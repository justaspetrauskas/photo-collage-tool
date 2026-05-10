import { MaxRectsBin } from 'maxrects-packer';
import { cmToPx } from './constants';
import type { BuildLayoutResult, ImageItem, ImageMetrics, PageLayout } from './types';

interface LayoutOptions {
  canvasWidthPx: number;
  canvasHeightPx: number;
  allowUpscale?: boolean;
  maxPages?: number;
  minContentWidthPx?: number;
  minContentHeightPx?: number;
  enableCompaction?: boolean;
}

interface BaseRect {
  id: string;
  naturalWidth: number;
  naturalHeight: number;
  baseContentWidthPx: number;
  baseContentHeightPx: number;
  frameThicknessPx: number;
}

interface ProjectedRect extends ImageMetrics {
  naturalWidth: number;
  naturalHeight: number;
}

function repackPageItems(
  pageWidthPx: number,
  pageHeightPx: number,
  items: PageLayout['items'],
): PageLayout['items'] | null {
  const bin = new MaxRectsBin(pageWidthPx, pageHeightPx, 0);
  const itemById = new Map(items.map((item) => [item.imageId, item]));

  for (const item of items) {
    const placed = bin.add(item.width, item.height, { id: item.imageId });
    if (!placed) {
      return null;
    }
  }

  return bin.rects.flatMap((rect) => {
    const item = itemById.get((rect.data as { id: string }).id);
    if (!item) {
      return [];
    }

    return [
      {
        ...item,
        x: rect.x,
        y: rect.y,
      },
    ];
  });
}

