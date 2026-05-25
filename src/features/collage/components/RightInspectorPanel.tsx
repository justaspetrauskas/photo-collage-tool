import { useState } from 'react';
import { ChevronDown, ChevronUp, Check, X, Sparkles, Loader2, Plus, RotateCcw, Trash2, Minus } from 'lucide-react';
import { Button } from '../../../shared/ui/Button';
import { Field } from '../../../shared/ui/Field';
import { CanvasSizeDropdown, type CanvasSizeDropdownProps } from './CanvasSizeDropdown';
import type { ImageItem, PageLayout, PaginationMode } from '../model/types';
import { CANVAS_CM, LAYOUT_PRESETS, type LayoutPresetId } from '../model/constants';
import { type EnhancePreset, ENHANCE_PRESET_LABELS } from '../lib/openaiImageEdit';
import { useEditorUIStore } from '../store/editorUIStore';
import { cn } from '../../../shared/lib/cn';

interface LayoutControlsProps {
  hasImages: boolean;
  hasPlacedItems: boolean;
  selectedPageIndex: number;
  maxImageCm: number;
  setMaxImageCm: (v: number) => void;
  minImageCm: number;
  setMinImageCm: (v: number) => void;
  frameMm: number;
  setFrameMm: (v: number) => void;
  gridModeEnabled: boolean;
  setGridModeEnabled: (v: boolean) => void;
  autoCompactPages: boolean;
  setAutoCompactPages: (v: boolean) => void;
  paginationMode: PaginationMode;
  setPaginationMode: (v: PaginationMode) => void;
  layoutPresetId: LayoutPresetId;
  setLayoutPresetId: (v: LayoutPresetId) => void;
  recommendedLayoutHint: string;
  overflowCount: number;
  onApplyGlobalSettings: () => void;
  onCreateNextPage: () => void;
  onRemoveSelectedCanvas: () => void;
  onStartFromScratch: () => void;
  onClearEverything: () => void;
  canvasSize: CanvasSizeDropdownProps;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt: number | null;
  restoredFromSnapshot: boolean;
  workflowStage: 'upload' | 'generate' | 'edit' | 'export';
  sessionMetrics: {
    uploads: number;
    layoutGenerations: number;
    exportsCompleted: number;
    exportFailures: number;
    enhancementRuns: number;
    enhancementFailures: number;
    modeSwitches: number;
    destructiveCancels: number;
    destructiveConfirms: number;
  };
  sessionInsights: {
    timeToFirstLayoutMs: number | null;
    timeToFirstExportMs: number | null;
  };
}

export interface RightInspectorPanelProps extends LayoutControlsProps {
  selectedImageId: string | null;
  images: ImageItem[];
  pages: PageLayout[];
  onUpdateImage: (id: string, patch: Partial<ImageItem>) => void;
  onDeleteImage: (id: string) => void;
  onRemoveFromCanvas: (id: string) => void;
  onEnhanceImage: (id: string, preset: EnhancePreset) => Promise<void>;
  onRestoreOriginalImage: (id: string) => Promise<void>;
  enhancingImageIds: Set<string>;
  onPlaceImageOnCanvas: (id: string) => void;
  onReplaceSelectedImage: (id: string) => void;
  onShowProjectView: () => void;
  /** Mobile: whether the panel is visible as an overlay */
  isOpen: boolean;
  onClose: () => void;
}

// ─── Accordion ───────────────────────────────────────────────────────────────

function Accordion({
  title,
  defaultOpen = false,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-line/30">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted hover:bg-white/5 focus-visible:outline-none"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="mx-2 mb-2 rounded-xl bg-white/[0.03] px-3 py-3">
          {children}
        </div>
      )}
    </div>
  );
}

function formatSavedState(saveState: LayoutControlsProps['saveState'], lastSavedAt: number | null): string {
  if (saveState === 'saving') {
    return 'Saving latest changes…';
  }
  if (saveState === 'error') {
    return 'Local save needs attention';
  }
  if (!lastSavedAt) {
    return 'Not saved yet';
  }

  return `Saved at ${new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(lastSavedAt)}`;
}

