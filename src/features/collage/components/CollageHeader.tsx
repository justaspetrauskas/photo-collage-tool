import { useState } from 'react';
import { Zap, Download, Menu, Settings } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';

type ExportFormat = 'png' | 'jpg' | 'jpeg';

export interface CollageHeaderProps {
  hasImages: boolean;
  hasUnplacedImages: boolean;
  canExport: boolean;
  isExporting: boolean;
  onGenerateLayout: () => void;
  onExportPages: (format: ExportFormat) => Promise<void> | void;
  /** Mobile: toggle the left library panel */
  onToggleLibrary: () => void;
  /** Mobile: toggle the right inspector panel */
  onToggleInspector: () => void;
}

export function CollageHeader({
  hasImages,
  hasUnplacedImages,
  canExport,
  isExporting,
  onGenerateLayout,
  onExportPages,
  onToggleLibrary,
  onToggleInspector,
}: CollageHeaderProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');

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
        disabled={!hasImages}
        aria-label={hasUnplacedImages ? 'Generate Layout (recommended action)' : 'Generate Layout'}
        className={`flex min-h-9 items-center gap-1.5 px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50 ${
          hasUnplacedImages
            ? 'animate-pulse motion-reduce:animate-none ring-2 ring-amber-300/70 ring-offset-1 ring-offset-[#0a0f1a]'
            : ''
        }`}
      >
        <Zap className="h-4 w-4" />
        <span className="hidden sm:inline">Generate layout</span>
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
          disabled={!canExport || isExporting}
          className="flex min-h-9 items-center gap-1.5 px-3 py-1.5 text-sm disabled:opacity-50 sm:rounded-l-none"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">{isExporting ? 'Exporting…' : 'Export ZIP'}</span>
        </Button>
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
