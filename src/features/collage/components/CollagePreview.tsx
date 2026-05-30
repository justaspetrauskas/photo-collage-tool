import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import { Stage, Layer, Group, Rect, Line, Text, Image as KonvaImage } from 'react-konva';
import type {
  DragEventHandler,
  MutableRefObject,
} from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Panel } from '../../../shared/ui/Panel';
import { CANVAS_CM, CANVAS_SIZE_PX, cmToPx, EDITOR_LENGTH_UNIT, formatSizeFromPx } from '../model/constants';
import { clampOffsets } from '../model/layoutEngine';
import type { ImageItem, InteractionMode, PageLayout, ResizeSnapGuide } from '../model/types';
import { getSelectHandlePositions, getZoomPanBounds, resolveZoomPanOffset } from '../interactions';
import { konvaNodeIds } from '../lib/konvaNodeIds';
import { UploadCloud } from 'lucide-react';
import { resolveEditorShortcut } from '../hooks/editor/keyboardShortcuts';

const MAX_IMAGES = 24;

interface ResizeFeedback {
  baseRect: { x: number; y: number; width: number; height: number };
  currentRect: { x: number; y: number; width: number; height: number };
  intent: 'expand' | 'shrink' | 'steady';
}

interface CanvasPlacementPreview {
  imageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  valid: boolean;
}

interface CollagePreviewProps {
  pages: PageLayout[];
  itemById: Map<string, ImageItem>;
  imageById: Map<string, HTMLImageElement>;
  imageZoomLevels: Record<string, number>;
  imagePanOffsets: Record<string, { x: number; y: number }>;
  selectedImageId: string | null;
  hoveredImageId: string | null;
  drawerSelectedImageId: string | null;
  selectedImageName: string | null;
  showSelectionControls: boolean;
  onCloseSelectionControls: () => void;
  resizeLimitNotice: string;
  interactionMode: InteractionMode;
  dragActive: boolean;
  moveOutsideCanvas: boolean;
  moveCollisionImageIds: string[];
  resizeCurrentDimensions: { width: number; height: number } | null;
  resizeFeedback: ResizeFeedback | null;
  resizeSnapGuides: ResizeSnapGuide[];
  resizeSnapActive: boolean;
  replaceAnimationTick: number;
  replacePointer: { x: number; y: number } | null;
  swapTargetInvalid: boolean;
  canvasPlacementPreview: CanvasPlacementPreview | null;
  onSetInteractionMode: (mode: InteractionMode) => void;
  onExpandSelectedImage: (factor: number) => void;
  onResetSelectedCrop: () => void;
  selectedPageIndex: number;
  onSelectPage: (index: number) => void;
  previewViewportRef: MutableRefObject<HTMLElement | null>;
  onPreviewMouseDown: (clientX: number, clientY: number) => void;
  onPreviewMouseMove: (clientX: number, clientY: number, shiftKey: boolean) => void;
  onPreviewMouseUp: (clientX?: number, clientY?: number) => void;
  onPreviewMouseLeave: () => void;
  onPreviewDoubleClick: (clientX: number, clientY: number) => void;
  onDragOver: DragEventHandler<HTMLElement>;
  onDrop: DragEventHandler<HTMLElement>;
  onDragLeave: DragEventHandler<HTMLElement>;
  onUploadFileList: (files: File[]) => Promise<void>;
  hasUnplacedImages: boolean;
  onGenerateLayout: () => void;
  imagesCount: number;
  canvasCursor?: string;
}

interface PageCanvasCardProps {
  index: number;
  page: PageLayout;
  scrollRoot: Element | null;
  isActive: boolean;
  onVisible: (index: number) => void;
  onJumpToPage: (index: number) => void;
  registerContainerRef: (index: number, node: HTMLElement | null) => void;
  registerViewportRef: (index: number, node: HTMLElement | null) => void;
  previewLogicalSize: number;
  itemById: Map<string, ImageItem>;
  imageById: Map<string, HTMLImageElement>;
  imageZoomLevels: Record<string, number>;
  imagePanOffsets: Record<string, { x: number; y: number }>;
  selectedImageId: string | null;
  hoveredImageId: string | null;
  drawerSelectedImageId: string | null;
  interactionMode: InteractionMode;
  dragActive: boolean;
  moveOutsideCanvas: boolean;
  moveCollisionImageIds: string[];
  resizeCurrentDimensions: { width: number; height: number } | null;
  resizeFeedback: ResizeFeedback | null;
  resizeSnapGuides: ResizeSnapGuide[];
  resizeSnapActive: boolean;
  replaceAnimationTick: number;
  replacePointer: { x: number; y: number } | null;
  swapTargetInvalid: boolean;
  canvasPlacementPreview: CanvasPlacementPreview | null;
  onPreviewMouseDown: (clientX: number, clientY: number) => void;
  onPreviewMouseMove: (clientX: number, clientY: number, shiftKey: boolean) => void;
  onPreviewMouseUp: (clientX?: number, clientY?: number) => void;
  onPreviewMouseLeave: () => void;
  onPreviewDoubleClick: (clientX: number, clientY: number) => void;
  onDragOver: DragEventHandler<HTMLElement>;
  onDrop: DragEventHandler<HTMLElement>;
  onDragLeave: DragEventHandler<HTMLElement>;
  showPlacementHints: boolean;
  canvasCursor?: string;
}

