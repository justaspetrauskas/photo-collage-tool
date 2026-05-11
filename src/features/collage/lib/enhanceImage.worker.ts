type EnhancePreset = 'lighting' | 'contrast' | 'cinematic' | 'consistent';

interface WorkerRequest {
  id: string;
  preset: EnhancePreset;
  imageData: ImageData;
}

interface WorkerResponse {
  id: string;
  imageData: ImageData;
}

self.onmessage = (event: MessageEvent<WorkerRequest>) => {
  const { id, preset, imageData } = event.data;
  const processed = applyEnhancement(imageData, preset);
  const response: WorkerResponse = { id, imageData: processed };
  self.postMessage(response);
};

function applyEnhancement(imageData: ImageData, preset: EnhancePreset): ImageData {
  const data = new Uint8ClampedArray(imageData.data);
  const stats = analyzeImage(data);
  const settings = resolveSettings(preset, stats);

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    r = r + settings.exposure;
    g = g + settings.exposure;
    b = b + settings.exposure;

    r = (r - 128) * settings.contrast + 128;
    g = (g - 128) * settings.contrast + 128;
    b = (b - 128) * settings.contrast + 128;

    ({ r, g, b } = adjustSaturation(r, g, b, settings.saturation));

    r += settings.warmth;
    b -= settings.warmth * 0.75;

    if (isLikelySkinPixel(r, g, b)) {
      r += settings.skinWarmth;
      g += settings.skinLift * 0.75;
      b -= settings.skinWarmth * 0.45;
      ({ r, g, b } = adjustSaturation(r, g, b, settings.skinSaturation));
    }

    const lumaNorm = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const shadowWeight = smoothstep(0.75, 0.08, lumaNorm);
    const shadowBoost = settings.shadowLift * shadowWeight;
    r += shadowBoost;
    g += shadowBoost;
    b += shadowBoost;

    if (settings.gamma < 1) {
      r = 255 * Math.pow(clamp(r / 255, 0, 1), settings.gamma);
      g = 255 * Math.pow(clamp(g / 255, 0, 1), settings.gamma);
      b = 255 * Math.pow(clamp(b / 255, 0, 1), settings.gamma);
    }

    if (settings.highlightCompression > 0) {
      const compress = (value: number): number => {
        const norm = clamp(value / 255, 0, 1);
        const compressed = norm - settings.highlightCompression * norm * norm * 0.18;
        return compressed * 255;
      };
      r = compress(r);
      g = compress(g);
      b = compress(b);
    }

    if (settings.lowLightChromaDenoise > 0 && lumaNorm < 0.34) {
      ({ r, g, b } = adjustSaturation(r, g, b, 1 - settings.lowLightChromaDenoise));
    }

    data[i] = clampByte(r);
    data[i + 1] = clampByte(g);
    data[i + 2] = clampByte(b);
  }

  return new ImageData(data, imageData.width, imageData.height);
}

interface ImageStats {
  meanLuma: number;
  stdLuma: number;
  meanR: number;
  meanB: number;
  darkPixelRatio: number;
}

interface ResolvedSettings {
  exposure: number;
  contrast: number;
  saturation: number;
  warmth: number;
  skinLift: number;
  skinWarmth: number;
  skinSaturation: number;
  shadowLift: number;
  gamma: number;
  highlightCompression: number;
  lowLightChromaDenoise: number;
}

function analyzeImage(data: Uint8ClampedArray): ImageStats {
  const pxCount = data.length / 4;
  let sumL = 0;
  let sumL2 = 0;
  let sumR = 0;
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
    sumB += b;
    if (l < 0.25) {
      darkPx += 1;
    }
  }

  const meanLuma = sumL / pxCount;
  const variance = Math.max(0, sumL2 / pxCount - meanLuma * meanLuma);
  const stdLuma = Math.sqrt(variance);

  return {
    meanLuma,
    stdLuma,
    meanR: sumR / pxCount,
    meanB: sumB / pxCount,
    darkPixelRatio: darkPx / pxCount,
  };
}

function resolveSettings(preset: EnhancePreset, stats: ImageStats): ResolvedSettings {
  const targetLuma = preset === 'cinematic' ? 0.48 : 0.5;
  const targetContrast = preset === 'cinematic' ? 0.24 : 0.22;
  const isLowLightScene = stats.meanLuma < 0.42 || stats.darkPixelRatio > 0.42;

  const exposureBoost = isLowLightScene ? 5.5 : 0;
  const exposure = clamp((targetLuma - stats.meanLuma) * 70 + exposureBoost, -8, 16);
  const contrast = clamp(1 + (targetContrast - stats.stdLuma) * 0.75, 0.97, 1.1);

  const coolBias = clamp((stats.meanB - stats.meanR) * 0.04, -4, 8);
  const baseWarmth = preset === 'cinematic' ? 6 : preset === 'contrast' ? 3 : 4;
  const warmth = clamp(baseWarmth + coolBias, 1, 10);

  const saturation =
    preset === 'contrast' ? 1.05 : preset === 'cinematic' ? 1.04 : preset === 'consistent' ? 1.01 : 1.02;
  const skinLift = preset === 'consistent' ? 0.9 : 1.1;
  const skinWarmth = preset === 'cinematic' ? 1.6 : 1.1;
  const skinSaturation = preset === 'consistent' ? 1.004 : 1.01;
  const shadowLift = isLowLightScene ? clamp((0.52 - stats.meanLuma) * 62, 6, 18) : 2.2;
  const gamma = isLowLightScene ? clamp(0.9 - stats.darkPixelRatio * 0.12, 0.8, 0.92) : 0.98;
  const highlightCompression = isLowLightScene ? 0.22 : 0.08;
  const lowLightChromaDenoise = isLowLightScene ? clamp((stats.darkPixelRatio - 0.3) * 0.4, 0.03, 0.16) : 0;

  if (preset === 'consistent') {
    return {
      exposure,
      contrast: clamp(1 + (0.21 - stats.stdLuma) * 0.65, 0.98, 1.07),
      saturation,
      warmth: clamp(coolBias, -3, 4),
      skinLift,
      skinWarmth,
      skinSaturation,
      shadowLift: shadowLift * 0.75,
      gamma: clamp(gamma + 0.04, 0.85, 0.96),
      highlightCompression,
      lowLightChromaDenoise,
    };
  }

  return {
    exposure,
    contrast,
    saturation,
    warmth,
    skinLift,
    skinWarmth,
    skinSaturation,
    shadowLift,
    gamma,
    highlightCompression,
    lowLightChromaDenoise,
  };
}

function adjustSaturation(r: number, g: number, b: number, factor: number): { r: number; g: number; b: number } {
  const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return {
    r: luma + (r - luma) * factor,
    g: luma + (g - luma) * factor,
    b: luma + (b - luma) * factor,
  };
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
