import { MaxRectsBin } from 'maxrects-packer';
import { CM_PER_INCH, DPI, cmToPx, type LayoutPresetId } from './constants';
import type { BuildLayoutResult, ImageItem, ImageMetrics, PageLayout } from './types';
import { clampCropOffset, computeContentBox, computeCropMetrics } from '../../../shared/math';

interface LayoutOptions {
  canvasWidthPx: number;
  canvasHeightPx: number;
  allowUpscale?: boolean;
  maxPages?: number;
  minContentWidthPx?: number;
  minContentHeightPx?: number;
  enableCompaction?: boolean;
  layoutPresetId?: LayoutPresetId;
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

type CanvasOrientation = 'landscape' | 'portrait';

interface PresetSlot {
  x: number;
  y: number;
  width: number;
  height: number;
}

function pxToCm(px: number): number {
  return (px / DPI) * CM_PER_INCH;
}

function resolvePresetSlots(
  layoutPresetId: LayoutPresetId,
  canvasWidthPx: number,
  canvasHeightPx: number,
): PresetSlot[] | null {
  const orientation: CanvasOrientation = canvasWidthPx >= canvasHeightPx ? 'landscape' : 'portrait';
  const createSlot = (x: number, y: number, width: number, height: number): PresetSlot => ({ x, y, width, height });

  if (layoutPresetId === 'grid_2x2') {
    const w = canvasWidthPx / 2;
    const h = canvasHeightPx / 2;
    return [
      createSlot(0, 0, w, h),
      createSlot(w, 0, w, h),
      createSlot(0, h, w, h),
      createSlot(w, h, w, h),
    ];
  }

  if (layoutPresetId === 'grid_3x3') {
    const w = canvasWidthPx / 3;
    const h = canvasHeightPx / 3;
    const slots: PresetSlot[] = [];
    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        slots.push(createSlot(col * w, row * h, w, h));
      }
    }
    return slots;
  }

  if (layoutPresetId === 'story_strip') {
    const slotCount = 4;
    if (orientation === 'landscape') {
      const w = canvasWidthPx / slotCount;
      return Array.from({ length: slotCount }, (_, i) => createSlot(i * w, 0, w, canvasHeightPx));
    }
    const h = canvasHeightPx / slotCount;
    return Array.from({ length: slotCount }, (_, i) => createSlot(0, i * h, canvasWidthPx, h));
  }

  if (layoutPresetId === 'mosaic') {
    if (orientation === 'landscape') {
      const heroW = canvasWidthPx * 0.62;
      const sideW = canvasWidthPx - heroW;
      const sideH = canvasHeightPx / 4;
      return [
        createSlot(0, 0, heroW, canvasHeightPx),
        createSlot(heroW, 0, sideW, sideH),
        createSlot(heroW, sideH, sideW, sideH),
        createSlot(heroW, sideH * 2, sideW, sideH),
        createSlot(heroW, sideH * 3, sideW, sideH),
      ];
    }

    const heroH = canvasHeightPx * 0.58;
    const bottomH = canvasHeightPx - heroH;
    const bottomW = canvasWidthPx / 4;
    return [
      createSlot(0, 0, canvasWidthPx, heroH),
      createSlot(0, heroH, bottomW, bottomH),
      createSlot(bottomW, heroH, bottomW, bottomH),
      createSlot(bottomW * 2, heroH, bottomW, bottomH),
      createSlot(bottomW * 3, heroH, bottomW, bottomH),
    ];
  }

  if (layoutPresetId === 'hero_supporting') {
    if (orientation === 'landscape') {
      const heroH = canvasHeightPx * 0.68;
      const supportH = canvasHeightPx - heroH;
      const supportW = canvasWidthPx / 4;
      return [
        createSlot(0, 0, canvasWidthPx, heroH),
        createSlot(0, heroH, supportW, supportH),
        createSlot(supportW, heroH, supportW, supportH),
        createSlot(supportW * 2, heroH, supportW, supportH),
        createSlot(supportW * 3, heroH, supportW, supportH),
      ];
    }

    const heroH = canvasHeightPx * 0.64;
    const bottomH = canvasHeightPx - heroH;
    const bottomW = canvasWidthPx / 2;
    const rowH = bottomH / 2;
    return [
      createSlot(0, 0, canvasWidthPx, heroH),
      createSlot(0, heroH, bottomW, rowH),
      createSlot(bottomW, heroH, bottomW, rowH),
      createSlot(0, heroH + rowH, bottomW, rowH),
      createSlot(bottomW, heroH + rowH, bottomW, rowH),
    ];
  }

  return null;
}

