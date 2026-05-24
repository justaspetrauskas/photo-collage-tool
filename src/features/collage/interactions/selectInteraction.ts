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
  options: { cornersOnly?: boolean } = {},
): HandleType | null {
  const handleOrder: HandleType[] = options.cornersOnly
    ? ['nw', 'ne', 'sw', 'se']
    : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

  if (options.cornersOnly) {
    const handleSize = hitRadiusPx;
    const half = handleSize / 2;
    let bestCorner: HandleType | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const type of handleOrder) {
      const boxX = type === 'nw' || type === 'sw' ? item.x - half : item.x + item.width - half;
      const boxY = type === 'nw' || type === 'ne' ? item.y - half : item.y + item.height - half;
      const insideBox =
        point.x >= boxX &&
        point.x <= boxX + handleSize &&
        point.y >= boxY &&
        point.y <= boxY + handleSize;

      if (insideBox) {
        const score = Math.max(point.x - boxX, point.y - boxY);
        if (score < bestScore) {
          bestScore = score;
          bestCorner = type;
        }
      }
    }

    return bestCorner;
  }

  const handles = getSelectHandlePositions(item);

  let bestHandle: HandleType | null = null;
  let bestDist = hitRadiusPx;

  for (const type of handleOrder) {
    const pos = handles[type];
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

/** Returns true if the handle is one of the four corner handles (nw, ne, sw, se). */
export function isCornerHandle(handle: HandleType): handle is 'nw' | 'ne' | 'sw' | 'se' {
  return handle === 'nw' || handle === 'ne' || handle === 'sw' || handle === 'se';
}

/** Returns the CSS cursor value for a given handle type. */
export function getCursorForHandle(handle: HandleType): string {
  switch (handle) {
    case 'nw': return 'nw-resize';
    case 'ne': return 'ne-resize';
    case 'sw': return 'sw-resize';
    case 'se': return 'se-resize';
    case 'n':  return 'n-resize';
    case 's':  return 's-resize';
    case 'e':  return 'e-resize';
    case 'w':  return 'w-resize';
  }
}
