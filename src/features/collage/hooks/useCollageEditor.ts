import { enhanceImageWithAI, type EnhanceOptions, type EnhancePreset } from '../lib/openaiImageEdit';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, MouseEvent, PointerEvent } from 'react';
import {
  CANVAS_SIZE_PRESETS,
  DEFAULT_CANVAS_PRESET_ID,
  DEFAULT_FRAME_MM,
  DEFAULT_GRID_SPACING_CM,
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
import { drawPagePreview, renderPageToExportCanvas } from '../model/renderEngine';
import { useEditorUIStore } from '../store/editorUIStore';
import type {
  ImageItem,
  InteractionMode,
  PaginationMode,
  PersistedEditorSnapshot,
  PersistedImageItem,
  PositionedImage,
  PreviewTransform,
  ResizeSnapGuide,
} from '../model/types';
import { blobToImage, fileToImage } from '../lib/fileToImage';
import { clearSnapshot, loadSnapshot, saveSnapshot } from '../lib/persistence';
import {
  type DragState,
  isCropDrag,
  isMoveDrag,
  isPanDrag,
  isReplaceDrag,
  isResizeDrag,
} from '../../../shared/drag';
import {
  rectanglesOverlap,
  isInsideCanvas,
  computeContentBox,
  computeCropMetrics,
} from '../../../shared/math';
import {
  calculateCropOffsets,
  calculateNewPosition,
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
} from '../interactions';
import { computeSmartDropSize, resolveSmartFraming } from '../lib/editorLayoutUtils';

function pageHasOverlap(page: { items: Array<{ x: number; y: number; width: number; height: number }> }): boolean {
  for (let i = 0; i < page.items.length; i += 1) {
    const current = page.items[i];
    for (let j = i + 1; j < page.items.length; j += 1) {
      if (rectanglesOverlap(current, page.items[j])) {
        return true;
      }
    }
  }
  return false;
}

type ResizeFeedback = {
  baseRect: { x: number; y: number; width: number; height: number };
  currentRect: { x: number; y: number; width: number; height: number };
  intent: 'expand' | 'shrink' | 'steady';
};

type SwapAnimation = {
  startedTick: number;
  durationTicks: number;
  transitions: Record<
    string,
    {
      from: { x: number; y: number };
      to: { x: number; y: number };
    }
  >;
};

function elapsedTicks(currentTick: number, startTick: number): number {
  return currentTick >= startTick ? currentTick - startTick : 10000 - startTick + currentTick;
}

const SELECT_HANDLE_HIT_RADIUS_CSS_PX = 12;

function randomId(prefix = 'img'): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

/**
 * Promisified wrapper around canvas.toBlob for export flows.
 */
function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas export failed'));
        return;
      }

      resolve(blob);
    }, mimeType, quality);
  });
}

interface CanvasPlacementPreview {
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  valid: boolean;
}

type WorkflowStage = 'upload' | 'generate' | 'edit' | 'export';
type SaveState = 'idle' | 'saving' | 'saved' | 'error';
type NoticeTone = 'info' | 'success';

interface NoticeMessage {
  tone: NoticeTone;
  text: string;
}

interface UndoAction {
  label: string;
  description: string;
  restore: () => void;
}

interface BatchEnhanceProgress {
  completed: number;
  total: number;
  preset: EnhancePreset;
}

interface SessionMetrics {
  sessionStartedAt: number;
  firstUploadAt: number | null;
  firstLayoutAt: number | null;
  firstExportAt: number | null;
  uploads: number;
  layoutGenerations: number;
  exportsCompleted: number;
  exportFailures: number;
  enhancementRuns: number;
  enhancementFailures: number;
  modeSwitches: number;
  destructiveConfirms: number;
  destructiveCancels: number;
  removedFromCanvas: number;
  removedPages: number;
}

interface EditorUndoSnapshot {
  images: ImageItem[];
  pages: Array<{ id: string; widthPx: number; heightPx: number; items: PositionedImage[] }>;
  maxImageCm: number;
  minImageCm: number;
  frameMm: number;
  gridModeEnabled: boolean;
  autoCompactPages: boolean;
  paginationMode: PaginationMode;
  interactionMode: InteractionMode;
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
  sessionStartedAt: Date.now(),
  firstUploadAt: null,
  firstLayoutAt: null,
  firstExportAt: null,
  uploads: 0,
  layoutGenerations: 0,
  exportsCompleted: 0,
  exportFailures: 0,
  enhancementRuns: 0,
  enhancementFailures: 0,
  modeSwitches: 0,
  destructiveConfirms: 0,
  destructiveCancels: 0,
  removedFromCanvas: 0,
  removedPages: 0,
});

