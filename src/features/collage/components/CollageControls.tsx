import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import { Panel } from '../../../shared/ui/Panel';
import type { PaginationMode } from '../model/types';
import type { ChangeEvent } from 'react';

interface CollageControlsProps {
  maxImageCm: number;
  setMaxImageCm: (value: number) => void;
  frameMm: number;
  setFrameMm: (value: number) => void;
  paginationMode: PaginationMode;
  setPaginationMode: (value: PaginationMode) => void;
  pagesCount: number;
  overflowCount: number;
  onUploadFiles: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onApplyGlobalSettings: () => void;
  onGenerateLayout: () => void;
  onExportPages: () => void;
  onCreateNextPage: () => void;
}

export function CollageControls({
  maxImageCm,
  setMaxImageCm,
  frameMm,
  setFrameMm,
  paginationMode,
  setPaginationMode,
  pagesCount,
  overflowCount,
  onUploadFiles,
  onApplyGlobalSettings,
  onGenerateLayout,
  onExportPages,
  onCreateNextPage,
}: CollageControlsProps) {
  return (
    <Panel className="animate-fade-up [animation-delay:80ms] grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
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

      <Field label="Pagination Mode">
        <select
          className="field-input"
          value={paginationMode}
          onChange={(event) => setPaginationMode(event.target.value as PaginationMode)}
        >
          <option value="auto">Auto Pagination</option>
          <option value="assisted">Assisted Pagination</option>
        </select>
      </Field>

      <Button onClick={onApplyGlobalSettings}>Apply Global Constraints</Button>
      <Button onClick={onGenerateLayout}>Generate Layout</Button>
      <Button onClick={onExportPages} disabled={!pagesCount}>Export PNG Pages</Button>

      {paginationMode === 'assisted' && overflowCount > 0 ? (
        <Button onClick={onCreateNextPage}>Create Next Page ({overflowCount} remaining)</Button>
      ) : null}
    </Panel>
  );
}
