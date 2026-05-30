import { describe, expect, it } from 'vitest';
import type { ImageItem, PageLayout } from '../../model/types';
import { buildPersistedEditorSnapshot, toPersistedImageItem } from './editorSnapshot';

function createImageItem(overrides: Partial<ImageItem> = {}): ImageItem {
  return {
    id: 'img-1',
    fileName: 'photo.jpg',
    sourceBlob: new Blob(['image']),
    originalSrc: 'blob:original',
    src: 'blob:current',
    bitmap: {} as HTMLImageElement,
    naturalWidth: 100,
    naturalHeight: 80,
    maxWidthCm: 8,
    maxHeightCm: 8,
    frameEnabled: true,
    frameThicknessPx: 12,
    renderWidthPx: 120,
    renderHeightPx: 96,
    offsetX: 4,
    offsetY: -3,
    cropMaxOffsetX: 10,
    cropMaxOffsetY: 8,
    ...overrides,
  };
}

const page: PageLayout = {
  id: 'page-1',
  widthPx: 1000,
  heightPx: 1000,
  items: [],
};

describe('editorSnapshot', () => {
  it('maps an image to persisted image item fields', () => {
    const persisted = toPersistedImageItem(createImageItem());
    expect(persisted).toMatchObject({
      id: 'img-1',
      fileName: 'photo.jpg',
      sourceBlob: expect.any(Blob),
      naturalWidth: 100,
      naturalHeight: 80,
      maxWidthCm: 8,
      maxHeightCm: 8,
      frameEnabled: true,
      frameThicknessPx: 12,
      renderWidthPx: 120,
      renderHeightPx: 96,
      offsetX: 4,
      offsetY: -3,
      cropMaxOffsetX: 10,
      cropMaxOffsetY: 8,
    });
  });

  it('builds a versioned snapshot with provided settings', () => {
    const persisted = toPersistedImageItem(createImageItem());
    const snapshot = buildPersistedEditorSnapshot([persisted], [page], ['a'], ['b'], {
      maxImageCm: 8,
      minImageCm: 3,
      frameMm: 4,
      gridModeEnabled: false,
      autoCompactPages: true,
      paginationMode: 'auto',
      interactionMode: 'select',
      assistedPageCount: 1,
      selectedPageIndex: 0,
      layoutPresetId: 'auto',
      canvasPresetId: 'square_20',
      customCanvasWidthCm: 20,
      customCanvasHeightCm: 20,
    });

    expect(snapshot.version).toBe(1);
    expect(snapshot.pages).toHaveLength(1);
    expect(snapshot.overflowImageIds).toEqual(['a']);
    expect(snapshot.oversizedImageIds).toEqual(['b']);
    expect(snapshot.images).toHaveLength(1);
    expect(snapshot.settings).toMatchObject({
      maxImageCm: 8,
      minImageCm: 3,
      frameMm: 4,
      gridModeEnabled: false,
      autoCompactPages: true,
      paginationMode: 'auto',
      interactionMode: 'select',
      assistedPageCount: 1,
      selectedPageIndex: 0,
      layoutPresetId: 'auto',
      canvasPresetId: 'square_20',
      customCanvasWidthCm: 20,
      customCanvasHeightCm: 20,
    });
  });
});
