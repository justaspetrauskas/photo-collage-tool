export type EnhancePreset = 'lighting' | 'contrast' | 'cinematic' | 'consistent';

export interface EnhanceOptions {
  preset?: EnhancePreset;
}

export interface ImageDataBuffer {
  data: Uint8ClampedArray;
  width: number;
  height: number;
}

interface ImageStats {
  meanLuma: number;
  stdLuma: number;
  meanR: number;
  meanG: number;
  meanB: number;
  darkPixelRatio: number;
}

interface ResolvedSettings {
  exposure: number;
  contrast: number;
  vibrance: number;
  redBalance: number;
  greenBalance: number;
  blueBalance: number;
  cinematicWarmth: number;
  shadowLift: number;
  gamma: number;
  highlightCompression: number;
  lowLightChromaDenoise: number;
}

export const ENHANCE_PRESET_LABELS: Record<EnhancePreset, string> = {
  lighting: 'Lighting fix',
  contrast: 'Tone & contrast',
  cinematic: 'Cinematic warm',
  consistent: 'Normalize (global)',
};

export function enhanceImageBuffer(imageData: ImageDataBuffer, preset: EnhancePreset): ImageDataBuffer {
  const data = new Uint8ClampedArray(imageData.data);
  const stats = analyzeImage(data);
  const settings = resolveSettings(preset, stats);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    r += settings.exposure;
    g += settings.exposure;
    b += settings.exposure;

    r = (r - 128) * settings.contrast + 128;
    g = (g - 128) * settings.contrast + 128;
    b = (b - 128) * settings.contrast + 128;

    const chroma = Math.max(r, g, b) - Math.min(r, g, b);
    const neutralWeight = 1 - smoothstep(12, 152, chroma);
    const skinProtection = isLikelySkinPixel(r, g, b) ? 0.45 : 1;
    const balanceWeight = neutralWeight * skinProtection;
    r += settings.redBalance * balanceWeight;
    g += settings.greenBalance * balanceWeight;
    b += settings.blueBalance * balanceWeight;

    ({ r, g, b } = adjustVibrance(r, g, b, settings.vibrance));

    const lumaNorm = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const shadowWeight = smoothstep(0.72, 0.12, lumaNorm);
    const shadowBoost = settings.shadowLift * shadowWeight;
    r += shadowBoost;
    g += shadowBoost;
    b += shadowBoost;

    if (settings.cinematicWarmth > 0) {
      const warmthWeight = 0.35 + shadowWeight * 0.65;
      r += settings.cinematicWarmth * 1.15 * warmthWeight;
      g += settings.cinematicWarmth * 0.35 * warmthWeight;
      b -= settings.cinematicWarmth * 0.95 * warmthWeight;
    }

    if (settings.gamma < 1) {
      r = 255 * Math.pow(clamp(r / 255, 0, 1), settings.gamma);
      g = 255 * Math.pow(clamp(g / 255, 0, 1), settings.gamma);
      b = 255 * Math.pow(clamp(b / 255, 0, 1), settings.gamma);
    }

    if (settings.highlightCompression > 0) {
      r = compressHighlights(r, settings.highlightCompression);
      g = compressHighlights(g, settings.highlightCompression);
      b = compressHighlights(b, settings.highlightCompression);
    }

    if (settings.lowLightChromaDenoise > 0 && lumaNorm < 0.34) {
      ({ r, g, b } = adjustSaturation(r, g, b, 1 - settings.lowLightChromaDenoise));
    }

    data[i] = clampByte(r);
    data[i + 1] = clampByte(g);
    data[i + 2] = clampByte(b);
  }

  return {
    data,
    width: imageData.width,
    height: imageData.height,
  };
}

function analyzeImage(data: Uint8ClampedArray): ImageStats {
  const pxCount = data.length / 4;
  let sumL = 0;
  let sumL2 = 0;
  let sumR = 0;
  let sumG = 0;
  let sumB = 0;
  let darkPx = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const l = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    sumL += l;
    sumL2 += l * l;
    sumR += r;
    sumG += g;
    sumB += b;
    if (l < 0.25) {
      darkPx += 1;
    }
  }

  const meanLuma = sumL / pxCount;
  const variance = Math.max(0, sumL2 / pxCount - meanLuma * meanLuma);

  return {
    meanLuma,
    stdLuma: Math.sqrt(variance),
    meanR: sumR / pxCount,
    meanG: sumG / pxCount,
    meanB: sumB / pxCount,
    darkPixelRatio: darkPx / pxCount,
  };
}

