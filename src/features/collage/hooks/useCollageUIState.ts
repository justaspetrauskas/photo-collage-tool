import { useState, useRef } from 'react';
import type { NoticeMessage, UndoAction, BatchEnhanceProgress, SessionMetrics, EditorUndoSnapshot, ResizeFeedback, SwapAnimation, CanvasPlacementPreview } from './useCollageEditor';
import type { HandleType } from '../interactions';
import type { ResizeSnapGuide } from '../model/types';

export function useCollageUIState() {
    const [drawerSelectedImageId, setDrawerSelectedImageId] = useState<string | null>(null);
    const [imageZoomLevels, setImageZoomLevels] = useState<Record<string, number>>({});
    const [imagePanOffsets, setImagePanOffsets] = useState<Record<string, { x: number; y: number }>>({});
  const [dragActive, setDragActive] = useState(false);
  const [resizeLimitNotice, setResizeLimitNotice] = useState('');
  const [error, setError] = useState('');
  const [isHydrated, setIsHydrated] = useState(false);
  const [replaceAnimationTick, setReplaceAnimationTick] = useState(0);
  const [swapAnimation, setSwapAnimation] = useState<SwapAnimation | null>(null);
  const [replacePointer, setReplacePointer] = useState<{ x: number; y: number } | null>(null);
  const [swapTargetInvalid, setSwapTargetInvalid] = useState(false);
  const [moveOutsideCanvas, setMoveOutsideCanvas] = useState(false);
  const [moveCollisionImageIds, setMoveCollisionImageIds] = useState<string[]>([]);
  const [resizeCurrentDimensions, setResizeCurrentDimensions] = useState<{ width: number; height: number } | null>(null);
  const [resizeFeedback, setResizeFeedback] = useState<ResizeFeedback | null>(null);
  const [resizeSnapGuides, setResizeSnapGuides] = useState<ResizeSnapGuide[]>([]);
  const [resizeSnapActive, setResizeSnapActive] = useState(false);
  const [hoveredResizeHandle, setHoveredResizeHandle] = useState<HandleType | null>(null);
  const [enhancingImageIds, setEnhancingImageIds] = useState<Set<string>>(new Set());
  const [canvasPlacementPreview, setCanvasPlacementPreview] = useState<CanvasPlacementPreview | null>(null);
  const [manualPlacementDragImageId, setManualPlacementDragImageId] = useState<string | null>(null);
  const [showSelectionControls, setShowSelectionControls] = useState(false);
  const [notice, setNotice] = useState<NoticeMessage | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [restoredFromSnapshot, setRestoredFromSnapshot] = useState(false);
  const [undoAction, setUndoAction] = useState<UndoAction | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [lastExportSummary, setLastExportSummary] = useState('');
  const [batchEnhanceProgress, setBatchEnhanceProgress] = useState<BatchEnhanceProgress | null>(null);
  const [sessionMetrics, setSessionMetrics] = useState<SessionMetrics>({
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

  // Animation and pointer refs
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previewTransformRef = useRef<import('../model/types').PreviewTransform | null>(null);
  const previewRenderFrameRef = useRef<number | null>(null);
  const interactionMoveFrameRef = useRef<number | null>(null);
  const pendingInteractionMoveRef = useRef<{ clientX: number; clientY: number; shiftKey: boolean } | null>(null);
  const dragStateRef = useRef<import('../../../shared/drag/types').DragState | null>(null);
  const mousePointerCapturedRef = useRef<boolean>(false);
  const knownImageSrcsRef = useRef<Set<string>>(new Set());

  return {
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
    drawerSelectedImageId, setDrawerSelectedImageId,
    imageZoomLevels, setImageZoomLevels,
    imagePanOffsets, setImagePanOffsets,
    previewCanvasRef,
    previewTransformRef,
    previewRenderFrameRef,
    interactionMoveFrameRef,
    pendingInteractionMoveRef,
    dragStateRef,
    mousePointerCapturedRef,
    knownImageSrcsRef,
  };
}
