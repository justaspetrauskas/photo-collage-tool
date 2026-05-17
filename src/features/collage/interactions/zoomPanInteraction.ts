function clampRatio(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

export interface ZoomPanBounds {
  maxX: number;
  maxY: number;
}

export interface ZoomPanFrame {
  contentWidthPx: number;
  contentHeightPx: number;
  drawnImageWidthPx: number;
  drawnImageHeightPx: number;
}

export function getZoomPanBounds(frame: ZoomPanFrame, zoom: number): ZoomPanBounds {
  if (zoom <= 1) {
    return { maxX: 0, maxY: 0 };
  }

  return {
    maxX: Math.max(0, (frame.drawnImageWidthPx * zoom - frame.contentWidthPx) / 2),
    maxY: Math.max(0, (frame.drawnImageHeightPx * zoom - frame.contentHeightPx) / 2),
  };
}

export function resolveZoomPanOffset(
  panRatio: { x: number; y: number } | undefined,
  bounds: ZoomPanBounds,
): { x: number; y: number } {
  const x = panRatio?.x ?? 0;
  const y = panRatio?.y ?? 0;

  return {
    x: bounds.maxX > 0 ? clampRatio(x) * bounds.maxX : 0,
    y: bounds.maxY > 0 ? clampRatio(y) * bounds.maxY : 0,
  };
}

export function calculateZoomPanOffset(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  basePanRatioX: number,
  basePanRatioY: number,
  bounds: ZoomPanBounds,
): { x: number; y: number } {
  const deltaX = currentX - startX;
  const deltaY = currentY - startY;
  const baseX = bounds.maxX > 0 ? clampRatio(basePanRatioX) * bounds.maxX : 0;
  const baseY = bounds.maxY > 0 ? clampRatio(basePanRatioY) * bounds.maxY : 0;

  return {
    x: bounds.maxX > 0 ? clampRatio((baseX + deltaX) / bounds.maxX) : 0,
    y: bounds.maxY > 0 ? clampRatio((baseY + deltaY) / bounds.maxY) : 0,
  };
}
