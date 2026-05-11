import { describe, expect, it } from 'vitest';
import { buildPaginatedLayout, clampOffsets } from './layoutEngine';
import type { ImageItem } from './types';

function makeImage(id: string, width: number, height: number): ImageItem {
  return {
    id,
    fileName: `${id}.jpg`,
    sourceBlob: new Blob(),
    originalSrc: `blob:${id}-orig`,
    src: `blob:${id}`,
    bitmap: {} as HTMLImageElement,
    naturalWidth: width,
    naturalHeight: height,
    maxWidthCm: 8,
    maxHeightCm: 8,
    frameEnabled: true,
    frameThicknessPx: 0,
    renderWidthPx: 0,
    renderHeightPx: 0,
    offsetX: 0,
    offsetY: 0,
    cropMaxOffsetX: 0,
    cropMaxOffsetY: 0,
  };
}

describe('layout engine', () => {
  it('builds at least one page and metrics for fit images', () => {
    const result = buildPaginatedLayout(
      [makeImage('a', 1200, 900), makeImage('b', 1000, 1500)],
      {
        canvasWidthPx: 1771,
        canvasHeightPx: 1771,
        allowUpscale: true,
      },
    );

    expect(result.pages.length).toBeGreaterThan(0);
    expect(result.imageMetrics.has('a')).toBe(true);
    expect(result.imageMetrics.has('b')).toBe(true);
  });

  it('clamps crop offsets', () => {
    expect(clampOffsets(20, -5, 10, 10)).toEqual({ offsetX: 10, offsetY: 0 });
  });
});
