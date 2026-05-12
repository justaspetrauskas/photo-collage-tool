import { describe, expect, it } from 'vitest';
import { getResizeAssistSnap } from './resizeInteraction';
import type { PositionedImage } from '../model/types';

function makeItem(imageId: string, x: number, y: number, width: number, height: number): PositionedImage {
  return {
    imageId,
    x,
    y,
    width,
    height,
    contentWidthPx: width,
    contentHeightPx: height,
    frameThicknessPx: 0,
    drawnImageWidthPx: width,
    drawnImageHeightPx: height,
    maxOffsetX: 0,
    maxOffsetY: 0,
  };
}

describe('resize interaction snapping assist', () => {
  it('snaps to a nearby neighboring edge within threshold', () => {
    const result = getResizeAssistSnap({
      baseRect: { x: 0, y: 0, width: 100, height: 100 },
      fixedHorizontal: 'left',
      fixedVertical: 'top',
      requestedDeltaCm: 3.2,
      neighbors: [makeItem('b', 130, 320, 40, 40)],
      pxPerCm: 10,
      thresholdPx: 3,
    });

    expect(result.snapped).toBe(true);
    expect(result.deltaCm).toBeCloseTo(3, 5);
    expect(result.guides).toContainEqual({ orientation: 'vertical', value: 130, kind: 'edge' });
  });

  it('prefers edge snapping over dimension snapping when distances are equal', () => {
    const result = getResizeAssistSnap({
      baseRect: { x: 0, y: 0, width: 100, height: 100 },
      fixedHorizontal: 'left',
      fixedVertical: 'top',
      requestedDeltaCm: 3.0,
      neighbors: [makeItem('b', 131, 320, 129, 40)],
      pxPerCm: 10,
      thresholdPx: 2,
    });

    expect(result.snapped).toBe(true);
    expect(result.deltaCm).toBeCloseTo(3.1, 5);
    expect(result.guides.some((guide) => guide.kind === 'edge')).toBe(true);
  });

  it('does not snap when targets are outside threshold', () => {
    const requestedDeltaCm = 1;
    const result = getResizeAssistSnap({
      baseRect: { x: 0, y: 0, width: 100, height: 100 },
      fixedHorizontal: 'left',
      fixedVertical: 'top',
      requestedDeltaCm,
      neighbors: [makeItem('b', 150, 320, 40, 40)],
      pxPerCm: 10,
      thresholdPx: 5,
    });

    expect(result).toEqual({
      deltaCm: requestedDeltaCm,
      snapped: false,
      guides: [],
    });
  });
});
