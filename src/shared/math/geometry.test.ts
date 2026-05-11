import { describe, expect, it } from 'vitest';
import { clampCropOffset, rectanglesOverlap, isInsideCanvas } from './geometry';

describe('geometry utilities', () => {
  it('detects rectangle overlap', () => {
    expect(rectanglesOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toBe(
      true,
    );
    expect(rectanglesOverlap({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 10, width: 10, height: 10 })).toBe(
      false,
    );
  });

  it('checks canvas bounds', () => {
    expect(isInsideCanvas({ x: 0, y: 0, width: 100, height: 100 }, 100)).toBe(true);
    expect(isInsideCanvas({ x: -1, y: 0, width: 100, height: 100 }, 100)).toBe(false);
  });

  it('clamps crop offsets', () => {
    expect(clampCropOffset(20, -5, 10, 15)).toEqual({ offsetX: 10, offsetY: 0 });
  });
});
