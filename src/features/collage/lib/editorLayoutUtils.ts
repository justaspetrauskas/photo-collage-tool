import type { ImageItem, ImageMetrics, PositionedImage } from '../model/types';
import { cmToPx } from '../model/constants';
import { clampOffsets } from '../model/layoutEngine';
import { computeCropMetrics } from '../../../shared/math';

export interface PlacementSize {
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

export function analyzeImageSaliency(image: ImageItem): { x: number; y: number; spread: number } {
  const sampleSize = 80;
  const canvas = document.createElement('canvas');
  canvas.width = sampleSize;
  canvas.height = sampleSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { x: 0.5, y: 0.5, spread: 0.3 };
  }

  ctx.drawImage(image.bitmap, 0, 0, sampleSize, sampleSize);
  const { data } = ctx.getImageData(0, 0, sampleSize, sampleSize);

  let totalWeight = 0;
  let weightedX = 0;
  let weightedY = 0;
  let weightedX2 = 0;
  let weightedY2 = 0;

  for (let y = 1; y < sampleSize - 1; y += 1) {
    for (let x = 1; x < sampleSize - 1; x += 1) {
      const i = (y * sampleSize + x) * 4;
      const ix = (y * sampleSize + (x + 1)) * 4;
      const iy = ((y + 1) * sampleSize + x) * 4;

      const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      const lumX = 0.299 * data[ix] + 0.587 * data[ix + 1] + 0.114 * data[ix + 2];
      const lumY = 0.299 * data[iy] + 0.587 * data[iy + 1] + 0.114 * data[iy + 2];

      const edge = Math.abs(lumX - lum) + Math.abs(lumY - lum);
      const weight = edge + 1;

      const nx = x / sampleSize;
      const ny = y / sampleSize;

      totalWeight += weight;
      weightedX += nx * weight;
      weightedY += ny * weight;
      weightedX2 += nx * nx * weight;
      weightedY2 += ny * ny * weight;
    }
  }

  if (totalWeight <= 0) {
    return { x: 0.5, y: 0.5, spread: 0.3 };
  }

  const cx = weightedX / totalWeight;
  const cy = weightedY / totalWeight;
  const varX = Math.max(0, weightedX2 / totalWeight - cx * cx);
  const varY = Math.max(0, weightedY2 / totalWeight - cy * cy);
  const spread = Math.sqrt((varX + varY) / 2);

  return { x: cx, y: cy, spread };
}

export function resolveSmartFraming(
  image: ImageItem,
  metrics: ImageMetrics,
): { offsetX: number; offsetY: number; zoom: number } {
  const saliency = analyzeImageSaliency(image);

  const targetOffsetX = saliency.x * metrics.drawnImageWidthPx - metrics.contentWidthPx / 2;
  const targetOffsetY = saliency.y * metrics.drawnImageHeightPx - metrics.contentHeightPx / 2;

  const clamped = clampOffsets(
    targetOffsetX,
    targetOffsetY,
    metrics.maxOffsetX,
    metrics.maxOffsetY,
  );

  const zoom = saliency.spread < 0.16 ? 1.14 : saliency.spread < 0.22 ? 1.08 : 1;

  return {
    offsetX: clamped.offsetX,
    offsetY: clamped.offsetY,
    zoom,
  };
}

/**
 * Computes a drop size that prefers fitting within local free space around the drop point.
 * The function shrinks the proposed slot when nearby placed items or page bounds constrain
 * available width/height, while preserving minimum content size and recalculating crop metrics.
 */
export function computeSmartDropSize(
  image: ImageItem,
  proposedSize: PlacementSize,
  dropX: number,
  dropY: number,
  canvasWidthPx: number,
  canvasHeightPx: number,
  existingItems: PositionedImage[],
  minImageCm: number,
): PlacementSize {
  const minContentPx = cmToPx(minImageCm);
  const frameThicknessPx = proposedSize.frameThicknessPx;

  let availableWidth = canvasWidthPx - dropX;

  for (const existing of existingItems) {
    const existingRight = existing.x + existing.width;
    const existingBottom = existing.y + existing.height;
    const dropBottom = dropY + proposedSize.height;

    if (existingRight > dropX && existing.y < dropBottom && existingBottom > dropY) {
      const rightmostConflict = existingRight;
      availableWidth = Math.min(availableWidth, rightmostConflict - dropX);
    }
  }

  let availableHeight = canvasHeightPx - dropY;

  for (const existing of existingItems) {
    const existingRight = existing.x + existing.width;
    const existingBottom = existing.y + existing.height;
    const dropRight = dropX + proposedSize.width;

    if (existingBottom > dropY && existing.x < dropRight && existingRight > dropX) {
      const bottomMostConflict = existingBottom;
      availableHeight = Math.min(availableHeight, bottomMostConflict - dropY);
    }
  }

  let finalWidth = proposedSize.width;
  let finalHeight = proposedSize.height;

  if (finalWidth > availableWidth || finalHeight > availableHeight) {
    const scaleX = finalWidth > availableWidth ? availableWidth / finalWidth : 1;
    const scaleY = finalHeight > availableHeight ? availableHeight / finalHeight : 1;
    const scale = Math.min(scaleX, scaleY);

    finalWidth = Math.round(proposedSize.width * scale);
    finalHeight = Math.round(proposedSize.height * scale);
  }

  const minTotalPx = minContentPx + frameThicknessPx * 2;
  if (finalWidth < minTotalPx || finalHeight < minTotalPx) {
    return proposedSize;
  }

  const finalContentWidthPx = finalWidth - frameThicknessPx * 2;
  const finalContentHeightPx = finalHeight - frameThicknessPx * 2;

  const crop = computeCropMetrics(
    image.naturalWidth,
    image.naturalHeight,
    finalContentWidthPx,
    finalContentHeightPx,
  );

  return {
    width: finalWidth,
    height: finalHeight,
    contentWidthPx: finalContentWidthPx,
    contentHeightPx: finalContentHeightPx,
    frameThicknessPx,
    drawnImageWidthPx: crop.drawnImageWidthPx,
    drawnImageHeightPx: crop.drawnImageHeightPx,
    maxOffsetX: crop.maxOffsetX,
    maxOffsetY: crop.maxOffsetY,
  };
}
