import { useEffect } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import {
  CANVAS_SIZE_PRESETS,
  LAYOUT_PRESETS,
  type CanvasSizePresetId,
  type LayoutPresetId,
} from '../../model/constants';
import type { ImageItem, PageLayout, PersistedEditorSnapshot, PersistedImageItem } from '../../model/types';
import { blobToImage } from '../../lib/fileToImage';
import { loadSnapshot, saveSnapshot } from '../../lib/persistence';

interface NoticeLike {
  tone: 'info' | 'success' | 'error';
  text: string;
}

interface HydrationParams {
  setImages: Dispatch<SetStateAction<ImageItem[]>>;
  setPages: Dispatch<SetStateAction<PageLayout[]>>;
  setOverflowImageIds: Dispatch<SetStateAction<string[]>>;
  setOversizedImageIds: Dispatch<SetStateAction<string[]>>;
  setMaxImageCm: Dispatch<SetStateAction<number>>;
  setMinImageCm: Dispatch<SetStateAction<number>>;
  setFrameMm: Dispatch<SetStateAction<number>>;
  setGridModeEnabled: Dispatch<SetStateAction<boolean>>;
  setAutoCompactPages: Dispatch<SetStateAction<boolean>>;
  setPaginationMode: Dispatch<SetStateAction<'auto' | 'assisted'>>;
  setInteractionModeState: Dispatch<SetStateAction<'crop' | 'resize' | 'replace' | 'move' | 'select'>>;
  setAssistedPageCount: Dispatch<SetStateAction<number>>;
  setSelectedPageIndex: Dispatch<SetStateAction<number>>;
  setLayoutPresetId: Dispatch<SetStateAction<LayoutPresetId>>;
  setCanvasPresetId: Dispatch<SetStateAction<CanvasSizePresetId>>;
  setCustomCanvasWidthCm: Dispatch<SetStateAction<number>>;
  setCustomCanvasHeightCm: Dispatch<SetStateAction<number>>;
  setSelectedImageId: Dispatch<SetStateAction<string | null>>;
  setShowSelectionControls: Dispatch<SetStateAction<boolean>>;
  setLastSavedAt: Dispatch<SetStateAction<number | null>>;
  setRestoredFromSnapshot: Dispatch<SetStateAction<boolean>>;
  setNotice: Dispatch<SetStateAction<NoticeLike | null>>;
  setError: Dispatch<SetStateAction<string>>;
  setIsHydrated: Dispatch<SetStateAction<boolean>>;
  setSaveState: Dispatch<SetStateAction<'idle' | 'saving' | 'saved' | 'error'>>;
}

