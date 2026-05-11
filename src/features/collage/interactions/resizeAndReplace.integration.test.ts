import { describe, expect, it } from 'vitest';
import { resolvePushLayout } from './resizeInteraction';
import { canSwapImages } from './replaceInteraction';
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

describe('resize + replace interaction integration behavior', () => {
  it('pushes neighboring items during resize when there is space', () => {
    const items = [makeItem('a', 0, 0, 100, 100), makeItem('b', 100, 0, 100, 100)];
    const resolved = resolvePushLayout(items, 0, { x: 0, y: 0, width: 140, height: 100 }, 'x');
    expect(resolved).not.toBeNull();
    expect(resolved?.[1].x).toBeGreaterThanOrEqual(140);
  });

  it('allows swap when candidates do not overlap other items', () => {
    const source = makeItem('a', 0, 0, 100, 100);
    const target = makeItem('b', 200, 0, 100, 100);
    const other = [makeItem('c', 400, 0, 100, 100)];
    expect(canSwapImages(source, target, other)).toBe(true);
  });

  it('rejects swap when target position would overlap another item', () => {
    const source = makeItem('a', 0, 0, 120, 120);
    const target = makeItem('b', 200, 0, 120, 120);
    const other = [makeItem('c', 210, 10, 100, 100)];
    expect(canSwapImages(source, target, other)).toBe(false);
  });
});
