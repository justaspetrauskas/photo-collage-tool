import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import type { PaginationMode } from '../model/types';
import { CANVAS_CM } from '../model/constants';
import { Check, Zap, Download, RotateCcw, Trash2, Plus } from 'lucide-react';
import { useState } from 'react';

type ExportFormat = 'png' | 'jpg' | 'jpeg';

export interface CollageControlsProps {
  maxImageCm: number;
  setMaxImageCm: (value: number) => void;
  minImageCm: number;
  setMinImageCm: (value: number) => void;
  frameMm: number;
  setFrameMm: (value: number) => void;
  gridModeEnabled: boolean;
  setGridModeEnabled: (value: boolean) => void;
  autoCompactPages: boolean;
  setAutoCompactPages: (value: boolean) => void;
  paginationMode: PaginationMode;
  setPaginationMode: (value: PaginationMode) => void;
  pagesCount: number;
  overflowCount: number;
  hasUnplacedImages: boolean;
  onApplyGlobalSettings: () => void;
  onGenerateLayout: () => void;
  onExportPages: (format: ExportFormat) => Promise<void> | void;
  onCreateNextPage: () => void;
  onStartFromScratch: () => void;
  onClearEverything: () => void;
}

export function CollageControls({
  maxImageCm,
  setMaxImageCm,
  minImageCm,
  setMinImageCm,
  frameMm,
  setFrameMm,
  gridModeEnabled,
  setGridModeEnabled,
  autoCompactPages,
  setAutoCompactPages,
  paginationMode,
  setPaginationMode,
  pagesCount,
  overflowCount,
  hasUnplacedImages,
  onApplyGlobalSettings,
  onGenerateLayout,
  onExportPages,
  onCreateNextPage,
  onStartFromScratch,
  onClearEverything,
}: CollageControlsProps) {
  const [exportFormat, setExportFormat] = useState<ExportFormat>('png');

  return (
      <div className="space-y-2">
      {/* Sizing Controls - Compact Grid */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <Field label="Max (cm)" className="mb-0">
                <input
                  className="field-input min-h-11 py-1 text-sm"
                  type="number"
                  min="1"
                  max={CANVAS_CM}
                  step="0.1"
                  value={maxImageCm}
                  onChange={(event) => setMaxImageCm(Math.min(CANVAS_CM, Number(event.target.value)))}
                />
              </Field>

              <Field label="Min (cm)" className="mb-0">
                <input
                  className="field-input min-h-11 py-1 text-sm"
                  type="number"
                  min="0.5"
                  max="20"
                  step="0.1"
                  value={minImageCm}
                  onChange={(event) => setMinImageCm(Number(event.target.value))}
                />
              </Field>

              <Field label={`Frame ${frameMm.toFixed(1)} mm`} className="mb-0">
                <input
                  className="mt-2 h-2 w-full accent-amber-400"
                  type="range"
                  min="0"
                  max="10"
                  step="0.5"
                  value={frameMm}
                  onChange={(event) => setFrameMm(Number(event.target.value))}
                />
              </Field>

              <Field label="Pagination" className="mb-0">
                <select
                  className="field-input min-h-11 py-1 text-sm"
                  value={paginationMode}
                  onChange={(event) => setPaginationMode(event.target.value as PaginationMode)}
                >
                  <option value="auto">Auto</option>
                  <option value="assisted">Assist</option>
                </select>
              </Field>
            </div>

            {/* Checkboxes - Compact Row */}
            <div className="flex flex-wrap gap-1.5">
               <label className="themed-checkbox flex min-h-11 items-center gap-1.5 rounded-lg bg-[#121a2b]/82 px-2.5 py-1 text-sm font-medium text-ink/90">
                <input
                  type="checkbox"
                  checked={gridModeEnabled}
                  onChange={(event) => setGridModeEnabled(event.target.checked)}
                />
                <span>Grid</span>
              </label>

               <label className="themed-checkbox flex min-h-11 items-center gap-1.5 rounded-lg bg-[#121a2b]/82 px-2.5 py-1 text-sm font-medium text-ink/90">
                <input
                  type="checkbox"
                  checked={autoCompactPages}
                  onChange={(event) => setAutoCompactPages(event.target.checked)}
                />
                <span>Compact</span>
              </label>
            </div>

            {/* Action Buttons - Column with Icons */}
            <div className="space-y-1.5">
              <Button onClick={onApplyGlobalSettings} className="flex min-h-11 w-full items-center justify-start gap-2 px-3 py-1.5 text-sm">
                <Check className="w-4 h-4" />
                Apply Constraints
              </Button>
              <Button
                onClick={onGenerateLayout}
                aria-label={hasUnplacedImages ? 'Generate Layout (recommended action)' : 'Generate Layout'}
                className={`flex min-h-11 w-full items-center justify-start gap-2 px-3 py-1.5 text-sm ${
                  hasUnplacedImages ? 'animate-pulse motion-reduce:animate-none ring-2 ring-amber-300/70 ring-offset-2 ring-offset-[#0a0f1a]' : ''
                }`}
              >
                <Zap className="w-4 h-4" />
                Generate Layout
              </Button>

              <div className="rounded-lg border border-amber-300/35 bg-amber-400/10 p-2">
                <div className="flex items-center gap-2">
                  <select
                    className="field-input min-h-11 flex-1 py-1 text-sm"
                    value={exportFormat}
                    onChange={(event) => setExportFormat(event.target.value as ExportFormat)}
                    aria-label="Export format"
                  >
                    <option value="png">PNG</option>
                    <option value="jpg">JPG</option>
                    <option value="jpeg">JPEG</option>
                  </select>
                  <Button
                    onClick={async () => {
                      await onExportPages(exportFormat);
                    }}
                    disabled={!pagesCount}
                    className="flex min-h-11 min-w-0 flex-1 items-center justify-center gap-2 px-3 py-2 text-sm font-semibold disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    Export ZIP
                  </Button>
                </div>
                <p className="mt-1 text-[10px] text-amber-100/90">ZIP archive: photo-grid-&lt;id&gt;.zip containing photo-grid-&lt;id&gt;-page-&lt;n&gt;.{exportFormat} files</p>
              </div>

              <div className="h-px bg-line/20 my-1"></div>

              <Button variant="soft" onClick={onStartFromScratch} className="flex min-h-11 w-full items-center justify-start gap-2 px-3 py-1.5 text-sm">
                <RotateCcw className="w-4 h-4" />
                Start Fresh
              </Button>
              <Button variant="soft" onClick={onClearEverything} className="flex min-h-11 w-full items-center justify-start gap-2 px-3 py-1.5 text-sm">
                <Trash2 className="w-4 h-4" />
                Clear All
              </Button>

              {paginationMode === 'assisted' && overflowCount > 0 ? (
                <Button onClick={onCreateNextPage} className="flex min-h-11 w-full items-center justify-start gap-2 px-3 py-1.5 text-sm">
                  <Plus className="w-4 h-4" />
                  Next Page ({overflowCount})
                </Button>
              ) : null}
            </div>
          </div>
  );
}
