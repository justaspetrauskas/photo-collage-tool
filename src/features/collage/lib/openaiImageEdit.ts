import {
  ENHANCE_PRESET_LABELS,
  enhanceImageBuffer,
  type EnhanceOptions,
  type EnhancePreset,
} from './enhancementCore';

export { ENHANCE_PRESET_LABELS, type EnhanceOptions, type EnhancePreset } from './enhancementCore';

interface WorkerRequest {
  id: string;
  preset: EnhancePreset;
  imageData: ImageData;
}

interface WorkerResponse {
  id: string;
  imageData: ImageData;
}

let enhancementWorker: Worker | null = null;
const pendingWorkerRequests = new Map<
  string,
  { resolve: (value: ImageData) => void; reject: (reason?: unknown) => void }
>();
const WORKER_TIMEOUT_MS = 15000;

function getEnhancementWorker(): Worker | null {
  if (typeof Worker === 'undefined') {
    return null;
  }

  if (enhancementWorker) {
    return enhancementWorker;
  }

  enhancementWorker = new Worker(new URL('./enhanceImage.worker.ts', import.meta.url), { type: 'module' });
  enhancementWorker.onmessage = (event: MessageEvent<WorkerResponse>) => {
    const pending = pendingWorkerRequests.get(event.data.id);
    if (!pending) {
      return;
    }
    pendingWorkerRequests.delete(event.data.id);
    pending.resolve(event.data.imageData);
  };
  enhancementWorker.onerror = (error) => {
    for (const pending of pendingWorkerRequests.values()) {
      pending.reject(error);
    }
    pendingWorkerRequests.clear();
  };

  return enhancementWorker;
}

async function runEnhancementInWorker(
  imageData: ImageData,
  preset: EnhancePreset,
): Promise<ImageData | null> {
  const worker = getEnhancementWorker();
  if (!worker) {
    return null;
  }

  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return await new Promise<ImageData | null>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      pendingWorkerRequests.delete(id);
      resolve(null);
    }, WORKER_TIMEOUT_MS);

    pendingWorkerRequests.set(id, {
      resolve: (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      reject: (reason) => {
        window.clearTimeout(timeoutId);
        reject(reason);
      },
    });

    const payload: WorkerRequest = { id, preset, imageData };
    worker.postMessage(payload);
  }).catch(() => null);
}

/**
 * Deterministic, content-preserving enhancement using canvas pixels only.
 * Uses subtle adaptive adjustments to avoid altering scene identity.
 */
export async function enhanceImageWithAI(
  imageSrc: string,
  options: EnhanceOptions = {},
): Promise<string> {
  const preset = options.preset ?? 'lighting';
  const source = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = source.naturalWidth;
  canvas.height = source.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get canvas 2D context');
  ctx.drawImage(source, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const workerResult = await runEnhancementInWorker(imageData, preset);
  const processed =
    workerResult ??
    new ImageData(new Uint8ClampedArray(enhanceImageBuffer(imageData, preset).data), imageData.width, imageData.height);
  ctx.putImageData(processed, 0, 0);
  return canvas.toDataURL('image/png');
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
