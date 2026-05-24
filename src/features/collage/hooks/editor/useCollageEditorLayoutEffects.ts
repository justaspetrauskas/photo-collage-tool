import { useEffect } from 'react';
import { mmToPx, type CanvasSizePresetId } from '../../model/constants';
import type { ImageItem, PageLayout } from '../../model/types';
import { pageHasOverlap } from '../collageEditorUtils';

interface UseCollageEditorLayoutEffectsParams {
  isHydrated: boolean;
  images: ImageItem[];
  pages: PageLayout[];
  frameMm: number;
  canvasPresetId: CanvasSizePresetId;
  customCanvasWidthCm: number;
  customCanvasHeightCm: number;
  paginationMode: 'auto' | 'assisted';
  assistedPageCount: number;
  minImageCm: number;
  autoCompactPages: boolean;
  setImages: (images: ImageItem[]) => void;
  setPages: (updater: (pages: PageLayout[]) => PageLayout[]) => void;
  regenerateLayout: (
    overrideAssistedCount: number,
    preservePageSelection?: boolean,
    sourceImages?: ImageItem[],
    useSmartFraming?: boolean,
  ) => void;
  resolveMaxPages: (overrideAssistedCount?: number) => number;
  resolveCanvasDimensions: () => { widthPx: number; heightPx: number };
}

export function useCollageEditorLayoutEffects({
  isHydrated,
  images,
  pages,
  frameMm,
  canvasPresetId,
  customCanvasWidthCm,
  customCanvasHeightCm,
  paginationMode,
  assistedPageCount,
  minImageCm,
  autoCompactPages,
  setImages,
  setPages,
  regenerateLayout,
  resolveMaxPages,
  resolveCanvasDimensions,
}: UseCollageEditorLayoutEffectsParams): void {
  useEffect(() => {
    if (!isHydrated || !images.length || !pages.length) {
      return;
    }

    if (!pages.some(pageHasOverlap)) {
      return;
    }

    regenerateLayout(resolveMaxPages(), true, images);
  }, [isHydrated, images, pages, paginationMode, assistedPageCount, minImageCm, autoCompactPages]);

  useEffect(() => {
    if (!isHydrated || !images.length) {
      return;
    }

    const nextFrameThicknessPx = mmToPx(frameMm);
    const nextImages = images.map((image) => ({
      ...image,
      frameThicknessPx: nextFrameThicknessPx,
    }));

    setImages(nextImages);

    if (pages.some((page) => page.items.length > 0)) {
      regenerateLayout(resolveMaxPages(), true, nextImages);
    }
  }, [frameMm]);

  // `images` and `pages` are intentionally omitted from deps to avoid an infinite loop:
  // the effect updates pages, which would re-trigger the effect if pages were a dep.
  // This mirrors the same pattern used in the frameMm effect above.
  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    const { widthPx, heightPx } = resolveCanvasDimensions();

    setPages((currentPages) =>
      currentPages.map((page) => ({
        ...page,
        widthPx,
        heightPx,
      })),
    );

    if (images.length && pages.some((page) => page.items.length > 0)) {
      regenerateLayout(resolveMaxPages(), true, images);
    }
  }, [canvasPresetId, customCanvasWidthCm, customCanvasHeightCm]);
}
