/**
 * Move Interaction Module
 * Handles all move-related logic and state management
 */

import { CANVAS_SIZE_PX } from '../model/constants';

export interface MoveInteractionState {
  imageId: string;
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
}

/**
 * Calculate new position based on drag delta
 */
export function calculateNewPosition(
  startX: number,
  startY: number,
  currentX: number,
  currentY: number,
  baseX: number,
  baseY: number,
): { x: number; y: number } {
  const deltaX = currentX - startX;
  const deltaY = currentY - startY;

  return {
    x: baseX + deltaX,
    y: baseY + deltaY,
  };
}

/**
 * Check if a position is outside the canvas bounds
 */
export function isPositionOutsideCanvas(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  return x < 0 || y < 0 || x + width > CANVAS_SIZE_PX || y + height > CANVAS_SIZE_PX;
}
