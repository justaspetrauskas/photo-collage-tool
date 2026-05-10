/**
 * Crop Interaction Module
 * Handles all crop-related logic and state management
 */

import { clampCropOffset } from '../../../shared/math';

export interface CropInteractionState {
  imageId: string;
  startX: number;
  startY: number;
  baseOffsetX: number;
  baseOffsetY: number;
  maxOffsetX: number;
  maxOffsetY: number;
}

/**
 * Calculate new crop offsets based on drag delta
 */
export function calculateCropOffsets(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  baseOffsetX: number,
  baseOffsetY: number,
  maxOffsetX: number,
  maxOffsetY: number,
): { offsetX: number; offsetY: number } {
  const deltaX = currentX - startX;
  const deltaY = currentY - startY;

  const newOffsetX = baseOffsetX - deltaX;
  const newOffsetY = baseOffsetY - deltaY;

  return clampCropOffset(newOffsetX, newOffsetY, maxOffsetX, maxOffsetY);
}
