/**
 * Shared geometric utility functions used across the application
 */

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Check if two rectangles overlap
 */
export function rectanglesOverlap(a: Rectangle, b: Rectangle): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/**
 * Check if a rectangle is completely inside canvas bounds
 */
export function isInsideCanvas(rect: Rectangle, canvasWidth: number, canvasHeight: number = canvasWidth): boolean {
  return rect.x >= 0 && rect.y >= 0 && rect.x + rect.width <= canvasWidth && rect.y + rect.height <= canvasHeight;
}

/**
 * Check if multiple rectangles have any overlaps
 */
export function hasAnyOverlaps(rectangles: Rectangle[]): boolean {
  for (let i = 0; i < rectangles.length; i += 1) {
    const current = rectangles[i];
    for (let j = i + 1; j < rectangles.length; j += 1) {
      if (rectanglesOverlap(current, rectangles[j])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Clamp offset values to prevent content from going outside frame
 */
export function clampCropOffset(
  offsetX: number,
  offsetY: number,
  maxOffsetX: number,
  maxOffsetY: number,
): { offsetX: number; offsetY: number } {
  return {
    offsetX: Math.max(0, Math.min(offsetX, maxOffsetX)),
    offsetY: Math.max(0, Math.min(offsetY, maxOffsetY)),
  };
}
