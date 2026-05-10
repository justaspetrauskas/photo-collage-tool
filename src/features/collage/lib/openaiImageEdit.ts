const API_BASE = 'https://api.openai.com/v1';
const MODEL = 'gpt-image-1';

export type EnhancePreset = 'lighting' | 'contrast' | 'cinematic' | 'consistent';

const PRESET_PROMPTS: Record<EnhancePreset, string> = {
  lighting:
    'Improve the lighting of this photo: brighten shadows, recover highlights, and create a natural, well-exposed look. Preserve the original composition and subjects exactly.',
  contrast:
    'Enhance the color and contrast of this photo: increase vibrancy, deepen blacks, and lift midtones for a punchy, editorial look. Keep the original composition exactly.',
  cinematic:
    'Apply a cinematic color grade: teal shadows, warm highlights, lifted blacks. Make it feel like a film still. Preserve the original composition exactly.',
  consistent:
    'Normalize the color temperature, exposure, and white balance of this photo to match a neutral, clean editorial style. Preserve the original composition exactly.',
};

export interface EnhanceOptions {
  preset?: EnhancePreset;
  customPrompt?: string;
}

/**
 * Sends an image to OpenAI image edit API and returns a data URL of the result.
 */
export async function enhanceImageWithAI(
  imageSrc: string,
  options: EnhanceOptions = {},
): Promise<string> {
  const apiKey = (import.meta.env.VITE_OPENAI_API_KEY as string | undefined) ?? '';
  if (!apiKey || apiKey === 'sk-...') {
    throw new Error('Missing OpenAI API key. Add VITE_OPENAI_API_KEY to .env.local');
  }

  const prompt =
    options.customPrompt ?? PRESET_PROMPTS[options.preset ?? 'lighting'];

  const pngBlob = await imageSourceToPngBlob(imageSrc);

  const formData = new FormData();
  formData.append('model', MODEL);
  formData.append('image[]', pngBlob, 'image.png');
  formData.append('prompt', prompt);
  formData.append('n', '1');
  formData.append('size', 'auto');

  const response = await fetch(`${API_BASE}/images/edits`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: formData,
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(body.error?.message ?? `OpenAI error ${response.status}`);
  }

  const data = (await response.json()) as {
    data: Array<{ b64_json?: string; url?: string }>;
  };

  const item = data.data[0];
  if (item.b64_json) {
    return `data:image/png;base64,${item.b64_json}`;
  }
  if (item.url) {
    return item.url;
  }
  throw new Error('No image in OpenAI response');
}

/** Draws the source image onto a canvas and exports as PNG blob (max 1024px). */
async function imageSourceToPngBlob(src: string): Promise<Blob> {
  const img = await loadImage(src);
  const MAX = 1024;
  const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas 2D context');
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('canvas.toBlob returned null'));
    }, 'image/png');
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}

export const ENHANCE_PRESET_LABELS: Record<EnhancePreset, string> = {
  lighting: 'Lighting fix',
  contrast: 'Color & contrast',
  cinematic: 'Cinematic grade',
  consistent: 'Normalize (global)',
};