function formatDuration(durationMs: number | null): string {
  if (!durationMs) {
    return '—';
  }

  const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
}

// ─── Layout controls (default inspector state) ────────────────────────────────

function LayoutInspector({
  hasImages,
  hasPlacedItems,
  selectedPageIndex,
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
  layoutPresetId,
  setLayoutPresetId,
  recommendedLayoutHint,
  overflowCount,
  onApplyGlobalSettings,
  onCreateNextPage,
  onRemoveSelectedCanvas,
  onStartFromScratch,
  onClearEverything,
  canvasSize,
  saveState,
  lastSavedAt,
  restoredFromSnapshot,
  workflowStage,
  sessionMetrics,
  sessionInsights,
}: LayoutControlsProps) {
  const [section, setSection] = useState<'setup' | 'rules' | 'actions' | 'insights'>('setup');

  return (
    <>
      <div className="space-y-3 border-b border-line/30 px-4 py-4">
        <div className="rounded-xl border border-line/30 bg-white/[0.03] p-3">
          <p className="m-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">Project summary</p>
          <p className="m-0 mt-2 text-sm text-ink">
            {hasImages
              ? hasPlacedItems
                ? `Editing page ${selectedPageIndex + 1}. Layout is ready for fine-tuning.`
                : 'Photos are loaded. Generate the layout next.'
              : 'Start by uploading photos, then generate the layout.'}
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted">
            <span className="rounded-full border border-line/30 px-2.5 py-1">{formatSavedState(saveState, lastSavedAt)}</span>
            <span className="rounded-full border border-line/30 px-2.5 py-1">Stage: {workflowStage}</span>
            {restoredFromSnapshot ? (
              <span className="rounded-full border border-line/30 px-2.5 py-1">Restored session</span>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => setSection('setup')}
            className={cn(
              'min-h-8 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] transition',
              section === 'setup' ? 'bg-amber-400/15 text-amber-200' : 'bg-white/[0.02] text-muted hover:text-ink',
            )}
          >
            Setup
          </button>
          <button
            type="button"
            onClick={() => setSection('rules')}
            className={cn(
              'min-h-8 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] transition',
              section === 'rules' ? 'bg-amber-400/15 text-amber-200' : 'bg-white/[0.02] text-muted hover:text-ink',
            )}
          >
            Rules
          </button>
          <button
            type="button"
            onClick={() => setSection('actions')}
            className={cn(
              'min-h-8 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] transition',
              section === 'actions' ? 'bg-amber-400/15 text-amber-200' : 'bg-white/[0.02] text-muted hover:text-ink',
            )}
          >
            Actions
          </button>
          <button
            type="button"
            onClick={() => setSection('insights')}
            className={cn(
              'min-h-8 rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-[0.06em] transition',
              section === 'insights' ? 'bg-amber-400/15 text-amber-200' : 'bg-white/[0.02] text-muted hover:text-ink',
            )}
          >
            Insights
          </button>
        </div>
      </div>

      {section === 'setup' ? (
        <>
      <Accordion title="Canvas" defaultOpen>
        <div className="space-y-2">
          <CanvasSizeDropdown {...canvasSize} />
          <Field label="Pagination" className="mb-0">
            <select
              className="field-input min-h-10 py-1 text-sm"
              value={paginationMode}
              onChange={(e) => setPaginationMode(e.target.value as PaginationMode)}
            >
              <option value="auto">Auto pages</option>
              <option value="assisted">Assisted pages</option>
            </select>
          </Field>
        </div>
      </Accordion>

      <Accordion title="Layout" defaultOpen={hasImages}>
        <div className="space-y-2">
          <Field label="Layout Preset" className="mb-0">
            <select
              className="field-input min-h-10 py-1 text-sm"
              value={layoutPresetId}
              onChange={(e) => setLayoutPresetId(e.target.value as LayoutPresetId)}
            >
              {LAYOUT_PRESETS.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </Field>
          {recommendedLayoutHint && (
            <p className="m-0 text-[11px] text-amber-200/80">{recommendedLayoutHint}</p>
          )}
        </div>
      </Accordion>
        </>
      ) : null}

      {section === 'rules' ? (
      <Accordion title="Sizing rules" defaultOpen={hasPlacedItems}>
        <div className="space-y-2">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Max (cm)" className="mb-0">
              <input
                className="field-input min-h-10 py-1 text-sm"
                type="number"
                min="1"
                max={CANVAS_CM}
                step="0.1"
                value={maxImageCm}
                onChange={(e) => setMaxImageCm(Math.min(CANVAS_CM, Number(e.target.value)))}
              />
            </Field>
            <Field label="Min (cm)" className="mb-0">
              <input
                className="field-input min-h-10 py-1 text-sm"
                type="number"
                min="0.5"
                max="20"
                step="0.1"
                value={minImageCm}
                onChange={(e) => setMinImageCm(Number(e.target.value))}
              />
            </Field>
          </div>

          <Field label={`Frame: ${frameMm.toFixed(1)} mm`} className="mb-0">
            <input
              className="mt-1.5 h-2 w-full accent-amber-400"
              type="range"
              min="0"
              max="10"
              step="0.5"
              value={frameMm}
              onChange={(e) => setFrameMm(Number(e.target.value))}
            />
          </Field>

          <div className="flex gap-2">
            <label className="themed-checkbox flex min-h-9 flex-1 cursor-pointer items-center gap-1.5 rounded-lg bg-[#121a2b]/82 px-2.5 py-1 text-sm font-medium text-ink/90">
              <input
                type="checkbox"
                checked={gridModeEnabled}
                onChange={(e) => setGridModeEnabled(e.target.checked)}
              />
              <span>Grid</span>
            </label>
            <label className="themed-checkbox flex min-h-9 flex-1 cursor-pointer items-center gap-1.5 rounded-lg bg-[#121a2b]/82 px-2.5 py-1 text-sm font-medium text-ink/90">
              <input
                type="checkbox"
                checked={autoCompactPages}
                onChange={(e) => setAutoCompactPages(e.target.checked)}
              />
              <span>Compact</span>
            </label>
          </div>

          <Button
            onClick={onApplyGlobalSettings}
            className="flex min-h-10 w-full items-center justify-center gap-2 px-3 py-1.5 text-sm"
          >
            <Check className="h-4 w-4" />
            Apply sizing rules
          </Button>
        </div>
        </div>
      </Accordion>
      ) : null}

      {section === 'actions' ? (
      <Accordion title="Project actions" defaultOpen>
        <div className="space-y-2">
          {paginationMode === 'assisted' && overflowCount > 0 ? (
            <Button
              onClick={onCreateNextPage}
              className="flex min-h-10 w-full items-center justify-center gap-2 px-3 py-1.5 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add next page ({overflowCount})
            </Button>
          ) : null}
          <Button
            variant="soft"
            onClick={onRemoveSelectedCanvas}
            className="flex min-h-10 w-full items-center justify-center gap-2 px-3 py-1.5 text-sm"
          >
            <Minus className="h-4 w-4" />
            Remove current page
          </Button>
          <Button
            variant="soft"
            onClick={onStartFromScratch}
            className="flex min-h-10 w-full items-center justify-center gap-2 px-3 py-1.5 text-sm"
          >
            <RotateCcw className="h-4 w-4" />
            Reset layout
          </Button>
          <Button
            variant="soft"
            onClick={onClearEverything}
            className="flex min-h-10 w-full items-center justify-center gap-2 px-3 py-1.5 text-sm text-danger hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
            Clear project
          </Button>
        </div>
      </Accordion>
      ) : null}

      {section === 'insights' ? (
      <Accordion title="Session insights" defaultOpen>
        <div className="space-y-3 text-xs text-muted">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-line/25 bg-black/10 px-3 py-2">
              <p className="m-0 text-[10px] uppercase tracking-[0.08em]">Time to first layout</p>
              <p className="m-0 mt-1 text-sm text-ink">{formatDuration(sessionInsights.timeToFirstLayoutMs)}</p>
            </div>
            <div className="rounded-lg border border-line/25 bg-black/10 px-3 py-2">
              <p className="m-0 text-[10px] uppercase tracking-[0.08em]">Time to first export</p>
              <p className="m-0 mt-1 text-sm text-ink">{formatDuration(sessionInsights.timeToFirstExportMs)}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-line/25 bg-black/10 px-3 py-2">Uploads: <span className="text-ink">{sessionMetrics.uploads}</span></div>
            <div className="rounded-lg border border-line/25 bg-black/10 px-3 py-2">Layouts: <span className="text-ink">{sessionMetrics.layoutGenerations}</span></div>
            <div className="rounded-lg border border-line/25 bg-black/10 px-3 py-2">Exports: <span className="text-ink">{sessionMetrics.exportsCompleted}</span></div>
            <div className="rounded-lg border border-line/25 bg-black/10 px-3 py-2">Mode switches: <span className="text-ink">{sessionMetrics.modeSwitches}</span></div>
            <div className="rounded-lg border border-line/25 bg-black/10 px-3 py-2">Enhance runs: <span className="text-ink">{sessionMetrics.enhancementRuns}</span></div>
            <div className="rounded-lg border border-line/25 bg-black/10 px-3 py-2">Canceled risky actions: <span className="text-ink">{sessionMetrics.destructiveCancels}</span></div>
          </div>
          <p className="m-0">
            Failures tracked — export: <span className="text-ink">{sessionMetrics.exportFailures}</span>, enhance: <span className="text-ink">{sessionMetrics.enhancementFailures}</span>.
          </p>
        </div>
      </Accordion>
      ) : null}
    </>
  );
}

// ─── Image inspector (when an image is selected) ─────────────────────────────

interface ImageInspectorProps {
  image: ImageItem;
  isEnhancing: boolean;
  isOnCanvas: boolean;
  onUpdateImage: (patch: Partial<ImageItem>) => void;
  onDeleteImage: () => void;
  onRemoveFromCanvas: () => void;
  onEnhanceImage: (preset: EnhancePreset) => void;
  onRestoreOriginalImage: () => void;
  onPlaceOnCanvas: () => void;
  onReplaceSelected: () => void;
}

function ImageInspector({
  image,
  isEnhancing,
  isOnCanvas,
  onUpdateImage,
  onDeleteImage,
  onRemoveFromCanvas,
  onEnhanceImage,
  onRestoreOriginalImage,
  onPlaceOnCanvas,
  onReplaceSelected,
}: ImageInspectorProps) {
  const { imageZoomLevels, setImageZoom, setImagePan } = useEditorUIStore();
  const [enhancePreset, setEnhancePreset] = useState<EnhancePreset>('lighting');
  const hasEnhancedVersion = image.src !== image.originalSrc;
  const zoom = imageZoomLevels[image.id] ?? 1;

  return (
    <div className="flex flex-col">
      {/* Image header */}
      <div className="flex items-center gap-3 border-b border-line/30 px-4 py-3">
        <img
          src={image.src}
          alt={image.fileName}
          className="h-12 w-12 flex-shrink-0 rounded-lg object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-ink">{image.fileName}</p>
          <p className="text-xs text-muted">
            {image.naturalWidth} × {image.naturalHeight} px
          </p>
        </div>
        <span
          className={cn(
            'flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold',
            isOnCanvas
              ? 'bg-green-500/15 text-green-400'
              : 'bg-amber-500/15 text-amber-400',
          )}
        >
          {isOnCanvas ? 'On a page' : 'Library only'}
        </span>
      </div>

      <div className="scrollbar-themed flex-1 overflow-y-auto">
        <div className="border-b border-line/30 px-4 py-3">
          <p className="m-0 text-xs text-muted">
            Use <span className="font-semibold text-ink/90">Edit mode</span> for move and resize. Switch to <span className="font-semibold text-ink/90">Crop mode</span> on the canvas when you want to reframe the photo.
          </p>
        </div>

        <Accordion title="Photo rules" defaultOpen>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Max W (cm)" className="mb-0">
                <input
                  className="field-input py-0.5 text-sm"
                  type="number"
                  min="1"
                  max={CANVAS_CM}
                  step="0.1"
                  value={image.maxWidthCm}
                  onChange={(e) =>
                    onUpdateImage({ maxWidthCm: Math.min(CANVAS_CM, Number(e.target.value)) })
                  }
                />
              </Field>
              <Field label="Max H (cm)" className="mb-0">
                <input
                  className="field-input py-0.5 text-sm"
                  type="number"
                  min="1"
                  max={CANVAS_CM}
                  step="0.1"
                  value={image.maxHeightCm}
                  onChange={(e) =>
                    onUpdateImage({ maxHeightCm: Math.min(CANVAS_CM, Number(e.target.value)) })
                  }
                />
              </Field>
            </div>

            <label className="themed-checkbox flex cursor-pointer items-center gap-2 text-sm text-ink/90">
              <input
                type="checkbox"
                checked={image.frameEnabled}
                onChange={(e) => onUpdateImage({ frameEnabled: e.target.checked })}
              />
              <span>Frame enabled</span>
            </label>
          </div>
        </Accordion>

        <Accordion title="Crop zoom" defaultOpen={false}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-muted">Zoom: {zoom.toFixed(2)}×</label>
              {zoom > 1 && (
                <button
                  className="text-xs text-amber-400 underline"
                  onClick={() => {
                    setImageZoom(image.id, 1);
                    setImagePan(image.id, 0, 0);
                  }}
                >
                  Reset
                </button>
              )}
            </div>
            <input
              className="w-full h-1.5 accent-amber-400"
              type="range"
              min="1"
              max="3"
              step="0.05"
              value={zoom}
              onChange={(e) => {
                const v = Number(e.target.value);
                setImageZoom(image.id, v);
                if (v === 1) setImagePan(image.id, 0, 0);
              }}
            />
            {zoom > 1 && (
              <p className="text-[10px] text-muted">
                In Crop mode, drag the photo directly on the canvas to pan it
              </p>
            )}
          </div>
        </Accordion>

        <Accordion title="Auto Enhance" defaultOpen={false}>
          <div className="space-y-2">
            <p className="text-[11px] text-muted/90">Subtle, content-preserving adjustments.</p>
            <select
              className="field-input w-full py-0.5 text-sm"
              value={enhancePreset}
              onChange={(e) => setEnhancePreset(e.target.value as EnhancePreset)}
            >
              {(Object.keys(ENHANCE_PRESET_LABELS) as EnhancePreset[]).map((key) => (
                <option key={key} value={key}>
                  {ENHANCE_PRESET_LABELS[key]}
                </option>
              ))}
            </select>
            <button
              disabled={isEnhancing}
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-violet-500/15 py-2 text-sm text-violet-300 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => onEnhanceImage(enhancePreset)}
            >
              {isEnhancing ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Enhancing…</>
              ) : (
                <><Sparkles className="h-3.5 w-3.5" /> Apply</>
              )}
            </button>
            {hasEnhancedVersion && (
              <button
                disabled={isEnhancing}
                className="w-full rounded-md border border-line/25 bg-white/5 py-1.5 text-xs text-ink/85 hover:bg-white/10 disabled:opacity-50"
                onClick={onRestoreOriginalImage}
              >
                Restore original
              </button>
            )}
          </div>
        </Accordion>

        <Accordion title="Page actions" defaultOpen>
          <div className="space-y-2">
            <button
              className="flex min-h-10 w-full items-center justify-center rounded-md border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/20"
              onClick={onPlaceOnCanvas}
            >
              Add to current page
            </button>
            <button
              className="flex min-h-10 w-full items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20"
              onClick={onReplaceSelected}
            >
              Replace active image
            </button>

            {isOnCanvas && (
              <button
                className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md bg-amber-500/10 py-1.5 text-sm text-amber-300 hover:bg-amber-500/20"
                onClick={onRemoveFromCanvas}
              >
                <X className="h-4 w-4" />
                Remove from current page
              </button>
            )}

            <div className="pt-1">
              <button
                className="flex min-h-10 w-full items-center justify-center rounded-md bg-red-500/10 py-1.5 text-sm text-red-400 hover:bg-red-500/20"
                onClick={onDeleteImage}
              >
                Delete from library
              </button>
            </div>
          </div>
        </Accordion>
      </div>
    </div>
  );
}

