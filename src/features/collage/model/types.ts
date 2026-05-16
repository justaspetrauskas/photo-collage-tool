import type { LayoutPresetId } from './constants';

export type PaginationMode = 'auto' | 'assisted';
export type InteractionMode = 'crop' | 'resize' | 'replace' | 'move';

export interface ImageItem {
  id: string;
  fileName: string;
  sourceBlob: Blob;
  originalSrc: string;
  src: string;
  bitmap: HTMLImageElement;
  naturalWidth: number;
  naturalHeight: number;
  maxWidthCm: number;
  maxHeightCm: number;
  frameEnabled: boolean;
  frameThicknessPx: number;
  renderWidthPx: number;
  renderHeightPx: number;
  offsetX: number;
  offsetY: number;
  cropMaxOffsetX: number;
  cropMaxOffsetY: number;
}

export interface PositionedImage {
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  contentWidthPx: number;
  contentHeightPx: number;
  frameThicknessPx: number;
  drawnImageWidthPx: number;
  drawnImageHeightPx: number;
  maxOffsetX: number;
  maxOffsetY: number;
}

export interface PageLayout {
  id: string;
  widthPx: number;
  heightPx: number;
  items: PositionedImage[];
}

export interface ImageMetrics {
  id: string;
  packedWidth: number;
  packedHeight: number;
  contentWidthPx: number;
  contentHeightPx: number;
  frameThicknessPx: number;
  drawnImageWidthPx: number;
  drawnImageHeightPx: number;
  maxOffsetX: number;
  maxOffsetY: number;
}

export interface BuildLayoutResult {
  pages: PageLayout[];
  overflowImageIds: string[];
  oversizedImageIds: string[];
  imageMetrics: Map<string, ImageMetrics>;
}

export interface PreviewTransform {
  dpr: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface ResizeSnapGuide {
  orientation: 'vertical' | 'horizontal';
  value: number;
  kind: 'edge' | 'size';
}

export interface LoadedImage {
  blob: Blob;
  src: string;
  image: HTMLImageElement;
  naturalWidth: number;
  naturalHeight: number;
}

export interface PersistedImageItem {
  id: string;
  fileName: string;
  sourceBlob: Blob;
  naturalWidth: number;
  naturalHeight: number;
  maxWidthCm: number;
  maxHeightCm: number;
  frameEnabled: boolean;
  frameThicknessPx: number;
  renderWidthPx: number;
  renderHeightPx: number;
  offsetX: number;
  offsetY: number;
  cropMaxOffsetX: number;
  cropMaxOffsetY: number;
  enhancedSrcBlob?: Blob;
}

export interface PersistedEditorSnapshot {
  version: 1;
  savedAt: number;
  settings: {
    maxImageCm: number;
    minImageCm: number;
    frameMm: number;
    gridModeEnabled: boolean;
    autoCompactPages: boolean;
    paginationMode: PaginationMode;
    interactionMode: InteractionMode;
    assistedPageCount: number;
    selectedPageIndex: number;
    layoutPresetId?: LayoutPresetId;
    canvasPresetId?: string;
    customCanvasWidthCm?: number;
    customCanvasHeightCm?: number;
  };
  pages: PageLayout[];
  overflowImageIds: string[];
  oversizedImageIds: string[];
  images: PersistedImageItem[];
}