export function useCollageEditor() {
  const {
    drawerSelectedImageId,
    setDrawerSelectedImageId,
    imageZoomLevels,
    setImageZoom,
    imagePanOffsets,
    setImagePan,
  } = useEditorUIStore();
  const [images, setImages] = useState<ImageItem[]>([]);
  const [pages, setPages] = useState<Array<{ id: string; widthPx: number; heightPx: number; items: PositionedImage[] }>>([]);
  const [maxImageCm, setMaxImageCm] = useState<number>(DEFAULT_MAX_IMAGE_CM);
  const [minImageCm, setMinImageCm] = useState<number>(DEFAULT_MIN_IMAGE_CM);
  const [frameMm, setFrameMm] = useState<number>(DEFAULT_FRAME_MM);
  const [gridModeEnabled, setGridModeEnabled] = useState<boolean>(false);
  const [autoCompactPages, setAutoCompactPages] = useState<boolean>(true);
  const [paginationMode, setPaginationMode] = useState<PaginationMode>('auto');
  const [interactionMode, setInteractionModeState] = useState<InteractionMode>('select');
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [hoveredImageId, setHoveredImageId] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [assistedPageCount, setAssistedPageCount] = useState<number>(1);
  const [selectedPageIndex, setSelectedPageIndex] = useState<number>(0);
  const [overflowImageIds, setOverflowImageIds] = useState<string[]>([]);
  const [oversizedImageIds, setOversizedImageIds] = useState<string[]>([]);
  const [resizeLimitNotice, setResizeLimitNotice] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isHydrated, setIsHydrated] = useState<boolean>(false);
  const [replaceAnimationTick, setReplaceAnimationTick] = useState<number>(0);
  const [swapAnimation, setSwapAnimation] = useState<SwapAnimation | null>(null);
  const [replacePointer, setReplacePointer] = useState<{ x: number; y: number } | null>(null);
  const [swapTargetInvalid, setSwapTargetInvalid] = useState<boolean>(false);
  const [moveOutsideCanvas, setMoveOutsideCanvas] = useState<boolean>(false);
  const [moveCollisionImageIds, setMoveCollisionImageIds] = useState<string[]>([]);
  const [resizeCurrentDimensions, setResizeCurrentDimensions] = useState<{ width: number; height: number } | null>(null);
  const [resizeFeedback, setResizeFeedback] = useState<ResizeFeedback | null>(null);
  const [resizeSnapGuides, setResizeSnapGuides] = useState<ResizeSnapGuide[]>([]);
  const [resizeSnapActive, setResizeSnapActive] = useState<boolean>(false);
  const [enhancingImageIds, setEnhancingImageIds] = useState<Set<string>>(new Set());
  const [canvasPlacementPreview, setCanvasPlacementPreview] = useState<CanvasPlacementPreview | null>(null);
  const [manualPlacementDragImageId, setManualPlacementDragImageId] = useState<string | null>(null);
  const [showSelectionControls, setShowSelectionControls] = useState<boolean>(false);
  const [canvasPresetId, setCanvasPresetId] = useState<CanvasSizePresetId>(DEFAULT_CANVAS_PRESET_ID);
  const [customCanvasWidthCm, setCustomCanvasWidthCm] = useState<number>(20);
  const [customCanvasHeightCm, setCustomCanvasHeightCm] = useState<number>(20);
  const [layoutPresetId, setLayoutPresetId] = useState<LayoutPresetId>(DEFAULT_LAYOUT_PRESET_ID);
  const [canvasCursor, setCanvasCursor] = useState<string>('cursor-default');
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [restoredFromSnapshot, setRestoredFromSnapshot] = useState<boolean>(false);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [lastExportSummary, setLastExportSummary] = useState<string>('');
  const [batchEnhanceProgress, setBatchEnhanceProgress] = useState<BatchEnhanceProgress | null>(null);
  const [sessionMetrics, setSessionMetrics] = useState<SessionMetrics>(DEFAULT_SESSION_METRICS);

  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewTransformRef = useRef<PreviewTransform | null>(null);
  const previewRenderFrameRef = useRef<number | null>(null);
  const interactionMoveFrameRef = useRef<number | null>(null);
  const pendingInteractionMoveRef = useRef<{ clientX: number; clientY: number; shiftKey: boolean } | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  // Tracks when pointer capture is active for a mouse pointer so that the
  // duplicate mouse event handlers (mousedown/mousemove/mouseup/mouseleave)
  // can be suppressed while pointer events handle the interaction.
  const mousePointerCapturedRef = useRef(false);
  const knownImageSrcsRef = useRef<Set<string>>(new Set());

  const itemById = useMemo(() => new Map(images.map((img) => [img.id, img])), [images]);
  const imageById = useMemo(() => new Map(images.map((img) => [img.id, img.bitmap])), [images]);
  const placementByImageId = useMemo(() => {
    const next = new Map<string, { pageIndex: number; itemIndex: number; item: PositionedImage }>();
    pages.forEach((page, pageIndex) => {
      page.items.forEach((item, itemIndex) => {
        next.set(item.imageId, { pageIndex, itemIndex, item });
      });
    });
    return next;
  }, [pages]);
  const selectedPage = pages[selectedPageIndex] ?? null;
  const selectedImage = selectedImageId ? itemById.get(selectedImageId) ?? null : null;
  const selectedPlacedItem = selectedImageId ? placementByImageId.get(selectedImageId)?.item ?? null : null;
  const hasPlacedItems = pages.some((page) => page.items.length > 0);
  const hasUnplacedImages = images.length > 0 && !hasPlacedItems;

  function updateSessionMetrics(update: (current: SessionMetrics) => SessionMetrics): void {
    setSessionMetrics((current) => update(current));
  }

  function setInteractionMode(nextMode: InteractionMode): void {
    setInteractionModeState((current) => {
      if (current === nextMode) {
        return current;
      }

      updateSessionMetrics((metrics) => ({
        ...metrics,
        modeSwitches: metrics.modeSwitches + 1,
      }));
      return nextMode;
    });
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

  const recommendedLayoutHint = useMemo(() => {
    if (!images.length) {
      return '';
    }

    const preset = CANVAS_SIZE_PRESETS.find((p) => p.id === canvasPresetId) ?? CANVAS_SIZE_PRESETS[0];
    const widthCm = canvasPresetId === 'custom' ? customCanvasWidthCm : preset.widthCm;
    const heightCm = canvasPresetId === 'custom' ? customCanvasHeightCm : preset.heightCm;
    const widthPx = Math.round(cmToPx(widthCm));
    const heightPx = Math.round(cmToPx(heightCm));
    const orientation = widthPx >= heightPx ? 'landscape' : 'portrait';
    const portraitCount = images.filter((img) => img.naturalHeight >= img.naturalWidth).length;
    const portraitShare = portraitCount / images.length;
    const recommended = new Set<LayoutPresetId>();

    if (images.length >= 8) {
      recommended.add('grid_3x3');
    } else if (images.length >= 4) {
      recommended.add('grid_2x2');
    }

    if (images.length >= 3 && images.length <= 5) {
      recommended.add('hero_supporting');
      recommended.add('mosaic');
    }

    if (images.length >= 3 && images.length <= 4) {
      recommended.add('story_strip');
    }

    if (orientation === 'portrait' && portraitShare > 0.6) {
      recommended.add('story_strip');
      recommended.add('mosaic');
    }

    if (recommended.size === 0) {
      return '';
    }

    const labels = LAYOUT_PRESETS.filter((preset) => recommended.has(preset.id) && preset.id !== 'auto').map(
      (preset) => preset.label,
    );

    return labels.length ? `Recommended: ${labels.join(' • ')}` : '';
  }, [images, canvasPresetId, customCanvasWidthCm, customCanvasHeightCm]);

  const workflowStage = useMemo<WorkflowStage>(() => {
    if (!images.length) {
      return 'upload';
    }
    if (!hasPlacedItems) {
      return 'generate';
    }
    if (isExporting || sessionMetrics.exportsCompleted > 0) {
      return 'export';
    }
    return 'edit';
  }, [hasPlacedItems, images.length, isExporting, sessionMetrics.exportsCompleted]);

  const sessionInsights = useMemo(() => ({
    timeToFirstLayoutMs:
      sessionMetrics.firstUploadAt && sessionMetrics.firstLayoutAt
        ? Math.max(0, sessionMetrics.firstLayoutAt - sessionMetrics.firstUploadAt)
        : null,
    timeToFirstExportMs:
      sessionMetrics.firstLayoutAt && sessionMetrics.firstExportAt
        ? Math.max(0, sessionMetrics.firstExportAt - sessionMetrics.firstLayoutAt)
        : null,
  }), [sessionMetrics.firstExportAt, sessionMetrics.firstLayoutAt, sessionMetrics.firstUploadAt]);

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
    const canvas = previewCanvasRef.current;
    if (!canvas || !selectedPage) {
      return;
    }

    if (previewRenderFrameRef.current !== null) {
      window.cancelAnimationFrame(previewRenderFrameRef.current);
    }

    previewRenderFrameRef.current = window.requestAnimationFrame(() => {
      previewTransformRef.current = drawPagePreview(canvas, selectedPage, itemById, imageById, {
        gridEnabled: gridModeEnabled,
        gridSpacingPx: cmToPx(DEFAULT_GRID_SPACING_CM),
        selectedImageId,
        hoveredImageId,
        drawerSelectedImageId,
        imageZoomLevels,
        imagePanOffsets,
        interactionMode,
        dragActive,
        moveOutsideCanvas,
        moveCollisionImageIds,
        resizeCurrentDimensions,
        resizeFeedback,
        resizeSnapGuides,
        resizeSnapActive,
        swapAnimation,
        replacePointer,
        swapTargetInvalid,
        placementPreview: canvasPlacementPreview,
        animationTimeMs: replaceAnimationTick,
      });
      previewRenderFrameRef.current = null;
    });

    return () => {
      if (previewRenderFrameRef.current !== null) {
        window.cancelAnimationFrame(previewRenderFrameRef.current);
        previewRenderFrameRef.current = null;
      }
    };
  }, [selectedPage, itemById, imageById, gridModeEnabled, selectedImageId, hoveredImageId, drawerSelectedImageId, imageZoomLevels, imagePanOffsets, interactionMode, dragActive, moveOutsideCanvas, moveCollisionImageIds, resizeCurrentDimensions, resizeFeedback, resizeSnapGuides, resizeSnapActive, swapAnimation, replacePointer, swapTargetInvalid, canvasPlacementPreview, replaceAnimationTick]);

  useEffect(() => {
    return () => {
      if (interactionMoveFrameRef.current !== null) {
        window.cancelAnimationFrame(interactionMoveFrameRef.current);
      }
    };
  }, []);

