import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, MouseEvent } from 'react';
import {
  CANVAS_SIZE_PX,
  DEFAULT_FRAME_MM,
  DEFAULT_GRID_SPACING_CM,
  DEFAULT_MAX_IMAGE_CM,
  DEFAULT_MIN_IMAGE_CM,
  cmToPx,
  mmToPx,
} from '../model/constants';
import { buildPaginatedLayout, clampOffsets } from '../model/layoutEngine';
import { drawPagePreview, renderPageToExportCanvas } from '../model/renderEngine';
import type {
  ImageItem,
  InteractionMode,
  PaginationMode,
  PersistedEditorSnapshot,
  PositionedImage,
  PreviewTransform,
} from '../model/types';
import { blobToImage, fileToImage } from '../lib/fileToImage';
import { clearSnapshot, loadSnapshot, saveSnapshot } from '../lib/persistence';

interface CropDragState {
  imageId: string;
  startX: number;
  startY: number;
  baseOffsetX: number;
  baseOffsetY: number;
  maxOffsetX: number;
  maxOffsetY: number;
}

interface ResizeDragState {
  imageId: string;
  startX: number;
  startY: number;
  baseMaxWidthCm: number;
  baseMaxHeightCm: number;
  baseX: number;
  baseY: number;
  baseWidth: number;
  baseHeight: number;
}

interface ReplaceDragState {
  sourceImageId: string;
}

interface MoveDragState {
  imageId: string;
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
}

