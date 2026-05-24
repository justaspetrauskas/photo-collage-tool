import { rectanglesOverlap } from '../../../shared/math/geometry';

type Rect = { x: number; y: number; width: number; height: number };

export function elapsedTicks(currentTick: number, startTick: number): number {
  return currentTick >= startTick ? currentTick - startTick : 10000 - startTick + currentTick;
}

export function randomId(prefix = 'img'): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas export failed'));
        return;
      }
      resolve(blob);
    }, mimeType, quality);
  });
}

export function pageHasOverlap(page: { items: Rect[] }): boolean {
  for (let i = 0; i < page.items.length; i += 1) {
    const current = page.items[i];
    for (let j = i + 1; j < page.items.length; j += 1) {
      if (rectanglesOverlap(current, page.items[j])) {
        return true;
      }
    }
  }
  return false;
}

export function rectanglesTouchOrOverlap(a: Rect, b: Rect): boolean {
  const aRight = a.x + a.width;
  const bRight = b.x + b.width;
  const aBottom = a.y + a.height;
  const bBottom = b.y + b.height;

  return !(aRight < b.x || a.x > bRight || aBottom < b.y || a.y > bBottom);
}
