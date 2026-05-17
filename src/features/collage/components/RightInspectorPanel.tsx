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

// ─── Layout controls (default inspector state) ────────────────────────────────

function LayoutInspector({
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
}: LayoutControlsProps) {
  return (
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

      <Accordion title="Layout" defaultOpen>
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

      <Accordion title="Sizing" defaultOpen>
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
            Apply Constraints
          </Button>
        </div>
      </Accordion>

      <Accordion title="Project" defaultOpen>
        <div className="space-y-2">
          {paginationMode === 'assisted' && overflowCount > 0 ? (
            <Button
              onClick={onCreateNextPage}
              className="flex min-h-10 w-full items-center justify-center gap-2 px-3 py-1.5 text-sm"
            >
              <Plus className="h-4 w-4" />
              Next Page ({overflowCount})
            </Button>
          ) : null}
          <Button
            variant="soft"
            onClick={onRemoveSelectedCanvas}
            className="flex min-h-10 w-full items-center justify-center gap-2 px-3 py-1.5 text-sm"
          >
            <Minus className="h-4 w-4" />
            Remove Canvas
          </Button>
          <Button
            variant="soft"
            onClick={onStartFromScratch}
            className="flex min-h-10 w-full items-center justify-center gap-2 px-3 py-1.5 text-sm"
          >
            <RotateCcw className="h-4 w-4" />
            Start Fresh
          </Button>
          <Button
            variant="soft"
            onClick={onClearEverything}
            className="flex min-h-10 w-full items-center justify-center gap-2 px-3 py-1.5 text-sm text-danger hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
            Clear All
          </Button>
        </div>
      </Accordion>
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
          {isOnCanvas ? '✓ On canvas' : 'Not placed'}
        </span>
      </div>

      <div className="scrollbar-themed flex-1 overflow-y-auto">
        {/* Constraints */}
        <Accordion title="Constraints" defaultOpen>
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

        {/* Zoom */}
        <Accordion title="Zoom / Pan" defaultOpen={false}>
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

        {/* Enhance */}
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

        {/* Placement */}
        <Accordion title="Placement" defaultOpen>
          <div className="space-y-2">
            <button
              className="flex min-h-10 w-full items-center justify-center rounded-md border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 hover:bg-amber-500/20"
              onClick={onPlaceOnCanvas}
            >
              Place on canvas
            </button>
            <button
              className="flex min-h-10 w-full items-center justify-center rounded-md border border-cyan-300/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200 hover:bg-cyan-500/20"
              onClick={onReplaceSelected}
            >
              Replace selected
            </button>

            {isOnCanvas && (
              <button
                className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-md bg-amber-500/10 py-1.5 text-sm text-amber-300 hover:bg-amber-500/20"
                onClick={onRemoveFromCanvas}
              >
                <X className="h-4 w-4" />
                Remove from canvas
              </button>
            )}

            <div className="pt-1">
              <button
                className="flex min-h-10 w-full items-center justify-center rounded-md bg-red-500/10 py-1.5 text-sm text-red-400 hover:bg-red-500/20"
                onClick={onDeleteImage}
              >
                Delete image
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
        {inspectorImage ? (
          <button
            className="flex items-center gap-1.5 text-xs text-muted hover:text-ink"
            onClick={() => setDrawerSelectedImageId(null)}
          >
            ← Layout
          </button>
        ) : (
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Inspector
          </span>
        )}
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
      <aside className="scrollbar-themed hidden w-[272px] flex-shrink-0 border-l border-line/30 bg-[#0a0f1a]/95 backdrop-blur-md md:flex md:flex-col">
        {panelContent}
      </aside>

      {/* Mobile: overlay sheet (from right) */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />
          <aside className="scrollbar-themed fixed inset-y-0 right-0 z-50 flex w-[280px] flex-col border-l border-line/20 bg-[#0a0f1a]/98 md:hidden">
            {panelContent}
          </aside>
        </>
      )}
    </>
  );
}
