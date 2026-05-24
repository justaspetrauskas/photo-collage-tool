import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import {
  calculateCropOffsets,
  calculateNewPosition,
  calculateZoomPanOffset,
  canSwapImages,
  getCanvasSnapPosition,
  getPreferredPushAxis,
  isPositionOutsideCanvas,
  resolvePushLayout,
} from '../../interactions';
import type { ImageItem, PageLayout, PositionedImage } from '../../model/types';
import { cmToPx } from '../../model/constants';
import { clampOffsets } from '../../model/layoutEngine';
import { computeContentBox, computeCropMetrics } from '../../../../shared/math/sizing';
import type { DragState } from '../../../../shared/drag/types';
import { isCropDrag, isMoveDrag, isPanDrag, isReplaceDrag, isResizeDrag } from '../../../../shared/drag/types';
import { rectanglesTouchOrOverlap } from '../collageEditorUtils';
import type { HandleType } from '../../interactions';
import type { ResizeFeedback } from './useCollageEditor';
import type { ResizeSnapGuide } from '../../model/types';

interface UseCollageInteractionMoveParams {
  interactionMode: 'crop' | 'resize' | 'replace' | 'move' | 'select';
  dragStateRef: MutableRefObject<DragState | null>;
  dragActive: boolean;
  hoveredImageId: string | null;
  hoveredResizeHandle: HandleType | null;
  selectedPage: PageLayout | null;
  pages: PageLayout[];
  itemById: Map<string, ImageItem>;
  placementByImageId: Map<string, { pageIndex: number; itemIndex: number; item: PositionedImage }>;
  pagePointFromClient: (clientX: number, clientY: number, options?: { allowOutsideCanvas?: boolean }) => { x: number; y: number } | null;
  findCornerHandleTarget: (pagePoint: { x: number; y: number }) => { item: PositionedImage; handle: HandleType | null } | null;
  findHitItem: (pagePoint: { x: number; y: number }) => PositionedImage | null;
  findClosestSwapTarget: (pagePoint: { x: number; y: number }, sourceImageId: string) => PositionedImage | null;
  updateImage: (id: string, patch: Partial<ImageItem>) => void;
  setImagePan: (imageId: string, x: number, y: number) => void;
  setHoveredImageId: Dispatch<SetStateAction<string | null>>;
  setHoveredResizeHandle: Dispatch<SetStateAction<HandleType | null>>;
  setReplacePointer: Dispatch<SetStateAction<{ x: number; y: number } | null>>;
  setSwapTargetInvalid: Dispatch<SetStateAction<boolean>>;
  setMoveOutsideCanvas: Dispatch<SetStateAction<boolean>>;
  setMoveCollisionImageIds: Dispatch<SetStateAction<string[]>>;
  setPages: Dispatch<SetStateAction<PageLayout[]>>;
  setImages: Dispatch<SetStateAction<ImageItem[]>>;
  setResizeCurrentDimensions: Dispatch<SetStateAction<{ width: number; height: number } | null>>;
  setResizeFeedback: Dispatch<SetStateAction<ResizeFeedback | null>>;
  setResizeSnapGuides: Dispatch<SetStateAction<ResizeSnapGuide[]>>;
  setResizeSnapActive: Dispatch<SetStateAction<boolean>>;
  setResizeLimitNotice: Dispatch<SetStateAction<string>>;
  minImageCm: number;
}

export function useCollageInteractionMove({
  interactionMode,
  dragStateRef,
  dragActive,
  hoveredImageId,
  hoveredResizeHandle,
  selectedPage,
  pages,
  itemById,
  placementByImageId,
  pagePointFromClient,
  findCornerHandleTarget,
  findHitItem,
  findClosestSwapTarget,
  updateImage,
  setImagePan,
  setHoveredImageId,
  setHoveredResizeHandle,
  setReplacePointer,
  setSwapTargetInvalid,
  setMoveOutsideCanvas,
  setMoveCollisionImageIds,
  setPages,
  setImages,
  setResizeCurrentDimensions,
  setResizeFeedback,
  setResizeSnapGuides,
  setResizeSnapActive,
  setResizeLimitNotice,
  minImageCm,
}: UseCollageInteractionMoveParams) {
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
      return;
    }

    const hit = findHitItem(point);
    if (!dragActive) {
      const handleTarget = interactionMode === 'select' ? findCornerHandleTarget(point) : null;
      const hoverResizeHandle = handleTarget?.handle ?? null;
      const hoverResizeImageId = handleTarget?.item.imageId ?? null;

      setHoveredResizeHandle(hoverResizeHandle);
      setHoveredImageId(hoverResizeImageId ?? (hit?.imageId ?? null));
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
      const target = point ? findClosestSwapTarget(point, drag.sourceImageId) : null;
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
      const assist = {
        snapped: false,
        deltaCm: dominantDeltaCm,
        guides: [] as ResizeSnapGuide[],
      };
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

  return {
    handleCanvasInteractionMove,
  };
}
