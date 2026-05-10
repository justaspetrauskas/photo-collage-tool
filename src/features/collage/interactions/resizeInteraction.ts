/**
 * Resize Interaction Module
 * Handles all resize-related logic and state management
 */

import { CANVAS_SIZE_PX } from '../model/constants';
import { rectanglesOverlap, isInsideCanvas } from '../../../shared/math';
import type { PositionedImage } from '../model/types';

export interface ResizeInteractionState {
  imageId: string;
  startX: number;
  startY: number;
  baseMaxWidthCm: number;
  baseMaxHeightCm: number;
  baseX: number;
  baseY: number;
  baseWidth: number;
  baseHeight: number;
}

/**
 * Check if a position overlaps with any item in the list
 */
function overlaps(
  pos: { x: number; y: number; width: number; height: number },
  otherItems: PositionedImage[],
): boolean {
  return otherItems.some((item) => rectanglesOverlap(pos, item));
}

/**
 * Apply push layout algorithm to resolve overlaps
 * Returns resolved items or null if no valid layout exists
 */
export function resolvePushLayout(
  items: PositionedImage[],
  anchorIndex: number,
  anchorRect: { x: number; y: number; width: number; height: number },
  preferredAxis: 'x' | 'y',
): PositionedImage[] | null {
  const nextItems = items.map((item, index) => {
    if (index !== anchorIndex) {
      return { ...item };
    }

    return {
      ...item,
      x: anchorRect.x,
      y: anchorRect.y,
      width: anchorRect.width,
      height: anchorRect.height,
    };
  });

  const queue: number[] = [anchorIndex];
  const queued = new Set<number>([anchorIndex]);
  let guard = 0;

  while (queue.length) {
    const currentIndex = queue.shift()!;
    queued.delete(currentIndex);
    const current = nextItems[currentIndex];

    for (let otherIndex = 0; otherIndex < nextItems.length; otherIndex += 1) {
      if (otherIndex === currentIndex) {
        continue;
      }

      const other = nextItems[otherIndex];
      if (!rectanglesOverlap(current, other)) {
        continue;
      }

      const pushRight = current.x + current.width - other.x;
      const pushDown = current.y + current.height - other.y;

      const rightCandidate = {
        ...other,
        x: other.x + pushRight,
      };
      const downCandidate = {
        ...other,
        y: other.y + pushDown,
      };

      const rightFits = isInsideCanvas(rightCandidate, CANVAS_SIZE_PX);
      const downFits = isInsideCanvas(downCandidate, CANVAS_SIZE_PX);

      if (!rightFits && !downFits) {
        return null;
      }

      const useRight = preferredAxis === 'x' ? rightFits || !downFits : rightFits && !downFits;
      nextItems[otherIndex] = useRight ? rightCandidate : downCandidate;

      if (!queued.has(otherIndex)) {
        queue.push(otherIndex);
        queued.add(otherIndex);
      }
    }

    guard += 1;
    if (guard > 2000) {
      return null;
    }
  }

  // Verify final state has no overlaps and all items fit
  for (let i = 0; i < nextItems.length; i += 1) {
    if (!isInsideCanvas(nextItems[i], CANVAS_SIZE_PX)) {
      return null;
    }

    for (let j = i + 1; j < nextItems.length; j += 1) {
      if (rectanglesOverlap(nextItems[i], nextItems[j])) {
        return null;
      }
    }
  }

  return nextItems;
}

/**
 * Calculate the preferred push axis based on drag deltas
 */
export function getPreferredPushAxis(deltaX: number, deltaY: number): 'x' | 'y' {
  return Math.abs(deltaX) >= Math.abs(deltaY) ? 'x' : 'y';
}
