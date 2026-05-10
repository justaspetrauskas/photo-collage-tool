/**
 * Shared image scaling and sizing utility functions
 */

import { cmToPx } from '../../features/collage/model/constants';

/**
 * Compute the dimensions of an image content box given max constraints
 */
export function computeContentBox(
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

/**
 * Compute crop metrics for an image to cover a frame
 */
export function computeCropMetrics(
  naturalWidth: number,
  naturalHeight: number,
  frameWidth: number,
  frameHeight: number,
): {
  drawnImageWidthPx: number;
  drawnImageHeightPx: number;
  maxOffsetX: number;
  maxOffsetY: number;
} {
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
