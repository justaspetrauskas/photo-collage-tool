import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { getHandleFixedEdges, getZoomPanBounds } from '../../interactions';
import type { HandleType } from '../../interactions';
import type { ImageItem, PageLayout, PositionedImage } from '../../model/types';
import type { ResizeSnapGuide } from '../../model/types';
import type { DragState } from '../../../../shared/drag/types';

interface ResizeFeedbackLike {
  baseRect: { x: number; y: number; width: number; height: number };
  currentRect: { x: number; y: number; width: number; height: number };
  intent: 'expand' | 'shrink' | 'steady';
}

interface UseCollageInteractionStartParams {
  dragActive: boolean;
  interactionMode: 'crop' | 'resize' | 'replace' | 'move' | 'select';
  selectedPage: PageLayout | null;
  selectedImageId: string | null;
  itemById: Map<string, ImageItem>;
  imageZoomLevels: Record<string, number>;
  imagePanOffsets: Record<string, { x: number; y: number }>;
  pagePointFromClient: (clientX: number, clientY: number) => { x: number; y: number } | null;
  findCornerHandleTarget: (pagePoint: { x: number; y: number }) => { item: PositionedImage; handle: HandleType | null } | null;
  findHitItem: (pagePoint: { x: number; y: number }) => PositionedImage | null;
  clearSelection: () => void;
  dragStateRef: MutableRefObject<DragState | null>;
  setSelectedImageId: Dispatch<SetStateAction<string | null>>;
  setDrawerSelectedImageId: Dispatch<SetStateAction<string | null>>;
  setHoveredImageId: Dispatch<SetStateAction<string | null>>;
  setShowSelectionControls: Dispatch<SetStateAction<boolean>>;
  setHoveredResizeHandle: Dispatch<SetStateAction<HandleType | null>>;
  setDragActive: Dispatch<SetStateAction<boolean>>;
  setResizeFeedback: Dispatch<SetStateAction<ResizeFeedbackLike | null>>;
  setResizeSnapGuides: Dispatch<SetStateAction<ResizeSnapGuide[]>>;
  setResizeSnapActive: Dispatch<SetStateAction<boolean>>;
  setMoveOutsideCanvas: Dispatch<SetStateAction<boolean>>;
  setMoveCollisionImageIds: Dispatch<SetStateAction<string[]>>;
  setReplacePointer: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
}

export function useCollageInteractionStart({
  dragActive,
  interactionMode,
  selectedPage,
  selectedImageId,
  itemById,
  imageZoomLevels,
  imagePanOffsets,
  pagePointFromClient,
  findCornerHandleTarget,
  findHitItem,
  clearSelection,
  dragStateRef,
  setSelectedImageId,
  setDrawerSelectedImageId,
  setHoveredImageId,
  setShowSelectionControls,
  setHoveredResizeHandle,
  setDragActive,
  setResizeFeedback,
  setResizeSnapGuides,
  setResizeSnapActive,
  setMoveOutsideCanvas,
  setMoveCollisionImageIds,
  setReplacePointer,
}: UseCollageInteractionStartParams) {
  function handleCanvasInteractionStart(clientX: number, clientY: number): void {
    if (dragActive) {
      return;
    }

    const point = pagePointFromClient(clientX, clientY);
    if (!point) {
      clearSelection();
      return;
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

    if (interactionMode === 'select') {
      if (interactionResizeHandle) {
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
      }

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
    }
  }

  return {
    handleCanvasInteractionStart,
  };
}
