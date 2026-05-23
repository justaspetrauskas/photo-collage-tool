import { motion } from 'framer-motion';
import { useInView } from 'react-intersection-observer';
import type {
  DragEventHandler,
  MouseEventHandler,
  MutableRefObject,
  PointerEventHandler,
} from 'react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '../../../shared/ui/Button';
import { Panel } from '../../../shared/ui/Panel';
import { CANVAS_CM, CANVAS_SIZE_PX, cmToPx } from '../model/constants';
import { drawPagePreview } from '../model/renderEngine';
import type { ImageItem, InteractionMode, PageLayout } from '../model/types';
import { UploadCloud } from 'lucide-react';

const MAX_IMAGES = 24;

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
  onDoubleClick: MouseEventHandler<HTMLCanvasElement>;
  onPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onPointerUp: PointerEventHandler<HTMLCanvasElement>;
  onPointerCancel: PointerEventHandler<HTMLCanvasElement>;
  onDragOver: DragEventHandler<HTMLCanvasElement>;
  onDrop: DragEventHandler<HTMLCanvasElement>;
  onDragLeave: DragEventHandler<HTMLCanvasElement>;
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
  registerCanvasRef: (index: number, node: HTMLCanvasElement | null) => void;
  onMouseDown: MouseEventHandler<HTMLCanvasElement>;
  onMouseMove: MouseEventHandler<HTMLCanvasElement>;
  onMouseUp: MouseEventHandler<HTMLCanvasElement>;
  onMouseLeave: MouseEventHandler<HTMLCanvasElement>;
  onDoubleClick: MouseEventHandler<HTMLCanvasElement>;
  onPointerDown: PointerEventHandler<HTMLCanvasElement>;
  onPointerMove: PointerEventHandler<HTMLCanvasElement>;
  onPointerUp: PointerEventHandler<HTMLCanvasElement>;
  onPointerCancel: PointerEventHandler<HTMLCanvasElement>;
  onDragOver: DragEventHandler<HTMLCanvasElement>;
  onDrop: DragEventHandler<HTMLCanvasElement>;
  onDragLeave: DragEventHandler<HTMLCanvasElement>;
  showPlacementHints: boolean;
  selectedSizeLabel: string | null;
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
  registerCanvasRef,
  onMouseDown,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
  onDoubleClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDragOver,
  onDrop,
  onDragLeave,
  showPlacementHints,
  selectedSizeLabel,
  canvasCursor,
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
          {isActive && selectedSizeLabel ? (
            <div className="pointer-events-none absolute -top-7 left-0 rounded-md border border-amber-200/30 bg-black/65 px-2 py-1 text-[10px] font-semibold tracking-[0.04em] text-amber-100">
              {selectedSizeLabel}
            </div>
          ) : null}
          <canvas
            className={`h-auto max-w-full touch-none rounded-xl ${isActive ? (canvasCursor ?? 'cursor-default') : 'pointer-events-none'} `}
            ref={(node) => registerCanvasRef(index, node)}
            onMouseDown={isActive ? onMouseDown : undefined}
            onMouseMove={isActive ? onMouseMove : undefined}
            onMouseUp={isActive ? onMouseUp : undefined}
            onMouseLeave={isActive ? onMouseLeave : undefined}
            onDoubleClick={isActive ? onDoubleClick : undefined}
            onPointerDown={isActive ? onPointerDown : undefined}
            onPointerMove={isActive ? onPointerMove : undefined}
            onPointerUp={isActive ? onPointerUp : undefined}
            onPointerCancel={isActive ? onPointerCancel : undefined}
            onDragOver={isActive ? onDragOver : undefined}
            onDrop={isActive ? onDrop : undefined}
            onDragLeave={isActive ? onDragLeave : undefined}
            aria-label={`Collage page ${page.id}`}
          />
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
  onDoubleClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  onDragOver,
  onDrop,
  onDragLeave,
  onUploadFileList,
  hasUnplacedImages,
  onGenerateLayout,
  imagesCount,
  canvasCursor,
}: CollagePreviewProps) {
  const pageCanvasRefs = useRef<Array<HTMLCanvasElement | null>>([]);
  const pageContainerRefs = useRef<Array<HTMLElement | null>>([]);
  const previewBodyRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const [scrollRoot, setScrollRoot] = useState<Element | null>(null);
  const [uploadDragOver, setUploadDragOver] = useState(false);
  const hasSelection = Boolean(selectedImageId);
  const selectedSizeLabel =
    hasSelection && selectedImageWidth !== null && selectedImageHeight !== null
      ? `${Math.max(1, Math.round(selectedImageWidth))} × ${Math.max(1, Math.round(selectedImageHeight))} px`
      : null;
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
        if (interactionMode !== 'select') {
          onSetInteractionMode('select');
        } else {
          onCloseSelectionControls();
        }
        event.preventDefault();
      } else if (key === 's') {
        onSetInteractionMode('select');
        event.preventDefault();
      } else if (key === 'c') {
        onSetInteractionMode('crop');
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
      if (isActive) {
        previewCanvasRef.current = canvas;
        return;
      }

      drawPagePreview(canvas, page, itemById, imageById, {
        selectedImageId: null,
        hoveredImageId: null,
        interactionMode,
        dragActive: false,
        moveOutsideCanvas: false,
      });
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
                  onDoubleClick={onDoubleClick}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerCancel}
                  onDragOver={onDragOver}
                  onDrop={onDrop}
                  onDragLeave={onDragLeave}
                  showPlacementHints={dragActive}
                  selectedSizeLabel={index === selectedPageIndex ? selectedSizeLabel : null}
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
