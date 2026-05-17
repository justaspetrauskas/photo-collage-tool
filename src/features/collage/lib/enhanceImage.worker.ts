import { enhanceImageBuffer, type EnhancePreset } from './enhancementCore';

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
  const processedData = enhanceImageBuffer(imageData, preset);
  const processed = new ImageData(new Uint8ClampedArray(processedData.data), imageData.width, imageData.height);
  const response: WorkerResponse = { id, imageData: processed };
  self.postMessage(response);
};