export function useCollageEditorHydration({
  setImages,
  setPages,
  setOverflowImageIds,
  setOversizedImageIds,
  setMaxImageCm,
  setMinImageCm,
  setFrameMm,
  setGridModeEnabled,
  setAutoCompactPages,
  setPaginationMode,
  setInteractionModeState,
  setAssistedPageCount,
  setSelectedPageIndex,
  setLayoutPresetId,
  setCanvasPresetId,
  setCustomCanvasWidthCm,
  setCustomCanvasHeightCm,
  setSelectedImageId,
  setShowSelectionControls,
  setLastSavedAt,
  setRestoredFromSnapshot,
  setNotice,
  setError,
  setIsHydrated,
  setSaveState,
}: HydrationParams): void {
  useEffect(() => {
    let cancelled = false;

    async function hydrateFromIndexedDb() {
      try {
        const snapshot = await loadSnapshot();
        if (!snapshot || cancelled) {
          return;
        }

        const hydratedImages = await Promise.all(
          snapshot.images.map(async (savedImage) => {
            const restored = await blobToImage(savedImage.sourceBlob);
            const baseItem: ImageItem = {
              ...savedImage,
              originalSrc: restored.src,
              src: restored.src,
              bitmap: restored.image,
              sourceBlob: restored.blob,
            };

            if (savedImage.enhancedSrcBlob) {
              try {
                const enhanced = await blobToImage(savedImage.enhancedSrcBlob);
                return {
                  ...baseItem,
                  src: enhanced.src,
                  bitmap: enhanced.image,
                };
              } catch {
                return baseItem;
              }
            }

            return baseItem;
          }),
        );

        if (cancelled) {
          for (const image of hydratedImages) {
            URL.revokeObjectURL(image.src);
          }
          return;
        }

        setImages(hydratedImages);
        setPages(snapshot.pages);
        setOverflowImageIds(snapshot.overflowImageIds);
        setOversizedImageIds(snapshot.oversizedImageIds);
        setMaxImageCm(snapshot.settings.maxImageCm);
        setMinImageCm(snapshot.settings.minImageCm);
        setFrameMm(snapshot.settings.frameMm);
        setGridModeEnabled(snapshot.settings.gridModeEnabled);
        setAutoCompactPages(snapshot.settings.autoCompactPages ?? true);
        setPaginationMode(snapshot.settings.paginationMode);
        setInteractionModeState(snapshot.settings.interactionMode ?? 'select');
        setAssistedPageCount(snapshot.settings.assistedPageCount);
        setSelectedPageIndex(snapshot.settings.selectedPageIndex);

        if (snapshot.settings.layoutPresetId) {
          const validLayoutPresetIds = new Set(LAYOUT_PRESETS.map((preset) => preset.id));
          if (validLayoutPresetIds.has(snapshot.settings.layoutPresetId)) {
            setLayoutPresetId(snapshot.settings.layoutPresetId);
          }
        }

        if (snapshot.settings.canvasPresetId) {
          const validPresetIds = CANVAS_SIZE_PRESETS.map((preset) => preset.id);
          const presetId = snapshot.settings.canvasPresetId;
          if (validPresetIds.includes(presetId as CanvasSizePresetId)) {
            setCanvasPresetId(presetId as CanvasSizePresetId);
          }
        }

        if (typeof snapshot.settings.customCanvasWidthCm === 'number') {
          setCustomCanvasWidthCm(snapshot.settings.customCanvasWidthCm);
        }

        if (typeof snapshot.settings.customCanvasHeightCm === 'number') {
          setCustomCanvasHeightCm(snapshot.settings.customCanvasHeightCm);
        }

        setSelectedImageId(null);
        setShowSelectionControls(false);
        setLastSavedAt(snapshot.savedAt);
        setRestoredFromSnapshot(true);
        setNotice({
          tone: 'info',
          text: 'Saved project restored. Continue with your last collage or export when ready.',
        });
      } catch {
        setError('Could not restore saved project state from local storage.');
      } finally {
        if (!cancelled) {
          setIsHydrated(true);
          setSaveState('idle');
        }
      }
    }

    void hydrateFromIndexedDb();

    return () => {
      cancelled = true;
    };
  }, [
    setAssistedPageCount,
    setAutoCompactPages,
    setCanvasPresetId,
    setCustomCanvasHeightCm,
    setCustomCanvasWidthCm,
    setError,
    setFrameMm,
    setGridModeEnabled,
    setImages,
    setInteractionModeState,
    setIsHydrated,
    setLastSavedAt,
    setLayoutPresetId,
    setMaxImageCm,
    setMinImageCm,
    setNotice,
    setOverflowImageIds,
    setOversizedImageIds,
    setPages,
    setPaginationMode,
    setRestoredFromSnapshot,
    setSaveState,
    setSelectedImageId,
    setSelectedPageIndex,
    setShowSelectionControls,
  ]);
}

