/**
 * Consolidated drag state types and utilities for all interaction modes
 */

/**
 * Unified drag state for all interaction types
 */
export type DragState = CropDragState | ResizeDragState | ReplaceDragState | MoveDragState;

export interface CropDragState {
  type: 'crop';
  imageId: string;
  startX: number;
  startY: number;
  baseOffsetX: number;
  baseOffsetY: number;
  maxOffsetX: number;
  maxOffsetY: number;
}

export interface ResizeDragState {
  type: 'resize';
  imageId: string;
  startX: number;
  startY: number;
  fixedHorizontal: 'left' | 'right';
  fixedVertical: 'top' | 'bottom';
  baseMaxWidthCm: number;
  baseMaxHeightCm: number;
  baseX: number;
  baseY: number;
  baseWidth: number;
  baseHeight: number;
}

export interface ReplaceDragState {
  type: 'replace';
  sourceImageId: string;
}

export interface MoveDragState {
  type: 'move';
  imageId: string;
  startX: number;
  startY: number;
  baseX: number;
  baseY: number;
}

/**
 * Type guards for drag states
 */
export function isCropDrag(state: DragState | null): state is CropDragState {
  return state?.type === 'crop';
}

export function isResizeDrag(state: DragState | null): state is ResizeDragState {
  return state?.type === 'resize';
}

export function isReplaceDrag(state: DragState | null): state is ReplaceDragState {
  return state?.type === 'replace';
}

export function isMoveDrag(state: DragState | null): state is MoveDragState {
  return state?.type === 'move';
}
