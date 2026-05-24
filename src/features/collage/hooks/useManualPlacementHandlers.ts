import type { Dispatch, DragEvent, SetStateAction } from 'react';
import { computeSmartDropSize } from '../lib/editorLayoutUtils';
import { clampOffsets } from '../model/layoutEngine';
import type { ImageItem, PageLayout, PositionedImage } from '../model/types';
import type { CanvasPlacementPreview, NoticeMessage } from './useCollageEditor';

export function useManualPlacementHandlers(params: {
  itemById: Map<string, ImageItem>;
  selectedPage: PageLayout | null;
  selectedPageIndex: number;
  selectedImageId: string | null;
  manualPlacementDragImageId: string | null;
  minImageCm: number;
  pagePointFromClient: (clientX: number, clientY: number, options?: { allowOutsideCanvas?: boolean }) => { x: number; y: number } | null;
  resolveManualPlacementSize: (image: ImageItem) => {
    width: number;
    height: number;
    contentWidthPx: number;
    contentHeightPx: number;
    frameThicknessPx: number;
    drawnImageWidthPx: number;
    drawnImageHeightPx: number;
    maxOffsetX: number;
    maxOffsetY: number;
  };
  setPages: Dispatch<SetStateAction<PageLayout[]>>;
  setImages: Dispatch<SetStateAction<ImageItem[]>>;
  setSelectedImageId: Dispatch<SetStateAction<string | null>>;
  setDrawerSelectedImageId: Dispatch<SetStateAction<string | null>>;
  setHoveredImageId: Dispatch<SetStateAction<string | null>>;
  setShowSelectionControls: Dispatch<SetStateAction<boolean>>;
  setError: Dispatch<SetStateAction<string>>;
  setManualPlacementDragImageId: Dispatch<SetStateAction<string | null>>;
  setCanvasPlacementPreview: Dispatch<SetStateAction<CanvasPlacementPreview | null>>;
  setNotice: Dispatch<SetStateAction<NoticeMessage | null>>;
}) {
  const {
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
  } = params;

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
            items: withoutImage,
          };
        }

        const nextItems: PositionedImage[] = withoutImage.filter((item) => item.imageId !== replaceTarget?.imageId);
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

  return {
    onCanvasDragOver,
    onCanvasDrop,
    onCanvasDragLeave,
    onBeginManualPlacementDrag,
    onEndManualPlacementDrag,
    placeImageOnSelectedPage,
  };
}