function PageCanvasCard({
  index,
  page,
  scrollRoot,
  isActive,
  onVisible,
  onJumpToPage,
  registerContainerRef,
  registerViewportRef,
  previewLogicalSize,
  itemById,
  imageById,
  imageZoomLevels,
  imagePanOffsets,
  selectedImageId,
  hoveredImageId,
  drawerSelectedImageId,
  interactionMode,
  dragActive,
  moveOutsideCanvas,
  moveCollisionImageIds,
  resizeCurrentDimensions,
  resizeFeedback,
  resizeSnapGuides,
  resizeSnapActive,
  replaceAnimationTick,
  replacePointer,
  swapTargetInvalid,
  canvasPlacementPreview,
  onPreviewMouseDown,
  onPreviewMouseMove,
  onPreviewMouseUp,
  onPreviewMouseLeave,
  onPreviewDoubleClick,
  onDragOver,
  onDrop,
  onDragLeave,
  showPlacementHints,
  canvasCursor,
}: PageCanvasCardProps) {
  const stageWidth = Math.max(1, previewLogicalSize);
  const stageHeight = Math.max(1, previewLogicalSize);
  const marginPx = 28;
  const availableWidth = stageWidth - marginPx * 2;
  const availableHeight = stageHeight - marginPx * 2;
  const stageScale = Math.min(availableWidth / page.widthPx, availableHeight / page.heightPx);
  const drawWidth = page.widthPx * stageScale;
  const drawHeight = page.heightPx * stageScale;
  const pageOffsetX = (stageWidth - drawWidth) / 2;
  const pageOffsetY = (stageHeight - drawHeight) / 2;
  const selectedPlacedItem = selectedImageId
    ? page.items.find((item) => item.imageId === selectedImageId) ?? null
    : null;
  const selectedHandles = selectedPlacedItem ? getSelectHandlePositions(selectedPlacedItem) : null;
  const replacePulse = 0.55 + 0.45 * Math.sin(replaceAnimationTick / 130);

  const { ref: inViewRef, inView } = useInView({
    threshold: 0.62,
    root: scrollRoot,
    rootMargin: '-20% 0px -20% 0px',
  });

  useEffect(() => {
    if (inView) {
      onVisible(index);
    }
  }, [inView, index, onVisible]);

  return (
    <motion.section
      ref={(node) => {
        inViewRef(node);
        registerContainerRef(index, node);
      }}
      className="relative"
      initial={{ opacity: 0, y: 26, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: false, amount: 0.45 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      animate={isActive ? { filter: 'brightness(1)', scale: 1 } : { filter: 'brightness(0.92)', scale: 0.992 }}
    >
      <button
        type="button"
        onClick={() => onJumpToPage(index)}
        className="mb-2 rounded-md border border-amber-200/30 px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-200/90"
      >
        Page {index + 1}
      </button>
      <div className="rounded-2xl p-2 backdrop-blur-md">
        <div className="relative inline-block">
          <div
            className={`touch-none rounded-xl ${isActive ? '' : 'pointer-events-none'}`}
            style={{ cursor: isActive ? (canvasCursor ?? 'default') : 'default' }}
            ref={(node) => registerViewportRef(index, node)}
            onMouseDown={isActive ? (event) => onPreviewMouseDown(event.clientX, event.clientY) : undefined}
            onMouseMove={isActive ? (event) => onPreviewMouseMove(event.clientX, event.clientY, event.shiftKey) : undefined}
            onMouseUp={isActive ? (event) => onPreviewMouseUp(event.clientX, event.clientY) : undefined}
            onMouseLeave={isActive ? () => onPreviewMouseLeave() : undefined}
            onDoubleClick={isActive ? (event) => onPreviewDoubleClick(event.clientX, event.clientY) : undefined}
            onDragOver={isActive ? onDragOver : undefined}
            onDrop={isActive ? onDrop : undefined}
            onDragLeave={isActive ? onDragLeave : undefined}
            aria-label={`Collage page ${page.id}`}
          >
            <Stage width={stageWidth} height={stageHeight} className="h-auto max-w-full rounded-xl" id={konvaNodeIds.pageStage(page.id)}>
              <Layer>
                <Group id={konvaNodeIds.page(page.id)} x={pageOffsetX} y={pageOffsetY} scaleX={stageScale} scaleY={stageScale}>
                  <Rect x={0} y={0} width={page.widthPx} height={page.heightPx} fill="#ffffff" listening={false} />
                  {page.items.map((placed) => {
                    const imageItem = itemById.get(placed.imageId);
                    const imageBitmap = imageById.get(placed.imageId);
                    if (!imageItem || !imageBitmap) {
                      return null;
                    }

                    const frameThicknessPx = placed.frameThicknessPx;
                    const innerX = placed.x + frameThicknessPx;
                    const innerY = placed.y + frameThicknessPx;
                    const innerWidth = placed.contentWidthPx;
                    const innerHeight = placed.contentHeightPx;
                    const clampedOffsets = clampOffsets(imageItem.offsetX, imageItem.offsetY, placed.maxOffsetX, placed.maxOffsetY);
                    const zoom = imageZoomLevels[placed.imageId] ?? 1;
                    const panRatio = imagePanOffsets[placed.imageId];

                    let drawX: number;
                    let drawY: number;
                    let drawW: number;
                    let drawH: number;

                    if (zoom > 1) {
                      drawW = placed.drawnImageWidthPx * zoom;
                      drawH = placed.drawnImageHeightPx * zoom;
                      drawX = innerX + innerWidth / 2 * (1 - zoom) - clampedOffsets.offsetX * zoom;
                      drawY = innerY + innerHeight / 2 * (1 - zoom) - clampedOffsets.offsetY * zoom;
                      const pan = resolveZoomPanOffset(
                        panRatio,
                        getZoomPanBounds(
                          {
                            contentWidthPx: placed.contentWidthPx,
                            contentHeightPx: placed.contentHeightPx,
                            drawnImageWidthPx: placed.drawnImageWidthPx,
                            drawnImageHeightPx: placed.drawnImageHeightPx,
                          },
                          zoom,
                        ),
                      );
                      drawX += pan.x;
                      drawY += pan.y;
                    } else {
                      drawW = placed.drawnImageWidthPx;
                      drawH = placed.drawnImageHeightPx;
                      drawX = innerX - clampedOffsets.offsetX;
                      drawY = innerY - clampedOffsets.offsetY;
                    }

                    const isHovered = hoveredImageId === placed.imageId && selectedImageId !== placed.imageId;
                    const isSelected = selectedImageId === placed.imageId;
                    const isDrawerSelected =
                      drawerSelectedImageId === placed.imageId &&
                      selectedImageId !== placed.imageId &&
                      hoveredImageId !== placed.imageId;

                    return (
                      <Group key={placed.imageId} id={konvaNodeIds.image(placed.imageId)}>
                        {frameThicknessPx > 0 ? (
                          <Rect x={placed.x} y={placed.y} width={placed.width} height={placed.height} fill="#ffffff" listening={false} />
                        ) : null}
                        <Group clipX={innerX} clipY={innerY} clipWidth={innerWidth} clipHeight={innerHeight} listening={false}>
                          <KonvaImage
                            id={konvaNodeIds.imageBitmap(placed.imageId)}
                            image={imageBitmap}
                            x={drawX}
                            y={drawY}
                            width={drawW}
                            height={drawH}
                            listening={false}
                          />
                        </Group>
                        {isHovered ? (
                          <Rect
                            id={konvaNodeIds.imageHover(placed.imageId)}
                            x={placed.x}
                            y={placed.y}
                            width={placed.width}
                            height={placed.height}
                            stroke="rgba(16, 57, 92, 0.78)"
                            strokeWidth={1.5 / stageScale}
                            dash={[6 / stageScale, 4 / stageScale]}
                            listening={false}
                          />
                        ) : null}
                        {isSelected ? (
                          <Rect
                            id={konvaNodeIds.imageSelection(placed.imageId)}
                            x={placed.x}
                            y={placed.y}
                            width={placed.width}
                            height={placed.height}
                            fill="rgba(252, 197, 21, 0.12)"
                            stroke="rgba(252, 197, 21, 0.92)"
                            strokeWidth={2 / stageScale}
                            listening={false}
                          />
                        ) : null}
                        {isDrawerSelected ? (
                          <Rect
                            id={konvaNodeIds.imageDrawerSelected(placed.imageId)}
                            x={placed.x}
                            y={placed.y}
                            width={placed.width}
                            height={placed.height}
                            stroke="rgba(250, 204, 21, 0.65)"
                            strokeWidth={2.5 / stageScale}
                            listening={false}
                          />
                        ) : null}
                      </Group>
                    );
                  })}
                  {canvasPlacementPreview ? (
                    <Rect
                      id={konvaNodeIds.placementPreview(canvasPlacementPreview.imageId)}
                      x={canvasPlacementPreview.x}
                      y={canvasPlacementPreview.y}
                      width={canvasPlacementPreview.width}
                      height={canvasPlacementPreview.height}
                      fill={canvasPlacementPreview.valid ? 'rgba(34, 197, 94, 0.14)' : 'rgba(239, 68, 68, 0.14)'}
                      stroke={canvasPlacementPreview.valid ? 'rgba(34, 197, 94, 0.9)' : 'rgba(239, 68, 68, 0.9)'}
                      strokeWidth={2 / stageScale}
                      dash={[10 / stageScale, 7 / stageScale]}
                      listening={false}
                    />
                  ) : null}
                  {(interactionMode === 'resize' || interactionMode === 'select') &&
                  dragActive &&
                  resizeSnapGuides.length > 0
                    ? resizeSnapGuides.map((guide, index) => (
                        <Line
                          key={`resize-guide-${index}`}
                          id={konvaNodeIds.resizeGuide(index)}
                          points={
                            guide.orientation === 'vertical'
                              ? [guide.value, 0, guide.value, page.heightPx]
                              : [0, guide.value, page.widthPx, guide.value]
                          }
                          stroke={resizeSnapActive ? 'rgba(252, 197, 21, 0.95)' : 'rgba(252, 197, 21, 0.7)'}
                          strokeWidth={(resizeSnapActive ? 2.5 : 1.8) / stageScale}
                          dash={[8 / stageScale, 5 / stageScale]}
                          listening={false}
                        />
                      ))
                    : null}
                  {selectedPlacedItem && moveOutsideCanvas && (interactionMode === 'move' || interactionMode === 'select') ? (
                    <Group id={konvaNodeIds.moveOutside(selectedPlacedItem.imageId)} listening={false}>
                      <Rect
                        x={selectedPlacedItem.x}
                        y={selectedPlacedItem.y}
                        width={selectedPlacedItem.width}
                        height={selectedPlacedItem.height}
                        stroke="rgba(239, 68, 68, 0.9)"
                        strokeWidth={2 / stageScale}
                        dash={[9 / stageScale, 6 / stageScale]}
                      />
                      <Line
                        points={[
                          selectedPlacedItem.x,
                          selectedPlacedItem.y,
                          selectedPlacedItem.x + selectedPlacedItem.width,
                          selectedPlacedItem.y + selectedPlacedItem.height,
                        ]}
                        stroke="rgba(239, 68, 68, 0.95)"
                        strokeWidth={2.4 / stageScale}
                      />
                      <Line
                        points={[
                          selectedPlacedItem.x + selectedPlacedItem.width,
                          selectedPlacedItem.y,
                          selectedPlacedItem.x,
                          selectedPlacedItem.y + selectedPlacedItem.height,
                        ]}
                        stroke="rgba(239, 68, 68, 0.95)"
                        strokeWidth={2.4 / stageScale}
                      />
                    </Group>
                  ) : null}
                  {selectedPlacedItem && moveCollisionImageIds.length > 0 && (interactionMode === 'move' || interactionMode === 'select') ? (
                    <Group id={konvaNodeIds.moveCollision(selectedPlacedItem.imageId)} listening={false}>
                      <Rect
                        x={selectedPlacedItem.x}
                        y={selectedPlacedItem.y}
                        width={selectedPlacedItem.width}
                        height={selectedPlacedItem.height}
                        stroke="rgba(251, 191, 36, 0.95)"
                        strokeWidth={2 / stageScale}
                        dash={[8 / stageScale, 4 / stageScale]}
                      />
                      {moveCollisionImageIds.map((collisionId) => {
                        const collided = page.items.find((item) => item.imageId === collisionId);
                        if (!collided) {
                          return null;
                        }
                        return (
                          <Group key={collisionId}>
                            <Rect
                              x={collided.x}
                              y={collided.y}
                              width={collided.width}
                              height={collided.height}
                              fill="rgba(251, 191, 36, 0.16)"
                            />
                            <Rect
                              x={collided.x}
                              y={collided.y}
                              width={collided.width}
                              height={collided.height}
                              stroke="rgba(251, 191, 36, 0.95)"
                              strokeWidth={2.2 / stageScale}
                              dash={[7 / stageScale, 5 / stageScale]}
                            />
                          </Group>
                        );
                      })}
                    </Group>
                  ) : null}
                  {resizeFeedback && (interactionMode === 'resize' || interactionMode === 'select') ? (
                    <Group id={konvaNodeIds.resizeFeedback} listening={false}>
                      <Rect
                        x={resizeFeedback.baseRect.x}
                        y={resizeFeedback.baseRect.y}
                        width={resizeFeedback.baseRect.width}
                        height={resizeFeedback.baseRect.height}
                        stroke="rgba(148, 163, 184, 0.9)"
                        strokeWidth={1.6 / stageScale}
                        dash={[8 / stageScale, 5 / stageScale]}
                      />
                      <Rect
                        x={resizeFeedback.currentRect.x}
                        y={resizeFeedback.currentRect.y}
                        width={resizeFeedback.currentRect.width}
                        height={resizeFeedback.currentRect.height}
                        fill="rgba(252, 197, 21, 0.12)"
                        stroke="rgba(252, 197, 21, 0.92)"
                        strokeWidth={2 / stageScale}
                      />
                    </Group>
                  ) : null}
                  {selectedPlacedItem && !resizeCurrentDimensions ? (
                    <Group id={konvaNodeIds.selectedSizeLabel(selectedPlacedItem.imageId)} listening={false}>
                      {(() => {
                        const label = formatSizeFromPx(
                          selectedPlacedItem.contentWidthPx,
                          selectedPlacedItem.contentHeightPx,
                          EDITOR_LENGTH_UNIT,
                        );
                        const fontSize = 11 / stageScale;
                        const padX = 6 / stageScale;
                        const labelHeight = 18 / stageScale;
                        const labelWidth = label.length * (fontSize * 0.58) + padX * 2;
                        const labelX = selectedPlacedItem.x + 6 / stageScale;
                        const labelY = selectedPlacedItem.y + 6 / stageScale;
                        return (
                          <>
                            <Rect x={labelX} y={labelY} width={labelWidth} height={labelHeight} fill="rgba(15, 23, 42, 0.9)" />
                            <Text x={labelX + padX} y={labelY + 3 / stageScale} text={label} fontSize={fontSize} fill="#fff7db" />
                          </>
                        );
                      })()}
                    </Group>
                  ) : null}
                  {selectedPlacedItem && resizeCurrentDimensions && (interactionMode === 'resize' || interactionMode === 'select') ? (
                    <Group id={konvaNodeIds.resizeSizeLabel(selectedPlacedItem.imageId)} listening={false}>
                      {(() => {
                        const label = formatSizeFromPx(
                          resizeCurrentDimensions.width,
                          resizeCurrentDimensions.height,
                          EDITOR_LENGTH_UNIT,
                        );
                        const fontSize = 11 / stageScale;
                        const padX = 6 / stageScale;
                        const labelHeight = 18 / stageScale;
                        const labelWidth = label.length * (fontSize * 0.58) + padX * 2;
                        const labelX = selectedPlacedItem.x + 6 / stageScale;
                        const labelY = selectedPlacedItem.y + 6 / stageScale;
                        return (
                          <>
                            <Rect x={labelX} y={labelY} width={labelWidth} height={labelHeight} fill="rgba(10, 122, 62, 0.92)" />
                            <Text x={labelX + padX} y={labelY + 3 / stageScale} text={label} fontSize={fontSize} fill="#ffffff" />
                          </>
                        );
                      })()}
                    </Group>
                  ) : null}
                  {interactionMode === 'replace' &&
                  dragActive &&
                  hoveredImageId &&
                  selectedImageId &&
                  hoveredImageId !== selectedImageId
                    ? (() => {
                        const source = page.items.find((item) => item.imageId === selectedImageId);
                        const target = page.items.find((item) => item.imageId === hoveredImageId);
                        if (!source || !target) {
                          return null;
                        }
                        const sourceX = source.x + source.width / 2;
                        const sourceY = source.y + source.height / 2;
                        const targetX = target.x + target.width / 2;
                        const targetY = target.y + target.height / 2;
                        const strokeColor = swapTargetInvalid
                          ? `rgba(239, 68, 68, ${0.55 + replacePulse * 0.3})`
                          : `rgba(252, 197, 21, ${0.55 + replacePulse * 0.3})`;
                        const arrowColor = swapTargetInvalid ? 'rgba(239, 68, 68, 0.92)' : 'rgba(252, 197, 21, 0.92)';
                        const angle = Math.atan2(targetY - sourceY, targetX - sourceX);
                        const arrowSize = 8 / stageScale;
                        const inset = 3 / stageScale;
                        return (
                          <Group id={konvaNodeIds.replaceFeedback(selectedImageId, hoveredImageId)} listening={false}>
                            <Line
                              points={[sourceX, sourceY, targetX, targetY]}
                              stroke={strokeColor}
                              strokeWidth={(2 + replacePulse * 1.1) / stageScale}
                              dash={[8 / stageScale, 6 / stageScale]}
                              dashOffset={-(replaceAnimationTick / 20) / stageScale}
                            />
                            <Line
                              points={[
                                targetX,
                                targetY,
                                targetX - arrowSize * Math.cos(angle - Math.PI / 6),
                                targetY - arrowSize * Math.sin(angle - Math.PI / 6),
                                targetX - arrowSize * Math.cos(angle + Math.PI / 6),
                                targetY - arrowSize * Math.sin(angle + Math.PI / 6),
                              ]}
                              closed
                              fill={arrowColor}
                            />
                            <Rect
                              x={target.x + inset}
                              y={target.y + inset}
                              width={target.width - inset * 2}
                              height={target.height - inset * 2}
                              fill={`rgba(34, 139, 84, ${0.12 + replacePulse * 0.1})`}
                              stroke={`rgba(10, 122, 62, ${0.65 + replacePulse * 0.25})`}
                              strokeWidth={(2 + replacePulse) / stageScale}
                              dash={[10 / stageScale, 7 / stageScale]}
                              dashOffset={-(replaceAnimationTick / 18) / stageScale}
                            />
                            <Rect
                              x={target.x + 6 / stageScale}
                              y={target.y + 6 / stageScale}
                              width={122 / stageScale}
                              height={18 / stageScale}
                              fill="rgba(10, 122, 62, 0.9)"
                            />
                            <Text
                              x={target.x + 12 / stageScale}
                              y={target.y + 9 / stageScale}
                              text="Replace target"
                              fontSize={11 / stageScale}
                              fill="#ffffff"
                            />
                          </Group>
                        );
                      })()
                    : null}
                  {interactionMode === 'replace' && dragActive && replacePointer ? (
                    <Group id={konvaNodeIds.replacePointerTooltip} listening={false}>
                      {(() => {
                        const label = swapTargetInvalid ? 'Cannot swap these photos' : 'Swap with this photo';
                        const padX = 7 / stageScale;
                        const height = 18 / stageScale;
                        const x = replacePointer.x + 12 / stageScale;
                        const y = replacePointer.y - 12 / stageScale;
                        const fontSize = 11 / stageScale;
                        const width = label.length * (fontSize * 0.58) + padX * 2;
                        return (
                          <>
                            <Rect
                              x={x}
                              y={y - height}
                              width={width}
                              height={height}
                              fill={swapTargetInvalid ? 'rgba(60, 10, 10, 0.9)' : 'rgba(20, 26, 40, 0.9)'}
                            />
                            <Text
                              x={x + padX}
                              y={y - height + 3 / stageScale}
                              text={label}
                              fontSize={fontSize}
                              fill={swapTargetInvalid ? '#fecaca' : '#fff7db'}
                            />
                          </>
                        );
                      })()}
                    </Group>
                  ) : null}
                  {selectedPlacedItem && selectedHandles ? (
                    Object.entries(selectedHandles)
                      .filter(([handle]) => handle === 'nw' || handle === 'ne' || handle === 'sw' || handle === 'se')
                      .map(([handle, position]) => (
                        <Rect
                          key={handle}
                          id={konvaNodeIds.handle(selectedPlacedItem.imageId, handle)}
                          x={position.x - 4 / stageScale}
                          y={position.y - 4 / stageScale}
                          width={8 / stageScale}
                          height={8 / stageScale}
                          fill="#ffffff"
                          stroke="rgba(252, 197, 21, 0.95)"
                          strokeWidth={1.5 / stageScale}
                          listening={false}
                        />
                      ))
                  ) : null}
                </Group>
              </Layer>
            </Stage>
          </div>
          {showPlacementHints ? (
            <div
              className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border-2 border-dashed border-amber-300/70 bg-amber-300/10 animate-pulse motion-reduce:animate-none"
              role="status"
              aria-live="polite"
            >
              <span className="rounded-md bg-black/55 px-2 py-1 text-xs font-semibold uppercase tracking-[0.06em] text-amber-100">
                Drop to place
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </motion.section>
  );
}

export function CollagePreview({
  pages,
  itemById,
  imageById,
  imageZoomLevels,
  imagePanOffsets,
  selectedImageId,
  hoveredImageId,
  drawerSelectedImageId,
  selectedImageName,
  showSelectionControls,
  onCloseSelectionControls,
  resizeLimitNotice,
  interactionMode,
  dragActive,
  moveOutsideCanvas,
  moveCollisionImageIds,
  resizeCurrentDimensions,
  resizeFeedback,
  resizeSnapGuides,
  resizeSnapActive,
  replaceAnimationTick,
  replacePointer,
  swapTargetInvalid,
  canvasPlacementPreview,
  onSetInteractionMode,
  onExpandSelectedImage,
  onResetSelectedCrop,
  selectedPageIndex,
  onSelectPage,
  previewViewportRef,
  onPreviewMouseDown,
  onPreviewMouseMove,
  onPreviewMouseUp,
  onPreviewMouseLeave,
  onPreviewDoubleClick,
  onDragOver,
  onDrop,
  onDragLeave,
  onUploadFileList,
  hasUnplacedImages,
  onGenerateLayout,
  imagesCount,
  canvasCursor,
}: CollagePreviewProps) {
  const pageViewportRefs = useRef<Array<HTMLElement | null>>([]);
  const pageContainerRefs = useRef<Array<HTMLElement | null>>([]);
  const previewBodyRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [scrollRoot, setScrollRoot] = useState<Element | null>(null);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const [previewLogicalSize, setPreviewLogicalSize] = useState<number>(() => {
    if (typeof window === 'undefined') {
      return 900;
    }
    return Math.round(Math.min(window.innerWidth * 0.9, 900));
  });
  const hasSelection = Boolean(selectedImageId);
  const hasPlacedItems = pages.some((page) => page.items.length > 0);
  const showOnboardingHints = !hasPlacedItems && imagesCount === 0;
  const showGenerateGuidance = !hasPlacedItems && imagesCount > 0;
  const imagesAtLimit = imagesCount >= MAX_IMAGES;

  useEffect(() => {
    if (!previewBodyRef.current) {
      return;
    }

    const root = previewBodyRef.current.closest('[data-collage-scroll-root]');
    setScrollRoot(root);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const shortcut = resolveEditorShortcut(
        {
          key: event.key,
          metaKey: event.metaKey,
          ctrlKey: event.ctrlKey,
          altKey: event.altKey,
          isEditableTarget: Boolean(
            target && (
              target instanceof HTMLInputElement
              || target instanceof HTMLTextAreaElement
              || target instanceof HTMLSelectElement
              || target.isContentEditable
            )
          ),
        },
        {
          hasSelection,
          showSelectionControls,
          interactionMode,
          selectedPageIndex,
          pageCount: pages.length,
        },
      );

      if (!shortcut) {
        return;
      }

      if (shortcut.type === 'select-page') {
        onSelectPage(shortcut.pageIndex);
        pageContainerRefs.current[shortcut.pageIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        event.preventDefault();
        return;
      }

      if (shortcut.type === 'set-mode') {
        onSetInteractionMode(shortcut.mode);
        event.preventDefault();
        return;
      }

      if (shortcut.type === 'clear-selection') {
        onCloseSelectionControls();
        event.preventDefault();
        return;
      }

      if (shortcut.type === 'expand-selected') {
        onExpandSelectedImage(shortcut.factor);
        event.preventDefault();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    hasSelection,
    showSelectionControls,
    interactionMode,
    pages.length,
    selectedPageIndex,
    onCloseSelectionControls,
    onExpandSelectedImage,
    onSelectPage,
    onSetInteractionMode,
  ]);

  useEffect(() => {
    pageViewportRefs.current.length = pages.length;
    pageContainerRefs.current.length = pages.length;
  }, [pages.length]);

  useEffect(() => {
    const onResize = () => {
      setPreviewLogicalSize(Math.round(Math.min(window.innerWidth * 0.9, 900)));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const rootEl = scrollRoot as HTMLElement | null;
    if (!rootEl || pages.length === 0) {
      return;
    }

    let rafId = 0;
    const syncActivePageFromScroll = () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }

      rafId = requestAnimationFrame(() => {
        const rootRect = rootEl.getBoundingClientRect();
        const viewportCenterY = rootRect.top + rootRect.height / 2;

        let bestIndex = -1;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (let index = 0; index < pageContainerRefs.current.length; index += 1) {
          const node = pageContainerRefs.current[index];
          if (!node) {
            continue;
          }

          const rect = node.getBoundingClientRect();
          const outsideViewport = rect.bottom < rootRect.top || rect.top > rootRect.bottom;
          if (outsideViewport) {
            continue;
          }

          const cardCenterY = rect.top + rect.height / 2;
          const distance = Math.abs(cardCenterY - viewportCenterY);
          if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = index;
          }
        }

        if (bestIndex >= 0 && bestIndex !== selectedPageIndex) {
          onSelectPage(bestIndex);
        }
      });
    };

    syncActivePageFromScroll();
    rootEl.addEventListener('scroll', syncActivePageFromScroll, { passive: true });
    window.addEventListener('resize', syncActivePageFromScroll);

    return () => {
      if (rafId) {
        cancelAnimationFrame(rafId);
      }
      rootEl.removeEventListener('scroll', syncActivePageFromScroll);
      window.removeEventListener('resize', syncActivePageFromScroll);
    };
  }, [scrollRoot, pages.length, selectedPageIndex, onSelectPage]);

  useEffect(() => {
    previewViewportRef.current = pageViewportRefs.current[selectedPageIndex] ?? null;
  }, [selectedPageIndex, pages.length, previewViewportRef]);

  const helperText = hasUnplacedImages
    ? 'Follow the core flow: generate the layout first, then fine-tune individual photos only when needed.'
    : 'Edit the active page here. Use Edit (S) for move/resize, Crop (C) for reframing, Swap (P) to replace, and Esc to return to Edit mode.';

  const jumpToPage = (index: number) => {
    onSelectPage(index);
    pageContainerRefs.current[index]?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  const handleVisiblePage = (index: number) => {
    if (index !== selectedPageIndex) {
      onSelectPage(index);
    }
  };

  return (
    <Panel className="animate-fade-up [animation-delay:130ms] bg-transparent shadow-none backdrop-blur-0">
      <h2 className="m-0 text-xl font-semibold text-ink">Canvas Pages</h2>
      <p className="m-0 text-sm text-muted">{helperText}</p>
      {pages.length > 0 ? (
        <p className="m-0 mt-1 text-xs text-amber-100/80">
          Active page: {Math.min(selectedPageIndex + 1, pages.length)} of {pages.length}
        </p>
      ) : null}
      {resizeLimitNotice ? (
        <p className="m-0 mt-1 text-xs font-semibold text-warn" role="status" aria-live="polite">
          {resizeLimitNotice}
        </p>
      ) : null}

      <div ref={previewBodyRef} className="mt-3 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-amber-200/90">
          Printable Area: {CANVAS_CM} x {CANVAS_CM} cm ({CANVAS_SIZE_PX} x {CANVAS_SIZE_PX} px)
        </p>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[76px_minmax(0,1fr)]">
          <div className="md:hidden">
            <div className="scrollbar-themed flex gap-2 overflow-x-auto pb-1">
              {pages.map((page, index) => (
                <Button
                  key={page.id}
                  variant={index === selectedPageIndex ? 'primary' : 'soft'}
                  onClick={() => jumpToPage(index)}
                  className="min-h-11 shrink-0 px-3 text-sm"
                >
                  Page {index + 1}
                </Button>
              ))}
            </div>
          </div>

          <aside className="sticky top-5 hidden self-start rounded-xl border border-line/30 bg-[#0b1220]/80 p-2 backdrop-blur-md md:block">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-200/70">
              Quick access
            </p>
            <div className="flex flex-col gap-2">
              {pages.map((page, index) => (
                <Button
                  key={page.id}
                  variant={index === selectedPageIndex ? 'primary' : 'soft'}
                  onClick={() => jumpToPage(index)}
                  className="min-h-10 justify-start px-2 text-xs"
                >
                  {index === selectedPageIndex ? '● ' : ''}P{index + 1}
                </Button>
              ))}
            </div>
          </aside>

          {showOnboardingHints ? (
            <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-line/30 bg-[#0b1220]/80 backdrop-blur-md">
              <div className="w-full px-8 py-12 text-center">
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  multiple
                  className="hidden"
                  disabled={imagesAtLimit}
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) void onUploadFileList(files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  disabled={imagesAtLimit}
                  onClick={() => !imagesAtLimit && uploadInputRef.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (!imagesAtLimit) setUploadDragOver(true);
                  }}
                  onDragLeave={() => setUploadDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setUploadDragOver(false);
                    if (imagesAtLimit) return;
                    const files = Array.from(e.dataTransfer.files);
                    if (files.length > 0) void onUploadFileList(files);
                  }}
                  className={`mx-auto flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border-2 border-dashed px-8 py-14 transition select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 ${
                    imagesAtLimit
                      ? 'cursor-not-allowed border-line/20 opacity-40'
                      : uploadDragOver
                        ? 'cursor-copy border-amber-400 bg-amber-400/10'
                        : 'cursor-pointer border-amber-300/40 hover:border-amber-400/70 hover:bg-amber-400/5'
                  }`}
                  aria-label="Upload photos"
                >
                  <UploadCloud className={`h-14 w-14 ${uploadDragOver ? 'text-amber-400' : 'text-amber-300/60'}`} />
                  <div className="text-center">
                     <p className="text-base font-semibold text-ink/90">
                       {imagesAtLimit ? `Limit reached (${MAX_IMAGES} photos)` : 'Drop photos here, or click to browse'}
                     </p>
                     {!imagesAtLimit && (
                       <p className="mt-1 text-sm text-muted">Upload from gallery · PNG, JPEG, WebP · up to {MAX_IMAGES} photos</p>
                     )}
                   </div>

                </button>
              </div>
            </div>
          ) : showGenerateGuidance ? (
            <div className="flex min-h-[400px] items-center justify-center rounded-2xl border border-line/30 bg-[#0b1220]/80 backdrop-blur-md">
              <div className="w-full max-w-xl px-8 py-12 text-center">
                <p className="m-0 text-xs font-semibold uppercase tracking-[0.08em] text-amber-200/80">Step 2 · Generate layout</p>
                <h3 className="mt-2 text-2xl font-semibold text-ink">Build the first collage automatically</h3>
                <p className="mx-auto mt-3 max-w-lg text-sm text-muted">
                  Your photos are uploaded. Generate the layout first to get a clean starting point, then fine-tune the active page only where needed.
                </p>
                <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
                  <Button onClick={onGenerateLayout} className="min-h-11 px-5 text-sm">
                    Generate layout
                  </Button>
                  <span className="text-xs text-muted">Manual drag-and-drop stays available from the library as a secondary option.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {pages.map((page, index) => (
                <PageCanvasCard
                  key={page.id}
                  index={index}
                  page={page}
                  scrollRoot={scrollRoot}
                  isActive={index === selectedPageIndex}
                  onVisible={handleVisiblePage}
                  onJumpToPage={jumpToPage}
                  registerContainerRef={(pageIndex, node) => {
                    pageContainerRefs.current[pageIndex] = node;
                  }}
                  registerViewportRef={(pageIndex, node) => {
                    pageViewportRefs.current[pageIndex] = node;
                    if (pageIndex === selectedPageIndex) {
                      previewViewportRef.current = node;
                    }
                  }}
                  previewLogicalSize={previewLogicalSize}
                  itemById={itemById}
                  imageById={imageById}
                  imageZoomLevels={imageZoomLevels}
                  imagePanOffsets={imagePanOffsets}
                  selectedImageId={index === selectedPageIndex ? selectedImageId : null}
                  hoveredImageId={index === selectedPageIndex ? hoveredImageId : null}
                  drawerSelectedImageId={index === selectedPageIndex ? drawerSelectedImageId : null}
                  interactionMode={interactionMode}
                  dragActive={dragActive && index === selectedPageIndex}
                  moveOutsideCanvas={moveOutsideCanvas && index === selectedPageIndex}
                  moveCollisionImageIds={index === selectedPageIndex ? moveCollisionImageIds : []}
                  resizeCurrentDimensions={index === selectedPageIndex ? resizeCurrentDimensions : null}
                  resizeFeedback={index === selectedPageIndex ? resizeFeedback : null}
                  resizeSnapGuides={index === selectedPageIndex ? resizeSnapGuides : []}
                  resizeSnapActive={index === selectedPageIndex ? resizeSnapActive : false}
                  replaceAnimationTick={replaceAnimationTick}
                  replacePointer={index === selectedPageIndex ? replacePointer : null}
                  swapTargetInvalid={index === selectedPageIndex ? swapTargetInvalid : false}
                  canvasPlacementPreview={index === selectedPageIndex ? canvasPlacementPreview : null}
                  onPreviewMouseDown={onPreviewMouseDown}
                  onPreviewMouseMove={onPreviewMouseMove}
                  onPreviewMouseUp={onPreviewMouseUp}
                  onPreviewMouseLeave={onPreviewMouseLeave}
                  onPreviewDoubleClick={onPreviewDoubleClick}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onDragLeave={onDragLeave}
                  showPlacementHints={dragActive}
                  canvasCursor={index === selectedPageIndex ? canvasCursor : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
