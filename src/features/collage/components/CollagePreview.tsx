import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import type {
  DragEventHandler,
  MouseEventHandler,
  MutableRefObject,
} from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Panel } from '../../../shared/ui/Panel';
import { CANVAS_CM, CANVAS_SIZE_PX, cmToPx } from '../model/constants';
import { drawPagePreview } from '../model/renderEngine';
import type { ImageItem, InteractionMode, PageLayout } from '../model/types';
import { ArrowRight, MousePointerClick, UploadCloud } from 'lucide-react';

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
  scrollRoot: Element | null;
  isActive: boolean;
  onVisible: (index: number) => void;
  onJumpToPage: (index: number) => void;
  registerContainerRef: (index: number, node: HTMLElement | null) => void;
  registerCanvasRef: (index: number, node: HTMLCanvasElement | null) => void;
  onMouseDown: MouseEventHandler<HTMLCanvasElement>;
  onMouseMove: MouseEventHandler<HTMLCanvasElement>;
  onMouseUp: MouseEventHandler<HTMLCanvasElement>;
  onMouseLeave: MouseEventHandler<HTMLCanvasElement>;
  onDragOver: DragEventHandler<HTMLCanvasElement>;
  onDrop: DragEventHandler<HTMLCanvasElement>;
  onDragLeave: DragEventHandler<HTMLCanvasElement>;
  showPlacementHints: boolean;
}

function PageCanvasCard({
  index,
  page,
  scrollRoot,
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
  showPlacementHints,
}: PageCanvasCardProps) {
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
          {showPlacementHints ? (
            <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-xl border-2 border-dashed border-amber-300/70 bg-amber-300/10 animate-pulse">
              <span className="rounded-md bg-black/55 px-2 py-1 text-xs font-semibold uppercase tracking-[0.06em] text-amber-100">
                Drop here
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
  const pageContainerRefs = useRef<Array<HTMLElement | null>>([]);
  const previewBodyRef = useRef<HTMLDivElement | null>(null);
  const [scrollRoot, setScrollRoot] = useState<Element | null>(null);
  const hasSelection = Boolean(selectedImageId);
  const hasPlacedItems = pages.some((page) => page.items.length > 0);
  const showOnboardingHints = !hasPlacedItems;

  useEffect(() => {
    if (!previewBodyRef.current) {
      return;
    }

    const root = previewBodyRef.current.closest('[data-collage-scroll-root]');
    setScrollRoot(root);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
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
      if (key === 'arrowdown') {
        const nextIndex = Math.min(pages.length - 1, selectedPageIndex + 1);
        if (nextIndex !== selectedPageIndex) {
          onSelectPage(nextIndex);
          pageContainerRefs.current[nextIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        event.preventDefault();
        return;
      }

      if (key === 'arrowup') {
        const nextIndex = Math.max(0, selectedPageIndex - 1);
        if (nextIndex !== selectedPageIndex) {
          onSelectPage(nextIndex);
          pageContainerRefs.current[nextIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        event.preventDefault();
        return;
      }

      if (!hasSelection) {
        return;
      }

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
    pages.length,
    selectedPageIndex,
    onCloseSelectionControls,
    onExpandSelectedImage,
    onSelectPage,
    onSetInteractionMode,
  ]);

  useEffect(() => {
    pageCanvasRefs.current.length = pages.length;
    pageContainerRefs.current.length = pages.length;
  }, [pages.length]);

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

  const helperText = 'Scroll through all collage pages. Select an image on the active page to edit via the bottom context menu.';

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
      {resizeLimitNotice ? (
        <p className="m-0 mt-1 text-xs font-semibold text-warn" role="status" aria-live="polite">
          {resizeLimitNotice}
        </p>
      ) : null}

      <div ref={previewBodyRef} className="mt-3 p-4">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.08em] text-amber-200/90">
          Printable Area: {CANVAS_CM} x {CANVAS_CM} cm ({CANVAS_SIZE_PX} x {CANVAS_SIZE_PX} px)
        </p>

        <div className="grid grid-cols-[76px_minmax(0,1fr)] gap-4">
          <aside className="sticky top-5 self-start rounded-xl border border-line/30 bg-[#0b1220]/80 p-2 backdrop-blur-md">
            <p className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-200/70">
              Quick access
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

          {showOnboardingHints ? (
            <div className="rounded-2xl border border-amber-300/30 bg-[#0b1220]/80 px-6 py-10 text-center backdrop-blur-md">
              <h3 className="m-0 text-lg font-semibold text-amber-100">Start your collage in 2 quick steps</h3>
              <div className="mx-auto mt-5 max-w-xl space-y-3 text-left">
                <div className="flex items-start gap-3 rounded-xl border border-line/30 bg-white/5 px-4 py-3">
                  <UploadCloud className="mt-0.5 h-4 w-4 text-amber-300" />
                  <p className="m-0 text-sm text-ink/90">
                    <strong className="text-amber-100">Step 1:</strong> Upload photos in the right-side drawer.
                  </p>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-line/30 bg-white/5 px-4 py-3">
                  <MousePointerClick className="mt-0.5 h-4 w-4 text-amber-300" />
                  <p className="m-0 text-sm text-ink/90">
                    <strong className="text-amber-100">Step 2:</strong> Click <strong>Generate Layout</strong> or drag uploaded images onto the canvas.
                  </p>
                </div>
              </div>
              <p className="mb-0 mt-4 flex items-center justify-center gap-1 text-xs font-semibold uppercase tracking-[0.08em] text-amber-200/80">
                Drawer is on the right <ArrowRight className="h-3.5 w-3.5" />
              </p>
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
                  showPlacementHints={dragActive}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </Panel>
  );
}
