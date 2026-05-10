import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import type { PaginationMode } from '../model/types';
import { CANVAS_CM } from '../model/constants';
import { Check, Zap, Download, RotateCcw, Trash2, Plus } from 'lucide-react';

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
  onApplyGlobalSettings: () => void;
  onGenerateLayout: () => void;
  onExportPages: () => void;
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
  onApplyGlobalSettings,
  onGenerateLayout,
  onExportPages,
  onCreateNextPage,
  onStartFromScratch,
  onClearEverything,
}: CollageControlsProps) {
  return (
    <div className="space-y-2">
      {/* Sizing Controls - Compact Grid */}
            <div className="grid gap-2 grid-cols-3 sm:grid-cols-4">
              <Field label="Max (cm)" className="mb-0">
                <input
                  className="field-input py-1 text-xs"
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
                  className="field-input py-1 text-xs"
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
                  className="w-full h-1 accent-amber-400 mt-2"
                  type="range"
                  min="0"
                  max="10"
                  step="0.1"
                  value={frameMm}
                  onChange={(event) => setFrameMm(Number(event.target.value))}
                />
              </Field>

              <Field label="Pagination" className="mb-0">
                <select
                  className="field-input py-1 text-xs"
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
              <label className="themed-checkbox flex items-center gap-1.5 rounded-lg bg-[#121a2b]/82 px-2.5 py-1 text-xs font-medium text-ink/90">
                <input
                  type="checkbox"
                  checked={gridModeEnabled}
                  onChange={(event) => setGridModeEnabled(event.target.checked)}
                />
                <span>Grid</span>
              </label>

              <label className="themed-checkbox flex items-center gap-1.5 rounded-lg bg-[#121a2b]/82 px-2.5 py-1 text-xs font-medium text-ink/90">
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
              <Button onClick={onApplyGlobalSettings} className="w-full flex items-center justify-start gap-2 py-1.5 px-3 text-sm">
                <Check className="w-4 h-4" />
                Apply Constraints
              </Button>
              <Button onClick={onGenerateLayout} className="w-full flex items-center justify-start gap-2 py-1.5 px-3 text-sm">
                <Zap className="w-4 h-4" />
                Generate Layout
              </Button>
              <Button onClick={onExportPages} disabled={!pagesCount} className="w-full flex items-center justify-start gap-2 py-1.5 px-3 text-sm disabled:opacity-50">
                <Download className="w-4 h-4" />
                Export PNG
              </Button>

              <div className="h-px bg-line/20 my-1"></div>

              <Button variant="soft" onClick={onStartFromScratch} className="w-full flex items-center justify-start gap-2 py-1.5 px-3 text-sm">
                <RotateCcw className="w-4 h-4" />
                Start Fresh
              </Button>
              <Button variant="soft" onClick={onClearEverything} className="w-full flex items-center justify-start gap-2 py-1.5 px-3 text-sm">
                <Trash2 className="w-4 h-4" />
                Clear All
              </Button>

              {paginationMode === 'assisted' && overflowCount > 0 ? (
                <Button onClick={onCreateNextPage} className="w-full flex items-center justify-start gap-2 py-1.5 px-3 text-sm">
                  <Plus className="w-4 h-4" />
                  Next Page ({overflowCount})
                </Button>
              ) : null}
            </div>
          </div>
  );
}
