import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import type {
  DragEventHandler,
  MouseEventHandler,
  MutableRefObject,
} from 'react';
import { useEffect, useRef } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Panel } from '../../../shared/ui/Panel';
import { CANVAS_CM, CANVAS_SIZE_PX, cmToPx } from '../model/constants';
import { drawPagePreview } from '../model/renderEngine';
import type { ImageItem, InteractionMode, PageLayout } from '../model/types';

interface CollagePreviewProps {
  pages: PageLayout[];
  itemById: Map<string, ImageItem>;
  imageById: Map<string, HTMLImageElement>;
  selectedImageId: string | null;
  hoveredImageId: string | null;
  selectedImageName: string | null;
  selectedImageWidth: number | null;
  selectedImageHeight: number | null;
  showSelectionControls: boolean;
  onCloseSelectionControls: () => void;
  resizeLimitNotice: string;
  interactionMode: InteractionMode;
  dragActive: boolean;
  moveOutsideCanvas: boolean;
  onSetInteractionMode: (mode: InteractionMode) => void;
  onExpandSelectedImage: (factor: number) => void;
  onResetSelectedCrop: () => void;
  selectedPageIndex: number;
  onSelectPage: (index: number) => void;
  previewCanvasRef: MutableRefObject<HTMLCanvasElement | null>;
  onMouseDown: MouseEventHandler<HTMLCanvasElement>;
  onMouseMove: MouseEventHandler<HTMLCanvasElement>;
  onMouseUp: MouseEventHandler<HTMLCanvasElement>;
  onMouseLeave: MouseEventHandler<HTMLCanvasElement>;
  onDragOver: DragEventHandler<HTMLCanvasElement>;
  onDrop: DragEventHandler<HTMLCanvasElement>;
  onDragLeave: DragEventHandler<HTMLCanvasElement>;
}

interface PageCanvasCardProps {
  index: number;
  page: PageLayout;
  isActive: boolean;
  onVisible: (index: number) => void;
  onJumpToPage: (index: number) => void;
  registerContainerRef: (index: number, node: HTMLDivElement | null) => void;
  registerCanvasRef: (index: number, node: HTMLCanvasElement | null) => void;
  onMouseDown: MouseEventHandler<HTMLCanvasElement>;
  onMouseMove: MouseEventHandler<HTMLCanvasElement>;
  onMouseUp: MouseEventHandler<HTMLCanvasElement>;
  onMouseLeave: MouseEventHandler<HTMLCanvasElement>;
  onDragOver: DragEventHandler<HTMLCanvasElement>;
  onDrop: DragEventHandler<HTMLCanvasElement>;
  onDragLeave: DragEventHandler<HTMLCanvasElement>;
}

