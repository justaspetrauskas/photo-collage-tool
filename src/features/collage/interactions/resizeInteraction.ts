/**
 * Resize Interaction Module
 * Handles all resize-related logic and state management
 */

import { CANVAS_SIZE_PX } from '../model/constants';
import { rectanglesOverlap, isInsideCanvas } from '../../../shared/math';
import type { PositionedImage } from '../model/types';
import type { ResizeSnapGuide } from '../model/types';

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

interface ResizeSnapCandidate {
  deltaCm: number;
  distancePx: number;
  priority: number;
  guide?: ResizeSnapGuide;
}

const SNAP_DELTA_EPSILON_CM = 0.0001;

interface ResizeAssistSnapInput {
  baseRect: { x: number; y: number; width: number; height: number };
  fixedHorizontal: 'left' | 'right';
  fixedVertical: 'top' | 'bottom';
  requestedDeltaCm: number;
  neighbors: PositionedImage[];
  pxPerCm: number;
  thresholdPx: number;
  includeDimensionMatches?: boolean;
}

export interface ResizeAssistSnapResult {
  deltaCm: number;
  snapped: boolean;
  guides: ResizeSnapGuide[];
}

function pushCandidate(
  candidates: ResizeSnapCandidate[],
  requestedDeltaCm: number,
  pxPerCm: number,
  thresholdPx: number,
  candidate: Omit<ResizeSnapCandidate, 'distancePx'>,
): void {
  const distancePx = Math.abs((candidate.deltaCm - requestedDeltaCm) * pxPerCm);
  if (distancePx > thresholdPx) {
    return;
  }
  candidates.push({
    ...candidate,
    distancePx,
  });
}

export function getResizeAssistSnap({
  baseRect,
  fixedHorizontal,
  fixedVertical,
  requestedDeltaCm,
  neighbors,
  pxPerCm,
  thresholdPx,
  includeDimensionMatches = true,
}: ResizeAssistSnapInput): ResizeAssistSnapResult {
  if (pxPerCm <= 0 || thresholdPx <= 0 || neighbors.length === 0) {
    return { deltaCm: requestedDeltaCm, snapped: false, guides: [] };
  }

  const movingVerticalEdge = fixedHorizontal === 'left' ? baseRect.x + baseRect.width : baseRect.x;
  const movingHorizontalEdge = fixedVertical === 'top' ? baseRect.y + baseRect.height : baseRect.y;
  const candidates: ResizeSnapCandidate[] = [];

  for (const neighbor of neighbors) {
    const edgeTargetsX = [neighbor.x, neighbor.x + neighbor.width];
    for (const targetX of edgeTargetsX) {
      const deltaPx = fixedHorizontal === 'left' ? targetX - movingVerticalEdge : movingVerticalEdge - targetX;
      pushCandidate(candidates, requestedDeltaCm, pxPerCm, thresholdPx, {
        deltaCm: deltaPx / pxPerCm,
        priority: 0,
        guide: { orientation: 'vertical', value: targetX, kind: 'edge' },
      });
    }

    const edgeTargetsY = [neighbor.y, neighbor.y + neighbor.height];
    for (const targetY of edgeTargetsY) {
      const deltaPx = fixedVertical === 'top' ? targetY - movingHorizontalEdge : movingHorizontalEdge - targetY;
      pushCandidate(candidates, requestedDeltaCm, pxPerCm, thresholdPx, {
        deltaCm: deltaPx / pxPerCm,
        priority: 0,
        guide: { orientation: 'horizontal', value: targetY, kind: 'edge' },
      });
    }

    if (!includeDimensionMatches) {
      continue;
    }

    pushCandidate(candidates, requestedDeltaCm, pxPerCm, thresholdPx, {
      deltaCm: (neighbor.width - baseRect.width) / pxPerCm,
      priority: 1,
      guide: {
        orientation: 'vertical',
        value: fixedHorizontal === 'left' ? baseRect.x + neighbor.width : baseRect.x + baseRect.width - neighbor.width,
        kind: 'size',
      },
    });

    pushCandidate(candidates, requestedDeltaCm, pxPerCm, thresholdPx, {
      deltaCm: (neighbor.height - baseRect.height) / pxPerCm,
      priority: 1,
      guide: {
        orientation: 'horizontal',
        value: fixedVertical === 'top' ? baseRect.y + neighbor.height : baseRect.y + baseRect.height - neighbor.height,
        kind: 'size',
      },
    });
  }

  if (!candidates.length) {
    return { deltaCm: requestedDeltaCm, snapped: false, guides: [] };
  }

  const best = candidates.reduce((currentBest, candidate) => {
    if (candidate.distancePx < currentBest.distancePx) {
      return candidate;
    }
    if (candidate.distancePx === currentBest.distancePx && candidate.priority < currentBest.priority) {
      return candidate;
    }
    return currentBest;
  });

  const seenGuideKeys = new Set<string>();
  const guides = candidates
    .filter((candidate) => candidate.guide && Math.abs(candidate.deltaCm - best.deltaCm) < SNAP_DELTA_EPSILON_CM)
    .map((candidate) => candidate.guide!)
    .filter((guide) => {
      const key = `${guide.orientation}:${guide.kind}:${guide.value}`;
      if (seenGuideKeys.has(key)) {
        return false;
      }
      seenGuideKeys.add(key);
      return true;
    });

  return {
    deltaCm: best.deltaCm,
    snapped: true,
    guides,
  };
}