function overlaps(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function computeContentBox(
  naturalWidth: number,
  naturalHeight: number,
  maxWidthCm: number,
  maxHeightCm: number,
): { widthPx: number; heightPx: number } {
  const maxWidthPx = cmToPx(maxWidthCm);
  const maxHeightPx = cmToPx(maxHeightCm);
  const widthRatio = maxWidthPx / naturalWidth;
  const heightRatio = maxHeightPx / naturalHeight;
  const fitScale = Math.min(widthRatio, heightRatio);

  return {
    widthPx: Math.round(naturalWidth * fitScale),
    heightPx: Math.round(naturalHeight * fitScale),
  };
}

function computeCropMetrics(
  naturalWidth: number,
  naturalHeight: number,
  frameWidth: number,
  frameHeight: number,
): { drawnImageWidthPx: number; drawnImageHeightPx: number; maxOffsetX: number; maxOffsetY: number } {
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

function rectanglesOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function isInsideCanvas(rect: { x: number; y: number; width: number; height: number }): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= CANVAS_SIZE_PX && rect.y + rect.height <= CANVAS_SIZE_PX;
}

function resolvePushLayout(
  items: PositionedImage[],
  anchorIndex: number,
  anchorRect: { x: number; y: number; width: number; height: number },
  preferredAxis: 'x' | 'y',
): PositionedImage[] | null {
  const nextItems = items.map((item, index) => {
    if (index !== anchorIndex) {
      return { ...item };
    }

    return {
      ...item,
      x: anchorRect.x,
      y: anchorRect.y,
      width: anchorRect.width,
      height: anchorRect.height,
    };
  });

  const queue: number[] = [anchorIndex];
  const queued = new Set<number>([anchorIndex]);
  let guard = 0;

  while (queue.length) {
    const currentIndex = queue.shift()!;
    queued.delete(currentIndex);
    const current = nextItems[currentIndex];

    for (let otherIndex = 0; otherIndex < nextItems.length; otherIndex += 1) {
      if (otherIndex === currentIndex) {
        continue;
      }

      const other = nextItems[otherIndex];
      if (!overlaps(current, other)) {
        continue;
      }

      const pushRight = current.x + current.width - other.x;
      const pushDown = current.y + current.height - other.y;

      const rightCandidate = {
        ...other,
        x: other.x + pushRight,
      };
      const downCandidate = {
        ...other,
        y: other.y + pushDown,
      };

      const rightFits = isInsideCanvas(rightCandidate);
      const downFits = isInsideCanvas(downCandidate);

      if (!rightFits && !downFits) {
        return null;
      }

      const useRight = preferredAxis === 'x'
        ? rightFits || !downFits
        : rightFits && !downFits;
      nextItems[otherIndex] = useRight ? rightCandidate : downCandidate;

      if (!queued.has(otherIndex)) {
        queue.push(otherIndex);
        queued.add(otherIndex);
      }
    }

    guard += 1;
    if (guard > 2000) {
      return null;
    }
  }

  for (let i = 0; i < nextItems.length; i += 1) {
    if (!isInsideCanvas(nextItems[i])) {
      return null;
    }

    for (let j = i + 1; j < nextItems.length; j += 1) {
      if (overlaps(nextItems[i], nextItems[j])) {
        return null;
      }
    }
  }

  return nextItems;
}

function pageHasOverlap(page: { items: Array<{ x: number; y: number; width: number; height: number }> }): boolean {
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

function randomId(prefix = 'img'): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

export function useCollageEditor() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pages, setPages] = useState<Array<{ id: string; widthPx: number; heightPx: number; items: PositionedImage[] }>>([]);
  const [maxImageCm, setMaxImageCm] = useState<number>(DEFAULT_MAX_IMAGE_CM);
  const [minImageCm, setMinImageCm] = useState<number>(DEFAULT_MIN_IMAGE_CM);
  const [frameMm, setFrameMm] = useState<number>(DEFAULT_FRAME_MM);
  const [gridModeEnabled, setGridModeEnabled] = useState<boolean>(false);
  const [autoCompactPages, setAutoCompactPages] = useState<boolean>(true);
  const [paginationMode, setPaginationMode] = useState<PaginationMode>('auto');
  const [interactionMode, setInteractionMode] = useState<InteractionMode>('crop');
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [assistedPageCount, setAssistedPageCount] = useState<number>(1);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [overflowImageIds, setOverflowImageIds] = useState<string[]>([]);
  const [oversizedImageIds, setOversizedImageIds] = useState<string[]>([]);
  const [resizeLimitNotice, setResizeLimitNotice] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [replaceAnimationTick, setReplaceAnimationTick] = useState<number>(0);
  const [moveOutsideCanvas, setMoveOutsideCanvas] = useState<boolean>(false);
  const [resizeCurrentDimensions, setResizeCurrentDimensions] = useState<{ width: number; height: number } | null>(null);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewTransformRef = useRef<PreviewTransform | null>(null);
  const cropDragRef = useRef<CropDragState | null>(null);
  const resizeDragRef = useRef<ResizeDragState | null>(null);
  const replaceDragRef = useRef<ReplaceDragState | null>(null);
  const moveDragRef = useRef<MoveDragState | null>(null);
  const knownImageSrcsRef = useRef<Set<string>>(new Set());

  const itemById = useMemo(() => new Map(images.map((img) => [img.id, img])), [images]);
  const imageById = useMemo(() => new Map(images.map((img) => [img.id, img.bitmap])), [images]);
  const selectedPage = pages[selectedPageIndex] ?? null;
  const selectedImage = selectedImageId ? itemById.get(selectedImageId) ?? null : null;

  useEffect(() => {
    if (!(dragActive && interactionMode === 'replace')) {
      return;
    }

    let frameId = 0;
    const animate = () => {
      setReplaceAnimationTick((tick) => (tick + 1) % 10000);
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [dragActive, interactionMode]);

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !selectedPage) {
      return;
    }

    previewTransformRef.current = drawPagePreview(canvas, selectedPage, itemById, imageById, {
      gridEnabled: gridModeEnabled,
      gridSpacingPx: cmToPx(DEFAULT_GRID_SPACING_CM),
      selectedImageId,
      hoveredImageId,
      interactionMode,
      dragActive,
      moveOutsideCanvas,
      resizeCurrentDimensions,
      animationTimeMs: replaceAnimationTick,
    });
  }, [selectedPage, itemById, imageById, gridModeEnabled, selectedImageId, hoveredImageId, interactionMode, dragActive, moveOutsideCanvas, resizeCurrentDimensions, replaceAnimationTick]);

  useEffect(() => {
    const currentSrcs = new Set(images.map((image) => image.src));
    for (const previousSrc of knownImageSrcsRef.current) {
      if (!currentSrcs.has(previousSrc)) {
        URL.revokeObjectURL(previousSrc);
      }
    }
    knownImageSrcsRef.current = currentSrcs;
  }, [images]);

  useEffect(() => {
    return () => {
      for (const src of knownImageSrcsRef.current) {
        URL.revokeObjectURL(src);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrateFromIndexedDb() {
      try {
        const snapshot = await loadSnapshot();
        if (!snapshot || cancelled) {
          return;
        }

        const hydratedImages = await Promise.all(
          snapshot.images.map(async (savedImage) => {
            const restored = await blobToImage(savedImage.sourceBlob);
            return {
              ...savedImage,
              src: restored.src,
              bitmap: restored.image,
              sourceBlob: restored.blob,
            } satisfies ImageItem;
          }),
        );

        if (cancelled) {
          for (const image of hydratedImages) {
            URL.revokeObjectURL(image.src);
          }
          return;
        }

        setImages(hydratedImages);
        setPages(snapshot.pages);
        setOverflowImageIds(snapshot.overflowImageIds);
        setOversizedImageIds(snapshot.oversizedImageIds);
        setMaxImageCm(snapshot.settings.maxImageCm);
        setMinImageCm(snapshot.settings.minImageCm);
        setFrameMm(snapshot.settings.frameMm);
        setGridModeEnabled(snapshot.settings.gridModeEnabled);
        setAutoCompactPages(snapshot.settings.autoCompactPages ?? true);
        setPaginationMode(snapshot.settings.paginationMode);
        setInteractionMode(snapshot.settings.interactionMode ?? 'crop');
        setAssistedPageCount(snapshot.settings.assistedPageCount);
        setSelectedPageIndex(snapshot.settings.selectedPageIndex);
      } catch {
        setError('Could not restore saved project state from local storage.');
      } finally {
        if (!cancelled) {
          setIsHydrated(true);
        }
      }
    }

    void hydrateFromIndexedDb();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      const snapshot: PersistedEditorSnapshot = {
        version: 1,
        savedAt: Date.now(),
        settings: {
          maxImageCm,
          minImageCm,
          frameMm,
          gridModeEnabled,
          autoCompactPages,
          paginationMode,
          interactionMode,
          assistedPageCount,
          selectedPageIndex,
        },
        pages,
        overflowImageIds,
        oversizedImageIds,
        images: images.map((image) => ({
          id: image.id,
          fileName: image.fileName,
          sourceBlob: image.sourceBlob,
          naturalWidth: image.naturalWidth,
          naturalHeight: image.naturalHeight,
          maxWidthCm: image.maxWidthCm,
          maxHeightCm: image.maxHeightCm,
          frameEnabled: image.frameEnabled,
          frameThicknessPx: image.frameThicknessPx,
          renderWidthPx: image.renderWidthPx,
          renderHeightPx: image.renderHeightPx,
          offsetX: image.offsetX,
          offsetY: image.offsetY,
          cropMaxOffsetX: image.cropMaxOffsetX,
          cropMaxOffsetY: image.cropMaxOffsetY,
        })),
      };

      void saveSnapshot(snapshot);
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [
    isHydrated,
    maxImageCm,
    minImageCm,
    frameMm,
    gridModeEnabled,
    autoCompactPages,
    paginationMode,
    interactionMode,
    assistedPageCount,
    selectedPageIndex,
    pages,
    overflowImageIds,
    oversizedImageIds,
    images,
  ]);

  useEffect(() => {
    if (!isHydrated || !images.length || !pages.length) {
      return;
    }

    if (!pages.some(pageHasOverlap)) {
      return;
    }

    regenerateLayout(resolveMaxPages(), true, images);
  }, [isHydrated, images, pages, paginationMode, assistedPageCount, minImageCm, autoCompactPages]);

  async function onUploadFiles(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []);
    if (!files.length) {
      return;
    }

    try {
      const loaded = await Promise.all(files.map((file) => fileToImage(file)));
      const next: ImageItem[] = loaded.map((entry, index) => ({
        id: randomId(`${Date.now()}-${index}`),
        fileName: files[index].name,
        sourceBlob: entry.blob,
        src: entry.src,
        bitmap: entry.image,
        naturalWidth: entry.naturalWidth,
        naturalHeight: entry.naturalHeight,
        maxWidthCm: maxImageCm,
        maxHeightCm: maxImageCm,
        frameEnabled: true,
        frameThicknessPx: mmToPx(frameMm),
        renderWidthPx: 0,
        renderHeightPx: 0,
        offsetX: 0,
        offsetY: 0,
        cropMaxOffsetX: 0,
        cropMaxOffsetY: 0,
      }));

      setImages((current) => [...current, ...next]);
      setError('');
    } catch {
      setError('Some images failed to load. Please retry with valid JPG, PNG, or WebP files.');
    } finally {
      event.target.value = '';
    }
  }

  function applyGlobalSettings(): void {
    setImages((current) =>
      current.map((image) => ({
        ...image,
        maxWidthCm: maxImageCm,
        maxHeightCm: maxImageCm,
        frameThicknessPx: mmToPx(frameMm),
      })),
    );
  }

  function focusImageOnCanvas(imageId: string): void {
    setSelectedImageId(imageId);
    setHoveredImageId(imageId);

    if (!pages.length) {
      return;
    }

    const pageIndex = pages.findIndex((page) => page.items.some((item) => item.imageId === imageId));
    if (pageIndex >= 0) {
      setSelectedPageIndex(pageIndex);
    }
  }

  function updateImage(id: string, patch: Partial<ImageItem>): void {
    focusImageOnCanvas(id);
    setImages((current) => current.map((image) => (image.id === id ? { ...image, ...patch } : image)));
  }

  function swapImagesOnSelectedPage(sourceImageId: string, targetImageId: string): void {
    if (sourceImageId === targetImageId || !selectedPage) {
      return;
    }

    const sourceIndex = selectedPage.items.findIndex((item) => item.imageId === sourceImageId);
    const targetIndex = selectedPage.items.findIndex((item) => item.imageId === targetImageId);
    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }

    const sourceSlot = selectedPage.items[sourceIndex];
    const targetSlot = selectedPage.items[targetIndex];

    const sourceCandidate = {
      ...sourceSlot,
      x: targetSlot.x,
      y: targetSlot.y,
    };
    const targetCandidate = {
      ...targetSlot,
      x: sourceSlot.x,
      y: sourceSlot.y,
    };

    const otherItems = selectedPage.items.filter((_, index) => index !== sourceIndex && index !== targetIndex);
    const overlapsOthers = otherItems.some((item) => overlaps(sourceCandidate, item) || overlaps(targetCandidate, item));
    const overlapsEachOther = overlaps(sourceCandidate, targetCandidate);

    if (overlapsOthers || overlapsEachOther) {
      setError('Cannot replace these two images because their constrained sizes would overlap nearby images.');
      return;
    }

    setPages((currentPages) => currentPages.map((page, pageIndex) => {
      if (pageIndex !== selectedPageIndex) {
        return page;
      }

      const nextItems = [...page.items];
      nextItems[sourceIndex] = {
        ...nextItems[sourceIndex],
        x: targetSlot.x,
        y: targetSlot.y,
      };
      nextItems[targetIndex] = {
        ...nextItems[targetIndex],
        x: sourceSlot.x,
        y: sourceSlot.y,
      };

      return {
        ...page,
        items: nextItems,
      };
    }));

    setError('');
    setSelectedImageId(sourceImageId);
    setHoveredImageId(targetImageId);
  }

  function resolveMaxPages(overrideAssistedCount?: number): number {
    if (paginationMode === 'auto') {
      return Number.POSITIVE_INFINITY;
    }
    return overrideAssistedCount ?? assistedPageCount;
  }

  function regenerateLayout(
    overrideAssistedCount: number,
    preservePageSelection = false,
    sourceImages: ImageItem[] = images,
  ): void {
    if (!sourceImages.length) {
      setPages([]);
      setOverflowImageIds([]);
      setOversizedImageIds([]);
      return;
    }

    const result = buildPaginatedLayout(sourceImages, {
      canvasWidthPx: CANVAS_SIZE_PX,
      canvasHeightPx: CANVAS_SIZE_PX,
      allowUpscale: true,
      maxPages: paginationMode === 'auto' ? Number.POSITIVE_INFINITY : overrideAssistedCount,
      minContentWidthPx: cmToPx(minImageCm),
      minContentHeightPx: cmToPx(minImageCm),
      enableCompaction: autoCompactPages,
    });

    const metricsById = result.imageMetrics;
    const nextImages = sourceImages.map((image) => {
        const metrics = metricsById.get(image.id);
        if (!metrics) {
          return {
            ...image,
            cropMaxOffsetX: 0,
            cropMaxOffsetY: 0,
          };
        }

        const clamped = clampOffsets(image.offsetX, image.offsetY, metrics.maxOffsetX, metrics.maxOffsetY);
        return {
          ...image,
          renderWidthPx: metrics.contentWidthPx,
          renderHeightPx: metrics.contentHeightPx,
          offsetX: clamped.offsetX,
          offsetY: clamped.offsetY,
          cropMaxOffsetX: metrics.maxOffsetX,
          cropMaxOffsetY: metrics.maxOffsetY,
        };
      });

    setImages(nextImages);

    setPages(result.pages);
    setOverflowImageIds(result.overflowImageIds);
    setOversizedImageIds(result.oversizedImageIds);
    if (preservePageSelection) {
      setSelectedPageIndex((current) => Math.max(0, Math.min(current, Math.max(0, result.pages.length - 1))));
    } else {
      setSelectedPageIndex(0);
    }
  }

  function onGenerateLayout(): void {
    setAssistedPageCount(1);
    regenerateLayout(1);
  }

  function onCreateNextPage(): void {
    const nextCount = assistedPageCount + 1;
    setAssistedPageCount(nextCount);
    regenerateLayout(nextCount);
  }

  function pagePointFromMouse(event: MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    const canvas = previewCanvasRef.current;
    const transform = previewTransformRef.current;
    if (!canvas || !transform || !selectedPage) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const x = (event.clientX - rect.left) * transform.dpr;
    const y = (event.clientY - rect.top) * transform.dpr;

    const pageX = (x - transform.offsetX) / transform.scale;
    const pageY = (y - transform.offsetY) / transform.scale;

    if (pageX < 0 || pageY < 0 || pageX > selectedPage.widthPx || pageY > selectedPage.heightPx) {
      return null;
    }

    return { x: pageX, y: pageY };
  }

  function findHitItem(pagePoint: { x: number; y: number }): PositionedImage | null {
    if (!selectedPage) {
      return null;
    }

    for (let i = selectedPage.items.length - 1; i >= 0; i -= 1) {
      const placed = selectedPage.items[i];
      const frame = placed.frameThicknessPx;
      const innerX = placed.x + frame;
      const innerY = placed.y + frame;
      if (
        pagePoint.x >= innerX &&
        pagePoint.x <= innerX + placed.contentWidthPx &&
        pagePoint.y >= innerY &&
        pagePoint.y <= innerY + placed.contentHeightPx
      ) {
        return placed;
      }
    }

    return null;
  }

  function onCanvasMouseDown(event: MouseEvent<HTMLCanvasElement>): void {
    const point = pagePointFromMouse(event);
    if (!point) {
      setSelectedImageId(null);
      setHoveredImageId(null);
      setDragActive(false);
      return;
    }

    const hit = findHitItem(point);
    if (!hit) {
      setSelectedImageId(null);
      setHoveredImageId(null);
      setDragActive(false);
      return;
    }

    setSelectedImageId(hit.imageId);
    setHoveredImageId(hit.imageId);

    const item = itemById.get(hit.imageId);
    if (!item) {
      return;
    }

    if (interactionMode === 'crop') {
      setDragActive(true);
      cropDragRef.current = {
        imageId: hit.imageId,
        startX: point.x,
        startY: point.y,
        baseOffsetX: item.offsetX,
        baseOffsetY: item.offsetY,
        maxOffsetX: hit.maxOffsetX,
        maxOffsetY: hit.maxOffsetY,
      };
      resizeDragRef.current = null;
      replaceDragRef.current = null;
      moveDragRef.current = null;
      return;
    }

    if (interactionMode === 'replace') {
      replaceDragRef.current = {
        sourceImageId: hit.imageId,
      };
      cropDragRef.current = null;
      resizeDragRef.current = null;
      moveDragRef.current = null;
      setDragActive(true);
      return;
    }

    if (interactionMode === 'move') {
      moveDragRef.current = {
        imageId: hit.imageId,
        startX: point.x,
        startY: point.y,
        baseX: hit.x,
        baseY: hit.y,
      };
      cropDragRef.current = null;
      resizeDragRef.current = null;
      replaceDragRef.current = null;
      setDragActive(true);
      setMoveOutsideCanvas(false);
      return;
    }

    resizeDragRef.current = {
      imageId: hit.imageId,
      startX: point.x,
      startY: point.y,
      baseMaxWidthCm: item.maxWidthCm,
      baseMaxHeightCm: item.maxHeightCm,
      baseX: hit.x,
      baseY: hit.y,
      baseWidth: hit.width,
      baseHeight: hit.height,
    };
    cropDragRef.current = null;
    replaceDragRef.current = null;
    moveDragRef.current = null;
    setDragActive(true);
  }

  function onCanvasMouseMove(event: MouseEvent<HTMLCanvasElement>): void {
    const point = pagePointFromMouse(event);
    if (!point) {
      if (!dragActive && hoveredImageId !== null) {
        setHoveredImageId(null);
      }
      return;
    }

    const hit = findHitItem(point);
    if (!dragActive) {
      setHoveredImageId(hit?.imageId ?? null);
    }

    if (interactionMode === 'crop' && cropDragRef.current) {
      const drag = cropDragRef.current;
      const deltaX = point.x - drag.startX;
      const deltaY = point.y - drag.startY;

      const clamped = clampOffsets(
        drag.baseOffsetX - deltaX,
        drag.baseOffsetY - deltaY,
        drag.maxOffsetX,
        drag.maxOffsetY,
      );

      updateImage(drag.imageId, {
        offsetX: Math.round(clamped.offsetX),
        offsetY: Math.round(clamped.offsetY),
      });
      return;
    }

    if (interactionMode === 'replace' && replaceDragRef.current) {
      setHoveredImageId(hit?.imageId ?? null);
      return;
    }

    if (interactionMode === 'move' && moveDragRef.current) {
      const drag = moveDragRef.current;
      const deltaX = point.x - drag.startX;
      const deltaY = point.y - drag.startY;
      const nextX = drag.baseX + deltaX;
      const nextY = drag.baseY + deltaY;

      const pageIndex = pages.findIndex((page) => page.items.some((item) => item.imageId === drag.imageId));
      if (pageIndex === -1) {
        return;
      }

      const page = pages[pageIndex];
      const itemIndex = page.items.findIndex((item) => item.imageId === drag.imageId);
      if (itemIndex === -1) {
        return;
      }

      const item = page.items[itemIndex];
      const isOutsideCanvas =
        nextX < 0 || nextY < 0 || nextX + item.width > CANVAS_SIZE_PX || nextY + item.height > CANVAS_SIZE_PX;

      setMoveOutsideCanvas(isOutsideCanvas);

      if (!isOutsideCanvas) {
        setPages((currentPages) =>
          currentPages.map((currentPage, index) => {
            if (index !== pageIndex) {
              return currentPage;
            }

            const nextItems = [...currentPage.items];
            nextItems[itemIndex] = {
              ...nextItems[itemIndex],
              x: nextX,
              y: nextY,
            };

            return {
              ...currentPage,
              items: nextItems,
            };
          }),
        );
      }
      return;
    }

    if (interactionMode === 'resize' && resizeDragRef.current) {
      const drag = resizeDragRef.current;
      const deltaX = point.x - drag.startX;
      const deltaY = point.y - drag.startY;
      const preferredPushAxis: 'x' | 'y' = Math.abs(deltaX) >= Math.abs(deltaY) ? 'x' : 'y';

      // Convert deltas from pixels to cm and lock scaling to preserve aspect ratio.
      const deltaXCm = deltaX / cmToPx(1);
      const deltaYCm = deltaY / cmToPx(1);
      const dominantDeltaCm = Math.abs(deltaXCm) >= Math.abs(deltaYCm) ? deltaXCm : deltaYCm;

      const requestedMaxWidthCm = drag.baseMaxWidthCm + dominantDeltaCm;
      const requestedMaxHeightCm = drag.baseMaxHeightCm + dominantDeltaCm;

      const clampedRequestedMaxWidthCm = Math.max(minImageCm, requestedMaxWidthCm);
      const clampedRequestedMaxHeightCm = Math.max(minImageCm, requestedMaxHeightCm);
      setResizeLimitNotice('');

      const targetImage = itemById.get(drag.imageId);
      if (!targetImage) {
        return;
      }

      const pageIndex = pages.findIndex((page) => page.items.some((item) => item.imageId === drag.imageId));
      if (pageIndex === -1) {
        return;
      }

      const page = pages[pageIndex];
      const itemIndex = page.items.findIndex((item) => item.imageId === drag.imageId);
      if (itemIndex === -1) {
        return;
      }

      // Top-left corner is always fixed (origin point)
      const nextX = drag.baseX;
      const nextY = drag.baseY;

      const tryApplyResize = (candidateMaxWidthCm: number, candidateMaxHeightCm: number) => {
        const nextContent = computeContentBox(
          targetImage.naturalWidth,
          targetImage.naturalHeight,
          candidateMaxWidthCm,
          candidateMaxHeightCm,
        );
        const nextFrameThicknessPx = targetImage.frameEnabled ? targetImage.frameThicknessPx : 0;
        const candidate = {
          x: nextX,
          y: nextY,
          width: nextContent.widthPx + nextFrameThicknessPx * 2,
          height: nextContent.heightPx + nextFrameThicknessPx * 2,
        };

        const pushedItems = resolvePushLayout(page.items, itemIndex, candidate, preferredPushAxis);
        if (!pushedItems) {
          return null;
        }

        const nextCrop = computeCropMetrics(
          targetImage.naturalWidth,
          targetImage.naturalHeight,
          nextContent.widthPx,
          nextContent.heightPx,
        );

        const patchedItems = [...pushedItems];
        patchedItems[itemIndex] = {
          ...patchedItems[itemIndex],
          x: nextX,
          y: nextY,
          width: candidate.width,
          height: candidate.height,
          contentWidthPx: nextContent.widthPx,
          contentHeightPx: nextContent.heightPx,
          frameThicknessPx: nextFrameThicknessPx,
          drawnImageWidthPx: nextCrop.drawnImageWidthPx,
          drawnImageHeightPx: nextCrop.drawnImageHeightPx,
          maxOffsetX: nextCrop.maxOffsetX,
          maxOffsetY: nextCrop.maxOffsetY,
        };

        return {
          nextItems: patchedItems,
          content: nextContent,
          crop: nextCrop,
          maxWidthCm: candidateMaxWidthCm,
          maxHeightCm: candidateMaxHeightCm,
        };
      };

      let resolved = tryApplyResize(clampedRequestedMaxWidthCm, clampedRequestedMaxHeightCm);
      let scaledDownByBorder = false;

      if (!resolved && (clampedRequestedMaxWidthCm > drag.baseMaxWidthCm || clampedRequestedMaxHeightCm > drag.baseMaxHeightCm)) {
        let low = 0;
        let high = 1;
        let best: ReturnType<typeof tryApplyResize> = null;

        for (let i = 0; i < 14; i += 1) {
          const mid = (low + high) / 2;
          const midWidthCm = drag.baseMaxWidthCm + (clampedRequestedMaxWidthCm - drag.baseMaxWidthCm) * mid;
          const midHeightCm = drag.baseMaxHeightCm + (clampedRequestedMaxHeightCm - drag.baseMaxHeightCm) * mid;
          const candidate = tryApplyResize(midWidthCm, midHeightCm);

          if (candidate) {
            best = candidate;
            low = mid;
          } else {
            high = mid;
          }
        }

        if (best) {
          resolved = best;
          scaledDownByBorder = true;
        }
      }

      if (!resolved) {
        setResizeLimitNotice('Cannot resize further: neighboring images are pinned by the canvas border.');
        return;
      }

      // Update current dimensions for label display (content only)
      setResizeCurrentDimensions({ width: resolved.content.widthPx, height: resolved.content.heightPx });

      setPages((currentPages) => currentPages.map((currentPage, index) => {
        if (index !== pageIndex) {
          return currentPage;
        }

        return {
          ...currentPage,
          items: resolved.nextItems,
        };
      }));

      setImages((current) => current.map((image) => {
        if (image.id !== drag.imageId) {
          return image;
        }

        const clampedOffsets = clampOffsets(image.offsetX, image.offsetY, resolved.crop.maxOffsetX, resolved.crop.maxOffsetY);
        return {
          ...image,
          maxWidthCm: Number(resolved.maxWidthCm.toFixed(2)),
          maxHeightCm: Number(resolved.maxHeightCm.toFixed(2)),
          renderWidthPx: resolved.content.widthPx,
          renderHeightPx: resolved.content.heightPx,
          cropMaxOffsetX: resolved.crop.maxOffsetX,
          cropMaxOffsetY: resolved.crop.maxOffsetY,
          offsetX: clampedOffsets.offsetX,
          offsetY: clampedOffsets.offsetY,
        };
      }));

      if (requestedMaxWidthCm < minImageCm || requestedMaxHeightCm < minImageCm) {
        setResizeLimitNotice('Minimum image size reached.');
      } else if (scaledDownByBorder) {
        setResizeLimitNotice('Resize limited by canvas border after pushing neighboring images.');
      } else {
        setResizeLimitNotice('');
      }
    }
  }

  function onCanvasMouseUp(event?: MouseEvent<HTMLCanvasElement>): void {
    if (interactionMode === 'replace' && replaceDragRef.current && event) {
      const point = pagePointFromMouse(event);
      const hit = point ? findHitItem(point) : null;
      if (hit && hit.imageId !== replaceDragRef.current.sourceImageId) {
        swapImagesOnSelectedPage(replaceDragRef.current.sourceImageId, hit.imageId);
      }
    }

    if (interactionMode === 'move' && moveDragRef.current && moveOutsideCanvas) {
      const imageIdToRemove = moveDragRef.current.imageId;
      setPages((currentPages) =>
        currentPages.map((page) => ({
          ...page,
          items: page.items.filter((item) => item.imageId !== imageIdToRemove),
        })),
      );
      setSelectedImageId(null);
      setHoveredImageId(null);
    }

    cropDragRef.current = null;
    resizeDragRef.current = null;
    replaceDragRef.current = null;
    moveDragRef.current = null;
    setDragActive(false);
    setMoveOutsideCanvas(false);
    setResizeCurrentDimensions(null);
  }

  function onCanvasMouseLeave(): void {
    onCanvasMouseUp();
    setHoveredImageId(null);
  }

  function expandSelectedImage(scaleFactor: number): void {
    if (!selectedImageId) {
      return;
    }

    const current = itemById.get(selectedImageId);
    if (!current) {
      return;
    }

    const nextMaxWidthCm = Math.max(minImageCm, current.maxWidthCm * scaleFactor);
    const nextMaxHeightCm = Math.max(minImageCm, current.maxHeightCm * scaleFactor);

    const nextImages = images.map((image) => (image.id === selectedImageId ? {
      ...image,
      maxWidthCm: Number(nextMaxWidthCm.toFixed(2)),
      maxHeightCm: Number(nextMaxHeightCm.toFixed(2)),
    } : image));

    regenerateLayout(resolveMaxPages(), true, nextImages);
  }

  function resetSelectedCrop(): void {
    if (!selectedImageId) {
      return;
    }
    updateImage(selectedImageId, { offsetX: 0, offsetY: 0 });
  }

  function exportPagesAsPng(): void {
    if (!pages.length) {
      return;
    }

    pages.forEach((page, index) => {
      const canvas = renderPageToExportCanvas(page, itemById, imageById);
      const link = document.createElement('a');
      link.download = `collage-page-${index + 1}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    });
  }

  function resetGeneratedLayoutState(): void {
    setImages((current) =>
      current.map((image) => ({
        ...image,
        renderWidthPx: 0,
        renderHeightPx: 0,
        offsetX: 0,
        offsetY: 0,
        cropMaxOffsetX: 0,
        cropMaxOffsetY: 0,
      })),
    );
    setPages([]);
    setSelectedImageId(null);
    setDragActive(false);
    setAssistedPageCount(1);
    setSelectedPageIndex(0);
    setOverflowImageIds([]);
    setOversizedImageIds([]);
    setResizeLimitNotice('');
    setError('');
    setResizeCurrentDimensions(null);
    cropDragRef.current = null;
    resizeDragRef.current = null;
    replaceDragRef.current = null;
    moveDragRef.current = null;
  }

  function startFromScratch(): void {
    resetGeneratedLayoutState();
  }

  function clearEverything(): void {
    for (const image of images) {
      URL.revokeObjectURL(image.src);
    }

    knownImageSrcsRef.current = new Set();
    setImages([]);
    setPages([]);
    setMaxImageCm(DEFAULT_MAX_IMAGE_CM);
    setMinImageCm(DEFAULT_MIN_IMAGE_CM);
    setFrameMm(DEFAULT_FRAME_MM);
    setGridModeEnabled(false);
    setAutoCompactPages(true);
    setPaginationMode('auto');
    setInteractionMode('crop');
    setSelectedImageId(null);
    setDragActive(false);
    setAssistedPageCount(1);
    setSelectedPageIndex(0);
    setOverflowImageIds([]);
    setOversizedImageIds([]);
    setResizeLimitNotice('');
    setError('');
    setResizeCurrentDimensions(null);
    cropDragRef.current = null;
    resizeDragRef.current = null;
    replaceDragRef.current = null;
    moveDragRef.current = null;
    setMoveOutsideCanvas(false);
    void clearSnapshot();
  }

  return {
    images,
    pages,
    maxImageCm,
    setMaxImageCm,
    minImageCm,
    setMinImageCm,
    frameMm,
    setFrameMm,
    gridModeEnabled,
    setGridModeEnabled,
    autoCompactPages,
    setAutoCompactPages,
    paginationMode,
    setPaginationMode,
    interactionMode,
    setInteractionMode,
    selectedImage,
    selectedImageId,
    hoveredImageId,
    dragActive,
    moveOutsideCanvas,
    selectedPageIndex,
    setSelectedPageIndex,
    overflowImageIds,
    oversizedImageIds,
    resizeLimitNotice,
    resizeCurrentDimensions,
    error,
    previewCanvasRef,
    onUploadFiles,
    applyGlobalSettings,
    onGenerateLayout,
    exportPagesAsPng,
    onCreateNextPage,
    startFromScratch,
    clearEverything,
    updateImage,
    onCanvasMouseDown,
    onCanvasMouseMove,
    onCanvasMouseUp,
    onCanvasMouseLeave,
    expandSelectedImage,
    resetSelectedCrop,
  };
}
