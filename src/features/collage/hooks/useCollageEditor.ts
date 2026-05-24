import { enhanceImageWithAI, type EnhanceOptions, type EnhancePreset } from '../lib/openaiImageEdit';
import { useEffect } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import {
  CANVAS_SIZE_PRESETS,
  DEFAULT_CANVAS_PRESET_ID,
  DEFAULT_FRAME_MM,
  DEFAULT_LAYOUT_PRESET_ID,
  DEFAULT_MAX_IMAGE_CM,
  DEFAULT_MIN_IMAGE_CM,
  LAYOUT_PRESETS,
  cmToPx,
  type LayoutPresetId,
  mmToPx,
  type CanvasSizePresetId,
} from '../model/constants';
import { buildPaginatedLayout, clampOffsets } from '../model/layoutEngine';
import { renderPageToExportCanvas } from '../model/renderEngine';
import { useEditorUIStore } from '../store/editorUIStore';
import { useCollageState } from './useCollageState';
import { useCollageUIState } from './useCollageUIState';
import { useCollageDerivedState } from './useCollageDerivedState';
import { useManualPlacementHandlers } from './useManualPlacementHandlers';
import {
  canvasToBlob,
  elapsedTicks,
  pageHasOverlap,
  randomId,
  rectanglesTouchOrOverlap,
} from './collageEditorUtils';
import { computeContentBox, computeCropMetrics } from '../../../shared/math/sizing';
import { fileToImage, blobToImage } from '../lib/fileToImage';
import { loadSnapshot, saveSnapshot, clearSnapshot } from '../lib/persistence';
import {
  calculateOutsideRatio,
  getCanvasSnapPosition,
  isPositionOutsideCanvas,
  resolvePushLayout,
  getPreferredPushAxis,
  canSwapImages,
  calculateZoomPanOffset,
  getZoomPanBounds,
  getResizeAssistSnap,
  getHandleAtPoint,
  getHandleFixedEdges,
  getCursorForHandle,
  calculateCropOffsets,
  calculateNewPosition,
} from '../interactions';

import type { HandleType } from '../interactions';
import type { DragState } from '../../../shared/drag/types';
import { isCropDrag, isMoveDrag, isPanDrag, isReplaceDrag, isResizeDrag } from '../../../shared/drag/types';
import type {
  ImageItem,
  PositionedImage,
  PageLayout,
  PersistedEditorSnapshot,
  PersistedImageItem,
} from '../model/types';

// --- Types and Interfaces ---
import { computeSmartDropSize, resolveSmartFraming } from '../lib/editorLayoutUtils';

export type WorkflowStage = 'upload' | 'generate' | 'edit' | 'export';

export interface NoticeMessage {
  tone: 'info' | 'success' | 'error';
  text: string;
}

export interface UndoAction {
  label: string;
  description: string;
  restore: () => void;
}

export interface BatchEnhanceProgress {
  completed: number;
  total: number;
  preset: EnhancePreset;
}

export interface SessionMetrics {
  uploads: number;
  layoutGenerations: number;
  modeSwitches: number;
  exportsCompleted: number;
  exportFailures: number;
  enhancementRuns: number;
  enhancementFailures: number;
  removedFromCanvas: number;
  removedPages: number;
  destructiveConfirms: number;
  destructiveCancels: number;
  firstUploadAt: number | null;
  firstLayoutAt: number | null;
  firstExportAt: number | null;
}

export interface ResizeFeedback {
  baseRect: { x: number; y: number; width: number; height: number };
  currentRect: { x: number; y: number; width: number; height: number };
  intent: 'expand' | 'shrink' | 'steady';
}

export interface SwapAnimation {
  startedTick: number;
  durationTicks: number;
  transitions: Record<string, { from: { x: number; y: number }; to: { x: number; y: number } }>;
}

export interface CanvasPlacementPreview {
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  valid: boolean;
}

export interface EditorUndoSnapshot {
  images: ImageItem[];
  pages: PageLayout[];
  maxImageCm: number;
  minImageCm: number;
  frameMm: number;
  gridModeEnabled: boolean;
  autoCompactPages: boolean;
  paginationMode: 'auto' | 'assisted';
  interactionMode: 'crop' | 'resize' | 'replace' | 'move' | 'select';
  selectedImageId: string | null;
  hoveredImageId: string | null;
  assistedPageCount: number;
  selectedPageIndex: number;
  overflowImageIds: string[];
  oversizedImageIds: string[];
  resizeLimitNotice: string;
  showSelectionControls: boolean;
  canvasPresetId: CanvasSizePresetId;
  customCanvasWidthCm: number;
  customCanvasHeightCm: number;
  layoutPresetId: LayoutPresetId;
  drawerSelectedImageId: string | null;
  imageZoomLevels: Record<string, number>;
  imagePanOffsets: Record<string, { x: number; y: number }>;
}

const DEFAULT_SESSION_METRICS = (): SessionMetrics => ({
  uploads: 0,
  layoutGenerations: 0,
  modeSwitches: 0,
  exportsCompleted: 0,
  exportFailures: 0,
  enhancementRuns: 0,
  enhancementFailures: 0,
  removedFromCanvas: 0,
  removedPages: 0,
  destructiveConfirms: 0,
  destructiveCancels: 0,
  firstUploadAt: null,
  firstLayoutAt: null,
  firstExportAt: null,
});

