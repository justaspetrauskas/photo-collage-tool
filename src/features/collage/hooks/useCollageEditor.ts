import { enhanceImageWithAI, type EnhanceOptions } from '../lib/openaiImageEdit';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, MouseEvent } from 'react';
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
import { useEditorUIStore } from '../store/editorUIStore';
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
import {
  type DragState,
  isCropDrag,
  isResizeDrag,
  isReplaceDrag,
  isMoveDrag,
} from '../../../shared/drag';
import {
  rectanglesOverlap,
  isInsideCanvas,
  computeContentBox,
  computeCropMetrics,
  clampCropOffset,
} from '../../../shared/math';
import {
  calculateCropOffsets,
  calculateNewPosition,
  isPositionOutsideCanvas,
  resolvePushLayout,
  getPreferredPushAxis,
  canSwapImages,
} from '../interactions';

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

interface CanvasPlacementPreview {
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  valid: boolean;
}

export function useCollageEditor() {
  const { drawerSelectedImageId, imageZoomLevels, imagePanOffsets } = useEditorUIStore();
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
  const [moveCollisionImageIds, setMoveCollisionImageIds] = useState<string[]>([]);
  const [resizeCurrentDimensions, setResizeCurrentDimensions] = useState<{ width: number; height: number } | null>(null);
  const [enhancingImageIds, setEnhancingImageIds] = useState<Set<string>>(new Set());
  const [canvasPlacementPreview, setCanvasPlacementPreview] = useState<CanvasPlacementPreview | null>(null);
  const [manualPlacementDragImageId, setManualPlacementDragImageId] = useState<string | null>(null);
  const [showSelectionControls, setShowSelectionControls] = useState<boolean>(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewTransformRef = useRef<PreviewTransform | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
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
      drawerSelectedImageId,
      imageZoomLevels,
      imagePanOffsets,
      interactionMode,
      dragActive,
      moveOutsideCanvas,
      moveCollisionImageIds,
      resizeCurrentDimensions,
      placementPreview: canvasPlacementPreview,
      animationTimeMs: replaceAnimationTick,
    });
  }, [selectedPage, itemById, imageById, gridModeEnabled, selectedImageId, hoveredImageId, drawerSelectedImageId, imageZoomLevels, imagePanOffsets, interactionMode, dragActive, moveOutsideCanvas, moveCollisionImageIds, resizeCurrentDimensions, canvasPlacementPreview, replaceAnimationTick]);

function rectanglesTouchOrOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  const aRight = a.x + a.width;
  const bRight = b.x + b.width;
  const aBottom = a.y + a.height;
  const bBottom = b.y + b.height;

  return !(aRight < b.x || a.x > bRight || aBottom < b.y || a.y > bBottom);
}

  useEffect(() => {
    const currentSrcs = new Set<string>();
    for (const image of images) {
      currentSrcs.add(image.src);
      currentSrcs.add(image.originalSrc);
    }
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
            const baseItem: ImageItem = {
              ...savedImage,
              originalSrc: restored.src,
              src: restored.src,
              bitmap: restored.image,
              sourceBlob: restored.blob,
            };

            // If enhanced version was saved, restore it
            if (savedImage.enhancedSrcBlob) {
              try {
                const enhanced = await blobToImage(savedImage.enhancedSrcBlob);
                return {
                  ...baseItem,
                  src: enhanced.src,
                  bitmap: enhanced.image,
                };
              } catch {
                // If enhanced blob fails to load, fall back to original
                return baseItem;
              }
            }

            return baseItem;
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
        // Explicitly clear selected image state on hydration to avoid stale selections
        setSelectedImageId(null);
        setShowSelectionControls(false);
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

    const timeoutId = window.setTimeout(async () => {
      const persistedImages = await Promise.all(
        images.map(async (image) => {
          const persisted = {
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
          } as Record<string, unknown>;

          // If image has been enhanced, convert the data URL to blob and store it
          if (image.src !== image.originalSrc && image.src.startsWith('data:')) {
            try {
              const response = await fetch(image.src);
              const enhancedBlob = await response.blob();
              persisted.enhancedSrcBlob = enhancedBlob;
            } catch {
              // If conversion fails, we'll lose the enhancement on next load
              // but the app will remain functional
            }
          }

          return persisted;
        }),
      );

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
        images: persistedImages as any,
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
    await uploadFileList(files);
    event.target.value = '';
  }

  async function uploadFileList(files: File[]): Promise<void> {
    if (!files.length) {
      return;
    }

    try {
      const loaded = await Promise.all(files.map((file) => fileToImage(file)));
      const next: ImageItem[] = loaded.map((entry, index) => ({
        id: randomId(`${Date.now()}-${index}`),
        fileName: files[index].name,
        sourceBlob: entry.blob,
        originalSrc: entry.src,
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
      setPages((currentPages) =>
        currentPages.length
          ? currentPages
          : [
              {
                id: randomId('page'),
                widthPx: CANVAS_SIZE_PX,
                heightPx: CANVAS_SIZE_PX,
                items: [],
              },
            ],
      );
      setError('');
    } catch {
      setError('Some images failed to load. Please retry with valid JPG, PNG, or WebP files.');
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
    const otherItems = selectedPage.items.filter((_, index) => index !== sourceIndex && index !== targetIndex);

    if (!canSwapImages(sourceSlot, targetSlot, otherItems)) {
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

  function pagePointFromClient(clientX: number, clientY: number): { x: number; y: number } | null {
    const canvas = previewCanvasRef.current;
    const transform = previewTransformRef.current;
    if (!canvas || !transform || !selectedPage) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * transform.dpr;
    const y = (clientY - rect.top) * transform.dpr;

    const pageX = (x - transform.offsetX) / transform.scale;
    const pageY = (y - transform.offsetY) / transform.scale;

    if (pageX < 0 || pageY < 0 || pageX > selectedPage.widthPx || pageY > selectedPage.heightPx) {
      return null;
    }

    return { x: pageX, y: pageY };
  }

  function pagePointFromMouse(event: MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    return pagePointFromClient(event.clientX, event.clientY);
  }

  function resolveManualPlacementSize(image: ImageItem): {
    width: number;
    height: number;
    contentWidthPx: number;
    contentHeightPx: number;
    frameThicknessPx: number;
    drawnImageWidthPx: number;
    drawnImageHeightPx: number;
    maxOffsetX: number;
    maxOffsetY: number;
  } {
    const base = computeContentBox(
      image.naturalWidth,
      image.naturalHeight,
      image.maxWidthCm,
      image.maxHeightCm,
    );

    const minPx = cmToPx(minImageCm);
    const scaleUp = Math.max(minPx / base.widthPx, minPx / base.heightPx, 1);
    const contentWidthPx = Math.round(base.widthPx * scaleUp);
    const contentHeightPx = Math.round(base.heightPx * scaleUp);
    const frameThicknessPx = image.frameEnabled ? image.frameThicknessPx : 0;
    const crop = computeCropMetrics(
      image.naturalWidth,
      image.naturalHeight,
      contentWidthPx,
      contentHeightPx,
    );

    return {
      width: contentWidthPx + frameThicknessPx * 2,
      height: contentHeightPx + frameThicknessPx * 2,
      contentWidthPx,
      contentHeightPx,
      frameThicknessPx,
      drawnImageWidthPx: crop.drawnImageWidthPx,
      drawnImageHeightPx: crop.drawnImageHeightPx,
      maxOffsetX: crop.maxOffsetX,
      maxOffsetY: crop.maxOffsetY,
    };
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
      setShowSelectionControls(false);
      return;
    }

    const hit = findHitItem(point);
    if (!hit) {
      setSelectedImageId(null);
      setHoveredImageId(null);
      setDragActive(false);
      setShowSelectionControls(false);
      return;
    }

    setSelectedImageId(hit.imageId);
    setHoveredImageId(hit.imageId);
    setShowSelectionControls(true);

    const item = itemById.get(hit.imageId);
    if (!item) {
      return;
    }

    if (interactionMode === 'crop') {
      setDragActive(true);
      dragStateRef.current = {
        type: 'crop',
        imageId: hit.imageId,
        startX: point.x,
        startY: point.y,
        baseOffsetX: item.offsetX,
        baseOffsetY: item.offsetY,
        maxOffsetX: hit.maxOffsetX,
        maxOffsetY: hit.maxOffsetY,
      };
      return;
    }

    if (interactionMode === 'replace') {
      dragStateRef.current = {
        type: 'replace',
        sourceImageId: hit.imageId,
      };
      setDragActive(true);
      return;
    }

    if (interactionMode === 'move') {
      dragStateRef.current = {
        type: 'move',
        imageId: hit.imageId,
        startX: point.x,
        startY: point.y,
        baseX: hit.x,
        baseY: hit.y,
      };
      setDragActive(true);
      setMoveOutsideCanvas(false);
      setMoveCollisionImageIds([]);
      return;
    }

    dragStateRef.current = {
      type: 'resize',
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

    if (interactionMode === 'crop' && isCropDrag(dragStateRef.current)) {
      const drag = dragStateRef.current;
      const offsets = calculateCropOffsets(
        drag.startX,
        drag.startY,
        point.x,
        point.y,
        drag.baseOffsetX,
        drag.baseOffsetY,
        drag.maxOffsetX,
        drag.maxOffsetY,
      );

      updateImage(drag.imageId, {
        offsetX: Math.round(offsets.offsetX),
        offsetY: Math.round(offsets.offsetY),
      });
      return;
    }

    if (interactionMode === 'replace' && isReplaceDrag(dragStateRef.current)) {
      setHoveredImageId(hit?.imageId ?? null);
      return;
    }

    if (interactionMode === 'move' && isMoveDrag(dragStateRef.current)) {
      const drag = dragStateRef.current;
      const position = calculateNewPosition(
        drag.startX,
        drag.startY,
        point.x,
        point.y,
        drag.baseX,
        drag.baseY,
      );

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
      const isOutsideCanvas = isPositionOutsideCanvas(position.x, position.y, item.width, item.height);

      setMoveOutsideCanvas(isOutsideCanvas);

      if (!isOutsideCanvas) {
        const movingRect = {
          x: position.x,
          y: position.y,
          width: item.width,
          height: item.height,
        };
        const collisionIds = page.items
          .filter((other) => other.imageId !== drag.imageId && rectanglesTouchOrOverlap(movingRect, other))
          .map((other) => other.imageId);
        setMoveCollisionImageIds(collisionIds);
      } else {
        setMoveCollisionImageIds([]);
      }

      if (!isOutsideCanvas) {
        setPages((currentPages) =>
          currentPages.map((currentPage, index) => {
            if (index !== pageIndex) {
              return currentPage;
            }

            const nextItems = [...currentPage.items];
            nextItems[itemIndex] = {
              ...nextItems[itemIndex],
              x: position.x,
              y: position.y,
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

    if (interactionMode === 'resize' && isResizeDrag(dragStateRef.current)) {
      const drag = dragStateRef.current;
      const deltaX = point.x - drag.startX;
      const deltaY = point.y - drag.startY;
      const preferredPushAxis = getPreferredPushAxis(deltaX, deltaY);

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
    if (interactionMode === 'replace' && isReplaceDrag(dragStateRef.current) && event) {
      const point = pagePointFromMouse(event);
      const hit = point ? findHitItem(point) : null;
      if (hit && hit.imageId !== dragStateRef.current.sourceImageId) {
        swapImagesOnSelectedPage(dragStateRef.current.sourceImageId, hit.imageId);
      }
    }

    if (interactionMode === 'move' && isMoveDrag(dragStateRef.current) && moveOutsideCanvas) {
      const imageIdToRemove = dragStateRef.current.imageId;
      setPages((currentPages) =>
        currentPages.map((page) => ({
          ...page,
          items: page.items.filter((item) => item.imageId !== imageIdToRemove),
        })),
      );
      setSelectedImageId(null);
      setHoveredImageId(null);
    }

    dragStateRef.current = null;
    setDragActive(false);
    setMoveOutsideCanvas(false);
    setMoveCollisionImageIds([]);
    setResizeCurrentDimensions(null);
  }

  function onCanvasMouseLeave(): void {
    onCanvasMouseUp();
    setHoveredImageId(null);
  }

  function onCanvasDragOver(event: DragEvent<HTMLCanvasElement>): void {
    event.preventDefault();
    const imageId = manualPlacementDragImageId ?? event.dataTransfer.getData('application/x-collage-image-id');
    if (!imageId || !selectedPage) {
      setCanvasPlacementPreview(null);
      return;
    }

    const image = itemById.get(imageId);
    const point = pagePointFromClient(event.clientX, event.clientY);
    if (!image || !point) {
      setCanvasPlacementPreview(null);
      return;
    }

    const size = resolveManualPlacementSize(image);
    const canFit = size.width <= selectedPage.widthPx && size.height <= selectedPage.heightPx;
    const x = Math.max(0, Math.min(selectedPage.widthPx - size.width, point.x - size.width / 2));
    const y = Math.max(0, Math.min(selectedPage.heightPx - size.height, point.y - size.height / 2));

    setCanvasPlacementPreview({
      imageId,
      x,
      y,
      width: size.width,
      height: size.height,
      valid: canFit,
    });
  }

  function onCanvasDrop(event: DragEvent<HTMLCanvasElement>): void {
    event.preventDefault();
    const imageId = manualPlacementDragImageId ?? event.dataTransfer.getData('application/x-collage-image-id');
    const image = itemById.get(imageId);
    const point = pagePointFromClient(event.clientX, event.clientY);
    if (!image || !selectedPage || !point) {
      setCanvasPlacementPreview(null);
      return;
    }

    const size = resolveManualPlacementSize(image);
    if (size.width > selectedPage.widthPx || size.height > selectedPage.heightPx) {
      setError('Image does not fit on canvas with current size constraints.');
      setCanvasPlacementPreview(null);
      return;
    }

    const x = Math.max(0, Math.min(selectedPage.widthPx - size.width, point.x - size.width / 2));
    const y = Math.max(0, Math.min(selectedPage.heightPx - size.height, point.y - size.height / 2));

    setPages((currentPages) =>
      currentPages.map((page, pageIndex) => {
        const withoutImage = page.items.filter((item) => item.imageId !== imageId);
        if (pageIndex !== selectedPageIndex) {
          return {
            ...page,
            items: withoutImage,
          };
        }

        return {
          ...page,
          items: [
            ...withoutImage,
            {
              imageId,
              x,
              y,
              width: size.width,
              height: size.height,
              contentWidthPx: size.contentWidthPx,
              contentHeightPx: size.contentHeightPx,
              frameThicknessPx: size.frameThicknessPx,
              drawnImageWidthPx: size.drawnImageWidthPx,
              drawnImageHeightPx: size.drawnImageHeightPx,
              maxOffsetX: size.maxOffsetX,
              maxOffsetY: size.maxOffsetY,
            },
          ],
        };
      }),
    );

    const clamped = clampOffsets(image.offsetX, image.offsetY, size.maxOffsetX, size.maxOffsetY);
    setImages((current) =>
      current.map((entry) =>
        entry.id === imageId
          ? {
              ...entry,
              renderWidthPx: size.contentWidthPx,
              renderHeightPx: size.contentHeightPx,
              cropMaxOffsetX: size.maxOffsetX,
              cropMaxOffsetY: size.maxOffsetY,
              offsetX: clamped.offsetX,
              offsetY: clamped.offsetY,
            }
          : entry,
      ),
    );

    setSelectedImageId(imageId);
    setHoveredImageId(imageId);
    setError('');
    setManualPlacementDragImageId(null);
    setCanvasPlacementPreview(null);
  }

  function onCanvasDragLeave(): void {
    setCanvasPlacementPreview(null);
  }

  function onBeginManualPlacementDrag(imageId: string): void {
    setManualPlacementDragImageId(imageId);
  }

  function onEndManualPlacementDrag(): void {
    setManualPlacementDragImageId(null);
    setCanvasPlacementPreview(null);
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
    setShowSelectionControls(false);
    setDragActive(false);
    setAssistedPageCount(1);
    setSelectedPageIndex(0);
    setOverflowImageIds([]);
    setOversizedImageIds([]);
    setResizeLimitNotice('');
    setError('');
    setResizeCurrentDimensions(null);
    dragStateRef.current = null;
    setMoveCollisionImageIds([]);
  }

  function startFromScratch(): void {
    resetGeneratedLayoutState();
  }

  async function enhanceImage(imageId: string, options: EnhanceOptions = {}): Promise<void> {
    const image = images.find((img) => img.id === imageId);
    if (!image) return;
    setEnhancingImageIds((prev) => new Set(prev).add(imageId));
    try {
      const enhancedSrc = await enhanceImageWithAI(image.src, options);
      // Load the result as an HTMLImageElement (matches ImageItem.bitmap type)
      const htmlImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Failed to load enhanced image'));
        el.src = enhancedSrc;
      });
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...img, src: enhancedSrc, bitmap: htmlImg } : img,
        ),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto enhancement failed');
    } finally {
      setEnhancingImageIds((prev) => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
    }
  }

  async function enhanceAllImages(options: EnhanceOptions = {}): Promise<void> {
    for (const image of images) {
      await enhanceImage(image.id, options);
    }
  }

  function deleteImage(imageId: string): void {
    const image = images.find((img) => img.id === imageId);
    if (image) {
      URL.revokeObjectURL(image.src);
      knownImageSrcsRef.current.delete(image.src);
      if (image.originalSrc !== image.src) {
        URL.revokeObjectURL(image.originalSrc);
        knownImageSrcsRef.current.delete(image.originalSrc);
      }
    }
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    setPages((prev) =>
      prev.map((page) => ({ ...page, items: page.items.filter((item) => item.imageId !== imageId) })),
    );
  }

  function removeFromCanvas(imageId: string): void {
    setPages((prev) =>
      prev.map((page) => ({ ...page, items: page.items.filter((item) => item.imageId !== imageId) })),
    );
  }

  function clearEverything(): void {
    const urlsToRevoke = new Set<string>();
    for (const image of images) {
      urlsToRevoke.add(image.src);
      urlsToRevoke.add(image.originalSrc);
    }
    for (const src of urlsToRevoke) {
      URL.revokeObjectURL(src);
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
    setShowSelectionControls(false);
    setDragActive(false);
    setAssistedPageCount(1);
    setSelectedPageIndex(0);
    setOverflowImageIds([]);
    setOversizedImageIds([]);
    setResizeLimitNotice('');
    setError('');
    setResizeCurrentDimensions(null);
    dragStateRef.current = null;
    setMoveOutsideCanvas(false);
    setMoveCollisionImageIds([]);
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
    showSelectionControls,
    previewCanvasRef,
    onUploadFiles,
    uploadFileList,
    applyGlobalSettings,
    onGenerateLayout,
    exportPagesAsPng,
    onCreateNextPage,
    startFromScratch,
    clearEverything,
    updateImage,
    deleteImage,
    removeFromCanvas,
    enhanceImage,
    enhanceAllImages,
    enhancingImageIds,
    onCanvasMouseDown,
    onCanvasMouseMove,
    onCanvasMouseUp,
    onCanvasMouseLeave,
    onCanvasDragOver,
    onCanvasDrop,
    onCanvasDragLeave,
    onBeginManualPlacementDrag,
    onEndManualPlacementDrag,
    expandSelectedImage,
    resetSelectedCrop,
    setShowSelectionControls,
  };
}