interface AutosaveParams {
  isHydrated: boolean;
  images: ImageItem[];
  pages: PageLayout[];
  overflowImageIds: string[];
  oversizedImageIds: string[];
  maxImageCm: number;
  minImageCm: number;
  frameMm: number;
  gridModeEnabled: boolean;
  autoCompactPages: boolean;
  paginationMode: 'auto' | 'assisted';
  interactionMode: 'crop' | 'resize' | 'replace' | 'move' | 'select';
  assistedPageCount: number;
  selectedPageIndex: number;
  layoutPresetId: LayoutPresetId;
  canvasPresetId: CanvasSizePresetId;
  customCanvasWidthCm: number;
  customCanvasHeightCm: number;
  setLastSavedAt: Dispatch<SetStateAction<number | null>>;
  setSaveState: Dispatch<SetStateAction<'idle' | 'saving' | 'saved' | 'error'>>;
  setError: Dispatch<SetStateAction<string>>;
}

export function useCollageEditorAutosave({
  isHydrated,
  images,
  pages,
  overflowImageIds,
  oversizedImageIds,
  maxImageCm,
  minImageCm,
  frameMm,
  gridModeEnabled,
  autoCompactPages,
  paginationMode,
  interactionMode,
  assistedPageCount,
  selectedPageIndex,
  layoutPresetId,
  canvasPresetId,
  customCanvasWidthCm,
  customCanvasHeightCm,
  setLastSavedAt,
  setSaveState,
  setError,
}: AutosaveParams): void {
  useEffect(() => {
    if (!isHydrated) {
      return;
    }

    setSaveState('saving');
    const timeoutId = window.setTimeout(async () => {
      const persistedImages: PersistedImageItem[] = await Promise.all(
        images.map(async (image) => {
          const persisted: PersistedImageItem = {
            id: image.id,
            fileName: image.fileName,
            sourceBlob: image.sourceBlob,
            naturalWidth: image.naturalWidth,
            naturalHeight: image.naturalHeight,
            maxWidthCm: image.maxWidthCm,
            maxHeightCm: image.maxHeightCm,
            frameEnabled: image.frameEnabled,
            frameThicknessPx: image.frameThicknessPx,
            renderWidthPx: image.renderWidthPx,
            renderHeightPx: image.renderHeightPx,
            offsetX: image.offsetX,
            offsetY: image.offsetY,
            cropMaxOffsetX: image.cropMaxOffsetX,
            cropMaxOffsetY: image.cropMaxOffsetY,
          };

          if (image.src !== image.originalSrc && image.src.startsWith('data:')) {
            try {
              const response = await fetch(image.src);
              const enhancedBlob = await response.blob();
              persisted.enhancedSrcBlob = enhancedBlob;
            } catch {
              // ignore enhanced conversion errors; autosave should stay best-effort
            }
          }

          return persisted;
        }),
      );

      const snapshot: PersistedEditorSnapshot = {
        version: 1,
        savedAt: Date.now(),
        settings: {
          maxImageCm,
          minImageCm,
          frameMm,
          gridModeEnabled,
          autoCompactPages,
          paginationMode,
          interactionMode,
          assistedPageCount,
          selectedPageIndex,
          layoutPresetId,
          canvasPresetId,
          customCanvasWidthCm,
          customCanvasHeightCm,
        },
        pages,
        overflowImageIds,
        oversizedImageIds,
        images: persistedImages,
      };

      try {
        await saveSnapshot(snapshot);
        setLastSavedAt(snapshot.savedAt);
        setSaveState('saved');
      } catch {
        setSaveState('error');
        setError('We could not save your latest changes locally. Please keep this tab open and try again.');
      }
    }, 500);

    return () => window.clearTimeout(timeoutId);
  }, [
    assistedPageCount,
    autoCompactPages,
    canvasPresetId,
    customCanvasHeightCm,
    customCanvasWidthCm,
    frameMm,
    gridModeEnabled,
    images,
    interactionMode,
    isHydrated,
    layoutPresetId,
    maxImageCm,
    minImageCm,
    overflowImageIds,
    oversizedImageIds,
    pages,
    paginationMode,
    selectedPageIndex,
    setError,
    setLastSavedAt,
    setSaveState,
  ]);
}
