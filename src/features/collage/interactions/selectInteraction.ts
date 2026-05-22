/**
 * Select Interaction Module
 * Provides Canva-style unified selection: click body → move, click handle → resize.
 */

/** The eight handle positions on a selected element. */
export type HandleType = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Computes the canvas-page-pixel coordinates for all 8 handles of an item. */
export function getSelectHandlePositions(item: Rect): Record<HandleType, { x: number; y: number }> {
  const { x, y, width, height } = item;
  return {
    nw: { x, y },
    n: { x: x + width / 2, y },
    ne: { x: x + width, y },
    e: { x: x + width, y: y + height / 2 },
    se: { x: x + width, y: y + height },
    s: { x: x + width / 2, y: y + height },
    sw: { x, y: y + height },
    w: { x, y: y + height / 2 },
  };
}

/**
 * Returns the handle type if `point` is within `hitRadiusPx` (page pixels) of any handle,
 * or `null` if the point is over the body of the item (or outside entirely).
 *
 * `hitRadiusPx` should be expressed in page pixel space.  Typical value:
 *   `10 * transform.dpr / transform.scale`  (≈ 10 CSS pixels)
 */
export function getHandleAtPoint(
  point: { x: number; y: number },
  item: Rect,
  hitRadiusPx: number,
): HandleType | null {
  const handles = getSelectHandlePositions(item);
  let bestHandle: HandleType | null = null;
  let bestDist = hitRadiusPx;

  for (const [type, pos] of Object.entries(handles) as [HandleType, { x: number; y: number }][]) {
    const dist = Math.hypot(point.x - pos.x, point.y - pos.y);
    if (dist <= bestDist) {
      bestDist = dist;
      bestHandle = type;
    }
  }

  if (bestHandle) {
    return bestHandle;
  }

  const withinExpandedBounds =
    point.x >= item.x - hitRadiusPx &&
    point.x <= item.x + item.width + hitRadiusPx &&
    point.y >= item.y - hitRadiusPx &&
    point.y <= item.y + item.height + hitRadiusPx;

  if (!withinExpandedBounds) {
    return null;
  }

  const distLeft = Math.abs(point.x - item.x);
  const distRight = Math.abs(point.x - (item.x + item.width));
  const distTop = Math.abs(point.y - item.y);
  const distBottom = Math.abs(point.y - (item.y + item.height));
  const nearLeft = distLeft <= hitRadiusPx;
  const nearRight = distRight <= hitRadiusPx;
  const nearTop = distTop <= hitRadiusPx;
  const nearBottom = distBottom <= hitRadiusPx;

  if (!nearLeft && !nearRight && !nearTop && !nearBottom) {
    return null;
  }

  const edgeCandidates: Array<{ handle: HandleType; distance: number; priority: number }> = [];
  if (nearLeft) {
    edgeCandidates.push({ handle: 'w', distance: distLeft, priority: 1 });
  }
  if (nearRight) {
    edgeCandidates.push({ handle: 'e', distance: distRight, priority: 1 });
  }
  if (nearTop) {
    edgeCandidates.push({ handle: 'n', distance: distTop, priority: 1 });
  }
  if (nearBottom) {
    edgeCandidates.push({ handle: 's', distance: distBottom, priority: 1 });
  }
  if (nearLeft && nearTop) {
    edgeCandidates.push({ handle: 'nw', distance: Math.max(distLeft, distTop), priority: 0 });
  }
  if (nearRight && nearTop) {
    edgeCandidates.push({ handle: 'ne', distance: Math.max(distRight, distTop), priority: 0 });
  }
  if (nearLeft && nearBottom) {
    edgeCandidates.push({ handle: 'sw', distance: Math.max(distLeft, distBottom), priority: 0 });
  }
  if (nearRight && nearBottom) {
    edgeCandidates.push({ handle: 'se', distance: Math.max(distRight, distBottom), priority: 0 });
  }

  return edgeCandidates.reduce((best, candidate) => {
    if (!best) {
      return candidate;
    }
    if (candidate.distance < best.distance) {
      return candidate;
    }
    if (candidate.distance === best.distance && candidate.priority < best.priority) {
      return candidate;
    }
    return best;
  }, null as { handle: HandleType; distance: number; priority: number } | null)?.handle ?? null;
}

/** Returns the fixed-edge anchors for a given handle (the opposite corner/side stays fixed). */
export function getHandleFixedEdges(handle: HandleType): {
  fixedHorizontal: 'left' | 'right';
  fixedVertical: 'top' | 'bottom';
} {
  switch (handle) {
    case 'nw': return { fixedHorizontal: 'right', fixedVertical: 'bottom' };
    case 'n':  return { fixedHorizontal: 'left',  fixedVertical: 'bottom' };
    case 'ne': return { fixedHorizontal: 'left',  fixedVertical: 'bottom' };
    case 'e':  return { fixedHorizontal: 'left',  fixedVertical: 'top' };
    case 'se': return { fixedHorizontal: 'left',  fixedVertical: 'top' };
    case 's':  return { fixedHorizontal: 'left',  fixedVertical: 'top' };
    case 'sw': return { fixedHorizontal: 'right', fixedVertical: 'top' };
    case 'w':  return { fixedHorizontal: 'right', fixedVertical: 'top' };
  }
}

/** Returns the Tailwind CSS cursor class for a given handle type. */
export function getCursorForHandle(handle: HandleType): string {
  switch (handle) {
    case 'nw': return 'cursor-nw-resize';
    case 'ne': return 'cursor-ne-resize';
    case 'sw': return 'cursor-sw-resize';
    case 'se': return 'cursor-se-resize';
    case 'n':  return 'cursor-n-resize';
    case 's':  return 'cursor-s-resize';
    case 'e':  return 'cursor-e-resize';
    case 'w':  return 'cursor-w-resize';
  }
}
