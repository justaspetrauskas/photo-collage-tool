import type { Dispatch, SetStateAction } from 'react';
import { CANVAS_SIZE_PRESETS, cmToPx, mmToPx, type CanvasSizePresetId, type LayoutPresetId } from '../../model/constants';
import { buildPaginatedLayout, clampOffsets } from '../../model/layoutEngine';
import type { ImageItem, PageLayout } from '../../model/types';
import { computeContentBox, computeCropMetrics } from '../../../../shared/math/sizing';
import { resolveSmartFraming } from '../../lib/editorLayoutUtils';

interface UseCollageEditorLayoutActionsParams {
  images: ImageItem[];
  pages: PageLayout[];
  maxImageCm: number;
  minImageCm: number;
  frameMm: number;
  autoCompactPages: boolean;
  paginationMode: 'auto' | 'assisted';
  assistedPageCount: number;
  layoutPresetId: LayoutPresetId;
  canvasPresetId: CanvasSizePresetId;
  customCanvasWidthCm: number;
  customCanvasHeightCm: number;
  setImages: Dispatch<SetStateAction<ImageItem[]>>;
  setPages: Dispatch<SetStateAction<PageLayout[]>>;
  setOverflowImageIds: Dispatch<SetStateAction<string[]>>;
  setOversizedImageIds: Dispatch<SetStateAction<string[]>>;
  setSelectedPageIndex: Dispatch<SetStateAction<number>>;
  setAssistedPageCount: Dispatch<SetStateAction<number>>;
  setNotice: Dispatch<SetStateAction<{ tone: 'info' | 'success' | 'error'; text: string } | null>>;
  setImageZoom: (imageId: string, zoom: number) => void;
  setImagePan: (imageId: string, x: number, y: number) => void;
  setUndoAction: Dispatch<SetStateAction<{ label: string; description: string; restore: () => void } | null>>;
  updateSessionMetrics: (updater: (metrics: { uploads: number; layoutGenerations: number; modeSwitches: number; exportsCompleted: number; exportFailures: number; enhancementRuns: number; enhancementFailures: number; removedFromCanvas: number; removedPages: number; destructiveConfirms: number; destructiveCancels: number; firstUploadAt: number | null; firstLayoutAt: number | null; firstExportAt: number | null; }) => { uploads: number; layoutGenerations: number; modeSwitches: number; exportsCompleted: number; exportFailures: number; enhancementRuns: number; enhancementFailures: number; removedFromCanvas: number; removedPages: number; destructiveConfirms: number; destructiveCancels: number; firstUploadAt: number | null; firstLayoutAt: number | null; firstExportAt: number | null; }) => void;
}

export function useCollageEditorLayoutActions({
  images,
  pages,
  maxImageCm,
  minImageCm,
  frameMm,
  autoCompactPages,
  paginationMode,
  assistedPageCount,
  layoutPresetId,
  canvasPresetId,
  customCanvasWidthCm,
  customCanvasHeightCm,
  setImages,
  setPages,
  setOverflowImageIds,
  setOversizedImageIds,
  setSelectedPageIndex,
  setAssistedPageCount,
  setNotice,
  setImageZoom,
  setImagePan,
  setUndoAction,
  updateSessionMetrics,
}: UseCollageEditorLayoutActionsParams) {
  function resolveCanvasDimensions(): { widthPx: number; heightPx: number } {
    const preset = CANVAS_SIZE_PRESETS.find((presetItem) => presetItem.id === canvasPresetId) ?? CANVAS_SIZE_PRESETS[0];
    const widthCm = canvasPresetId === 'custom' ? customCanvasWidthCm : preset.widthCm;
    const heightCm = canvasPresetId === 'custom' ? customCanvasHeightCm : preset.heightCm;
    return {
      widthPx: Math.round(cmToPx(widthCm)),
      heightPx: Math.round(cmToPx(heightCm)),
    };
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
    useSmartFraming = false,
  ): void {
    if (!sourceImages.length) {
      setPages([]);
      setOverflowImageIds([]);
      setOversizedImageIds([]);
      return;
    }

    const { widthPx: canvasWidthPx, heightPx: canvasHeightPx } = resolveCanvasDimensions();
    const result = buildPaginatedLayout(sourceImages, {
      canvasWidthPx,
      canvasHeightPx,
      allowUpscale: true,
      maxPages: paginationMode === 'auto' ? Number.POSITIVE_INFINITY : overrideAssistedCount,
      minContentWidthPx: cmToPx(minImageCm),
      minContentHeightPx: cmToPx(minImageCm),
      enableCompaction: autoCompactPages,
      layoutPresetId,
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

      const smart = useSmartFraming ? resolveSmartFraming(image, metrics) : null;
      const clamped = smart
        ? { offsetX: smart.offsetX, offsetY: smart.offsetY }
        : clampOffsets(image.offsetX, image.offsetY, metrics.maxOffsetX, metrics.maxOffsetY);
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

    if (useSmartFraming) {
      for (const image of nextImages) {
        const metrics = metricsById.get(image.id);
        if (!metrics) {
          continue;
        }

        const { zoom } = resolveSmartFraming(image, metrics);
        setImageZoom(image.id, zoom);
        setImagePan(image.id, 0, 0);
      }
    }

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
    regenerateLayout(1, false, images, true);
    setUndoAction(null);
    setNotice({
      tone: 'success',
      text: 'Layout ready. Select a photo to fine-tune it, or export when the collage looks right.',
    });
    updateSessionMetrics((metrics) => ({
      ...metrics,
      layoutGenerations: metrics.layoutGenerations + 1,
      firstLayoutAt: metrics.firstLayoutAt ?? Date.now(),
    }));
  }

  function onCreateNextPage(): void {
    const nextCount = assistedPageCount + 1;
    setAssistedPageCount(nextCount);
    regenerateLayout(nextCount, false, images, true);
    setNotice({
      tone: 'info',
      text: `Added page ${nextCount}. Continue placing and editing photos on the current page.`,
    });
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
    setNotice({
      tone: 'success',
      text: 'Project sizing rules updated. Generate layout again if you want every page reflowed.',
    });
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

  return {
    resolveCanvasDimensions,
    resolveMaxPages,
    regenerateLayout,
    applyGlobalSettings,
    onGenerateLayout,
    onCreateNextPage,
    resolveManualPlacementSize,
  };
}