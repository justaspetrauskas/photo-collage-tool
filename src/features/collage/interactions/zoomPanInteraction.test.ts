import { describe, expect, it } from 'vitest';
import { calculateZoomPanOffset, getZoomPanBounds, resolveZoomPanOffset } from './zoomPanInteraction';

describe('zoom pan interaction', () => {
  it('computes pan bounds from zoomed image coverage', () => {
    expect(
      getZoomPanBounds(
        {
          contentWidthPx: 200,
          contentHeightPx: 100,
          drawnImageWidthPx: 200,
          drawnImageHeightPx: 100,
        },
        1.5,
      ),
    ).toEqual({ maxX: 50, maxY: 25 });
  });

  it('calculates normalized pan offsets from drag movement', () => {
    expect(
      calculateZoomPanOffset(100, 100, 130, 80, 0, 0, {
        maxX: 60,
        maxY: 40,
      }),
    ).toEqual({ x: 0.5, y: -0.5 });
  });

  it('clamps resolved offsets to the available zoom pan bounds', () => {
    expect(resolveZoomPanOffset({ x: 1.8, y: -2.2 }, { maxX: 45, maxY: 30 })).toEqual({
      x: 45,
      y: -30,
    });
  });
});