function compactPages(pages: PageLayout[]): PageLayout[] {
  if (pages.length <= 1) {
    return pages;
  }

  const workingPages = pages.map((page) => ({
    ...page,
    items: [...page.items],
  }));

  for (let pageIndex = 0; pageIndex < workingPages.length - 1; pageIndex += 1) {
    let currentItems = workingPages[pageIndex].items;
    let changed = true;

    while (changed) {
      changed = false;

      for (let fromPageIndex = pageIndex + 1; fromPageIndex < workingPages.length; fromPageIndex += 1) {
        const donorItems = [...workingPages[fromPageIndex].items];

        for (const candidate of donorItems) {
          const packed = repackPageItems(
            workingPages[pageIndex].widthPx,
            workingPages[pageIndex].heightPx,
            [...currentItems, candidate],
          );

          if (!packed) {
            continue;
          }

          currentItems = packed;
          workingPages[pageIndex].items = currentItems;
          workingPages[fromPageIndex].items = workingPages[fromPageIndex].items.filter(
            (item) => item.imageId !== candidate.imageId,
          );
          changed = true;
        }
      }
    }
  }

  return workingPages
    .filter((page) => page.items.length > 0)
    .map((page, index) => ({
      ...page,
      id: `page-${index + 1}`,
    }));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getContentBox(
  naturalWidth: number,
  naturalHeight: number,
  maxWidthCm: number,
  maxHeightCm: number,
  allowUpscale = false,
): { widthPx: number; heightPx: number } {
  const maxWidthPx = cmToPx(maxWidthCm);
  const maxHeightPx = cmToPx(maxHeightCm);

  const widthRatio = maxWidthPx / naturalWidth;
  const heightRatio = maxHeightPx / naturalHeight;
  const fitScale = Math.min(widthRatio, heightRatio);
  const scale = allowUpscale ? fitScale : Math.min(1, fitScale);

  return {
    widthPx: Math.round(naturalWidth * scale),
    heightPx: Math.round(naturalHeight * scale),
  };
}

function getCropMetrics(
  naturalWidth: number,
  naturalHeight: number,
  frameWidth: number,
  frameHeight: number,
): Pick<ImageMetrics, 'drawnImageWidthPx' | 'drawnImageHeightPx' | 'maxOffsetX' | 'maxOffsetY'> {
  const coverScale = Math.max(frameWidth / naturalWidth, frameHeight / naturalHeight);
  const drawnImageWidthPx = Math.round(naturalWidth * coverScale);
  const drawnImageHeightPx = Math.round(naturalHeight * coverScale);

  return {
    drawnImageWidthPx,
    drawnImageHeightPx,
    maxOffsetX: Math.max(0, drawnImageWidthPx - frameWidth),
    maxOffsetY: Math.max(0, drawnImageHeightPx - frameHeight),
  };
}

export function buildPaginatedLayout(images: ImageItem[], options: LayoutOptions): BuildLayoutResult {
  const {
    canvasWidthPx,
    canvasHeightPx,
    allowUpscale = false,
    maxPages = Number.POSITIVE_INFINITY,
    minContentWidthPx = 0,
    minContentHeightPx = 0,
    enableCompaction = true,
  } = options;

  const baseRects: BaseRect[] = images
    .map((image) => {
      const content = getContentBox(
        image.naturalWidth,
        image.naturalHeight,
        image.maxWidthCm,
        image.maxHeightCm,
        allowUpscale,
      );

      const frameThicknessPx = image.frameEnabled ? image.frameThicknessPx : 0;
      return {
        id: image.id,
        naturalWidth: image.naturalWidth,
        naturalHeight: image.naturalHeight,
        baseContentWidthPx: content.widthPx,
        baseContentHeightPx: content.heightPx,
        frameThicknessPx,
      };
    })
    .sort((a, b) => b.baseContentWidthPx * b.baseContentHeightPx - a.baseContentWidthPx * a.baseContentHeightPx);

  const MIN_PAGE_SCALE = 0.35;
  const SCALE_STEP = 0.05;

  function projectRects(rects: BaseRect[], scale: number): ProjectedRect[] {
    return rects
      .map((rect) => {
        const minWidthFloorPx = Math.min(rect.baseContentWidthPx, minContentWidthPx);
        const minHeightFloorPx = Math.min(rect.baseContentHeightPx, minContentHeightPx);
        const contentWidthPx = Math.max(minWidthFloorPx, Math.round(rect.baseContentWidthPx * scale));
        const contentHeightPx = Math.max(minHeightFloorPx, Math.round(rect.baseContentHeightPx * scale));
        const packedWidth = contentWidthPx + rect.frameThicknessPx * 2;
        const packedHeight = contentHeightPx + rect.frameThicknessPx * 2;
        const crop = getCropMetrics(
          rect.naturalWidth,
          rect.naturalHeight,
          contentWidthPx,
          contentHeightPx,
        );

        return {
          id: rect.id,
          naturalWidth: rect.naturalWidth,
          naturalHeight: rect.naturalHeight,
          packedWidth,
          packedHeight,
          contentWidthPx,
          contentHeightPx,
          frameThicknessPx: rect.frameThicknessPx,
          ...crop,
        };
      })
      .sort((a, b) => b.packedWidth * b.packedHeight - a.packedWidth * a.packedHeight);
  }

  const metricsById = new Map<string, ImageMetrics>();
  const pages: PageLayout[] = [];
  let remaining = baseRects;

  while (remaining.length > 0 && pages.length < maxPages) {
    let bestBin: MaxRectsBin | null = null;
    let bestProjected: ProjectedRect[] = [];
    let bestPlacedCount = 0;
    let bestPlacedArea = -1;

    for (let scale = 1; scale >= MIN_PAGE_SCALE; scale = Math.round((scale - SCALE_STEP) * 1000) / 1000) {
      const projected = projectRects(remaining, scale);
      const bin = new MaxRectsBin(canvasWidthPx, canvasHeightPx, 0);

      for (const rect of projected) {
        bin.add(rect.packedWidth, rect.packedHeight, { id: rect.id });
      }

      const placedCount = bin.rects.length;
      const placedArea = bin.rects.reduce((sum, rect) => sum + rect.width * rect.height, 0);

      if (
        placedCount > bestPlacedCount ||
        (placedCount === bestPlacedCount && placedArea > bestPlacedArea)
      ) {
        bestBin = bin;
        bestProjected = projected;
        bestPlacedCount = placedCount;
        bestPlacedArea = placedArea;
      }

      if (placedCount === projected.length) {
        break;
      }
    }

    if (!bestBin || bestBin.rects.length === 0) {
      break;
    }

    const projectedById = new Map(bestProjected.map((rect) => [rect.id, rect]));
    const placedIdSet = new Set<string>();

    const positionedItems = bestBin.rects.flatMap((rect) => {
      const source = projectedById.get((rect.data as { id: string }).id);
      if (!source) {
        return [];
      }
      placedIdSet.add(source.id);
      metricsById.set(source.id, source);
      return [
        {
          imageId: source.id,
          x: rect.x,
          y: rect.y,
          width: source.packedWidth,
          height: source.packedHeight,
          contentWidthPx: source.contentWidthPx,
          contentHeightPx: source.contentHeightPx,
          frameThicknessPx: source.frameThicknessPx,
          drawnImageWidthPx: source.drawnImageWidthPx,
          drawnImageHeightPx: source.drawnImageHeightPx,
          maxOffsetX: source.maxOffsetX,
          maxOffsetY: source.maxOffsetY,
        },
      ];
    });

    pages.push({
      id: `page-${pages.length + 1}`,
      widthPx: canvasWidthPx,
      heightPx: canvasHeightPx,
      items: positionedItems,
    });

    remaining = remaining.filter((rect) => !placedIdSet.has(rect.id));
  }

  const overflowImageIds = remaining.map((rect) => rect.id);
  const oversizedImageIds = remaining
    .filter((rect) => rect.baseContentWidthPx + rect.frameThicknessPx * 2 > canvasWidthPx || rect.baseContentHeightPx + rect.frameThicknessPx * 2 > canvasHeightPx)
    .map((rect) => rect.id);

  const compactedPages = enableCompaction ? compactPages(pages) : pages;

  return {
    pages: compactedPages,
    overflowImageIds,
    oversizedImageIds,
    imageMetrics: metricsById,
  };
}

export function clampOffsets(
  offsetX: number,
  offsetY: number,
  maxOffsetX: number,
  maxOffsetY: number,
): { offsetX: number; offsetY: number } {
  return {
    offsetX: clamp(offsetX, 0, maxOffsetX),
    offsetY: clamp(offsetY, 0, maxOffsetY),
  };
}
