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

interface SnapCandidate {
  x: number;
  y: number;
  distance: number;
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
 * Snap moved rectangles to canvas edges/corners when close enough.
 */
export function getCanvasSnapPosition(
  x: number,
  y: number,
  width: number,
  height: number,
): { x: number; y: number; snapped: boolean } {
  const maxX = CANVAS_SIZE_PX - width;
  const maxY = CANVAS_SIZE_PX - height;

  if (maxX <= 0 || maxY <= 0) {
    return { x, y, snapped: false };
  }

  const threshold = 18;
  const candidates: SnapCandidate[] = [];

  const distLeft = Math.abs(x);
  const distRight = Math.abs(x - maxX);
  const distTop = Math.abs(y);
  const distBottom = Math.abs(y - maxY);

  if (distLeft <= threshold) {
    candidates.push({ x: 0, y, distance: distLeft });
  }
  if (distRight <= threshold) {
    candidates.push({ x: maxX, y, distance: distRight });
  }
  if (distTop <= threshold) {
    candidates.push({ x, y: 0, distance: distTop });
  }
  if (distBottom <= threshold) {
    candidates.push({ x, y: maxY, distance: distBottom });
  }

  const nearLeft = distLeft <= threshold;
  const nearRight = distRight <= threshold;
  const nearTop = distTop <= threshold;
  const nearBottom = distBottom <= threshold;

  if (nearLeft && nearTop) {
    candidates.push({ x: 0, y: 0, distance: Math.hypot(distLeft, distTop) });
  }
  if (nearRight && nearTop) {
    candidates.push({ x: maxX, y: 0, distance: Math.hypot(distRight, distTop) });
  }
  if (nearLeft && nearBottom) {
    candidates.push({ x: 0, y: maxY, distance: Math.hypot(distLeft, distBottom) });
  }
  if (nearRight && nearBottom) {
    candidates.push({ x: maxX, y: maxY, distance: Math.hypot(distRight, distBottom) });
  }

  if (!candidates.length) {
    return { x, y, snapped: false };
  }

  const best = candidates.reduce((closest, candidate) =>
    candidate.distance < closest.distance ? candidate : closest,
  );

  return {
    x: best.x,
    y: best.y,
    snapped: true,
  };
}

/**
 * Check if a position is outside the canvas bounds
 */
export function calculateOutsideRatio(
  x: number,
  y: number,
  width: number,
  height: number,
): number {
  const totalArea = width * height;
  if (totalArea <= 0) {
    return 0;
  }

  const insideLeft = Math.max(0, x);
  const insideTop = Math.max(0, y);
  const insideRight = Math.min(CANVAS_SIZE_PX, x + width);
  const insideBottom = Math.min(CANVAS_SIZE_PX, y + height);
  const insideWidth = Math.max(0, insideRight - insideLeft);
  const insideHeight = Math.max(0, insideBottom - insideTop);
  const insideArea = insideWidth * insideHeight;

  return (totalArea - insideArea) / totalArea;
}

export function isPositionOutsideCanvas(
  x: number,
  y: number,
  width: number,
  height: number,
): boolean {
  const outsideRatio = calculateOutsideRatio(x, y, width, height);

  // Remove-on-drop should only trigger when a meaningful portion is outside.
  return outsideRatio >= 0.05;
}