function PageCanvasCard({
  index,
  page,
  isActive,
  onVisible,
  onJumpToPage,
  registerContainerRef,
  registerCanvasRef,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onDragOver,
  onDrop,
  onDragLeave,
}: PageCanvasCardProps) {
  const { ref: inViewRef, inView } = useInView({
    threshold: 0.62,
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
        <canvas
          className={`h-auto max-w-full rounded-xl ${isActive ? 'cursor-default' : 'pointer-events-none'} `}
          ref={(node) => registerCanvasRef(index, node)}
          onMouseDown={isActive ? onMouseDown : undefined}
          onMouseMove={isActive ? onMouseMove : undefined}
          onMouseUp={isActive ? onMouseUp : undefined}
          onMouseLeave={isActive ? onMouseLeave : undefined}
          onDragOver={isActive ? onDragOver : undefined}
          onDrop={isActive ? onDrop : undefined}
          onDragLeave={isActive ? onDragLeave : undefined}
          aria-label={`Collage page ${page.id}`}
        />
      </div>
    </motion.section>
  );
}

export function CollagePreview({
  pages,
  itemById,
  imageById,
  selectedImageId,
  hoveredImageId,
  selectedImageName,
  selectedImageWidth,
  selectedImageHeight,
  showSelectionControls,
  onCloseSelectionControls,
  resizeLimitNotice,
  interactionMode,
  dragActive,
  moveOutsideCanvas,
  onSetInteractionMode,
  onExpandSelectedImage,
  onResetSelectedCrop,
  selectedPageIndex,
  onSelectPage,
  previewCanvasRef,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onDragOver,
  onDrop,
  onDragLeave,
}: CollagePreviewProps) {
  const pageCanvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const pageContainerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const hasSelection = Boolean(selectedImageId);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!hasSelection) {
        return;
      }

      const tag = (event.target as HTMLElement | null)?.tagName?.toLowerCase();
      const isEditable =
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        (event.target as HTMLElement | null)?.isContentEditable;
      if (isEditable) {
        return;
      }

      const key = event.key.toLowerCase();
      if (key === 'escape') {
        onCloseSelectionControls();
        event.preventDefault();
      } else if (key === 'r') {
        onSetInteractionMode('resize');
        event.preventDefault();
      } else if (key === 'm') {
        onSetInteractionMode('move');
        event.preventDefault();
      } else if (key === 'p') {
        onSetInteractionMode('replace');
        event.preventDefault();
      } else if (key === '=') {
        onExpandSelectedImage(1.1);
        event.preventDefault();
      } else if (key === '-') {
        onExpandSelectedImage(0.9);
        event.preventDefault();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    hasSelection,
    onCloseSelectionControls,
    onExpandSelectedImage,
    onSetInteractionMode,
  ]);

  useEffect(() => {
    pageCanvasRefs.current.length = pages.length;
    pageContainerRefs.current.length = pages.length;
  }, [pages.length]);

  useEffect(() => {
    pages.forEach((page, index) => {
      const canvas = pageCanvasRefs.current[index];
      if (!canvas) {
        return;
      }

      const isActive = index === selectedPageIndex;
      drawPagePreview(canvas, page, itemById, imageById, {
        selectedImageId: isActive ? selectedImageId : null,
        hoveredImageId: isActive ? hoveredImageId : null,
        interactionMode,
        dragActive: isActive ? dragActive : false,
        moveOutsideCanvas: isActive ? moveOutsideCanvas : false,
      });

      if (isActive) {
        previewCanvasRef.current = canvas;
      }
    });
  }, [
    pages,
    itemById,
    imageById,
    selectedPageIndex,
    selectedImageId,
    hoveredImageId,
    interactionMode,
    dragActive,
    moveOutsideCanvas,
    previewCanvasRef,
  ]);

  const helperText = !hasSelection
    ? 'Scroll through all collage pages and click an image on the active page to edit.'
    : interactionMode === 'crop'
      ? dragActive
        ? 'Cropping: drag to move the visible area inside the frame.'
        : 'Crop mode: drag inside the selected image to reposition crop.'
    : interactionMode === 'resize'
      ? dragActive
        ? 'Resizing: drag diagonally to scale selected image within local free space.'
        : 'Resize mode: drag selected image to change its size in place.'
      : interactionMode === 'move'
        ? dragActive
          ? moveOutsideCanvas
            ? 'Dragging outside canvas: release to remove image.'
            : 'Moving: drag selected image around the canvas.'
          : 'Move mode: drag selected image to reposition it. Drag outside canvas to remove.'
        : dragActive
          ? 'Replacing: drag selected image over another and release to swap.'
          : 'Replace mode: drag one image onto another to swap positions.';

  const modeLabel =
    interactionMode === 'crop'
      ? 'Crop Drag'
      : interactionMode === 'resize'
      ? 'Resize Drag'
      : interactionMode === 'move'
        ? 'Move Drag'
        : 'Replace Drag';

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
      {resizeLimitNotice ? <p className="m-0 mt-1 text-xs font-semibold text-warn">{resizeLimitNotice}</p> : null}

      {hasSelection ? (
        <div className="mt-3 rounded-xl bg-[#0e1626]/76 p-3 backdrop-blur-md">
          <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-muted">
            Selected: {selectedImageName ?? selectedImageId}
          </p>
          {selectedImageWidth !== null || selectedImageHeight !== null ? (
            <p className="m-0 mt-1 text-xs text-muted">
              Dimensions:{' '}
              <span className="font-semibold text-ink">
                {selectedImageWidth !== null ? `${(selectedImageWidth / cmToPx(1)).toFixed(2)} cm` : '-'} x{' '}
                {selectedImageHeight !== null ? `${(selectedImageHeight / cmToPx(1)).toFixed(2)} cm` : '-'}
              </span>
            </p>
          ) : null}
          <p className="mt-1 text-xs text-muted">
            Mode: <span className="font-bold text-ink">{modeLabel}</span>
            {dragActive ? <span className="ml-2 rounded bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">Dragging</span> : null}
          </p>
        </div>
      ) : null}

      <div className="mt-3 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-amber-200/90">
          Printable Area: {CANVAS_CM} x {CANVAS_CM} cm ({CANVAS_SIZE_PX} x {CANVAS_SIZE_PX} px)
        </p>

        <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-4">
          <aside className="sticky top-5 self-start rounded-xl border border-line/30 bg-[#0b1220]/80 p-2 backdrop-blur-md">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-200/70">
              Quick Pages · Scroll sync
            </p>
            <div className="flex flex-col gap-2">
              {pages.map((page, index) => (
                <Button
                  key={page.id}
                  variant={index === selectedPageIndex ? 'primary' : 'soft'}
                  onClick={() => jumpToPage(index)}
                  className="justify-start px-2 text-xs"
                >
                  {index === selectedPageIndex ? '● ' : ''}P{index + 1}
                </Button>
              ))}
            </div>
          </aside>

          <div className="space-y-8">
            {pages.map((page, index) => (
              <PageCanvasCard
                key={page.id}
                index={index}
                page={page}
                isActive={index === selectedPageIndex}
                onVisible={handleVisiblePage}
                onJumpToPage={jumpToPage}
                registerContainerRef={(pageIndex, node) => {
                  pageContainerRefs.current[pageIndex] = node;
                }}
                registerCanvasRef={(pageIndex, node) => {
                  pageCanvasRefs.current[pageIndex] = node;
                  if (pageIndex === selectedPageIndex) {
                    previewCanvasRef.current = node;
                  }
                }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={onMouseUp}
                onMouseLeave={onMouseLeave}
                onDragOver={onDragOver}
                onDrop={onDrop}
                onDragLeave={onDragLeave}
              />
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}
