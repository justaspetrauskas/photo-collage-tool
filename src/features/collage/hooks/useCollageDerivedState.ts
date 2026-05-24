import { useMemo } from 'react';
import { CANVAS_SIZE_PRESETS, LAYOUT_PRESETS, cmToPx, type CanvasSizePresetId } from '../model/constants';
import type { ImageItem, PageLayout, PositionedImage } from '../model/types';
import type { SessionMetrics, WorkflowStage } from './useCollageEditor';

type PlacementInfo = { pageIndex: number; itemIndex: number; item: PositionedImage };

export function useCollageDerivedState(params: {
  images: ImageItem[];
  pages: PageLayout[];
  selectedPageIndex: number;
  selectedImageId: string | null;
  canvasPresetId: CanvasSizePresetId;
  customCanvasWidthCm: number;
  customCanvasHeightCm: number;
  isExporting: boolean;
  sessionMetrics: SessionMetrics;
}) {
  const {
    images,
    pages,
    selectedPageIndex,
    selectedImageId,
    canvasPresetId,
    customCanvasWidthCm,
    customCanvasHeightCm,
    isExporting,
    sessionMetrics,
  } = params;

  const selectedPage = pages[selectedPageIndex] ?? null;
  const itemById = useMemo(() => new Map(images.map((image) => [image.id, image] as const)), [images]);
  const bitmapById = useMemo(() => new Map(images.map((image) => [image.id, image.bitmap] as const)), [images]);
  const imageById = bitmapById;
  const placementByImageId = useMemo(() => {
    const map = new Map<string, PlacementInfo>();
    pages.forEach((page, pageIndex) => {
      page.items.forEach((item, itemIndex) => {
        map.set(item.imageId, { pageIndex, itemIndex, item });
      });
    });
    return map;
  }, [pages]);

  const selectedImage = selectedImageId ? itemById.get(selectedImageId) ?? null : null;
  const selectedPlacedItem =
    selectedPage && selectedImageId ? selectedPage.items.find((item) => item.imageId === selectedImageId) ?? null : null;
  const hasPlacedItems = pages.some((page) => page.items.length > 0);
  const hasUnplacedImages = images.some((image) => !placementByImageId.has(image.id));

  const recommendedLayoutHint = useMemo(() => {
    if (!images.length) {
      return '';
    }

    const preset = CANVAS_SIZE_PRESETS.find((p) => p.id === canvasPresetId) ?? CANVAS_SIZE_PRESETS[0];
    const widthCm = canvasPresetId === 'custom' ? customCanvasWidthCm : preset.widthCm;
    const heightCm = canvasPresetId === 'custom' ? customCanvasHeightCm : preset.heightCm;
    const widthPx = Math.round(cmToPx(widthCm));
    const heightPx = Math.round(cmToPx(heightCm));
    const orientation = widthPx >= heightPx ? 'landscape' : 'portrait';
    const portraitCount = images.filter((img) => img.naturalHeight >= img.naturalWidth).length;
    const portraitShare = portraitCount / images.length;
    const recommended = new Set<string>();

    if (images.length >= 8) {
      recommended.add('grid_3x3');
    } else if (images.length >= 4) {
      recommended.add('grid_2x2');
    }

    if (images.length >= 3 && images.length <= 5) {
      recommended.add('hero_supporting');
      recommended.add('mosaic');
    }

    if (images.length >= 3 && images.length <= 4) {
      recommended.add('story_strip');
    }

    if (orientation === 'portrait' && portraitShare > 0.6) {
      recommended.add('story_strip');
      recommended.add('mosaic');
    }

    if (recommended.size === 0) {
      return '';
    }

    const labels = LAYOUT_PRESETS.filter((preset) => recommended.has(preset.id) && preset.id !== 'auto').map(
      (preset) => preset.label,
    );

    return labels.length ? `Recommended: ${labels.join(' • ')}` : '';
  }, [images, canvasPresetId, customCanvasWidthCm, customCanvasHeightCm]);

  const workflowStage = useMemo<WorkflowStage>(() => {
    if (!images.length) {
      return 'upload';
    }
    if (!hasPlacedItems) {
      return 'generate';
    }
    if (isExporting || sessionMetrics.exportsCompleted > 0) {
      return 'export';
    }
    return 'edit';
  }, [hasPlacedItems, images.length, isExporting, sessionMetrics.exportsCompleted]);

  const sessionInsights = useMemo(
    () => ({
      timeToFirstLayoutMs:
        sessionMetrics.firstUploadAt && sessionMetrics.firstLayoutAt
          ? Math.max(0, sessionMetrics.firstLayoutAt - sessionMetrics.firstUploadAt)
          : null,
      timeToFirstExportMs:
        sessionMetrics.firstLayoutAt && sessionMetrics.firstExportAt
          ? Math.max(0, sessionMetrics.firstExportAt - sessionMetrics.firstLayoutAt)
          : null,
    }),
    [sessionMetrics.firstExportAt, sessionMetrics.firstLayoutAt, sessionMetrics.firstUploadAt],
  );

  return {
    selectedPage,
    itemById,
    imageById,
    bitmapById,
    placementByImageId,
    selectedImage,
    selectedPlacedItem,
    hasPlacedItems,
    hasUnplacedImages,
    recommendedLayoutHint,
    workflowStage,
    sessionInsights,
  };
}