function rectanglesTouchOrOverlap(
  a: { x: number; y: number; width: number; height: number },
  b: { x: number; y: number; width: number; height: number },
): boolean {
  const aRight = a.x + a.width;
  const bRight = b.x + b.width;
  const aBottom = a.y + a.height;
  const bBottom = b.y + b.height;

  return !(aRight < b.x || a.x > bRight || aBottom < b.y || a.y > bBottom);
}

  useEffect(() => {
    const currentSrcs = new Set<string>();
    for (const image of images) {
      currentSrcs.add(image.src);
      currentSrcs.add(image.originalSrc);
    }
    for (const previousSrc of knownImageSrcsRef.current) {
      if (!currentSrcs.has(previousSrc)) {
        URL.revokeObjectURL(previousSrc);
      }
    }
    knownImageSrcsRef.current = currentSrcs;
  }, [images]);

  useEffect(() => {
    return () => {
      for (const src of knownImageSrcsRef.current) {
        URL.revokeObjectURL(src);
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
    setImages((current) => current.map((image) => (image.id === id ? { ...image, ...patch } : image)));
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
    const canvas = previewCanvasRef.current;
    const transform = previewTransformRef.current;
    if (!canvas || !transform || !selectedPage) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * transform.dpr;
    const y = (clientY - rect.top) * transform.dpr;

    const pageX = (x - transform.offsetX) / transform.scale;
    const pageY = (y - transform.offsetY) / transform.scale;

    if (
      !options.allowOutsideCanvas &&
      (pageX < 0 || pageY < 0 || pageX > selectedPage.widthPx || pageY > selectedPage.heightPx)
    ) {
      return null;
    }

    return { x: pageX, y: pageY };
  }

  function pagePointFromMouse(event: MouseEvent<HTMLCanvasElement>): { x: number; y: number } | null {
    return pagePointFromClient(event.clientX, event.clientY);
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

  function findHitItem(pagePoint: { x: number; y: number }): PositionedImage | null {
    if (!selectedPage) {
      return null;
    }

    const transform = previewTransformRef.current;
    const handleHitRadiusPx = transform
      ? SELECT_HANDLE_HIT_RADIUS_CSS_PX * transform.dpr / transform.scale
      : 0;

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

      if (
        placed.imageId === selectedImageId &&
        handleHitRadiusPx > 0 &&
        getHandleAtPoint(pagePoint, placed, handleHitRadiusPx, { cornersOnly: true })
      ) {
        return placed;
      }
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

  function handleCanvasInteractionStart(clientX: number, clientY: number): void {
    const point = pagePointFromClient(clientX, clientY);
    if (!point) {
      setSelectedImageId(null);
      setDrawerSelectedImageId(null);
      setHoveredImageId(null);
      setDragActive(false);
      setShowSelectionControls(false);
      setResizeSnapGuides([]);
      setResizeSnapActive(false);
      return;
    }

    const selectedItem = selectedImageId
      ? selectedPage?.items.find((item) => item.imageId === selectedImageId) ?? null
      : null;
    const transform = previewTransformRef.current;
    const handleHitRadiusPx = transform
      ? SELECT_HANDLE_HIT_RADIUS_CSS_PX * transform.dpr / transform.scale
      : 0;
    const selectedHandle = interactionMode === 'select' && selectedItem && handleHitRadiusPx > 0
      ? getHandleAtPoint(point, selectedItem, handleHitRadiusPx, { cornersOnly: true })
      : null;
    const selectedResizeHandle = selectedHandle;

    const hit = findHitItem(point);
    const interactionTarget = hit ?? (selectedResizeHandle ? selectedItem : null);
    const interactionResizeHandle = interactionMode === 'select' && interactionTarget && handleHitRadiusPx > 0
      ? getHandleAtPoint(point, interactionTarget, handleHitRadiusPx, { cornersOnly: true })
      : null;
    if (!interactionTarget) {
      setSelectedImageId(null);
      setDrawerSelectedImageId(null);
      setHoveredImageId(null);
      setDragActive(false);
      setShowSelectionControls(false);
      setResizeSnapGuides([]);
      setResizeSnapActive(false);
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

    if (interactionMode === 'select') {
      // Check if the click lands on a resize handle (corner or edge) of the interaction target.
      if (interactionResizeHandle) {
        const { fixedHorizontal, fixedVertical } = getHandleFixedEdges(interactionResizeHandle);
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
      }
      // No corner handle hit — start a move drag.
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
      setCanvasCursor('cursor-grabbing');
      return;
    }

    const fixedHorizontal = point.x >= interactionTarget.x + interactionTarget.width / 2 ? 'left' : 'right';
    const fixedVertical = point.y >= interactionTarget.y + interactionTarget.height / 2 ? 'top' : 'bottom';

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
      return;
    }

    const hit = findHitItem(point);
    if (!dragActive) {
      const transform = previewTransformRef.current;
      const selectedItem = selectedImageId
        ? selectedPage?.items.find((item) => item.imageId === selectedImageId) ?? null
        : null;
      const handleHitRadiusPx = transform
        ? SELECT_HANDLE_HIT_RADIUS_CSS_PX * transform.dpr / transform.scale
        : 0;
      const selectedResizeHandle = interactionMode === 'select' && selectedItem && handleHitRadiusPx > 0
        ? getHandleAtPoint(point, selectedItem, handleHitRadiusPx, { cornersOnly: true })
        : null;
      const hitResizeHandle = interactionMode === 'select' && hit && handleHitRadiusPx > 0
        ? getHandleAtPoint(point, hit, handleHitRadiusPx, { cornersOnly: true })
        : null;
      const hoverResizeHandle = selectedResizeHandle ?? hitResizeHandle;
      const hoverResizeImageId = selectedResizeHandle && selectedItem
        ? selectedItem.imageId
        : hitResizeHandle && hit
          ? hit.imageId
          : null;

      setHoveredImageId(hoverResizeImageId ?? (hit?.imageId ?? null));

      // In 'select' mode, update the canvas cursor based on what's under the pointer.
      if (interactionMode === 'select') {
        if (hoverResizeHandle) {
          setCanvasCursor(getCursorForHandle(hoverResizeHandle));
        } else if (hit) {
          setCanvasCursor('cursor-grab');
        } else {
          setCanvasCursor('cursor-default');
        }
      }
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

    if ((interactionMode === 'move' || interactionMode === 'select') && isMoveDrag(dragStateRef.current) && !moveOutsideCanvas) {
      const imageId = dragStateRef.current.imageId;
      const pageIndex = pages.findIndex((page) => page.items.some((item) => item.imageId === imageId));
      if (pageIndex >= 0) {
        const page = pages[pageIndex];
        const itemIndex = page.items.findIndex((item) => item.imageId === imageId);
        if (itemIndex >= 0) {
          const item = page.items[itemIndex];
          const outsideRatio = calculateOutsideRatio(item.x, item.y, item.width, item.height, page.widthPx, page.heightPx);

          if (outsideRatio > 0 && outsideRatio < 0.05) {
            const snappedX = Math.max(0, Math.min(page.widthPx - item.width, item.x));
            const snappedY = Math.max(0, Math.min(page.heightPx - item.height, item.y));

            if (snappedX !== item.x || snappedY !== item.y) {
              setPages((currentPages) =>
                currentPages.map((currentPage, currentPageIndex) => {
                  if (currentPageIndex !== pageIndex) {
                    return currentPage;
                  }

                  const nextItems = [...currentPage.items];
                  nextItems[itemIndex] = {
                    ...nextItems[itemIndex],
                    x: snappedX,
                    y: snappedY,
                  };

                  return {
                    ...currentPage,
                    items: nextItems,
                  };
                }),
              );

              setSwapAnimation({
                startedTick: replaceAnimationTick,
                durationTicks: 12,
                transitions: {
                  [imageId]: {
                    from: { x: item.x, y: item.y },
                    to: { x: snappedX, y: snappedY },
                  },
                },
              });
            }
          }
        }
      }
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
    if (interactionMode === 'select') {
      setCanvasCursor('cursor-default');
    }
  }

  function onCanvasMouseLeave(): void {
    // Do not end an active drag — pointer capture on the mouse pointer keeps
    // delivering pointermove/pointerup even outside the canvas element, so
    // the drag will be ended cleanly by onCanvasPointerUp instead.
    if (mousePointerCapturedRef.current) {
      return;
    }
    handleCanvasInteractionEnd();
    setHoveredImageId(null);
    if (interactionMode === 'select') {
      setCanvasCursor('cursor-default');
    }
  }

  function onCanvasMouseDown(event: MouseEvent<HTMLCanvasElement>): void {
    // Skip if already handled by onCanvasPointerDown (which set pointer capture).
    if (mousePointerCapturedRef.current) {
      return;
    }
    handleCanvasInteractionStart(event.clientX, event.clientY);
  }

  function onCanvasDoubleClick(event: MouseEvent<HTMLCanvasElement>): void {
    if (interactionMode !== 'select') {
      return;
    }
    const point = pagePointFromMouse(event);
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

  function onCanvasMouseMove(event: MouseEvent<HTMLCanvasElement>): void {
    // Skip if pointer events are already tracking this mouse interaction.
    if (mousePointerCapturedRef.current) {
      return;
    }
    pendingInteractionMoveRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      shiftKey: event.shiftKey,
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

  function onCanvasMouseUp(event?: MouseEvent<HTMLCanvasElement>): void {
    if (interactionMoveFrameRef.current !== null) {
      window.cancelAnimationFrame(interactionMoveFrameRef.current);
      interactionMoveFrameRef.current = null;
      pendingInteractionMoveRef.current = null;
    }
    // Skip if the drag was already ended by onCanvasPointerUp (pointer capture path).
    if (dragStateRef.current) {
      handleCanvasInteractionEnd(event?.clientX, event?.clientY);
    }
  }

  function onCanvasPointerDown(event: PointerEvent<HTMLCanvasElement>): void {
    if (event.pointerType === 'mouse') {
      // Use pointer capture for mouse so that pointermove/pointerup keep firing
      // even when the cursor moves outside the canvas element during a drag.
      // Do NOT call preventDefault() here — that would suppress mousedown and
      // thereby also prevent dblclick (used for crop mode activation).
      event.currentTarget.setPointerCapture(event.pointerId);
      mousePointerCapturedRef.current = true;
      handleCanvasInteractionStart(event.clientX, event.clientY);
      return;
    }
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    handleCanvasInteractionStart(event.clientX, event.clientY);
  }

  function onCanvasPointerMove(event: PointerEvent<HTMLCanvasElement>): void {
    if (event.pointerType !== 'mouse') {
      event.preventDefault();
    }
    pendingInteractionMoveRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      shiftKey: event.shiftKey,
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

  function onCanvasPointerUp(event: PointerEvent<HTMLCanvasElement>): void {
    if (event.pointerType === 'mouse') {
      mousePointerCapturedRef.current = false;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (interactionMoveFrameRef.current !== null) {
      window.cancelAnimationFrame(interactionMoveFrameRef.current);
      interactionMoveFrameRef.current = null;
      pendingInteractionMoveRef.current = null;
    }
    handleCanvasInteractionEnd(event.clientX, event.clientY);
  }

  function onCanvasPointerCancel(event: PointerEvent<HTMLCanvasElement>): void {
    if (event.pointerType === 'mouse') {
      mousePointerCapturedRef.current = false;
    }
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (interactionMoveFrameRef.current !== null) {
      window.cancelAnimationFrame(interactionMoveFrameRef.current);
      interactionMoveFrameRef.current = null;
      pendingInteractionMoveRef.current = null;
    }
    handleCanvasInteractionEnd();
    setHoveredImageId(null);
  }

  function onCanvasDragOver(event: DragEvent<HTMLCanvasElement>): void {
    event.preventDefault();
    const imageId = manualPlacementDragImageId ?? event.dataTransfer.getData('application/x-collage-image-id');
    if (!imageId || !selectedPage) {
      setCanvasPlacementPreview(null);
      return;
    }

    const image = itemById.get(imageId);
    const point = pagePointFromClient(event.clientX, event.clientY);
    if (!image || !point) {
      setCanvasPlacementPreview(null);
      return;
    }

    const proposedSize = resolveManualPlacementSize(image);
    const existingItems = selectedPage.items.filter((item) => item.imageId !== imageId);
    const smartSize = computeSmartDropSize(
      image,
      proposedSize,
      point.x - proposedSize.width / 2,
      point.y - proposedSize.height / 2,
      selectedPage.widthPx,
      selectedPage.heightPx,
      existingItems,
      minImageCm,
    );

    const x = Math.max(0, Math.min(selectedPage.widthPx - smartSize.width, point.x - smartSize.width / 2));
    const y = Math.max(0, Math.min(selectedPage.heightPx - smartSize.height, point.y - smartSize.height / 2));

    setCanvasPlacementPreview({
      imageId,
      x,
      y,
      width: smartSize.width,
      height: smartSize.height,
      valid: true,
    });
  }

  function onCanvasDrop(event: DragEvent<HTMLCanvasElement>): void {
    event.preventDefault();
    const imageId = manualPlacementDragImageId ?? event.dataTransfer.getData('application/x-collage-image-id');
    const image = itemById.get(imageId);
    const point = pagePointFromClient(event.clientX, event.clientY);
    if (!image || !selectedPage || !point) {
      setCanvasPlacementPreview(null);
      return;
    }

    const proposedSize = resolveManualPlacementSize(image);
    
    // Compute smart size: fit to available space while respecting minimums
    const existingItems = selectedPage.items.filter((item) => item.imageId !== imageId);
    const smartSize = computeSmartDropSize(
      image,
      proposedSize,
      point.x - proposedSize.width / 2,
      point.y - proposedSize.height / 2,
      selectedPage.widthPx,
      selectedPage.heightPx,
      existingItems,
      minImageCm,
    );

    // Position the image (centering on drop point, clamped to canvas bounds)
    const x = Math.max(0, Math.min(selectedPage.widthPx - smartSize.width, point.x - smartSize.width / 2));
    const y = Math.max(0, Math.min(selectedPage.heightPx - smartSize.height, point.y - smartSize.height / 2));

    setPages((currentPages) =>
      currentPages.map((page, pageIndex) => {
        const withoutImage = page.items.filter((item) => item.imageId !== imageId);
        if (pageIndex !== selectedPageIndex) {
          return {
            ...page,
            items: withoutImage,
          };
        }

        return {
          ...page,
          items: [
            ...withoutImage,
            {
              imageId,
              x,
              y,
              width: smartSize.width,
              height: smartSize.height,
              contentWidthPx: smartSize.contentWidthPx,
              contentHeightPx: smartSize.contentHeightPx,
              frameThicknessPx: smartSize.frameThicknessPx,
              drawnImageWidthPx: smartSize.drawnImageWidthPx,
              drawnImageHeightPx: smartSize.drawnImageHeightPx,
              maxOffsetX: smartSize.maxOffsetX,
              maxOffsetY: smartSize.maxOffsetY,
            },
          ],
        };
      }),
    );

    const clamped = clampOffsets(image.offsetX, image.offsetY, smartSize.maxOffsetX, smartSize.maxOffsetY);
    setImages((current) =>
      current.map((entry) =>
        entry.id === imageId
          ? {
              ...entry,
              renderWidthPx: smartSize.contentWidthPx,
              renderHeightPx: smartSize.contentHeightPx,
              cropMaxOffsetX: smartSize.maxOffsetX,
              cropMaxOffsetY: smartSize.maxOffsetY,
              offsetX: clamped.offsetX,
              offsetY: clamped.offsetY,
            }
          : entry,
      ),
    );

    setSelectedImageId(imageId);
    setHoveredImageId(imageId);
    setError('');
    setManualPlacementDragImageId(null);
    setCanvasPlacementPreview(null);
    setNotice({
      tone: 'success',
      text: `${image.fileName} added to the active page. Use Edit mode to move or resize it.`,
    });
  }

  function onCanvasDragLeave(): void {
    setCanvasPlacementPreview(null);
  }

  function onBeginManualPlacementDrag(imageId: string): void {
    setManualPlacementDragImageId(imageId);
  }

  function onEndManualPlacementDrag(): void {
    setManualPlacementDragImageId(null);
    setCanvasPlacementPreview(null);
  }

  function placeImageOnSelectedPage(imageId: string, replaceSelected = false): void {
    const image = itemById.get(imageId);
    if (!image || !selectedPage) {
      return;
    }

    const proposedSize = resolveManualPlacementSize(image);
    const replaceTargetIndex =
      replaceSelected && selectedImageId
        ? selectedPage.items.findIndex((item) => item.imageId === selectedImageId)
        : -1;
    const replaceTarget = replaceTargetIndex >= 0 ? selectedPage.items[replaceTargetIndex] : null;

    const centerX = replaceTarget ? replaceTarget.x + replaceTarget.width / 2 : selectedPage.widthPx / 2;
    const centerY = replaceTarget ? replaceTarget.y + replaceTarget.height / 2 : selectedPage.heightPx / 2;
    const existingItems = selectedPage.items
      .filter((item) => item.imageId !== imageId)
      .filter((item) => item.imageId !== replaceTarget?.imageId);

    const smartSize = computeSmartDropSize(
      image,
      proposedSize,
      centerX - proposedSize.width / 2,
      centerY - proposedSize.height / 2,
      selectedPage.widthPx,
      selectedPage.heightPx,
      existingItems,
      minImageCm,
    );

    const x = Math.max(0, Math.min(selectedPage.widthPx - smartSize.width, centerX - smartSize.width / 2));
    const y = Math.max(0, Math.min(selectedPage.heightPx - smartSize.height, centerY - smartSize.height / 2));

    setPages((currentPages) =>
      currentPages.map((page, pageIndex) => {
        const withoutImage = page.items.filter((item) => item.imageId !== imageId);
        if (pageIndex !== selectedPageIndex) {
          return {
            ...page,
            items: replaceSelected
              ? withoutImage.filter((item) => item.imageId !== replaceTarget?.imageId)
              : withoutImage,
          };
        }

        const nextItems = withoutImage.filter((item) => item.imageId !== replaceTarget?.imageId);
        nextItems.push({
          imageId,
          x,
          y,
          width: smartSize.width,
          height: smartSize.height,
          contentWidthPx: smartSize.contentWidthPx,
          contentHeightPx: smartSize.contentHeightPx,
          frameThicknessPx: smartSize.frameThicknessPx,
          drawnImageWidthPx: smartSize.drawnImageWidthPx,
          drawnImageHeightPx: smartSize.drawnImageHeightPx,
          maxOffsetX: smartSize.maxOffsetX,
          maxOffsetY: smartSize.maxOffsetY,
        });

        return {
          ...page,
          items: nextItems,
        };
      }),
    );

    const clamped = clampOffsets(image.offsetX, image.offsetY, smartSize.maxOffsetX, smartSize.maxOffsetY);
    setImages((current) =>
      current.map((entry) =>
        entry.id === imageId
          ? {
              ...entry,
              renderWidthPx: smartSize.contentWidthPx,
              renderHeightPx: smartSize.contentHeightPx,
              cropMaxOffsetX: smartSize.maxOffsetX,
              cropMaxOffsetY: smartSize.maxOffsetY,
              offsetX: clamped.offsetX,
              offsetY: clamped.offsetY,
            }
          : entry,
      ),
    );

    setSelectedImageId(imageId);
    setDrawerSelectedImageId(imageId);
    setHoveredImageId(imageId);
    setShowSelectionControls(true);
    setError('');
    setNotice({
      tone: 'success',
      text: replaceSelected
        ? `${image.fileName} replaced the active photo on the current page.`
        : `${image.fileName} added to the current page.`,
    });
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
    if (!currentPlacement) {
      return;
    }

    const pxPerCm = cmToPx(1);
    const currentWidthCm = currentPlacement.width / pxPerCm;
    const currentHeightCm = currentPlacement.height / pxPerCm;
    const requestedMaxWidthCm = currentWidthCm * scaleFactor;
    const requestedMaxHeightCm = currentHeightCm * scaleFactor;
    const canvasWidthCm = currentPlacement && selectedPage ? selectedPage.widthPx / pxPerCm : currentImage.maxWidthCm;
    const canvasHeightCm = currentPlacement && selectedPage ? selectedPage.heightPx / pxPerCm : currentImage.maxHeightCm;
    const nextMaxWidthCm = Math.max(minImageCm, Math.min(canvasWidthCm, requestedMaxWidthCm));
    const nextMaxHeightCm = Math.max(minImageCm, Math.min(canvasHeightCm, requestedMaxHeightCm));

    const nextImages = images.map((image) => (image.id === selectedImageId ? {
      ...image,
      maxWidthCm: Number(nextMaxWidthCm.toFixed(2)),
      maxHeightCm: Number(nextMaxHeightCm.toFixed(2)),
    } : image));

    regenerateLayout(resolveMaxPages(), true, nextImages);
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
          const canvas = renderPageToExportCanvas(page, itemById, imageById, {
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
    setCanvasPlacementPreview(null);
    setManualPlacementDragImageId(null);
    dragStateRef.current = null;
    setMoveOutsideCanvas(false);
    setMoveCollisionImageIds([]);
    setInteractionModeState('select');
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
      setBatchEnhanceProgress((current) =>
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

  return {
    images,
    pages,
    itemById,
    imageById,
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
    dragActive,
    moveOutsideCanvas,
    hasPlacedItems,
    hasUnplacedImages,
    selectedPageIndex,
    setSelectedPageIndex,
    overflowImageIds,
    oversizedImageIds,
    resizeLimitNotice,
    resizeCurrentDimensions,
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
    previewCanvasRef,
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
    onCanvasMouseDown,
    onCanvasMouseMove,
    onCanvasMouseUp,
    onCanvasMouseLeave,
    onCanvasDoubleClick,
    onCanvasPointerDown,
    onCanvasPointerMove,
    onCanvasPointerUp,
    onCanvasPointerCancel,
    onCanvasDragOver,
    onCanvasDrop,
    onCanvasDragLeave,
    onBeginManualPlacementDrag,
    onEndManualPlacementDrag,
    placeImageOnSelectedPage,
    expandSelectedImage,
    resetSelectedCrop,
    setShowSelectionControls,
    canvasCursor,
  };
}
