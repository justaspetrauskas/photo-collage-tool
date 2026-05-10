import { Button } from '../../../shared/ui/Button';
import { Panel } from '../../../shared/ui/Panel';
import type { InteractionMode, PageLayout } from '../model/types';
import type { MouseEventHandler, RefObject } from 'react';

interface CollagePreviewProps {
  pages: PageLayout[];
  selectedImageId: string | null;
  selectedImageName: string | null;
  interactionMode: InteractionMode;
  dragActive: boolean;
  onSetInteractionMode: (mode: InteractionMode) => void;
  onExpandSelectedImage: (factor: number) => void;
  onResetSelectedCrop: () => void;
  selectedPageIndex: number;
  onSelectPage: (index: number) => void;
  previewCanvasRef: RefObject<HTMLCanvasElement | null>;
  onMouseDown: MouseEventHandler<HTMLCanvasElement>;
  onMouseMove: MouseEventHandler<HTMLCanvasElement>;
  onMouseUp: MouseEventHandler<HTMLCanvasElement>;
}

export function CollagePreview({
  pages,
  selectedImageId,
  selectedImageName,
  interactionMode,
  dragActive,
  onSetInteractionMode,
  onExpandSelectedImage,
  onResetSelectedCrop,
  selectedPageIndex,
  onSelectPage,
  previewCanvasRef,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: CollagePreviewProps) {
  const hasSelection = Boolean(selectedImageId);
  const helperText = !hasSelection
    ? 'Click any image on the canvas to select it first.'
    : interactionMode === 'crop'
      ? dragActive
        ? 'Cropping: drag to move the visible area inside the frame.'
        : 'Crop mode: drag inside the selected image to reposition crop.'
      : dragActive
        ? 'Resizing: keep dragging diagonally to scale selected image limits.'
        : 'Resize mode: drag selected image to change its max size and relayout.';

  const canvasCursorClass = !hasSelection
    ? 'cursor-pointer'
    : interactionMode === 'crop'
      ? dragActive
        ? 'cursor-grabbing'
        : 'cursor-move'
      : dragActive
        ? 'cursor-se-resize'
        : 'cursor-nwse-resize';

  return (
    <Panel className="animate-fade-up [animation-delay:130ms]">
      <h2 className="m-0 text-xl font-extrabold">Page Preview</h2>
      <p className="m-0 text-sm text-muted">{helperText}</p>

      <div className="mt-3 rounded-xl border border-line bg-white/70 p-2">
        <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-muted">
          {hasSelection ? `Selected: ${selectedImageName ?? selectedImageId}` : 'No image selected'}
        </p>
        {hasSelection ? (
          <p className="mt-1 text-xs text-muted">
            Mode: <span className="font-bold text-ink">{interactionMode === 'crop' ? 'Crop Drag' : 'Resize Drag'}</span>
            {dragActive ? <span className="ml-2 rounded bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">Dragging</span> : null}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            variant={interactionMode === 'crop' ? 'primary' : 'soft'}
            onClick={() => onSetInteractionMode('crop')}
            disabled={!hasSelection}
          >
            Crop Drag
          </Button>
          <Button
            variant={interactionMode === 'resize' ? 'primary' : 'soft'}
            onClick={() => onSetInteractionMode('resize')}
            disabled={!hasSelection}
          >
            Resize Drag
          </Button>
          <Button variant="soft" onClick={() => onExpandSelectedImage(1.1)} disabled={!hasSelection}>
            Expand 10%
          </Button>
          <Button variant="soft" onClick={() => onExpandSelectedImage(0.9)} disabled={!hasSelection}>
            Shrink 10%
          </Button>
          <Button variant="soft" onClick={onResetSelectedCrop} disabled={!hasSelection}>
            Reset Crop
          </Button>
        </div>
      </div>

      <div className="mt-3 grid place-items-center rounded-xl border border-dashed border-line bg-[linear-gradient(135deg,_#fff9f2,_#fff)] p-3">
        <canvas
          className={`max-w-full rounded-lg border border-line ${canvasCursorClass}`}
          ref={previewCanvasRef}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
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