export function useCollageEditor() {
  // --- All previous top-level code and functions go here ---

  const SELECT_HANDLE_HIT_RADIUS_CSS_PX = 12;

  function restoreEditorUndoSnapshot(snapshot: EditorUndoSnapshot): void {
    setImages(snapshot.images);
    setPages(snapshot.pages);
    setMaxImageCm(snapshot.maxImageCm);
    setMinImageCm(snapshot.minImageCm);
    setFrameMm(snapshot.frameMm);
    setGridModeEnabled(snapshot.gridModeEnabled);
    setAutoCompactPages(snapshot.autoCompactPages);
    setPaginationMode(snapshot.paginationMode);
    setInteractionModeState(snapshot.interactionMode);
    setSelectedImageId(snapshot.selectedImageId);
    setHoveredImageId(snapshot.hoveredImageId);
    setAssistedPageCount(snapshot.assistedPageCount);
    setSelectedPageIndex(snapshot.selectedPageIndex);
    setOverflowImageIds(snapshot.overflowImageIds);
    setOversizedImageIds(snapshot.oversizedImageIds);
    setResizeLimitNotice(snapshot.resizeLimitNotice);
    setShowSelectionControls(snapshot.showSelectionControls);
    setCanvasPresetId(snapshot.canvasPresetId);
    setCustomCanvasWidthCm(snapshot.customCanvasWidthCm);
    setCustomCanvasHeightCm(snapshot.customCanvasHeightCm);
    setLayoutPresetId(snapshot.layoutPresetId);
    setDrawerSelectedImageId(snapshot.drawerSelectedImageId);
    setImageZoomLevels(snapshot.imageZoomLevels);
    setImagePanOffsets(snapshot.imagePanOffsets);
    setNotice({
      tone: 'success',
      text: 'Undo complete. Your previous project state has been restored.',
    });
    useEditorUIStore.setState({
      drawerSelectedImageId: snapshot.drawerSelectedImageId,
      imageZoomLevels: snapshot.imageZoomLevels,
      imagePanOffsets: snapshot.imagePanOffsets,
    });
  }

  function queueUndoAction(label: string, description: string, snapshot: EditorUndoSnapshot): void {
    setUndoAction({
      label,
      description,
      restore: () => restoreEditorUndoSnapshot(snapshot),
    });
  }

  function undoLastAction(): void {
    if (!undoAction) {
      return;
    }
    undoAction.restore();
    setUndoAction(null);
  }

  function registerDestructiveConfirmation(confirmed: boolean): void {
    updateSessionMetrics((metrics) => ({
      ...metrics,
      destructiveConfirms: metrics.destructiveConfirms + (confirmed ? 1 : 0),
      destructiveCancels: metrics.destructiveCancels + (confirmed ? 0 : 1),
    }));
  }

  function resolveCanvasDimensions(): { widthPx: number; heightPx: number } {
    const preset = CANVAS_SIZE_PRESETS.find((p) => p.id === canvasPresetId) ?? CANVAS_SIZE_PRESETS[0];
    const widthCm = canvasPresetId === 'custom' ? customCanvasWidthCm : preset.widthCm;
    const heightCm = canvasPresetId === 'custom' ? customCanvasHeightCm : preset.heightCm;
    return {
      widthPx: Math.round(cmToPx(widthCm)),
      heightPx: Math.round(cmToPx(heightCm)),
    };
  }

  // recommendedLayoutHint useMemo moved after all state/variable declarations

  // State hooks
  const collageState = useCollageState();
  const collageUIState = useCollageUIState();

  // Destructure all state and setters from hooks
  const {
    images, setImages,
    pages, setPages,
    maxImageCm, setMaxImageCm,
    minImageCm, setMinImageCm,
    frameMm, setFrameMm,
    gridModeEnabled, setGridModeEnabled,
    autoCompactPages, setAutoCompactPages,
    paginationMode, setPaginationMode,
    interactionMode, setInteractionModeState,
    selectedImageId, setSelectedImageId,
    hoveredImageId, setHoveredImageId,
    assistedPageCount, setAssistedPageCount,
    selectedPageIndex, setSelectedPageIndex,
    overflowImageIds, setOverflowImageIds,
    oversizedImageIds, setOversizedImageIds,
    canvasPresetId, setCanvasPresetId,
    customCanvasWidthCm, setCustomCanvasWidthCm,
    customCanvasHeightCm, setCustomCanvasHeightCm,
    layoutPresetId, setLayoutPresetId,
  } = collageState;

  const {
    drawerSelectedImageId, setDrawerSelectedImageId,
    imageZoomLevels, setImageZoomLevels,
    imagePanOffsets, setImagePanOffsets,
  } = collageUIState;

  const {
    dragActive, setDragActive,
    resizeLimitNotice, setResizeLimitNotice,
    error, setError,
    isHydrated, setIsHydrated,
    replaceAnimationTick, setReplaceAnimationTick,
    swapAnimation, setSwapAnimation,
    replacePointer, setReplacePointer,
    swapTargetInvalid, setSwapTargetInvalid,
    moveOutsideCanvas, setMoveOutsideCanvas,
    moveCollisionImageIds, setMoveCollisionImageIds,
    resizeCurrentDimensions, setResizeCurrentDimensions,
    resizeFeedback, setResizeFeedback,
    resizeSnapGuides, setResizeSnapGuides,
    resizeSnapActive, setResizeSnapActive,
    hoveredResizeHandle, setHoveredResizeHandle,
    enhancingImageIds, setEnhancingImageIds,
    canvasPlacementPreview, setCanvasPlacementPreview,
    manualPlacementDragImageId, setManualPlacementDragImageId,
    showSelectionControls, setShowSelectionControls,
    notice, setNotice,
    saveState, setSaveState,
    lastSavedAt, setLastSavedAt,
    restoredFromSnapshot, setRestoredFromSnapshot,
    undoAction, setUndoAction,
    isExporting, setIsExporting,
    lastExportSummary, setLastExportSummary,
    batchEnhanceProgress, setBatchEnhanceProgress,
    sessionMetrics, setSessionMetrics,
    previewViewportRef,
    interactionMoveFrameRef,
    pendingInteractionMoveRef,
    dragStateRef,
    knownImageSrcsRef,
  } = collageUIState;

  const {
    selectedPage,
    itemById,
    imageById,
    bitmapById,
    placementByImageId,
    selectedImage,
    selectedPlacedItem,
    hasPlacedItems,
    hasUnplacedImages,
    recommendedLayoutHint,
    workflowStage,
    sessionInsights,
  } = useCollageDerivedState({
    images,
    pages,
    selectedPageIndex,
    selectedImageId,
    canvasPresetId,
    customCanvasWidthCm,
    customCanvasHeightCm,
    isExporting,
    sessionMetrics,
  });

  function setInteractionMode(mode: 'crop' | 'resize' | 'replace' | 'move' | 'select'): void {
    if (interactionMode !== mode) {
      updateSessionMetrics((metrics) => ({
        ...metrics,
        modeSwitches: metrics.modeSwitches + 1,
      }));
    }
    setInteractionModeState(mode);
  }

  function updateSessionMetrics(updater: (metrics: SessionMetrics) => SessionMetrics): void {
    setSessionMetrics((current) => updater(current ?? DEFAULT_SESSION_METRICS()));
  }

  function setImageZoom(imageId: string, zoom: number): void {
    setImageZoomLevels((current) => ({ ...current, [imageId]: zoom }));
  }

  function setImagePan(imageId: string, x: number, y: number): void {
    setImagePanOffsets((current) => ({ ...current, [imageId]: { x, y } }));
  }

  function captureEditorUndoSnapshot(): EditorUndoSnapshot {
    return {
      images,
      pages,
      maxImageCm,
      minImageCm,
      frameMm,
      gridModeEnabled,
      autoCompactPages,
      paginationMode,
      interactionMode,
      selectedImageId,
      hoveredImageId,
      assistedPageCount,
      selectedPageIndex,
      overflowImageIds,
      oversizedImageIds,
      resizeLimitNotice,
      showSelectionControls,
      canvasPresetId,
      customCanvasWidthCm,
      customCanvasHeightCm,
      layoutPresetId,
      drawerSelectedImageId,
      imageZoomLevels,
      imagePanOffsets,
    };
  }

  const shouldRunAnimationLoop = (dragActive && interactionMode === 'replace') || Boolean(swapAnimation);

  useEffect(() => {
    if (!shouldRunAnimationLoop) {
      return;
    }

    let frameId = 0;
    const animate = () => {
      setReplaceAnimationTick((tick) => (tick + 1) % 10000);
      frameId = window.requestAnimationFrame(animate);
    };

    frameId = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frameId);
  }, [shouldRunAnimationLoop]);

  useEffect(() => {
    if (!swapAnimation) {
      return;
    }

    if (elapsedTicks(replaceAnimationTick, swapAnimation.startedTick) >= swapAnimation.durationTicks) {
      setSwapAnimation(null);
    }
  }, [replaceAnimationTick, swapAnimation]);

  useEffect(() => {
    return () => {
      if (interactionMoveFrameRef.current !== null) {
        window.cancelAnimationFrame(interactionMoveFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const currentSrcs = new Set<string>();
    for (const image of images) {
      currentSrcs.add(image.src);
      currentSrcs.add(image.originalSrc);
    }
    for (const previousSrc of knownImageSrcsRef.current) {
      if (!currentSrcs.has(previousSrc) && typeof previousSrc === 'string') {
        URL.revokeObjectURL(previousSrc);
      }
    }
    knownImageSrcsRef.current = currentSrcs;
  }, [images]);

  useEffect(() => {
    return () => {
      for (const src of knownImageSrcsRef.current) {
        if (typeof src === 'string') URL.revokeObjectURL(src);
      }
    };
  }, []);

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

            // If enhanced version was saved, restore it
            if (savedImage.enhancedSrcBlob) {
              try {
                const enhanced = await blobToImage(savedImage.enhancedSrcBlob);
                return {
                  ...baseItem,
                  src: enhanced.src,
                  bitmap: enhanced.image,
                };
              } catch {
                // If enhanced blob fails to load, fall back to original
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
          const VALID_PRESET_IDS = CANVAS_SIZE_PRESETS.map((p) => p.id);
          const id = snapshot.settings.canvasPresetId;
          if (VALID_PRESET_IDS.includes(id as CanvasSizePresetId)) {
            setCanvasPresetId(id as CanvasSizePresetId);
          }
        }
        if (typeof snapshot.settings.customCanvasWidthCm === 'number') {
          setCustomCanvasWidthCm(snapshot.settings.customCanvasWidthCm);
        }
        if (typeof snapshot.settings.customCanvasHeightCm === 'number') {
          setCustomCanvasHeightCm(snapshot.settings.customCanvasHeightCm);
        }
        // Explicitly clear selected image state on hydration to avoid stale selections
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
  }, []);

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

          // If image has been enhanced, convert the data URL to blob and store it
          if (image.src !== image.originalSrc && image.src.startsWith('data:')) {
            try {
              const response = await fetch(image.src);
              const enhancedBlob = await response.blob();
              persisted.enhancedSrcBlob = enhancedBlob;
            } catch {
              // If conversion fails, we'll lose the enhancement on next load
              // but the app will remain functional
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
    isHydrated,
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
    pages,
    overflowImageIds,
    oversizedImageIds,
    images,
    canvasPresetId,
    customCanvasWidthCm,
    customCanvasHeightCm,
  ]);

  useEffect(() => {
    if (!isHydrated || !images.length || !pages.length) {
      return;
    }

    if (!pages.some(pageHasOverlap)) {
      return;
    }

    regenerateLayout(resolveMaxPages(), true, images);
  }, [isHydrated, images, pages, paginationMode, assistedPageCount, minImageCm, autoCompactPages]);

  async function onUploadFiles(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const files = Array.from(event.target.files ?? []);
    await uploadFileList(files);
    event.target.value = '';
  }

  async function uploadFileList(files: File[]): Promise<void> {
    if (!files.length) {
      return;
    }

    try {
      const loaded = await Promise.all(files.map((file) => fileToImage(file)));
      const next: ImageItem[] = loaded.map((entry, index) => ({
        id: randomId(`${Date.now()}-${index}`),
        fileName: files[index].name,
        sourceBlob: entry.blob,
        originalSrc: entry.src,
        src: entry.src,
        bitmap: entry.image,
        naturalWidth: entry.naturalWidth,
        naturalHeight: entry.naturalHeight,
        maxWidthCm: maxImageCm,
        maxHeightCm: maxImageCm,
        frameEnabled: true,
        frameThicknessPx: mmToPx(frameMm),
        renderWidthPx: 0,
        renderHeightPx: 0,
        offsetX: 0,
        offsetY: 0,
        cropMaxOffsetX: 0,
        cropMaxOffsetY: 0,
      }));

      setImages((current) => [...current, ...next]);
      setPages((currentPages) =>
        currentPages.length
          ? currentPages
          : [
              {
                id: randomId('page'),
                ...resolveCanvasDimensions(),
                items: [],
              },
            ],
      );
      setError('');
      setNotice({
        tone: 'success',
        text: `${next.length} photo${next.length === 1 ? '' : 's'} added. Next step: generate a layout to start editing.`,
      });
      updateSessionMetrics((metrics) => ({
        ...metrics,
        uploads: metrics.uploads + next.length,
        firstUploadAt: metrics.firstUploadAt ?? Date.now(),
      }));
    } catch {
      setError('Some photos could not be loaded. Please retry with valid PNG, JPG, or WebP files.');
    }
  }

  function applyGlobalSettings(): void {
    setImages((current) =>
      current.map((image) => ({
        ...image,
        maxWidthCm: maxImageCm,
        maxHeightCm: maxImageCm,
        frameThicknessPx: mmToPx(frameMm),
      })),
    );
    setNotice({
      tone: 'success',
      text: 'Project sizing rules updated. Generate layout again if you want every page reflowed.',
    });
  }

  // Keep canvas frames in sync with global frame width changes.
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

  // When canvas preset or custom dimensions change, update page sizes and regenerate layout.
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

  function focusImageOnCanvas(imageId: string): void {
    setSelectedImageId(imageId);
    setHoveredImageId(imageId);

    if (!pages.length) {
      return;
    }

    const pageIndex = placementByImageId.get(imageId)?.pageIndex ?? -1;
    if (pageIndex >= 0) {
      setSelectedPageIndex(pageIndex);
    }
  }

  function updateImage(id: string, patch: Partial<ImageItem>): void {
    focusImageOnCanvas(id);
    const nextImages = images.map((image) => (image.id === id ? { ...image, ...patch } : image));
    setImages(nextImages);

    const affectsPlacedLayout =
      patch.frameEnabled !== undefined ||
      patch.frameThicknessPx !== undefined ||
      patch.maxWidthCm !== undefined ||
      patch.maxHeightCm !== undefined;

    if (affectsPlacedLayout && placementByImageId.has(id)) {
      regenerateLayout(resolveMaxPages(), true, nextImages);
    }
  }

  function clearSelection(): void {
    dragStateRef.current = null;
    setSelectedImageId(null);
    setHoveredImageId(null);
    setDrawerSelectedImageId(null);
    setShowSelectionControls(false);
    setDragActive(false);
    setResizeCurrentDimensions(null);
    setResizeFeedback(null);
    setResizeSnapGuides([]);
    setResizeSnapActive(false);
    setHoveredResizeHandle(null);
    setReplacePointer(null);
    setSwapTargetInvalid(false);
    setMoveOutsideCanvas(false);
    setMoveCollisionImageIds([]);
    setHoveredResizeHandle(null);
    setHoveredImageId(null);
    setInteractionModeState('select');
  }

  function swapImagesOnSelectedPage(sourceImageId: string, targetImageId: string): void {
    if (sourceImageId === targetImageId || !selectedPage) {
      return;
    }

    const sourceIndex = selectedPage.items.findIndex((item) => item.imageId === sourceImageId);
    const targetIndex = selectedPage.items.findIndex((item) => item.imageId === targetImageId);
    if (sourceIndex === -1 || targetIndex === -1) {
      return;
    }

    const sourceSlot = selectedPage.items[sourceIndex];
    const targetSlot = selectedPage.items[targetIndex];
    const otherItems = selectedPage.items.filter((_, index) => index !== sourceIndex && index !== targetIndex);

    if (!canSwapImages(sourceSlot, targetSlot, otherItems)) {
      setError('Cannot replace these two images because their constrained sizes would overlap nearby images.');
      return;
    }

    setPages((currentPages) => currentPages.map((page, pageIndex) => {
      if (pageIndex !== selectedPageIndex) {
        return page;
      }

      const nextItems = [...page.items];
      nextItems[sourceIndex] = {
        ...nextItems[sourceIndex],
        x: targetSlot.x,
        y: targetSlot.y,
      };
      nextItems[targetIndex] = {
        ...nextItems[targetIndex],
        x: sourceSlot.x,
        y: sourceSlot.y,
      };

      return {
        ...page,
        items: nextItems,
      };
    }));

    setSwapAnimation({
      startedTick: replaceAnimationTick,
      durationTicks: 16,
      transitions: {
        [sourceImageId]: {
          from: { x: sourceSlot.x, y: sourceSlot.y },
          to: { x: targetSlot.x, y: targetSlot.y },
        },
        [targetImageId]: {
          from: { x: targetSlot.x, y: targetSlot.y },
          to: { x: sourceSlot.x, y: sourceSlot.y },
        },
      },
    });

    setError('');
    setSelectedImageId(sourceImageId);
    setHoveredImageId(targetImageId);
  }

  function resolveMaxPages(overrideAssistedCount?: number): number {
    if (paginationMode === 'auto') {
      return Number.POSITIVE_INFINITY;
    }
    return overrideAssistedCount ?? assistedPageCount;
  }

  function regenerateLayout(
    overrideAssistedCount: number,
    preservePageSelection = false,
    sourceImages: ImageItem[] = images,
    useSmartFraming = false,
  ): void {
    if (!sourceImages.length) {
      setPages([]);
      setOverflowImageIds([]);
      setOversizedImageIds([]);
      return;
    }

    const { widthPx: canvasWidthPx, heightPx: canvasHeightPx } = resolveCanvasDimensions();
    const result = buildPaginatedLayout(sourceImages, {
      canvasWidthPx,
      canvasHeightPx,
      allowUpscale: true,
      maxPages: paginationMode === 'auto' ? Number.POSITIVE_INFINITY : overrideAssistedCount,
      minContentWidthPx: cmToPx(minImageCm),
      minContentHeightPx: cmToPx(minImageCm),
      enableCompaction: autoCompactPages,
      layoutPresetId,
    });

    const metricsById = result.imageMetrics;
    const nextImages = sourceImages.map((image) => {
        const metrics = metricsById.get(image.id);
        if (!metrics) {
          return {
            ...image,
            cropMaxOffsetX: 0,
            cropMaxOffsetY: 0,
          };
        }

        const smart = useSmartFraming
          ? resolveSmartFraming(image, metrics)
          : null;
        const clamped = smart
          ? { offsetX: smart.offsetX, offsetY: smart.offsetY }
          : clampOffsets(image.offsetX, image.offsetY, metrics.maxOffsetX, metrics.maxOffsetY);
        return {
          ...image,
          renderWidthPx: metrics.contentWidthPx,
          renderHeightPx: metrics.contentHeightPx,
          offsetX: clamped.offsetX,
          offsetY: clamped.offsetY,
          cropMaxOffsetX: metrics.maxOffsetX,
          cropMaxOffsetY: metrics.maxOffsetY,
        };
      });

    if (useSmartFraming) {
      for (const image of nextImages) {
        const metrics = metricsById.get(image.id);
        if (!metrics) {
          continue;
        }

        const { zoom } = resolveSmartFraming(image, metrics);
        setImageZoom(image.id, zoom);
        setImagePan(image.id, 0, 0);
      }
    }

    setImages(nextImages);

    setPages(result.pages);
    setOverflowImageIds(result.overflowImageIds);
    setOversizedImageIds(result.oversizedImageIds);
    if (preservePageSelection) {
      setSelectedPageIndex((current) => Math.max(0, Math.min(current, Math.max(0, result.pages.length - 1))));
    } else {
      setSelectedPageIndex(0);
    }
  }

  function onGenerateLayout(): void {
    setAssistedPageCount(1);
    regenerateLayout(1, false, images, true);
    setUndoAction(null);
    setNotice({
      tone: 'success',
      text: 'Layout ready. Select a photo to fine-tune it, or export when the collage looks right.',
    });
    updateSessionMetrics((metrics) => ({
      ...metrics,
      layoutGenerations: metrics.layoutGenerations + 1,
      firstLayoutAt: metrics.firstLayoutAt ?? Date.now(),
    }));
  }

  function onCreateNextPage(): void {
    const nextCount = assistedPageCount + 1;
    setAssistedPageCount(nextCount);
    regenerateLayout(nextCount, false, images, true);
    setNotice({
      tone: 'info',
      text: `Added page ${nextCount}. Continue placing and editing photos on the current page.`,
    });
  }

  function pagePointFromClient(
    clientX: number,
    clientY: number,
    options: { allowOutsideCanvas?: boolean } = {},
  ): { x: number; y: number } | null {
    const viewport = previewViewportRef.current;
    if (!viewport || !selectedPage) {
      return null;
    }

    const rect = viewport.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    const dpr = window.devicePixelRatio || 1;
    const backingWidth = Math.round(rect.width * dpr);
    const backingHeight = Math.round(rect.height * dpr);
    const margin = 28 * dpr;
    const availableWidth = backingWidth - margin * 2;
    const availableHeight = backingHeight - margin * 2;
    const scale = Math.min(availableWidth / selectedPage.widthPx, availableHeight / selectedPage.heightPx);
    const offsetX = (backingWidth - selectedPage.widthPx * scale) / 2;
    const offsetY = (backingHeight - selectedPage.heightPx * scale) / 2;

    if (!Number.isFinite(scale) || scale <= 0) {
      return null;
    }

    const x = (clientX - rect.left) * dpr;
    const y = (clientY - rect.top) * dpr;
    const pageX = (x - offsetX) / scale;
    const pageY = (y - offsetY) / scale;

    if (
      !options.allowOutsideCanvas &&
      (pageX < 0 || pageY < 0 || pageX > selectedPage.widthPx || pageY > selectedPage.heightPx)
    ) {
      return null;
    }

    return { x: pageX, y: pageY };
  }

  function resolveManualPlacementSize(image: ImageItem): {
    width: number;
    height: number;
    contentWidthPx: number;
    contentHeightPx: number;
    frameThicknessPx: number;
    drawnImageWidthPx: number;
    drawnImageHeightPx: number;
    maxOffsetX: number;
    maxOffsetY: number;
  } {
    const base = computeContentBox(
      image.naturalWidth,
      image.naturalHeight,
      image.maxWidthCm,
      image.maxHeightCm,
    );

    const minPx = cmToPx(minImageCm);
    const scaleUp = Math.max(minPx / base.widthPx, minPx / base.heightPx, 1);
    const contentWidthPx = Math.round(base.widthPx * scaleUp);
    const contentHeightPx = Math.round(base.heightPx * scaleUp);
    const frameThicknessPx = image.frameEnabled ? image.frameThicknessPx : 0;
    const crop = computeCropMetrics(
      image.naturalWidth,
      image.naturalHeight,
      contentWidthPx,
      contentHeightPx,
    );

    return {
      width: contentWidthPx + frameThicknessPx * 2,
      height: contentHeightPx + frameThicknessPx * 2,
      contentWidthPx,
      contentHeightPx,
      frameThicknessPx,
      drawnImageWidthPx: crop.drawnImageWidthPx,
      drawnImageHeightPx: crop.drawnImageHeightPx,
      maxOffsetX: crop.maxOffsetX,
      maxOffsetY: crop.maxOffsetY,
    };
  }

  const {
    onCanvasDragOver,
    onCanvasDrop,
    onCanvasDragLeave,
    onBeginManualPlacementDrag,
    onEndManualPlacementDrag,
    placeImageOnSelectedPage,
  } = useManualPlacementHandlers({
    itemById,
    selectedPage,
    selectedPageIndex,
    selectedImageId,
    manualPlacementDragImageId,
    minImageCm,
    pagePointFromClient,
    resolveManualPlacementSize,
    setPages,
    setImages,
    setSelectedImageId,
    setDrawerSelectedImageId,
    setHoveredImageId,
    setShowSelectionControls,
    setError,
    setManualPlacementDragImageId,
    setCanvasPlacementPreview,
    setNotice,
  });

  function findHitItem(pagePoint: { x: number; y: number }): PositionedImage | null {
    if (!selectedPage) {
      return null;
    }

    for (let i = selectedPage.items.length - 1; i >= 0; i -= 1) {
      const placed = selectedPage.items[i];
      if (
        pagePoint.x >= placed.x &&
        pagePoint.x <= placed.x + placed.width &&
        pagePoint.y >= placed.y &&
        pagePoint.y <= placed.y + placed.height
      ) {
        return placed;
      }
    }

    return null;
  }

  function findCornerHandleTarget(
    pagePoint: { x: number; y: number },
  ): { item: PositionedImage; handle: ReturnType<typeof getHandleAtPoint> } | null {
    if (!selectedPage || !selectedImageId) {
      return null;
    }

    const viewport = previewViewportRef.current;
    let handleHitRadiusPx = 0;
    if (viewport) {
      const rect = viewport.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const backingWidth = Math.round(rect.width * dpr);
      const backingHeight = Math.round(rect.height * dpr);
      const margin = 28 * dpr;
      const availableWidth = backingWidth - margin * 2;
      const availableHeight = backingHeight - margin * 2;
      const scale = Math.min(availableWidth / selectedPage.widthPx, availableHeight / selectedPage.heightPx);
      if (Number.isFinite(scale) && scale > 0) {
        handleHitRadiusPx = SELECT_HANDLE_HIT_RADIUS_CSS_PX * dpr / scale;
      }
    }

    if (handleHitRadiusPx <= 0) {
      return null;
    }

    const selectedPlacedItem = selectedPage.items.find((item) => item.imageId === selectedImageId);
    if (!selectedPlacedItem) {
      return null;
    }

    const handle = getHandleAtPoint(pagePoint, selectedPlacedItem, handleHitRadiusPx, { cornersOnly: true });
    if (handle) {
      return { item: selectedPlacedItem, handle };
    }

    return null;
  }

  function findClosestSwapTarget(pagePoint: { x: number; y: number }, sourceImageId: string): PositionedImage | null {
    if (!selectedPage) {
      return null;
    }

    const maxSnapDistancePx = 44;
    let bestTarget: PositionedImage | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const placed of selectedPage.items) {
      if (placed.imageId === sourceImageId) {
        continue;
      }

      const frame = placed.frameThicknessPx;
      const innerX = placed.x + frame;
      const innerY = placed.y + frame;
      const innerW = placed.contentWidthPx;
      const innerH = placed.contentHeightPx;

      const clampedX = Math.max(innerX, Math.min(pagePoint.x, innerX + innerW));
      const clampedY = Math.max(innerY, Math.min(pagePoint.y, innerY + innerH));
      const distance = Math.hypot(pagePoint.x - clampedX, pagePoint.y - clampedY);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestTarget = placed;
      }
    }

    if (!bestTarget) {
      return null;
    }

    return bestDistance <= maxSnapDistancePx ? bestTarget : null;
  }

  // --- Drag Start: Only allow one drag at a time, mode guards for handle/body ---
  function handleCanvasInteractionStart(clientX: number, clientY: number): void {
    if (dragActive) return; // Only one drag at a time
    const point = pagePointFromClient(clientX, clientY);
    if (!point) {
      clearSelection();
      return;
    }

    const selectedItem = selectedImageId
      ? selectedPage?.items.find((item) => item.imageId === selectedImageId) ?? null
      : null;
    let handleHitRadiusPx = 0;
    const viewport = previewViewportRef.current;
    if (viewport && selectedPage) {
      const rect = viewport.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const backingWidth = Math.round(rect.width * dpr);
      const backingHeight = Math.round(rect.height * dpr);
      const margin = 28 * dpr;
      const availableWidth = backingWidth - margin * 2;
      const availableHeight = backingHeight - margin * 2;
      const scale = Math.min(availableWidth / selectedPage.widthPx, availableHeight / selectedPage.heightPx);
      if (Number.isFinite(scale) && scale > 0) {
        handleHitRadiusPx = SELECT_HANDLE_HIT_RADIUS_CSS_PX * dpr / scale;
      }
    }
    const handleTarget = interactionMode === 'select' ? findCornerHandleTarget(point) : null;
    const hit = findHitItem(point);
    const interactionTarget = handleTarget?.item ?? hit ?? null;
    const interactionResizeHandle = interactionMode === 'select' ? handleTarget?.handle ?? null : null;
    if (!interactionTarget) {
      clearSelection();
      return;
    }

    setSelectedImageId(interactionTarget.imageId);
    setDrawerSelectedImageId(interactionTarget.imageId);
    setHoveredImageId(interactionTarget.imageId);
    setShowSelectionControls(true);

    const item = itemById.get(interactionTarget.imageId);
    if (!item) {
      return;
    }

    // --- Mode guards: only allow resize from corner handle, move from body ---
    if (interactionMode === 'select') {
      if (interactionResizeHandle) {
        // Corner handle: resize
        const { fixedHorizontal, fixedVertical } = getHandleFixedEdges(interactionResizeHandle);
        setHoveredResizeHandle(interactionResizeHandle);
        dragStateRef.current = {
          type: 'resize',
          imageId: interactionTarget.imageId,
          startX: point.x,
          startY: point.y,
          fixedHorizontal,
          fixedVertical,
          baseMaxWidthCm: item.maxWidthCm,
          baseMaxHeightCm: item.maxHeightCm,
          baseX: interactionTarget.x,
          baseY: interactionTarget.y,
          baseWidth: interactionTarget.width,
          baseHeight: interactionTarget.height,
        };
        setDragActive(true);
        setResizeFeedback({
          baseRect: {
            x: interactionTarget.x,
            y: interactionTarget.y,
            width: interactionTarget.width,
            height: interactionTarget.height,
          },
          currentRect: {
            x: interactionTarget.x,
            y: interactionTarget.y,
            width: interactionTarget.width,
            height: interactionTarget.height,
          },
          intent: 'steady',
        });
        setResizeSnapGuides([]);
        setResizeSnapActive(false);
        return;
      } else {
        // Body: move
        setHoveredResizeHandle(null);
        dragStateRef.current = {
          type: 'move',
          imageId: interactionTarget.imageId,
          startX: point.x,
          startY: point.y,
          baseX: interactionTarget.x,
          baseY: interactionTarget.y,
        };
        setDragActive(true);
        setMoveOutsideCanvas(false);
        setMoveCollisionImageIds([]);

        return;
      }
    }

    // --- Other modes (crop, replace, move): preserve existing logic ---
    if (interactionMode === 'crop') {
      const zoom = imageZoomLevels[interactionTarget.imageId] ?? 1;
      if (zoom > 1) {
        const pan = imagePanOffsets[interactionTarget.imageId] ?? { x: 0, y: 0 };
        const bounds = getZoomPanBounds(
          {
            contentWidthPx: interactionTarget.contentWidthPx,
            contentHeightPx: interactionTarget.contentHeightPx,
            drawnImageWidthPx: interactionTarget.drawnImageWidthPx,
            drawnImageHeightPx: interactionTarget.drawnImageHeightPx,
          },
          zoom,
        );
        setDragActive(true);
        dragStateRef.current = {
          type: 'pan',
          imageId: interactionTarget.imageId,
          startX: point.x,
          startY: point.y,
          basePanX: pan.x,
          basePanY: pan.y,
          maxPanX: bounds.maxX,
          maxPanY: bounds.maxY,
        };
        return;
      }

      setDragActive(true);
      dragStateRef.current = {
        type: 'crop',
        imageId: interactionTarget.imageId,
        startX: point.x,
        startY: point.y,
        baseOffsetX: item.offsetX,
        baseOffsetY: item.offsetY,
        maxOffsetX: interactionTarget.maxOffsetX,
        maxOffsetY: interactionTarget.maxOffsetY,
      };
      return;
    }

    if (interactionMode === 'replace') {
      dragStateRef.current = {
        type: 'replace',
        sourceImageId: interactionTarget.imageId,
      };
      setReplacePointer(point);
      setDragActive(true);
      return;
    }

    if (interactionMode === 'move') {
      setHoveredResizeHandle(null);
      dragStateRef.current = {
        type: 'move',
        imageId: interactionTarget.imageId,
        startX: point.x,
        startY: point.y,
        baseX: interactionTarget.x,
        baseY: interactionTarget.y,
      };
      setDragActive(true);
      setMoveOutsideCanvas(false);
      setMoveCollisionImageIds([]);
      return;
    }
  }

  function handleCanvasInteractionMove(
    clientX: number,
    clientY: number,
    modifiers: { shiftKey: boolean } = { shiftKey: false },
  ): void {
    const point = pagePointFromClient(clientX, clientY, { allowOutsideCanvas: dragActive });
    if (!point) {
      if (!dragActive && hoveredImageId !== null) {
        setHoveredImageId(null);
      }
      if (!dragActive && hoveredResizeHandle !== null) {
        setHoveredResizeHandle(null);
      }
      // if (!dragActive && interactionMode === 'select') {
      //   setCanvasCursor('default');
      // }
      return;
    }

    const hit = findHitItem(point);
    if (!dragActive) {
      const handleTarget = interactionMode === 'select' ? findCornerHandleTarget(point) : null;
      const hoverResizeHandle = handleTarget?.handle ?? null;
      const hoverResizeImageId = handleTarget?.item.imageId ?? null;

      setHoveredResizeHandle(hoverResizeHandle);
      setHoveredImageId(hoverResizeImageId ?? (hit?.imageId ?? null));

      // In 'select' mode, update the canvas cursor based on what's under the pointer.
      // (Cursor management removed for clean code and cross-platform compatibility)
    }

    if (interactionMode === 'crop' && isPanDrag(dragStateRef.current)) {
      const drag = dragStateRef.current;
      const pan = calculateZoomPanOffset(
        drag.startX,
        drag.startY,
        point.x,
        point.y,
        drag.basePanX,
        drag.basePanY,
        {
          maxX: drag.maxPanX,
          maxY: drag.maxPanY,
        },
      );
      setImagePan(drag.imageId, pan.x, pan.y);
      return;
    }

    if (interactionMode === 'crop' && isCropDrag(dragStateRef.current)) {
      const drag = dragStateRef.current;
      const offsets = calculateCropOffsets(
        drag.startX,
        drag.startY,
        point.x,
        point.y,
        drag.baseOffsetX,
        drag.baseOffsetY,
        drag.maxOffsetX,
        drag.maxOffsetY,
      );

      updateImage(drag.imageId, {
        offsetX: Math.round(offsets.offsetX),
        offsetY: Math.round(offsets.offsetY),
      });
      return;
    }

    if (interactionMode === 'replace' && isReplaceDrag(dragStateRef.current)) {
      const drag = dragStateRef.current;
      setReplacePointer(point);
      const target = point
        ? findClosestSwapTarget(point, drag.sourceImageId)
        : null;
      setHoveredImageId(target?.imageId ?? null);
      if (target && selectedPage) {
        const sourceIndex = selectedPage.items.findIndex((item) => item.imageId === drag.sourceImageId);
        const targetIndex = selectedPage.items.findIndex((item) => item.imageId === target.imageId);
        if (sourceIndex !== -1 && targetIndex !== -1) {
          const otherItems = selectedPage.items.filter((_, i) => i !== sourceIndex && i !== targetIndex);
          setSwapTargetInvalid(!canSwapImages(selectedPage.items[sourceIndex], selectedPage.items[targetIndex], otherItems));
        } else {
          setSwapTargetInvalid(false);
        }
      } else {
        setSwapTargetInvalid(false);
      }
      return;
    }

    if ((interactionMode === 'move' || interactionMode === 'select') && isMoveDrag(dragStateRef.current)) {
      const drag = dragStateRef.current;
      const position = calculateNewPosition(
        drag.startX,
        drag.startY,
        point.x,
        point.y,
        drag.baseX,
        drag.baseY,
      );

      const placement = placementByImageId.get(drag.imageId);
      if (!placement) {
        return;
      }

      const { pageIndex, itemIndex } = placement;
      const page = pages[pageIndex];
      if (!page) {
        return;
      }

      const item = page.items[itemIndex];
      if (!item) {
        return;
      }
      const snapResult = getCanvasSnapPosition(position.x, position.y, item.width, item.height, page.widthPx, page.heightPx);
      const effectivePosition = snapResult.snapped ? { x: snapResult.x, y: snapResult.y } : position;
      const isOutsideCanvas = isPositionOutsideCanvas(
        effectivePosition.x,
        effectivePosition.y,
        item.width,
        item.height,
        page.widthPx,
        page.heightPx,
      );

      setMoveOutsideCanvas(isOutsideCanvas);

      if (!isOutsideCanvas) {
        const movingRect = {
          x: effectivePosition.x,
          y: effectivePosition.y,
          width: item.width,
          height: item.height,
        };
        const collisionIds = page.items
          .filter((other) => other.imageId !== drag.imageId && rectanglesTouchOrOverlap(movingRect, other))
          .map((other) => other.imageId);
        setMoveCollisionImageIds(collisionIds);
      } else {
        setMoveCollisionImageIds([]);
      }

      if (!isOutsideCanvas) {
        setPages((currentPages) =>
          currentPages.map((currentPage, index) => {
            if (index !== pageIndex) {
              return currentPage;
            }

            const nextItems = [...currentPage.items];
            nextItems[itemIndex] = {
              ...nextItems[itemIndex],
                x: effectivePosition.x,
                y: effectivePosition.y,
            };

            return {
              ...currentPage,
              items: nextItems,
            };
          }),
        );
      }
      return;
    }

    if ((interactionMode === 'resize' || interactionMode === 'select') && isResizeDrag(dragStateRef.current)) {
      const drag = dragStateRef.current;
      const deltaX = drag.fixedHorizontal === 'left' ? point.x - drag.startX : drag.startX - point.x;
      const deltaY = drag.fixedVertical === 'top' ? point.y - drag.startY : drag.startY - point.y;
      const preferredPushAxis = getPreferredPushAxis(deltaX, deltaY);

      // Convert deltas from pixels to cm and lock scaling to preserve aspect ratio.
      const deltaXCm = deltaX / cmToPx(1);
      const deltaYCm = deltaY / cmToPx(1);
      const dominantDeltaCm = Math.abs(deltaXCm) >= Math.abs(deltaYCm) ? deltaXCm : deltaYCm;
      const resizeIntent = dominantDeltaCm > 0.01 ? 'expand' : dominantDeltaCm < -0.01 ? 'shrink' : 'steady';

      const targetImage = itemById.get(drag.imageId);
      if (!targetImage) {
        return;
      }

      const placement = placementByImageId.get(drag.imageId);
      if (!placement) {
        return;
      }

      const { pageIndex, itemIndex } = placement;
      const page = pages[pageIndex];
      if (!page || !page.items[itemIndex]) {
        return;
      }

      const snappingEnabled = !modifiers.shiftKey;
      const assist = getResizeAssistSnap({
        baseRect: { x: drag.baseX, y: drag.baseY, width: drag.baseWidth, height: drag.baseHeight },
        fixedHorizontal: drag.fixedHorizontal,
        fixedVertical: drag.fixedVertical,
        requestedDeltaCm: dominantDeltaCm,
        neighbors: page.items.filter((item) => item.imageId !== drag.imageId),
        pxPerCm: cmToPx(1),
        thresholdPx: 12,
        includeDimensionMatches: true,
      });
      const effectiveDeltaCm = snappingEnabled && assist.snapped ? assist.deltaCm : dominantDeltaCm;
      const requestedMaxWidthCm = drag.baseMaxWidthCm + effectiveDeltaCm;
      const requestedMaxHeightCm = drag.baseMaxHeightCm + effectiveDeltaCm;

      const clampedRequestedMaxWidthCm = Math.max(minImageCm, requestedMaxWidthCm);
      const clampedRequestedMaxHeightCm = Math.max(minImageCm, requestedMaxHeightCm);
      setResizeSnapGuides(snappingEnabled ? assist.guides : []);
      setResizeSnapActive(snappingEnabled && assist.snapped);
      setResizeLimitNotice('');

      const anchorX = drag.fixedHorizontal === 'left' ? drag.baseX : drag.baseX + drag.baseWidth;
      const anchorY = drag.fixedVertical === 'top' ? drag.baseY : drag.baseY + drag.baseHeight;

      const tryApplyResize = (candidateMaxWidthCm: number, candidateMaxHeightCm: number) => {
        const nextContent = computeContentBox(
          targetImage.naturalWidth,
          targetImage.naturalHeight,
          candidateMaxWidthCm,
          candidateMaxHeightCm,
        );
        const nextFrameThicknessPx = targetImage.frameEnabled ? targetImage.frameThicknessPx : 0;
        const nextWidth = nextContent.widthPx + nextFrameThicknessPx * 2;
        const nextHeight = nextContent.heightPx + nextFrameThicknessPx * 2;
        const nextX = drag.fixedHorizontal === 'left' ? anchorX : anchorX - nextWidth;
        const nextY = drag.fixedVertical === 'top' ? anchorY : anchorY - nextHeight;
        const candidate = {
          x: nextX,
          y: nextY,
          width: nextWidth,
          height: nextHeight,
        };

        const pushedItems = resolvePushLayout(page.items, itemIndex, candidate, preferredPushAxis, page.widthPx, page.heightPx);
        if (!pushedItems) {
          return null;
        }

        const nextCrop = computeCropMetrics(
          targetImage.naturalWidth,
          targetImage.naturalHeight,
          nextContent.widthPx,
          nextContent.heightPx,
        );

        const patchedItems = [...pushedItems];
        patchedItems[itemIndex] = {
          ...patchedItems[itemIndex],
          x: nextX,
          y: nextY,
          width: candidate.width,
          height: candidate.height,
          contentWidthPx: nextContent.widthPx,
          contentHeightPx: nextContent.heightPx,
          frameThicknessPx: nextFrameThicknessPx,
          drawnImageWidthPx: nextCrop.drawnImageWidthPx,
          drawnImageHeightPx: nextCrop.drawnImageHeightPx,
          maxOffsetX: nextCrop.maxOffsetX,
          maxOffsetY: nextCrop.maxOffsetY,
        };

        return {
          nextItems: patchedItems,
          content: nextContent,
          crop: nextCrop,
          rect: candidate,
          maxWidthCm: candidateMaxWidthCm,
          maxHeightCm: candidateMaxHeightCm,
        };
      };

      let resolved = tryApplyResize(clampedRequestedMaxWidthCm, clampedRequestedMaxHeightCm);
      let scaledDownByBorder = false;

      if (!resolved && (clampedRequestedMaxWidthCm > drag.baseMaxWidthCm || clampedRequestedMaxHeightCm > drag.baseMaxHeightCm)) {
        let low = 0;
        let high = 1;
        let best: ReturnType<typeof tryApplyResize> = null;

        for (let i = 0; i < 14; i += 1) {
          const mid = (low + high) / 2;
          const midWidthCm = drag.baseMaxWidthCm + (clampedRequestedMaxWidthCm - drag.baseMaxWidthCm) * mid;
          const midHeightCm = drag.baseMaxHeightCm + (clampedRequestedMaxHeightCm - drag.baseMaxHeightCm) * mid;
          const candidate = tryApplyResize(midWidthCm, midHeightCm);

          if (candidate) {
            best = candidate;
            low = mid;
          } else {
            high = mid;
          }
        }

        if (best) {
          resolved = best;
          scaledDownByBorder = true;
        }
      }

      if (!resolved) {
        setResizeFeedback({
          baseRect: { x: drag.baseX, y: drag.baseY, width: drag.baseWidth, height: drag.baseHeight },
          currentRect: { x: drag.baseX, y: drag.baseY, width: drag.baseWidth, height: drag.baseHeight },
          intent: resizeIntent,
        });
        setResizeLimitNotice('Cannot resize further: neighboring images are pinned by the canvas border.');
        return;
      }

      // Update current dimensions for label display (content only)
      setResizeCurrentDimensions({ width: resolved.content.widthPx, height: resolved.content.heightPx });
      setResizeFeedback({
        baseRect: { x: drag.baseX, y: drag.baseY, width: drag.baseWidth, height: drag.baseHeight },
        currentRect: {
          x: resolved.rect.x,
          y: resolved.rect.y,
          width: resolved.rect.width,
          height: resolved.rect.height,
        },
        intent: resizeIntent,
      });

      setPages((currentPages) => currentPages.map((currentPage, index) => {
        if (index !== pageIndex) {
          return currentPage;
        }

        return {
          ...currentPage,
          items: resolved.nextItems,
        };
      }));

      setImages((current) => current.map((image) => {
        if (image.id !== drag.imageId) {
          return image;
        }

        const clampedOffsets = clampOffsets(image.offsetX, image.offsetY, resolved.crop.maxOffsetX, resolved.crop.maxOffsetY);
        return {
          ...image,
          maxWidthCm: Number(resolved.maxWidthCm.toFixed(2)),
          maxHeightCm: Number(resolved.maxHeightCm.toFixed(2)),
          renderWidthPx: resolved.content.widthPx,
          renderHeightPx: resolved.content.heightPx,
          cropMaxOffsetX: resolved.crop.maxOffsetX,
          cropMaxOffsetY: resolved.crop.maxOffsetY,
          offsetX: clampedOffsets.offsetX,
          offsetY: clampedOffsets.offsetY,
        };
      }));

      if (requestedMaxWidthCm < minImageCm || requestedMaxHeightCm < minImageCm) {
        setResizeLimitNotice('Minimum image size reached.');
      } else if (scaledDownByBorder) {
        setResizeLimitNotice('Resize limited by canvas border after pushing neighboring images.');
      } else {
        setResizeLimitNotice('');
      }
    }
  }

  function handleCanvasInteractionEnd(clientX?: number, clientY?: number): void {
    if (
      interactionMode === 'replace' &&
      isReplaceDrag(dragStateRef.current) &&
      typeof clientX === 'number' &&
      typeof clientY === 'number'
    ) {
      const point = pagePointFromClient(clientX, clientY);
      const target = point
        ? findClosestSwapTarget(point, dragStateRef.current.sourceImageId)
        : null;

      const targetImageId = target?.imageId ?? hoveredImageId;
      if (targetImageId && targetImageId !== dragStateRef.current.sourceImageId) {
        swapImagesOnSelectedPage(dragStateRef.current.sourceImageId, targetImageId);
        setInteractionModeState('select');
        setNotice({
          tone: 'success',
          text: 'Photos swapped. You are back in Edit mode.',
        });
      }
    }

    if ((interactionMode === 'move' || interactionMode === 'select') && isMoveDrag(dragStateRef.current) && moveOutsideCanvas) {
      const imageIdToRemove = dragStateRef.current.imageId;
      removeFromCanvas(imageIdToRemove);
    }

    dragStateRef.current = null;
    setDragActive(false);
    setReplacePointer(null);
    setSwapTargetInvalid(false);
    setMoveOutsideCanvas(false);
    setMoveCollisionImageIds([]);
    setResizeCurrentDimensions(null);
    setResizeFeedback(null);
    setResizeSnapGuides([]);
    setResizeSnapActive(false);
    setHoveredResizeHandle(null);
    if (interactionMode === 'select') {
      // setCanvasCursor removed (no-op)
    }
  }

  function onPreviewMouseLeave(): void {
    handleCanvasInteractionEnd();
  }

  function onPreviewMouseDown(clientX: number, clientY: number): void {
    handleCanvasInteractionStart(clientX, clientY);
  }

  function onPreviewDoubleClick(clientX: number, clientY: number): void {
    if (interactionMode !== 'select') {
      return;
    }
    const point = pagePointFromClient(clientX, clientY);
    if (!point) {
      return;
    }
    const hit = findHitItem(point);
    if (hit) {
      setInteractionMode('crop');
      setNotice({
        tone: 'info',
        text: 'Crop mode active. Drag the photo to reframe it, then press Esc to return to Edit mode.',
      });
    }
  }

  function resolveCanvasCursor(): string {
    if ((interactionMode === 'select' || interactionMode === 'resize') && hoveredResizeHandle) {
      return getCursorForHandle(hoveredResizeHandle);
    }

    if ((interactionMode === 'select' || interactionMode === 'move') && dragActive && isMoveDrag(dragStateRef.current)) {
      return 'grabbing';
    }

    if ((interactionMode === 'select' || interactionMode === 'move') && hoveredImageId) {
      return dragActive ? 'grabbing' : 'grab';
    }

    if (interactionMode === 'crop') {
      return dragActive ? 'grabbing' : 'grab';
    }

    if (interactionMode === 'replace') {
      return dragActive ? 'grabbing' : 'copy';
    }

    return 'default';
  }

  function onPreviewMouseMove(clientX: number, clientY: number, shiftKey: boolean): void {
    pendingInteractionMoveRef.current = {
      clientX,
      clientY,
      shiftKey,
    };

    if (interactionMoveFrameRef.current !== null) {
      return;
    }

    interactionMoveFrameRef.current = window.requestAnimationFrame(() => {
      interactionMoveFrameRef.current = null;
      const pending = pendingInteractionMoveRef.current;
      if (!pending) {
        return;
      }

      pendingInteractionMoveRef.current = null;
      handleCanvasInteractionMove(pending.clientX, pending.clientY, { shiftKey: pending.shiftKey });
    });
  }

  function onPreviewMouseUp(clientX?: number, clientY?: number): void {
    if (interactionMoveFrameRef.current !== null) {
      window.cancelAnimationFrame(interactionMoveFrameRef.current);
      interactionMoveFrameRef.current = null;
      pendingInteractionMoveRef.current = null;
    }
    if (dragStateRef.current) {
      handleCanvasInteractionEnd(clientX, clientY);
    }
  }


  function expandSelectedImage(scaleFactor: number): void {
    if (!selectedImageId) {
      return;
    }

    const currentImage = itemById.get(selectedImageId);
    if (!currentImage) {
      return;
    }

    const currentPlacement = selectedPlacedItem;
    if (!currentPlacement || !selectedPage) {
      return;
    }

    const placement = placementByImageId.get(selectedImageId);
    if (!placement) {
      return;
    }

    const { pageIndex, itemIndex } = placement;
    const page = pages[pageIndex];
    if (!page) {
      return;
    }

    const pxPerCm = cmToPx(1);
    const frameThicknessPx = currentImage.frameEnabled ? currentImage.frameThicknessPx : 0;
    const centerX = currentPlacement.x + currentPlacement.width / 2;
    const centerY = currentPlacement.y + currentPlacement.height / 2;

    const requestedMaxWidthCm = currentImage.maxWidthCm * scaleFactor;
    const requestedMaxHeightCm = currentImage.maxHeightCm * scaleFactor;

    const maxTotalWidthFromCenter = Math.max(1, Math.min(centerX, page.widthPx - centerX) * 2);
    const maxTotalHeightFromCenter = Math.max(1, Math.min(centerY, page.heightPx - centerY) * 2);
    const maxContentWidthFromCenter = Math.max(1, maxTotalWidthFromCenter - frameThicknessPx * 2);
    const maxContentHeightFromCenter = Math.max(1, maxTotalHeightFromCenter - frameThicknessPx * 2);

    const centerLimitedMaxWidthCm = maxContentWidthFromCenter / pxPerCm;
    const centerLimitedMaxHeightCm = maxContentHeightFromCenter / pxPerCm;

    const nextMaxWidthCm = Math.max(
      minImageCm,
      Math.min(centerLimitedMaxWidthCm, requestedMaxWidthCm),
    );
    const nextMaxHeightCm = Math.max(
      minImageCm,
      Math.min(centerLimitedMaxHeightCm, requestedMaxHeightCm),
    );

    const nextContent = computeContentBox(
      currentImage.naturalWidth,
      currentImage.naturalHeight,
      nextMaxWidthCm,
      nextMaxHeightCm,
    );
    const nextCrop = computeCropMetrics(
      currentImage.naturalWidth,
      currentImage.naturalHeight,
      nextContent.widthPx,
      nextContent.heightPx,
    );

    const nextWidth = nextContent.widthPx + frameThicknessPx * 2;
    const nextHeight = nextContent.heightPx + frameThicknessPx * 2;
    const nextX = centerX - nextWidth / 2;
    const nextY = centerY - nextHeight / 2;
    const candidateRect = { x: nextX, y: nextY, width: nextWidth, height: nextHeight };

    const collides = page.items
      .filter((item) => item.imageId !== selectedImageId)
      .some((item) => rectanglesTouchOrOverlap(candidateRect, item));

    if (collides) {
      setResizeLimitNotice('Cannot resize from center: neighboring images are too close.');
      return;
    }

    setPages((currentPages) =>
      currentPages.map((currentPage, index) => {
        if (index !== pageIndex) {
          return currentPage;
        }

        const nextItems = [...currentPage.items];
        nextItems[itemIndex] = {
          ...nextItems[itemIndex],
          x: nextX,
          y: nextY,
          width: nextWidth,
          height: nextHeight,
          contentWidthPx: nextContent.widthPx,
          contentHeightPx: nextContent.heightPx,
          frameThicknessPx,
          drawnImageWidthPx: nextCrop.drawnImageWidthPx,
          drawnImageHeightPx: nextCrop.drawnImageHeightPx,
          maxOffsetX: nextCrop.maxOffsetX,
          maxOffsetY: nextCrop.maxOffsetY,
        };

        return {
          ...currentPage,
          items: nextItems,
        };
      }),
    );

    setImages((current) =>
      current.map((image) => {
        if (image.id !== selectedImageId) {
          return image;
        }

        const clamped = clampOffsets(image.offsetX, image.offsetY, nextCrop.maxOffsetX, nextCrop.maxOffsetY);
        return {
          ...image,
          maxWidthCm: Number(nextMaxWidthCm.toFixed(2)),
          maxHeightCm: Number(nextMaxHeightCm.toFixed(2)),
          renderWidthPx: nextContent.widthPx,
          renderHeightPx: nextContent.heightPx,
          cropMaxOffsetX: nextCrop.maxOffsetX,
          cropMaxOffsetY: nextCrop.maxOffsetY,
          offsetX: clamped.offsetX,
          offsetY: clamped.offsetY,
        };
      }),
    );

    setResizeLimitNotice('');
  }

  function resetSelectedCrop(): void {
    if (!selectedImageId) {
      return;
    }
    updateImage(selectedImageId, { offsetX: 0, offsetY: 0 });
  }

  async function exportPages(format: 'png' | 'jpg' | 'jpeg' = 'png'): Promise<void> {
    if (!pages.length) {
      return;
    }

    const exportablePages = pages.filter((page) => page.items.length > 0);
    if (!exportablePages.length) {
      setError('No non-empty canvases to export.');
      return;
    }

    const normalizedFormat = format === 'png' ? 'png' : 'jpeg';
    const extension = format === 'jpg' ? 'jpg' : format;
    const mimeType = normalizedFormat === 'png' ? 'image/png' : 'image/jpeg';
    const exportZipErrorMessage = 'Failed to export ZIP file';
    const exportId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID().slice(0, 8)
        : Math.random().toString(36).slice(2, 10);

    setIsExporting(true);
    setLastExportSummary('');
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      const quality = normalizedFormat === 'png' ? undefined : 0.92;

      const pageFiles = await Promise.all(
        exportablePages.map(async (page, index) => {
          const canvas = renderPageToExportCanvas(page, itemById, bitmapById, {
            imageZoomLevels,
            imagePanOffsets,
          });
          const blob = await canvasToBlob(canvas, mimeType, quality);

          return {
            blob,
            fileName: `photo-grid-${exportId}-page-${index + 1}.${extension}`,
          };
        }),
      );

      pageFiles.forEach(({ blob, fileName }) => {
        zip.file(fileName, blob);
      });

      const zipBlob = await zip.generateAsync({
        type: 'blob',
        compression: 'DEFLATE',
        compressionOptions: { level: 6 },
      });

      const link = document.createElement('a');
      const objectUrl = URL.createObjectURL(zipBlob);
      link.download = `photo-grid-${exportId}.zip`;
      link.href = objectUrl;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
      const summary = `Exported ${exportablePages.length} page${exportablePages.length === 1 ? '' : 's'} as a ${extension.toUpperCase()} ZIP.`;
      setLastExportSummary(summary);
      setNotice({
        tone: 'success',
        text: `${summary} Review the downloaded archive before printing.`,
      });
      updateSessionMetrics((metrics) => ({
        ...metrics,
        exportsCompleted: metrics.exportsCompleted + 1,
        firstExportAt: metrics.firstExportAt ?? Date.now(),
      }));
    } catch (err) {
      setError(
        err instanceof Error
          ? `${exportZipErrorMessage}: ${err.message}. Please retry export or switch to PNG if JPEG packaging fails.`
          : `${exportZipErrorMessage}. Please retry export or switch to PNG if JPEG packaging fails.`,
      );
      updateSessionMetrics((metrics) => ({
        ...metrics,
        exportFailures: metrics.exportFailures + 1,
      }));
    } finally {
      setIsExporting(false);
    }
  }

  function resetGeneratedLayoutState(): void {
    setImages((current) =>
      current.map((image) => ({
        ...image,
        renderWidthPx: 0,
        renderHeightPx: 0,
        offsetX: 0,
        offsetY: 0,
        cropMaxOffsetX: 0,
        cropMaxOffsetY: 0,
      })),
    );
    setPages(
      images.length
        ? [
            {
              id: randomId('page'),
              ...resolveCanvasDimensions(),
              items: [],
            },
          ]
        : [],
    );
    setSelectedImageId(null);
    setHoveredImageId(null);
    setDrawerSelectedImageId(null);
    setShowSelectionControls(false);
    setDragActive(false);
    setAssistedPageCount(1);
    setSelectedPageIndex(0);
    setOverflowImageIds([]);
    setOversizedImageIds([]);
    setResizeLimitNotice('');
    setError('');
    setResizeCurrentDimensions(null);
    setResizeFeedback(null);
    setResizeSnapGuides([]);
    setResizeSnapActive(false);
    setSwapAnimation(null);
    setReplacePointer(null);
    setSwapTargetInvalid(false);
    dragStateRef.current = null;
    setMoveOutsideCanvas(false);
    setMoveCollisionImageIds([]);
    setCanvasPresetId(DEFAULT_CANVAS_PRESET_ID);
    setLayoutPresetId(DEFAULT_LAYOUT_PRESET_ID);
    setCustomCanvasWidthCm(20);
    setCustomCanvasHeightCm(20);
    setSaveState('idle');
    setLastSavedAt(null);
    setRestoredFromSnapshot(false);
    setUndoAction(null);
    setLastExportSummary('');
  }

  function startFromScratch(): void {
    const hasAnyLayout = pages.some((page) => page.items.length > 0);
    if (hasAnyLayout) {
      const confirmed = window.confirm(
        'Reset the generated layout and keep your uploaded photos in the library? You can undo this right after resetting.',
      );
      registerDestructiveConfirmation(confirmed);
      if (!confirmed) {
        return;
      }
      queueUndoAction('Layout reset', 'Undo reset and restore your previous page arrangement.', captureEditorUndoSnapshot());
    }
    resetGeneratedLayoutState();
    setNotice({
      tone: 'info',
      text: 'Layout reset. Your uploaded photos are still available, and you can undo this reset.',
    });
  }

  async function enhanceImage(imageId: string, options: EnhanceOptions = {}): Promise<void> {
    const image = images.find((img) => img.id === imageId);
    if (!image) return;
    setEnhancingImageIds((prev) => new Set(prev).add(imageId));
    updateSessionMetrics((metrics) => ({
      ...metrics,
      enhancementRuns: metrics.enhancementRuns + 1,
    }));
    try {
      const enhancedSrc = await enhanceImageWithAI(image.src, options);
      // Load the result as an HTMLImageElement (matches ImageItem.bitmap type)
      const htmlImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Failed to load enhanced image'));
        el.src = enhancedSrc;
      });
      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...img, src: enhancedSrc, bitmap: htmlImg } : img,
        ),
      );
      setNotice({
        tone: 'success',
        text: `Enhanced ${image.fileName}. Compare it on the canvas before exporting.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Auto enhancement failed');
      updateSessionMetrics((metrics) => ({
        ...metrics,
        enhancementFailures: metrics.enhancementFailures + 1,
      }));
    } finally {
      setEnhancingImageIds((prev) => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
    }
  }

  async function enhanceAllImages(options: EnhanceOptions = {}): Promise<void> {
    const preset = options.preset ?? 'consistent';
    setBatchEnhanceProgress({
      completed: 0,
      total: images.length,
      preset,
    });
    for (const [index, image] of images.entries()) {
      await enhanceImage(image.id, options);
      setBatchEnhanceProgress((current: BatchEnhanceProgress | null) =>
        current
          ? {
              ...current,
              completed: index + 1,
            }
          : current,
      );
    }
    setBatchEnhanceProgress(null);
    if (images.length) {
      setNotice({
        tone: 'success',
        text: `Finished enhancing ${images.length} photo${images.length === 1 ? '' : 's'}. Review the results before export.`,
      });
    }
  }

  async function restoreOriginalImage(imageId: string): Promise<void> {
    const image = images.find((img) => img.id === imageId);
    if (!image || image.src === image.originalSrc) {
      return;
    }

    setEnhancingImageIds((prev) => new Set(prev).add(imageId));
    try {
      const originalImg = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('Failed to restore original image'));
        el.src = image.originalSrc;
      });

      setImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...img, src: img.originalSrc, bitmap: originalImg } : img,
        ),
      );
      setNotice({
        tone: 'info',
        text: `Restored the original version of ${image.fileName}.`,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to restore original image');
    } finally {
      setEnhancingImageIds((prev) => {
        const next = new Set(prev);
        next.delete(imageId);
        return next;
      });
    }
  }

  function deleteImage(imageId: string): void {
    const image = images.find((img) => img.id === imageId);
    const confirmed = window.confirm(
      `Delete ${image?.fileName ?? 'this photo'} from the project library? This also removes it from every page.`,
    );
    registerDestructiveConfirmation(confirmed);
    if (!confirmed) {
      return;
    }
    if (image) {
      URL.revokeObjectURL(image.src);
      knownImageSrcsRef.current.delete(image.src);
      if (image.originalSrc !== image.src) {
        URL.revokeObjectURL(image.originalSrc);
        knownImageSrcsRef.current.delete(image.originalSrc);
      }
    }
    setImages((prev) => prev.filter((img) => img.id !== imageId));
    setPages((prev) =>
      prev.map((page) => ({ ...page, items: page.items.filter((item) => item.imageId !== imageId) })),
    );
    setOverflowImageIds((prev) => prev.filter((id) => id !== imageId));
    setOversizedImageIds((prev) => prev.filter((id) => id !== imageId));
    if (selectedImageId === imageId) {
      setSelectedImageId(null);
      setHoveredImageId(null);
      setShowSelectionControls(false);
      setResizeCurrentDimensions(null);
      setResizeFeedback(null);
      setResizeSnapGuides([]);
      setResizeSnapActive(false);
      setResizeLimitNotice('');
      setMoveOutsideCanvas(false);
      setMoveCollisionImageIds([]);
    }
    if (drawerSelectedImageId === imageId) {
      setDrawerSelectedImageId(null);
    }
    setNotice({
      tone: 'info',
      text: `${image?.fileName ?? 'Photo'} removed from the project library.`,
    });
  }

  function removeFromCanvas(imageId: string): void {
    const image = images.find((img) => img.id === imageId);
    queueUndoAction(
      'Photo removed',
      'Undo removal and place the photo back on its previous page.',
      captureEditorUndoSnapshot(),
    );
    setPages((prev) =>
      prev.map((page) => ({ ...page, items: page.items.filter((item) => item.imageId !== imageId) })),
    );
    setOverflowImageIds((prev) => prev.filter((id) => id !== imageId));
    if (selectedImageId === imageId) {
      setSelectedImageId(null);
      setHoveredImageId(null);
      setShowSelectionControls(false);
      setResizeCurrentDimensions(null);
      setResizeFeedback(null);
      setResizeSnapGuides([]);
      setResizeSnapActive(false);
      setResizeLimitNotice('');
      setMoveOutsideCanvas(false);
      setMoveCollisionImageIds([]);
    }
    updateSessionMetrics((metrics) => ({
      ...metrics,
      removedFromCanvas: metrics.removedFromCanvas + 1,
    }));
    setNotice({
      tone: 'info',
      text: `${image?.fileName ?? 'Photo'} removed from the current layout. You can undo this action.`,
    });
  }

  function removeSelectedCanvas(): void {
    if (!pages.length) {
      return;
    }

    const targetPage = pages[selectedPageIndex];
    if (!targetPage) {
      return;
    }

    const hasItems = targetPage.items.length > 0;
    if (hasItems) {
      const confirmed = window.confirm(
        `Remove current page ${selectedPageIndex + 1}? It contains ${targetPage.items.length} placed photo${targetPage.items.length === 1 ? '' : 's'}. You can undo this right after removing it.`,
      );
      registerDestructiveConfirmation(confirmed);
      if (!confirmed) {
        return;
      }
    }

    queueUndoAction(
      'Page removed',
      'Undo page removal and restore the previous page stack.',
      captureEditorUndoSnapshot(),
    );
    const removedImageIds = new Set(targetPage.items.map((item) => item.imageId));
    setPages((prev) => prev.filter((_, index) => index !== selectedPageIndex));
    setSelectedPageIndex((current) => {
      const nextCount = pages.length - 1;
      if (nextCount <= 0) {
        return 0;
      }
      return Math.max(0, Math.min(current, nextCount - 1));
    });

    if (selectedImageId && removedImageIds.has(selectedImageId)) {
      setSelectedImageId(null);
      setHoveredImageId(null);
      setShowSelectionControls(false);
      setResizeCurrentDimensions(null);
      setResizeFeedback(null);
      setResizeSnapGuides([]);
      setResizeSnapActive(false);
      setResizeLimitNotice('');
      setMoveOutsideCanvas(false);
      setMoveCollisionImageIds([]);
    }
    updateSessionMetrics((metrics) => ({
      ...metrics,
      removedPages: metrics.removedPages + 1,
    }));
    setNotice({
      tone: 'info',
      text: `Removed page ${selectedPageIndex + 1}. You can undo this action.`,
    });
  }

  function clearEverything(): void {
    const confirmed = window.confirm(
      'Clear the entire project, including uploaded photos, layouts, and saved local state? This cannot be undone.',
    );
    registerDestructiveConfirmation(confirmed);
    if (!confirmed) {
      return;
    }
    const urlsToRevoke = new Set<string>();
    for (const image of images) {
      urlsToRevoke.add(image.src);
      urlsToRevoke.add(image.originalSrc);
    }
    for (const src of urlsToRevoke) {
      URL.revokeObjectURL(src);
    }

    knownImageSrcsRef.current = new Set();
    setImages([]);
    setPages([]);
    setMaxImageCm(DEFAULT_MAX_IMAGE_CM);
    setMinImageCm(DEFAULT_MIN_IMAGE_CM);
    setFrameMm(DEFAULT_FRAME_MM);
    setGridModeEnabled(false);
    setAutoCompactPages(true);
    setPaginationMode('auto');
    setInteractionModeState('select');
    setSelectedImageId(null);
    setHoveredImageId(null);
    setDrawerSelectedImageId(null);
    setShowSelectionControls(false);
    setDragActive(false);
    setAssistedPageCount(1);
    setSelectedPageIndex(0);
    setOverflowImageIds([]);
    setOversizedImageIds([]);
    setResizeLimitNotice('');
    setError('');
    setResizeCurrentDimensions(null);
    setResizeFeedback(null);
    setResizeSnapGuides([]);
    setResizeSnapActive(false);
    setSwapAnimation(null);
    setReplacePointer(null);
    setSwapTargetInvalid(false);
    dragStateRef.current = null;
    setMoveOutsideCanvas(false);
    setMoveCollisionImageIds([]);
    setCanvasPresetId(DEFAULT_CANVAS_PRESET_ID);
    setLayoutPresetId(DEFAULT_LAYOUT_PRESET_ID);
    setCustomCanvasWidthCm(20);
    setCustomCanvasHeightCm(20);
    setSaveState('idle');
    setLastSavedAt(null);
    setRestoredFromSnapshot(false);
    setUndoAction(null);
    setLastExportSummary('');
    setBatchEnhanceProgress(null);
    setSessionMetrics(DEFAULT_SESSION_METRICS());
    setNotice({
      tone: 'info',
      text: 'Project cleared. Start again by uploading photos.',
    });
    void clearSnapshot();
  }

  // --- END useCollageEditor function ---
  return {
    images,
    pages,
    itemById,
    imageById,
    imageZoomLevels,
    imagePanOffsets,
    maxImageCm,
    setMaxImageCm,
    minImageCm,
    setMinImageCm,
    frameMm,
    setFrameMm,
    gridModeEnabled,
    setGridModeEnabled,
    autoCompactPages,
    setAutoCompactPages,
    paginationMode,
    setPaginationMode,
    interactionMode,
    setInteractionMode,
    selectedImage,
    selectedPlacedItem,
    selectedImageId,
    hoveredImageId,
    drawerSelectedImageId,
    dragActive,
    moveOutsideCanvas,
    moveCollisionImageIds,
    hasPlacedItems,
    hasUnplacedImages,
    selectedPageIndex,
    setSelectedPageIndex,
    overflowImageIds,
    oversizedImageIds,
    resizeLimitNotice,
    resizeCurrentDimensions,
    canvasCursor: resolveCanvasCursor(),
    resizeFeedback,
    resizeSnapGuides,
    resizeSnapActive,
    error,
    notice,
    saveState,
    lastSavedAt,
    restoredFromSnapshot,
    workflowStage,
    isExporting,
    lastExportSummary,
    batchEnhanceProgress,
    sessionMetrics,
    sessionInsights,
    undoActionLabel: undoAction?.label ?? null,
    undoActionDescription: undoAction?.description ?? null,
    showSelectionControls,
    replaceAnimationTick,
    replacePointer,
    swapTargetInvalid,
    canvasPlacementPreview,
    previewViewportRef,
    canvasPresetId,
    setCanvasPresetId,
    layoutPresetId,
    setLayoutPresetId,
    recommendedLayoutHint,
    customCanvasWidthCm,
    setCustomCanvasWidthCm,
    customCanvasHeightCm,
    setCustomCanvasHeightCm,
    onUploadFiles,
    uploadFileList,
    applyGlobalSettings,
    onGenerateLayout,
    exportPages,
    onCreateNextPage,
    startFromScratch,
    clearEverything,
    undoLastAction,
    updateImage,
    deleteImage,
    removeFromCanvas,
    removeSelectedCanvas,
    enhanceImage,
    enhanceAllImages,
    restoreOriginalImage,
    enhancingImageIds,
    onPreviewMouseDown,
    onPreviewMouseMove,
    onPreviewMouseUp,
    onPreviewMouseLeave,
    onPreviewDoubleClick,
    onCanvasDragOver,
    onCanvasDrop,
    onCanvasDragLeave,
    onBeginManualPlacementDrag,
    onEndManualPlacementDrag,
    placeImageOnSelectedPage,
    expandSelectedImage,
    resetSelectedCrop,
    clearSelection,
    setShowSelectionControls,
  };
}
