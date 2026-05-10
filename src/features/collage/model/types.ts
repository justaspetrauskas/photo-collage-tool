export type PaginationMode = 'auto' | 'assisted';

export interface ImageItem {
  id: string;
  fileName: string;
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

export interface LoadedImage {
  src: string;
  image: HTMLImageElement;
  naturalWidth: number;
  naturalHeight: number;
}
