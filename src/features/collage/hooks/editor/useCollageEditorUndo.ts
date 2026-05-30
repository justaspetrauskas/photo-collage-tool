import type { Dispatch, SetStateAction } from 'react';
import type { CanvasSizePresetId, LayoutPresetId } from '../../model/constants';
import type { ImageItem, PageLayout } from '../../model/types';
import type { EditorUndoSnapshot, NoticeMessage, SessionMetrics, UndoAction } from './useCollageEditor';

interface UseCollageEditorUndoParams {
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
  setImages: Dispatch<SetStateAction<ImageItem[]>>;
  setPages: Dispatch<SetStateAction<PageLayout[]>>;
  setMaxImageCm: Dispatch<SetStateAction<number>>;
  setMinImageCm: Dispatch<SetStateAction<number>>;
  setFrameMm: Dispatch<SetStateAction<number>>;
  setGridModeEnabled: Dispatch<SetStateAction<boolean>>;
  setAutoCompactPages: Dispatch<SetStateAction<boolean>>;
  setPaginationMode: Dispatch<SetStateAction<'auto' | 'assisted'>>;
  setInteractionModeState: Dispatch<SetStateAction<'crop' | 'resize' | 'replace' | 'move' | 'select'>>;
  setSelectedImageId: Dispatch<SetStateAction<string | null>>;
  setHoveredImageId: Dispatch<SetStateAction<string | null>>;
  setAssistedPageCount: Dispatch<SetStateAction<number>>;
  setSelectedPageIndex: Dispatch<SetStateAction<number>>;
  setOverflowImageIds: Dispatch<SetStateAction<string[]>>;
  setOversizedImageIds: Dispatch<SetStateAction<string[]>>;
  setResizeLimitNotice: Dispatch<SetStateAction<string>>;
  setShowSelectionControls: Dispatch<SetStateAction<boolean>>;
  setCanvasPresetId: Dispatch<SetStateAction<CanvasSizePresetId>>;
  setCustomCanvasWidthCm: Dispatch<SetStateAction<number>>;
  setCustomCanvasHeightCm: Dispatch<SetStateAction<number>>;
  setLayoutPresetId: Dispatch<SetStateAction<LayoutPresetId>>;
  setDrawerSelectedImageId: Dispatch<SetStateAction<string | null>>;
  setImageZoomLevels: Dispatch<SetStateAction<Record<string, number>>>;
  setImagePanOffsets: Dispatch<SetStateAction<Record<string, { x: number; y: number }>>>;
  setNotice: Dispatch<SetStateAction<NoticeMessage | null>>;
  setUndoAction: Dispatch<SetStateAction<UndoAction | null>>;
  updateSessionMetrics: (updater: (metrics: SessionMetrics) => SessionMetrics) => void;
}

export function useCollageEditorUndo({
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
  setImages,
  setPages,
  setMaxImageCm,
  setMinImageCm,
  setFrameMm,
  setGridModeEnabled,
  setAutoCompactPages,
  setPaginationMode,
  setInteractionModeState,
  setSelectedImageId,
  setHoveredImageId,
  setAssistedPageCount,
  setSelectedPageIndex,
  setOverflowImageIds,
  setOversizedImageIds,
  setResizeLimitNotice,
  setShowSelectionControls,
  setCanvasPresetId,
  setCustomCanvasWidthCm,
  setCustomCanvasHeightCm,
  setLayoutPresetId,
  setDrawerSelectedImageId,
  setImageZoomLevels,
  setImagePanOffsets,
  setNotice,
  setUndoAction,
  updateSessionMetrics,
}: UseCollageEditorUndoParams) {
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

  function queueUndoAction(label: string, description: string, snapshot: EditorUndoSnapshot): void {
    setUndoAction({
      label,
      description,
      restore: () => restoreEditorUndoSnapshot(snapshot),
    });
  }

  function undoLastAction(undoAction: UndoAction | null): void {
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

  return {
    restoreEditorUndoSnapshot,
    captureEditorUndoSnapshot,
    queueUndoAction,
    undoLastAction,
    registerDestructiveConfirmation,
  };
}