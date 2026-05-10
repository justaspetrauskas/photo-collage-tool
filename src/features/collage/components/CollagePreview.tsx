import { Button } from '../../../shared/ui/Button';
import { Panel } from '../../../shared/ui/Panel';
import { CANVAS_CM, CANVAS_SIZE_PX, cmToPx } from '../model/constants';
import type { InteractionMode, PageLayout } from '../model/types';
import type { DragEventHandler, MouseEventHandler, RefObject } from 'react';
import { useEffect } from 'react';
import { useEditorUIStore } from '../store/editorUIStore';

interface CollagePreviewProps {
  pages: PageLayout[];
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
  previewCanvasRef: RefObject<HTMLCanvasElement | null>;
  onMouseDown: MouseEventHandler<HTMLCanvasElement>;
  onMouseMove: MouseEventHandler<HTMLCanvasElement>;
  onMouseUp: MouseEventHandler<HTMLCanvasElement>;
  onMouseLeave: MouseEventHandler<HTMLCanvasElement>;
  onDragOver: DragEventHandler<HTMLCanvasElement>;
  onDrop: DragEventHandler<HTMLCanvasElement>;
  onDragLeave: DragEventHandler<HTMLCanvasElement>;
}

export function CollagePreview({
  pages,
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
  const hasSelection = Boolean(selectedImageId);
  const hasHover = Boolean(hoveredImageId);

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
      } else {
        return;
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hasSelection, onCloseSelectionControls, onExpandSelectedImage, onSetInteractionMode]);
  const helperText = !hasSelection
    ? 'Click any image on the canvas to select it first.'
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
              ? '⚠️ Dragging outside canvas - release to remove image.'
              : 'Moving: drag selected image around the canvas.'
            : 'Move mode: drag selected image to reposition it. Drag outside canvas to remove.'
          : dragActive
            ? 'Replacing: drag selected image over another and release to swap them. Green animated slot marks target.'
            : 'Replace mode: drag one image onto another to swap positions.';

  const canvasCursorClass = !hasSelection
    ? hasHover
      ? 'cursor-pointer'
      : 'cursor-default'
    : interactionMode === 'crop'
      ? dragActive
        ? 'cursor-grabbing'
        : hasHover
          ? 'cursor-move'
          : 'cursor-default'
      : interactionMode === 'resize'
        ? dragActive
          ? 'cursor-se-resize'
          : hasHover
            ? 'cursor-nwse-resize'
            : 'cursor-default'
        : interactionMode === 'move'
          ? dragActive
            ? moveOutsideCanvas
              ? 'cursor-not-allowed'
              : 'cursor-grabbing'
            : hasHover
              ? 'cursor-grab'
              : 'cursor-default'
          : dragActive
            ? 'cursor-grabbing'
            : hasHover
              ? 'cursor-grab'
              : 'cursor-default';

  const modeLabel =
    interactionMode === 'crop'
      ? 'Crop Drag'
      : interactionMode === 'resize'
        ? 'Resize Drag'
        : interactionMode === 'move'
          ? 'Move Drag'
          : 'Replace Drag';

  return (
    <Panel className="animate-fade-up [animation-delay:130ms] bg-transparent shadow-none backdrop-blur-0">
      <h2 className="m-0 text-xl font-semibold text-ink">Canvas Lightbox</h2>
      <p className="m-0 text-sm text-muted">{helperText}</p>
      {resizeLimitNotice ? <p className="m-0 mt-1 text-xs font-semibold text-warn">{resizeLimitNotice}</p> : null}

      <div className="mt-3 rounded-xl bg-[#0e1626]/76 p-3 backdrop-blur-md">
        <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-muted">
          {hasSelection ? `Selected: ${selectedImageName ?? selectedImageId}` : 'No image selected'}
        </p>
        {hasSelection && (selectedImageWidth !== null || selectedImageHeight !== null) ? (
          <p className="m-0 mt-1 text-xs text-muted">
            Dimensions:{' '}
            <span className="font-semibold text-ink">
              {selectedImageWidth !== null ? `${(selectedImageWidth / cmToPx(1)).toFixed(2)} cm` : '—'} ×{' '}
              {selectedImageHeight !== null ? `${(selectedImageHeight / cmToPx(1)).toFixed(2)} cm` : '—'}
            </span>
          </p>
        ) : null}
        {hasSelection ? (
          <p className="mt-1 text-xs text-muted">
            Mode: <span className="font-bold text-ink">{modeLabel}</span>
            {dragActive ? <span className="ml-2 rounded bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">Dragging</span> : null}
          </p>
        ) : null}
      </div>

      <div className="mt-3 grid place-items-center rounded-2xl p-4">
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-200/70">
          Tip: drag an image from the sidebar into the canvas to place it manually
        </p>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-amber-200/90">
          Printable Area: {CANVAS_CM} x {CANVAS_CM} cm ({CANVAS_SIZE_PX} x {CANVAS_SIZE_PX} px)
        </p>
        <canvas
          className={`h-auto max-w-full rounded-xl ${canvasCursorClass}`}
          ref={previewCanvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
          onDragOver={onDragOver}
          onDrop={onDrop}
          onDragLeave={onDragLeave}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {pages.map((page, index) => (
          <Button key={page.id} variant={index === selectedPageIndex ? 'primary' : 'soft'} onClick={() => onSelectPage(index)}>
            Page {index + 1}
          </Button>
        ))}
      </div>
    </Panel>
  );
}
