import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import { isMoveDrag, isReplaceDrag } from '../../../../shared/drag/types';
import type { DragState } from '../../../../shared/drag/types';
import type { HandleType } from '../../interactions';
import type { ResizeSnapGuide } from '../../model/types';
import type { ResizeFeedback } from './useCollageEditor';

interface NoticeLike {
  tone: 'info' | 'success' | 'error';
  text: string;
}

interface ReplaceTargetLike {
  imageId: string;
}

interface UseCollageInteractionEndParams {
  interactionMode: 'crop' | 'resize' | 'replace' | 'move' | 'select';
  dragStateRef: MutableRefObject<DragState | null>;
  hoveredImageId: string | null;
  moveOutsideCanvas: boolean;
  pagePointFromClient: (clientX: number, clientY: number) => { x: number; y: number } | null;
  findClosestSwapTarget: (point: { x: number; y: number }, sourceImageId: string) => ReplaceTargetLike | null;
  swapImagesOnSelectedPage: (sourceImageId: string, targetImageId: string) => void;
  setInteractionModeState: (mode: 'crop' | 'resize' | 'replace' | 'move' | 'select') => void;
  setNotice: (notice: NoticeLike | null) => void;
  removeFromCanvas: (imageId: string) => void;
  setDragActive: (active: boolean) => void;
  setReplacePointer: (point: { x: number; y: number } | null) => void;
  setSwapTargetInvalid: (invalid: boolean) => void;
  setMoveOutsideCanvas: (outside: boolean) => void;
  setMoveCollisionImageIds: (ids: string[]) => void;
  setResizeCurrentDimensions: (dimensions: { width: number; height: number } | null) => void;
  setResizeFeedback: Dispatch<SetStateAction<ResizeFeedback | null>>;
  setResizeSnapGuides: Dispatch<SetStateAction<ResizeSnapGuide[]>>;
  setResizeSnapActive: (active: boolean) => void;
  setHoveredResizeHandle: Dispatch<SetStateAction<HandleType | null>>;
}

export function useCollageInteractionEnd({
  interactionMode,
  dragStateRef,
  hoveredImageId,
  moveOutsideCanvas,
  pagePointFromClient,
  findClosestSwapTarget,
  swapImagesOnSelectedPage,
  setInteractionModeState,
  setNotice,
  removeFromCanvas,
  setDragActive,
  setReplacePointer,
  setSwapTargetInvalid,
  setMoveOutsideCanvas,
  setMoveCollisionImageIds,
  setResizeCurrentDimensions,
  setResizeFeedback,
  setResizeSnapGuides,
  setResizeSnapActive,
  setHoveredResizeHandle,
}: UseCollageInteractionEndParams) {
  function handleCanvasInteractionEnd(clientX?: number, clientY?: number): void {
    if (
      interactionMode === 'replace' &&
      isReplaceDrag(dragStateRef.current) &&
      typeof clientX === 'number' &&
      typeof clientY === 'number'
    ) {
      const point = pagePointFromClient(clientX, clientY);
      const target = point ? findClosestSwapTarget(point, dragStateRef.current.sourceImageId) : null;

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
      removeFromCanvas(dragStateRef.current.imageId);
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
  }

  return {
    handleCanvasInteractionEnd,
  };
}
