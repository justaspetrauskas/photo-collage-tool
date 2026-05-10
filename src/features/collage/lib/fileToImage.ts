import type { LoadedImage } from '../model/types';

export function fileToImage(file: File): Promise<LoadedImage> {
  return new Promise((resolve, reject) => {
    const src = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      resolve({
        src,
        image,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
      });
    };

    image.onerror = () => reject(new Error(`Failed to load image ${file.name}`));
    image.src = src;
  });
}