function buildPresetLayout(
  images: ImageItem[],
  options: LayoutOptions,
): BuildLayoutResult | null {
  const {
    canvasWidthPx,
    canvasHeightPx,
    minContentWidthPx = 0,
    minContentHeightPx = 0,
    layoutPresetId = 'auto',
  } = options;

  if (layoutPresetId === 'auto') {
    return null;
  }

  const slots = resolvePresetSlots(layoutPresetId, canvasWidthPx, canvasHeightPx);
  if (!slots || images.length > slots.length) {
    return null;
  }

  const orderedImages =
    layoutPresetId === 'mosaic' || layoutPresetId === 'hero_supporting'
      ? [...images].sort((a, b) => b.naturalWidth * b.naturalHeight - a.naturalWidth * a.naturalHeight)
      : [...images];

  const metricsById = new Map<string, ImageMetrics>();
  const items: PageLayout['items'] = [];

  for (let index = 0; index < orderedImages.length; index += 1) {
    const image = orderedImages[index];
    const slot = slots[index];
    const frameThicknessPx = image.frameEnabled ? image.frameThicknessPx : 0;
    const slotContentWidthPx = Math.floor(slot.width - frameThicknessPx * 2);
    const slotContentHeightPx = Math.floor(slot.height - frameThicknessPx * 2);

    if (slotContentWidthPx <= 0 || slotContentHeightPx <= 0) {
      return null;
    }

    const content = computeContentBox(
      image.naturalWidth,
      image.naturalHeight,
      pxToCm(slotContentWidthPx),
      pxToCm(slotContentHeightPx),
      true,
    );

    if (
      content.widthPx < minContentWidthPx ||
      content.heightPx < minContentHeightPx ||
      content.widthPx > slotContentWidthPx ||
      content.heightPx > slotContentHeightPx
    ) {
      return null;
    }

    const crop = computeCropMetrics(
      image.naturalWidth,
      image.naturalHeight,
      content.widthPx,
      content.heightPx,
    );
    const packedWidth = content.widthPx + frameThicknessPx * 2;
    const packedHeight = content.heightPx + frameThicknessPx * 2;
    const x = Math.round(slot.x + (slot.width - packedWidth) / 2);
    const y = Math.round(slot.y + (slot.height - packedHeight) / 2);

    if (
      x < 0 ||
      y < 0 ||
      x + packedWidth > canvasWidthPx ||
      y + packedHeight > canvasHeightPx
    ) {
      return null;
    }

    metricsById.set(image.id, {
      id: image.id,
      packedWidth,
      packedHeight,
      contentWidthPx: content.widthPx,
      contentHeightPx: content.heightPx,
      frameThicknessPx,
      drawnImageWidthPx: crop.drawnImageWidthPx,
      drawnImageHeightPx: crop.drawnImageHeightPx,
      maxOffsetX: crop.maxOffsetX,
      maxOffsetY: crop.maxOffsetY,
    });

    items.push({
      imageId: image.id,
      x,
      y,
      width: packedWidth,
      height: packedHeight,
      contentWidthPx: content.widthPx,
      contentHeightPx: content.heightPx,
      frameThicknessPx,
      drawnImageWidthPx: crop.drawnImageWidthPx,
      drawnImageHeightPx: crop.drawnImageHeightPx,
      maxOffsetX: crop.maxOffsetX,
      maxOffsetY: crop.maxOffsetY,
    });
  }

  return {
    pages: [
      {
        id: 'page-1',
        widthPx: canvasWidthPx,
        heightPx: canvasHeightPx,
        items,
      },
    ],
    overflowImageIds: [],
    oversizedImageIds: [],
    imageMetrics: metricsById,
  };
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

function enforceNoOverlap(pages: PageLayout[]): PageLayout[] {
  if (!pages.length) {
    return pages;
  }

  const pageWidthPx = pages[0].widthPx;
  const pageHeightPx = pages[0].heightPx;
  const queue = pages.flatMap((page) => page.items);
  const normalizedPages: PageLayout[] = [];

  let remaining = queue;
  while (remaining.length > 0) {
    const bin = new MaxRectsBin(pageWidthPx, pageHeightPx, 0);
    const nextRemaining: PageLayout['items'] = [];
    const pageItems: PageLayout['items'] = [];

    for (const item of remaining) {
      const placed = bin.add(item.width, item.height, { id: item.imageId });
      if (!placed) {
        nextRemaining.push(item);
        continue;
      }

      pageItems.push({
        ...item,
        x: placed.x,
        y: placed.y,
      });
    }

    if (pageItems.length === 0) {
      break;
    }

    normalizedPages.push({
      id: `page-${normalizedPages.length + 1}`,
      widthPx: pageWidthPx,
      heightPx: pageHeightPx,
      items: pageItems,
    });

    remaining = nextRemaining;
  }

  return normalizedPages;
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
    layoutPresetId = 'auto',
  } = options;

  if (maxPages >= 1) {
    const presetResult = buildPresetLayout(images, {
      canvasWidthPx,
      canvasHeightPx,
      allowUpscale,
      maxPages,
      minContentWidthPx,
      minContentHeightPx,
      enableCompaction,
      layoutPresetId,
    });

    if (presetResult) {
      return presetResult;
    }
  }

  const baseRects: BaseRect[] = images
    .map((image) => {
      const content = computeContentBox(
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
          const crop = computeCropMetrics(
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
  const safePages = enforceNoOverlap(compactedPages);

  return {
    pages: safePages,
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
  return clampCropOffset(offsetX, offsetY, maxOffsetX, maxOffsetY);
}
