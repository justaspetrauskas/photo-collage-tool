import { describe, expect, it } from 'vitest';
import { buildPaginatedLayout, clampOffsets } from './layoutEngine';
import type { ImageItem } from './types';
import type { LayoutPresetId } from './constants';

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

function expectWithinCanvas(result: ReturnType<typeof buildPaginatedLayout>) {
  const page = result.pages[0];
  if (!page) {
    return;
  }

  for (const item of page.items) {
    expect(item.x).toBeGreaterThanOrEqual(0);
    expect(item.y).toBeGreaterThanOrEqual(0);
    expect(item.x + item.width).toBeLessThanOrEqual(page.widthPx);
    expect(item.y + item.height).toBeLessThanOrEqual(page.heightPx);
  }
}

function expectNoOverlap(result: ReturnType<typeof buildPaginatedLayout>) {
  const page = result.pages[0];
  if (!page) {
    return;
  }

  for (let i = 0; i < page.items.length; i += 1) {
    const a = page.items[i];
    for (let j = i + 1; j < page.items.length; j += 1) {
      const b = page.items[j];
      const overlap = !(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y);
      expect(overlap).toBe(false);
    }
  }
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

  it.each<LayoutPresetId>(['grid_2x2', 'grid_3x3', 'mosaic', 'story_strip', 'hero_supporting'])(
    'builds a safe single-page preset layout for %s',
    (preset) => {
      const imageCount = preset === 'grid_3x3' ? 6 : preset === 'story_strip' ? 4 : 5;
      const images = Array.from({ length: imageCount }, (_, idx) =>
        makeImage(`img-${idx + 1}`, 1000 + idx * 50, 1200 - idx * 30),
      );

      const result = buildPaginatedLayout(images, {
        canvasWidthPx: 1771,
        canvasHeightPx: 1771,
        allowUpscale: true,
        layoutPresetId: preset,
      });

      expect(result.pages.length).toBe(1);
      expect(result.pages[0].items.length).toBe(images.length);
      expectWithinCanvas(result);
      expectNoOverlap(result);
    },
  );

  it('uses orientation-aware story strip slots', () => {
    const images = [makeImage('a', 1200, 900), makeImage('b', 1200, 900), makeImage('c', 1200, 900)];

    const landscape = buildPaginatedLayout(images, {
      canvasWidthPx: 2400,
      canvasHeightPx: 1200,
      allowUpscale: true,
      layoutPresetId: 'story_strip',
    });
    const portrait = buildPaginatedLayout(images, {
      canvasWidthPx: 1200,
      canvasHeightPx: 2400,
      allowUpscale: true,
      layoutPresetId: 'story_strip',
    });

    expect(landscape.pages[0].items[0].y).toBe(landscape.pages[0].items[1].y);
    expect(landscape.pages[0].items[0].x).toBeLessThan(landscape.pages[0].items[1].x);

    expect(portrait.pages[0].items[0].x).toBe(portrait.pages[0].items[1].x);
    expect(portrait.pages[0].items[0].y).toBeLessThan(portrait.pages[0].items[1].y);
  });

  it('falls back to auto pack when preset cannot satisfy input', () => {
    const images = Array.from({ length: 5 }, (_, idx) => makeImage(`img-${idx + 1}`, 1200, 900));
    const result = buildPaginatedLayout(images, {
      canvasWidthPx: 1771,
      canvasHeightPx: 1771,
      allowUpscale: true,
      layoutPresetId: 'grid_2x2',
    });

    expect(result.imageMetrics.size).toBe(5);
  });
});
