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
import type { ImageItem, PaginationMode, PersistedEditorSnapshot, PositionedImage, PreviewTransform } from '../model/types';
import { blobToImage, fileToImage } from '../lib/fileToImage';
import { loadSnapshot, saveSnapshot } from '../lib/persistence';

interface DragState {
  imageId: string;
  startX: number;
  startY: number;
  baseOffsetX: number;
  baseOffsetY: number;
  maxOffsetX: number;
  maxOffsetY: number;
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
  const [paginationMode, setPaginationMode] = useState<PaginationMode>('auto');
  const [assistedPageCount, setAssistedPageCount] = useState<number>(1);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [overflowImageIds, setOverflowImageIds] = useState<string[]>([]);
  const [oversizedImageIds, setOversizedImageIds] = useState<string[]>([]);
  const [error, setError] = useState<string>('');
  const [isHydrated, setIsHydrated] = useState<boolean>(false);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewTransformRef = useRef<PreviewTransform | null>(null);
  const dragRef = useRef<DragState | null>(null);
  const knownImageSrcsRef = useRef<Set<string>>(new Set());

  const itemById = useMemo(() => new Map(images.map((img) => [img.id, img])), [images]);
  const imageById = useMemo(() => new Map(images.map((img) => [img.id, img.bitmap])), [images]);
  const selectedPage = pages[selectedPageIndex] ?? null;

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !selectedPage) {
      return;
    }

    previewTransformRef.current = drawPagePreview(canvas, selectedPage, itemById, imageById, {
      gridEnabled: gridModeEnabled,
      gridSpacingPx: cmToPx(DEFAULT_GRID_SPACING_CM),
    });
  }, [selectedPage, itemById, imageById, gridModeEnabled]);

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
        setPaginationMode(snapshot.settings.paginationMode);
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
          paginationMode,
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
    paginationMode,
    assistedPageCount,
    selectedPageIndex,
    pages,
    overflowImageIds,
    oversizedImageIds,
    images,
  ]);

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

  function updateImage(id: string, patch: Partial<ImageItem>): void {
    setImages((current) => current.map((image) => (image.id === id ? { ...image, ...patch } : image)));
  }

  function regenerateLayout(overrideAssistedCount: number): void {
    if (!images.length) {
      setPages([]);
      setOverflowImageIds([]);
      setOversizedImageIds([]);
      return;
    }

    const result = buildPaginatedLayout(images, {
      canvasWidthPx: CANVAS_SIZE_PX,
      canvasHeightPx: CANVAS_SIZE_PX,
      maxPages: paginationMode === 'auto' ? Number.POSITIVE_INFINITY : overrideAssistedCount,
      minContentWidthPx: cmToPx(minImageCm),
      minContentHeightPx: cmToPx(minImageCm),
    });

    const metricsById = result.imageMetrics;
    setImages((current) =>
      current.map((image) => {
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
      }),
    );

    setPages(result.pages);
    setOverflowImageIds(result.overflowImageIds);
    setOversizedImageIds(result.oversizedImageIds);
    setSelectedPageIndex(0);
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
      return;
    }

    const hit = findHitItem(point);
    if (!hit) {
      return;
    }

    const item = itemById.get(hit.imageId);
    if (!item) {
      return;
    }

    dragRef.current = {
      imageId: hit.imageId,
      startX: point.x,
      startY: point.y,
      baseOffsetX: item.offsetX,
      baseOffsetY: item.offsetY,
      maxOffsetX: hit.maxOffsetX,
      maxOffsetY: hit.maxOffsetY,
    };
  }

  function onCanvasMouseMove(event: MouseEvent<HTMLCanvasElement>): void {
    if (!dragRef.current) {
      return;
    }

    const point = pagePointFromMouse(event);
    if (!point) {
      return;
    }

    const drag = dragRef.current;
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
  }

  function onCanvasMouseUp(): void {
    dragRef.current = null;
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
    paginationMode,
    setPaginationMode,
    selectedPageIndex,
    setSelectedPageIndex,
    overflowImageIds,
    oversizedImageIds,
    error,
    previewCanvasRef,
    onUploadFiles,
    applyGlobalSettings,
    onGenerateLayout,
    exportPagesAsPng,
    onCreateNextPage,
    updateImage,
    onCanvasMouseDown,
    onCanvasMouseMove,
    onCanvasMouseUp,
  };
}
