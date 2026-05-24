import type { MutableRefObject } from 'react';
import { getCursorForHandle } from '../../interactions';
import type { HandleType } from '../../interactions';
import type { DragState } from '../../../../shared/drag/types';
import { isMoveDrag } from '../../../../shared/drag/types';

interface UseCollagePreviewInteractionsParams {
  interactionMode: 'crop' | 'resize' | 'replace' | 'move' | 'select';
  hoveredResizeHandle: HandleType | null;
  dragActive: boolean;
  hoveredImageId: string | null;
  dragStateRef: MutableRefObject<DragState | null>;
  interactionMoveFrameRef: MutableRefObject<number | null>;
  pendingInteractionMoveRef: MutableRefObject<{ clientX: number; clientY: number; shiftKey: boolean } | null>;
  handleCanvasInteractionStart: (clientX: number, clientY: number) => void;
  handleCanvasInteractionMove: (clientX: number, clientY: number, modifiers?: { shiftKey: boolean }) => void;
  handleCanvasInteractionEnd: (clientX?: number, clientY?: number) => void;
}

export function useCollagePreviewInteractions({
  interactionMode,
  hoveredResizeHandle,
  dragActive,
  hoveredImageId,
  dragStateRef,
  interactionMoveFrameRef,
  pendingInteractionMoveRef,
  handleCanvasInteractionStart,
  handleCanvasInteractionMove,
  handleCanvasInteractionEnd,
}: UseCollagePreviewInteractionsParams) {
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

  function onPreviewMouseLeave(): void {
    handleCanvasInteractionEnd();
  }

  function onPreviewMouseDown(clientX: number, clientY: number): void {
    handleCanvasInteractionStart(clientX, clientY);
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

  return {
    canvasCursor: resolveCanvasCursor(),
    onPreviewMouseLeave,
    onPreviewMouseDown,
    onPreviewMouseMove,
    onPreviewMouseUp,
  };
}
