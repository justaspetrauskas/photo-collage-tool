import { rectanglesOverlap } from '../../../shared/math/geometry';

type Rect = { x: number; y: number; width: number; height: number };
type ItemRectBase = Rect & {
  imageId: string;
  contentWidthPx: number;
  contentHeightPx: number;
  frameThicknessPx: number;
};

type PageLike<TItem extends ItemRectBase = ItemRectBase> = {
  widthPx: number;
  heightPx: number;
  items: TItem[];
};

export interface PreviewViewportTransform {
  dpr: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  rect: DOMRect;
}

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

export function resolvePreviewViewportTransform(
  viewport: HTMLElement,
  page: Pick<PageLike, 'widthPx' | 'heightPx'>,
): PreviewViewportTransform | null {
  const rect = viewport.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  const dpr = window.devicePixelRatio || 1;
  const backingWidth = Math.round(rect.width * dpr);
  const backingHeight = Math.round(rect.height * dpr);
  const margin = 28 * dpr;
  const availableWidth = backingWidth - margin * 2;
  const availableHeight = backingHeight - margin * 2;
  const scale = Math.min(availableWidth / page.widthPx, availableHeight / page.heightPx);
  if (!Number.isFinite(scale) || scale <= 0) {
    return null;
  }

  const offsetX = (backingWidth - page.widthPx * scale) / 2;
  const offsetY = (backingHeight - page.heightPx * scale) / 2;

  return {
    dpr,
    scale,
    offsetX,
    offsetY,
    rect,
  };
}

export function pagePointFromClientForViewport(
  clientX: number,
  clientY: number,
  viewport: HTMLElement,
  page: Pick<PageLike, 'widthPx' | 'heightPx'>,
  options: { allowOutsideCanvas?: boolean } = {},
): { x: number; y: number } | null {
  const transform = resolvePreviewViewportTransform(viewport, page);
  if (!transform) {
    return null;
  }

  const x = (clientX - transform.rect.left) * transform.dpr;
  const y = (clientY - transform.rect.top) * transform.dpr;
  const pageX = (x - transform.offsetX) / transform.scale;
  const pageY = (y - transform.offsetY) / transform.scale;

  if (
    !options.allowOutsideCanvas &&
    (pageX < 0 || pageY < 0 || pageX > page.widthPx || pageY > page.heightPx)
  ) {
    return null;
  }

  return { x: pageX, y: pageY };
}

export function computeHandleHitRadiusPx(
  viewport: HTMLElement,
  page: Pick<PageLike, 'widthPx' | 'heightPx'>,
  handleHitRadiusCssPx: number,
): number {
  const transform = resolvePreviewViewportTransform(viewport, page);
  if (!transform) {
    return 0;
  }
  return handleHitRadiusCssPx * transform.dpr / transform.scale;
}

export function findHitItemAtPoint<TItem extends ItemRectBase>(
  page: PageLike<TItem>,
  point: { x: number; y: number },
): TItem | null {
  for (let i = page.items.length - 1; i >= 0; i -= 1) {
    const placed = page.items[i];
    if (
      point.x >= placed.x &&
      point.x <= placed.x + placed.width &&
      point.y >= placed.y &&
      point.y <= placed.y + placed.height
    ) {
      return placed;
    }
  }
  return null;
}

export function findClosestSwapTargetAtPoint<TItem extends ItemRectBase>(
  page: PageLike<TItem>,
  pagePoint: { x: number; y: number },
  sourceImageId: string,
  maxSnapDistancePx = 44,
): TItem | null {
  let bestTarget: TItem | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const placed of page.items) {
    if (placed.imageId === sourceImageId) {
      continue;
    }

    const frame = placed.frameThicknessPx;
    const innerX = placed.x + frame;
    const innerY = placed.y + frame;
    const innerW = placed.contentWidthPx;
    const innerH = placed.contentHeightPx;

    const clampedX = Math.max(innerX, Math.min(pagePoint.x, innerX + innerW));
    const clampedY = Math.max(innerY, Math.min(pagePoint.y, innerY + innerH));
    const distance = Math.hypot(pagePoint.x - clampedX, pagePoint.y - clampedY);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestTarget = placed;
    }
  }

  if (!bestTarget) {
    return null;
  }

  return bestDistance <= maxSnapDistancePx ? bestTarget : null;
}
