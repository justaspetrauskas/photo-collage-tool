import type { CanvasSizePresetId, LayoutPresetId } from '../../model/constants';
import type { ImageItem, PageLayout, PersistedEditorSnapshot, PersistedImageItem } from '../../model/types';

export interface PersistedSnapshotSettings {
  maxImageCm: number;
  minImageCm: number;
  frameMm: number;
  gridModeEnabled: boolean;
  autoCompactPages: boolean;
  paginationMode: 'auto' | 'assisted';
  interactionMode: 'crop' | 'resize' | 'replace' | 'move' | 'select';
  assistedPageCount: number;
  selectedPageIndex: number;
  layoutPresetId: LayoutPresetId;
  canvasPresetId: CanvasSizePresetId;
  customCanvasWidthCm: number;
  customCanvasHeightCm: number;
}

export function toPersistedImageItem(image: ImageItem): PersistedImageItem {
  return {
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
  };
}

export function buildPersistedEditorSnapshot(
  images: PersistedImageItem[],
  pages: PageLayout[],
  overflowImageIds: string[],
  oversizedImageIds: string[],
  settings: PersistedSnapshotSettings,
): PersistedEditorSnapshot {
  return {
    version: 1,
    savedAt: Date.now(),
    settings,
    pages,
    overflowImageIds,
    oversizedImageIds,
    images,
  };
}