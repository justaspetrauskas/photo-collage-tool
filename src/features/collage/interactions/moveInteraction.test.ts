import { describe, expect, it } from 'vitest';
import { calculateNewPosition, calculateOutsideRatio, getCanvasSnapPosition, isPositionOutsideCanvas } from './moveInteraction';
import { CANVAS_SIZE_PX } from '../model/constants';

describe('move interaction', () => {
  it('calculates new position from drag deltas', () => {
    expect(calculateNewPosition(10, 10, 20, 35, 100, 200)).toEqual({ x: 110, y: 225 });
  });

  it('snaps near canvas edges', () => {
    const width = 100;
    const height = 100;
    const maxX = CANVAS_SIZE_PX - width;
    const maxY = CANVAS_SIZE_PX - height;

    expect(getCanvasSnapPosition(6, 25, width, height)).toEqual({ x: 0, y: 25, snapped: true });
    expect(getCanvasSnapPosition(maxX - 7, maxY - 8, width, height)).toEqual({ x: maxX, y: maxY - 8, snapped: true });
  });

  it('reports outside ratio and outside threshold', () => {
    const ratio = calculateOutsideRatio(-10, 0, 100, 100);
    expect(ratio).toBeGreaterThan(0);
    expect(isPositionOutsideCanvas(-2, 0, 100, 100)).toBe(false);
    expect(isPositionOutsideCanvas(-20, 0, 100, 100)).toBe(true);
  });
});
