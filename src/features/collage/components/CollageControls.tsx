import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import { Panel } from '../../../shared/ui/Panel';
import type { PaginationMode } from '../model/types';
import type { ChangeEvent } from 'react';

interface CollageControlsProps {
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
  onUploadFiles: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
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
  onUploadFiles,
  onApplyGlobalSettings,
  onGenerateLayout,
  onExportPages,
  onCreateNextPage,
  onStartFromScratch,
  onClearEverything,
}: CollageControlsProps) {
  return (
    <Panel className="animate-fade-up [animation-delay:80ms] space-y-3">
      <div>
        <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-cyan-300">Tool Panel</p>
        <h2 className="m-0 mt-1 text-lg font-semibold text-ink">Scene Controls</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
      <Field label="Upload Photos">
        <input className="field-input" type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onUploadFiles} />
      </Field>

      <Field label="Max Image Size (cm)">
        <input
          className="field-input"
          type="number"
          min="1"
          max="20"
          step="0.1"
          value={maxImageCm}
          onChange={(event) => setMaxImageCm(Number(event.target.value))}
        />
      </Field>

      <Field label="Min Image Size (cm)">
        <input
          className="field-input"
          type="number"
          min="0.5"
          max="20"
          step="0.1"
          value={minImageCm}
          onChange={(event) => setMinImageCm(Number(event.target.value))}
        />
      </Field>

      <Field label="Frame Thickness (mm)">
        <input
          className="field-input"
          type="number"
          min="0"
          max="20"
          step="0.1"
          value={frameMm}
          onChange={(event) => setFrameMm(Number(event.target.value))}
        />
      </Field>

      <label className="mt-1 flex items-center gap-2 rounded-xl bg-[#0d1629]/82 px-3 py-2 text-sm font-medium text-ink/90">
        <input
          className="h-4 w-4 rounded border-line text-accent focus:ring-accent/30"
          type="checkbox"
          checked={gridModeEnabled}
          onChange={(event) => setGridModeEnabled(event.target.checked)}
        />
        Occupancy guidelines overlay (preview only)
      </label>

      <label className="mt-1 flex items-center gap-2 rounded-xl bg-[#0d1629]/82 px-3 py-2 text-sm font-medium text-ink/90">
        <input
          className="h-4 w-4 rounded border-line text-accent focus:ring-accent/30"
          type="checkbox"
          checked={autoCompactPages}
          onChange={(event) => setAutoCompactPages(event.target.checked)}
        />
        Auto compact pages (backfill earlier pages)
      </label>
      </div>

      <Field label="Pagination Mode" className="pt-1">
        <select
          className="field-input"
          value={paginationMode}
          onChange={(event) => setPaginationMode(event.target.value as PaginationMode)}
        >
          <option value="auto">Auto Pagination</option>
          <option value="assisted">Assisted Pagination</option>
        </select>
      </Field>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
        <Button onClick={onApplyGlobalSettings}>Apply Global Constraints</Button>
        <Button onClick={onGenerateLayout}>Generate Layout</Button>
        <Button onClick={onExportPages} disabled={!pagesCount}>Export PNG Pages</Button>
        <Button variant="soft" onClick={onStartFromScratch}>Start From Scratch</Button>
        <Button variant="soft" onClick={onClearEverything}>Clear Everything</Button>
      </div>

      {paginationMode === 'assisted' && overflowCount > 0 ? (
        <Button onClick={onCreateNextPage}>Create Next Page ({overflowCount} remaining)</Button>
      ) : null}
    </Panel>
  );
}
