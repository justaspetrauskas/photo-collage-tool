import { useState } from 'react';
import type { ImageItem, PositionedImage, PaginationMode, InteractionMode } from '../../model/types';
import type { CanvasSizePresetId, LayoutPresetId } from '../../model/constants';

export function useCollageState(initial?: Partial<ReturnType<typeof getDefaultState>>) {
  const [images, setImages] = useState<ImageItem[]>(initial?.images ?? []);
  const [pages, setPages] = useState<Array<{ id: string; widthPx: number; heightPx: number; items: PositionedImage[] }>>(initial?.pages ?? []);
  const [maxImageCm, setMaxImageCm] = useState<number>(initial?.maxImageCm ?? 8);
  const [minImageCm, setMinImageCm] = useState<number>(initial?.minImageCm ?? 3);
  const [frameMm, setFrameMm] = useState<number>(initial?.frameMm ?? 4);
  const [gridModeEnabled, setGridModeEnabled] = useState<boolean>(initial?.gridModeEnabled ?? false);
  const [autoCompactPages, setAutoCompactPages] = useState<boolean>(initial?.autoCompactPages ?? true);
  const [paginationMode, setPaginationMode] = useState<PaginationMode>((initial?.paginationMode as PaginationMode | undefined) ?? 'auto');
  const [interactionMode, setInteractionModeState] = useState<InteractionMode>((initial?.interactionMode as InteractionMode | undefined) ?? 'select');
  const [selectedImageId, setSelectedImageId] = useState<string | null>(initial?.selectedImageId ?? null);
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(initial?.hoveredImageId ?? null);
  const [assistedPageCount, setAssistedPageCount] = useState<number>(initial?.assistedPageCount ?? 1);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(initial?.selectedPageIndex ?? 0);
  const [overflowImageIds, setOverflowImageIds] = useState<string[]>(initial?.overflowImageIds ?? []);
  const [oversizedImageIds, setOversizedImageIds] = useState<string[]>(initial?.oversizedImageIds ?? []);
  const [canvasPresetId, setCanvasPresetId] = useState<CanvasSizePresetId>((initial?.canvasPresetId as CanvasSizePresetId | undefined) ?? 'square_20');
  const [customCanvasWidthCm, setCustomCanvasWidthCm] = useState<number>(initial?.customCanvasWidthCm ?? 20);
  const [customCanvasHeightCm, setCustomCanvasHeightCm] = useState<number>(initial?.customCanvasHeightCm ?? 20);
  const [layoutPresetId, setLayoutPresetId] = useState<LayoutPresetId>((initial?.layoutPresetId as LayoutPresetId | undefined) ?? 'auto');

  return {
    images, setImages,
    pages, setPages,
    maxImageCm, setMaxImageCm,
    minImageCm, setMinImageCm,
    frameMm, setFrameMm,
    gridModeEnabled, setGridModeEnabled,
    autoCompactPages, setAutoCompactPages,
    paginationMode, setPaginationMode,
    interactionMode, setInteractionModeState,
    selectedImageId, setSelectedImageId,
    hoveredImageId, setHoveredImageId,
    assistedPageCount, setAssistedPageCount,
    selectedPageIndex, setSelectedPageIndex,
    overflowImageIds, setOverflowImageIds,
    oversizedImageIds, setOversizedImageIds,
    canvasPresetId, setCanvasPresetId,
    customCanvasWidthCm, setCustomCanvasWidthCm,
    customCanvasHeightCm, setCustomCanvasHeightCm,
    layoutPresetId, setLayoutPresetId,
  };
}

function getDefaultState() {
  return {
    images: [],
    pages: [],
    maxImageCm: 8,
    minImageCm: 3,
    frameMm: 4,
    gridModeEnabled: false,
    autoCompactPages: true,
    paginationMode: 'auto',
    interactionMode: 'select',
    selectedImageId: null,
    hoveredImageId: null,
    assistedPageCount: 1,
    selectedPageIndex: 0,
    overflowImageIds: [],
    oversizedImageIds: [],
    canvasPresetId: 'square_20',
    customCanvasWidthCm: 20,
    customCanvasHeightCm: 20,
    layoutPresetId: 'auto',
  };
}
