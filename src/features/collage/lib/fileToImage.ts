import type { LoadedImage } from '../model/types';

function blobToLoadedImage(blob: Blob, onErrorLabel: string): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      resolve({
        blob,
        src,
        image,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      });
    };

    image.onerror = () => reject(new Error(onErrorLabel));
    image.src = src;
  });
}

export function fileToImage(file: File): Promise<LoadedImage> {
  return blobToLoadedImage(file, `Failed to load image ${file.name}`);
}

export function blobToImage(blob: Blob): Promise<LoadedImage> {
  return blobToLoadedImage(blob, 'Failed to load saved image from local storage');
}