// ─── Right Inspector Panel ────────────────────────────────────────────────────

export function RightInspectorPanel({
  selectedImageId,
  images,
  pages,
  onUpdateImage,
  onDeleteImage,
  onRemoveFromCanvas,
  onEnhanceImage,
  onRestoreOriginalImage,
  enhancingImageIds,
  onPlaceImageOnCanvas,
  onReplaceSelectedImage,
  onShowProjectView,
  isOpen,
  onClose,
  ...layoutControls
}: RightInspectorPanelProps) {
  // Determine which image to show in the inspector
  const { drawerSelectedImageId, setDrawerSelectedImageId } = useEditorUIStore();
  const inspectorId = selectedImageId ?? drawerSelectedImageId;
  const inspectorImage = inspectorId ? images.find((img) => img.id === inspectorId) ?? null : null;

  const usedImageIds = new Set<string>();
  pages.forEach((page) => page.items.forEach((item) => usedImageIds.add(item.imageId)));

  const panelContent = (
    <div className="scrollbar-themed flex h-full flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-line/30 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-1 rounded-lg border border-line/30 bg-white/[0.02] p-1">
          <button
            type="button"
            className={cn(
              'min-h-8 rounded-md px-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] transition',
              !inspectorImage
                ? 'bg-amber-400/15 text-amber-200'
                : 'text-muted hover:text-ink',
            )}
            onClick={() => {
              setDrawerSelectedImageId(null);
              onShowProjectView();
            }}
          >
            Project
          </button>
          <span
            className={cn(
              'min-h-8 max-w-[150px] truncate rounded-md px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.06em]',
              inspectorImage
                ? 'bg-cyan-400/12 text-cyan-100'
                : 'text-muted/70',
            )}
            title={inspectorImage ? inspectorImage.fileName : 'No image selected'}
          >
            {inspectorImage ? `Image: ${inspectorImage.fileName}` : 'Image'}
          </span>
        </div>
        {/* Close button — mobile only */}
        <button
          className="rounded-md p-1.5 text-muted hover:bg-white/5 hover:text-ink md:hidden"
          onClick={onClose}
          aria-label="Close inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Content: image inspector or layout controls */}
      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto">
        {inspectorImage ? (
          <ImageInspector
            image={inspectorImage}
            isEnhancing={enhancingImageIds.has(inspectorImage.id)}
            isOnCanvas={usedImageIds.has(inspectorImage.id)}
            onUpdateImage={(patch) => onUpdateImage(inspectorImage.id, patch)}
            onDeleteImage={() => onDeleteImage(inspectorImage.id)}
            onRemoveFromCanvas={() => onRemoveFromCanvas(inspectorImage.id)}
            onEnhanceImage={(preset) => void onEnhanceImage(inspectorImage.id, preset)}
            onRestoreOriginalImage={() => void onRestoreOriginalImage(inspectorImage.id)}
            onPlaceOnCanvas={() => onPlaceImageOnCanvas(inspectorImage.id)}
            onReplaceSelected={() => onReplaceSelectedImage(inspectorImage.id)}
          />
        ) : (
          <LayoutInspector {...layoutControls} />
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: always-visible right panel */}
      <aside className="scrollbar-themed hidden w-[248px] flex-shrink-0 border-l border-line/30 bg-[#0a0f1a]/95 backdrop-blur-md md:flex md:flex-col lg:w-[288px] xl:w-[320px]">
        {panelContent}
      </aside>

      {/* Mobile: overlay sheet (from right) */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-overlay bg-black/50 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />
          <aside className="scrollbar-themed fixed inset-y-0 right-0 z-drawer flex w-[min(86vw,340px)] flex-col border-l border-line/20 bg-[#0a0f1a]/98 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
            {panelContent}
          </aside>
        </>
      )}
    </>
  );
}
