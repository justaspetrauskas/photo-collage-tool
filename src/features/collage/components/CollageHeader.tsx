import { useState } from 'react';
import { Zap, Download, RotateCcw, Trash2, Plus, MoreHorizontal, Menu, Settings } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import type { PaginationMode } from '../model/types';

type ExportFormat = 'png' | 'jpg' | 'jpeg';

export interface CollageHeaderProps {
  hasUnplacedImages: boolean;
  pagesCount: number;
  overflowCount: number;
  paginationMode: PaginationMode;
  onGenerateLayout: () => void;
  onExportPages: (format: ExportFormat) => Promise<void> | void;
  onCreateNextPage: () => void;
  onStartFromScratch: () => void;
  onClearEverything: () => void;
  /** Mobile: toggle the left library panel */
  onToggleLibrary: () => void;
  /** Mobile: toggle the right inspector panel */
  onToggleInspector: () => void;
}

export function CollageHeader({
  hasUnplacedImages,
  pagesCount,
  overflowCount,
  paginationMode,
  onGenerateLayout,
  onExportPages,
  onCreateNextPage,
  onStartFromScratch,
  onClearEverything,
  onToggleLibrary,
  onToggleInspector,
}: CollageHeaderProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');
  const [overflowOpen, setOverflowOpen] = useState(false);

  return (
    <header className="flex h-14 flex-shrink-0 items-center gap-2 border-b border-line/20 bg-[#0a0f1a]/95 px-3 backdrop-blur-sm">
      {/* Mobile: library toggle */}
      <button
        className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-white/5 md:hidden"
        onClick={onToggleLibrary}
        aria-label="Toggle image library"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Logo */}
      <h1 className="m-0 whitespace-nowrap font-display text-base font-black tracking-[0.02em] text-ink">
        collage-io
      </h1>

      <div className="flex-1" />

      {/* Generate Layout */}
      <Button
        onClick={onGenerateLayout}
        aria-label={hasUnplacedImages ? 'Generate Layout (recommended action)' : 'Generate Layout'}
        className={`flex min-h-9 items-center gap-1.5 px-3 py-1.5 text-sm ${
          hasUnplacedImages
            ? 'animate-pulse motion-reduce:animate-none ring-2 ring-amber-300/70 ring-offset-1 ring-offset-[#0a0f1a]'
            : ''
        }`}
      >
        <Zap className="h-4 w-4" />
        <span className="hidden sm:inline">Generate</span>
      </Button>

      {/* Export — format select + button */}
      <div className="flex items-center">
        <select
          className="field-input hidden h-9 rounded-r-none border border-line/30 py-1 text-sm sm:block"
          style={{ borderRight: 'none' }}
          value={exportFormat}
          onChange={(e) => setExportFormat(e.target.value as ExportFormat)}
          aria-label="Export format"
        >
          <option value="png">PNG</option>
          <option value="jpg">JPG</option>
          <option value="jpeg">JPEG</option>
        </select>
        <Button
          onClick={async () => { await onExportPages(exportFormat); }}
          disabled={!pagesCount}
          className="flex min-h-9 items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-50 sm:rounded-l-none"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </div>

      {/* Overflow menu */}
      <div className="relative">
        <button
          className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
          onClick={() => setOverflowOpen((v) => !v)}
          aria-label="More options"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>

        {overflowOpen && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOverflowOpen(false)}
            />
            <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-line/25 bg-[#0a0f1a]/98 p-1 shadow-xl backdrop-blur-md">
              {paginationMode === 'assisted' && overflowCount > 0 && (
                <button
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-white/5"
                  onClick={() => { onCreateNextPage(); setOverflowOpen(false); }}
                >
                  <Plus className="h-4 w-4 text-amber-300" />
                  Next Page ({overflowCount})
                </button>
              )}
              <div className="my-1 h-px bg-line/20" />
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:bg-white/5 hover:text-ink"
                onClick={() => { onStartFromScratch(); setOverflowOpen(false); }}
              >
                <RotateCcw className="h-4 w-4" />
                Start Fresh
              </button>
              <button
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-danger/80 hover:bg-danger/10 hover:text-danger"
                onClick={() => { onClearEverything(); setOverflowOpen(false); }}
              >
                <Trash2 className="h-4 w-4" />
                Clear All
              </button>
            </div>
          </>
        )}
      </div>

      {/* Mobile: inspector toggle */}
      <button
        className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-white/5 md:hidden"
        onClick={onToggleInspector}
        aria-label="Toggle settings panel"
      >
        <Settings className="h-5 w-5" />
      </button>
    </header>
  );
}
