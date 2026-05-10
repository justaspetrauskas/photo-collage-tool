import { Button } from '../../../shared/ui/Button';
import { Panel } from '../../../shared/ui/Panel';
import type { PageLayout } from '../model/types';
import type { MouseEventHandler, RefObject } from 'react';

interface CollagePreviewProps {
  pages: PageLayout[];
  selectedPageIndex: number;
  onSelectPage: (index: number) => void;
  previewCanvasRef: RefObject<HTMLCanvasElement | null>;
  onMouseDown: MouseEventHandler<HTMLCanvasElement>;
  onMouseMove: MouseEventHandler<HTMLCanvasElement>;
  onMouseUp: MouseEventHandler<HTMLCanvasElement>;
}

export function CollagePreview({
  pages,
  selectedPageIndex,
  onSelectPage,
  previewCanvasRef,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}: CollagePreviewProps) {
  return (
    <Panel className="animate-fade-up [animation-delay:130ms]">
      <h2 className="m-0 text-xl font-extrabold">Page Preview</h2>
      <p className="m-0 text-sm text-muted">Generate layout, then drag inside a frame to crop per image.</p>

      <div className="mt-3 grid place-items-center rounded-xl border border-dashed border-line bg-[linear-gradient(135deg,_#fff9f2,_#fff)] p-3">
        <canvas
          className="max-w-full cursor-grab rounded-lg border border-line active:cursor-grabbing"
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