function resolveSettings(preset: EnhancePreset, stats: ImageStats): ResolvedSettings {
  const targetLuma = preset === 'cinematic' ? 0.47 : preset === 'contrast' ? 0.5 : 0.51;
  const targetContrast = preset === 'contrast' ? 0.26 : preset === 'cinematic' ? 0.24 : 0.22;
  const isLowLightScene = stats.meanLuma < 0.42 || stats.darkPixelRatio > 0.42;
  const avgChannel = (stats.meanR + stats.meanG + stats.meanB) / 3;
  const balanceStrength = preset === 'consistent' ? 0.22 : preset === 'lighting' ? 0.2 : preset === 'contrast' ? 0.1 : 0.05;
  const balanceLimit = preset === 'consistent' ? 9 : preset === 'lighting' ? 6 : 4;
  const castThreshold = preset === 'consistent' ? 3 : 6;
  const redDelta = avgChannel - stats.meanR;
  const greenDelta = avgChannel - stats.meanG;
  const blueDelta = avgChannel - stats.meanB;
  const castMagnitude = Math.max(Math.abs(redDelta), Math.abs(greenDelta), Math.abs(blueDelta));
  const shouldBalance = castMagnitude >= castThreshold;

  const exposureBoost = isLowLightScene ? 2.5 : 0;
  const exposure = clamp((targetLuma - stats.meanLuma) * 52 + exposureBoost, -6, 12);
  const contrast = clamp(1 + (targetContrast - stats.stdLuma) * 0.55, 0.985, preset === 'contrast' ? 1.12 : 1.08);
  const vibrance =
    preset === 'contrast' ? 0.1 : preset === 'cinematic' ? 0.065 : preset === 'consistent' ? 0.025 : 0.04;
  const cinematicWarmth = preset === 'cinematic' ? clamp(6 + Math.max(0, stats.meanB - stats.meanR) * 0.035, 5, 8) : 0;
  const shadowLift = isLowLightScene ? clamp((0.48 - stats.meanLuma) * 36, 2, 10) : 1.4;
  const gamma = isLowLightScene ? clamp(0.97 - stats.darkPixelRatio * 0.05, 0.91, 0.97) : 1;
  const highlightCompression = isLowLightScene ? 0.12 : 0.04;
  const lowLightChromaDenoise = isLowLightScene ? clamp((stats.darkPixelRatio - 0.32) * 0.25, 0.02, 0.08) : 0;

  return {
    exposure,
    contrast,
    vibrance,
    redBalance: shouldBalance ? clamp(redDelta * balanceStrength, -balanceLimit, balanceLimit) : 0,
    greenBalance: shouldBalance ? clamp(greenDelta * balanceStrength, -balanceLimit, balanceLimit) : 0,
    blueBalance: shouldBalance ? clamp(blueDelta * balanceStrength, -balanceLimit, balanceLimit) : 0,
    cinematicWarmth,
    shadowLift: preset === 'consistent' ? shadowLift * 0.72 : shadowLift,
    gamma,
    highlightCompression,
    lowLightChromaDenoise,
  };
}

function adjustVibrance(r: number, g: number, b: number, amount: number): { r: number; g: number; b: number } {
  if (amount <= 0) {
    return { r, g, b };
  }

  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  const saturationFactor = 1 + amount * (1 - clamp(chroma / 160, 0, 1));
  return adjustSaturation(r, g, b, saturationFactor);
}

function adjustSaturation(r: number, g: number, b: number, factor: number): { r: number; g: number; b: number } {
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return {
    r: luma + (r - luma) * factor,
    g: luma + (g - luma) * factor,
    b: luma + (b - luma) * factor,
  };
}

function compressHighlights(value: number, strength: number): number {
  const norm = clamp(value / 255, 0, 1);
  const compressed = norm - strength * norm * norm * 0.15;
  return compressed * 255;
}

function isLikelySkinPixel(r: number, g: number, b: number): boolean {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return cb >= 84 && cb <= 124 && cr >= 134 && cr <= 176 && r > 62 && g > 36 && b > 18 && max - min > 12;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function clampByte(value: number): number {
  return Math.round(clamp(value, 0, 255));
}
