import { Field } from '../../../shared/ui/Field';
import type { ImageItem, PageLayout } from '../model/types';
import { CANVAS_CM } from '../model/constants';
import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronLeft, UploadCloud, ChevronDown, ChevronUp, Trash2, X, Sparkles, Loader2, GripVertical } from 'lucide-react';
import { type EnhancePreset, ENHANCE_PRESET_LABELS } from '../lib/openaiImageEdit';
import { useEditorUIStore } from '../store/editorUIStore';
import { useDrag } from '@use-gesture/react';
import { CollageControls, type CollageControlsProps } from './CollageControls';
import type { ChangeEvent } from 'react';

const MAX_IMAGES = 24;

interface ImageDrawerProps {
  images: ImageItem[];
  pages: PageLayout[];
  onUpdateImage: (id: string, patch: Partial<ImageItem>) => void;
  onDeleteImage: (id: string) => void;
  onRemoveFromCanvas: (id: string) => void;
  onEnhanceImage: (id: string, preset: EnhancePreset) => Promise<void>;
  onRestoreOriginalImage: (id: string) => Promise<void>;
  onEnhanceAll: (preset: EnhancePreset) => Promise<void>;
  enhancingImageIds: Set<string>;
  onBeginManualPlacementDrag: (id: string) => void;
  onEndManualPlacementDrag: () => void;
  onUploadFiles: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onUploadFileList: (files: File[]) => Promise<void>;
  sceneControls: CollageControlsProps;
}

interface ImageDrawerCardProps {
  image: ImageItem;
  isUsed: boolean;
  isSelected: boolean;
  isEnhancing: boolean;
  cardRef?: (node: HTMLDivElement | null) => void;
  onSelect: () => void;
  onUpdateImage: (patch: Partial<ImageItem>) => void;
  onDelete: () => void;
  onRemoveFromCanvas: () => void;
  onEnhance: (preset: EnhancePreset) => void;
  onRestoreOriginal: () => void;
  onBeginManualPlacementDrag: (id: string) => void;
  onEndManualPlacementDrag: () => void;
  showPlacementHints: boolean;
}

function ImageDrawerCard({ image, isUsed, isSelected, isEnhancing, cardRef, onSelect, onUpdateImage, onDelete, onRemoveFromCanvas, onEnhance, onRestoreOriginal, onBeginManualPlacementDrag, onEndManualPlacementDrag, showPlacementHints }: ImageDrawerCardProps) {
  const [enhancePreset, setEnhancePreset] = useState<EnhancePreset>('lighting');
  const [showBefore, setShowBefore] = useState(false);
  const { imageZoomLevels, setImageZoom, imagePanOffsets, setImagePan } = useEditorUIStore();
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const hasEnhancedVersion = image.src !== image.originalSrc;
  const previewSrc = showBefore && hasEnhancedVersion ? image.originalSrc : image.src;

  const zoom = imageZoomLevels[image.id] ?? 1;
  const pan = imagePanOffsets[image.id] ?? { x: 0, y: 0 };

  const bind = useDrag(
    ({ offset: [x, y], event }) => {
      event.stopPropagation();
      const cw = imgContainerRef.current?.clientWidth ?? 400;
      const maxPan = (cw * (zoom - 1)) / 2;
      setImagePan(image.id, Math.max(-maxPan, Math.min(maxPan, x)), Math.max(-maxPan, Math.min(maxPan, y)));
    },
    {
      from: () => [pan.x, pan.y],
      enabled: zoom > 1,
      preventDefault: true,
    },
  );

  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      className={`rounded-lg transition overflow-hidden border-2 ${
        isSelected ? 'bg-[#121a2b] border-amber-400/60' : 'bg-[#121a2b]/60 hover:bg-[#121a2b] border-line/20'
      }`}
      onClick={onSelect}
    >
      {/* Zoomable/Pannable thumbnail — only the image content zooms, not the card */}
      <div
        ref={imgContainerRef}
        className="relative overflow-hidden bg-[#000000]/40 aspect-square select-none"
        draggable
        onDragStart={(e) => {
          e.stopPropagation();
          onBeginManualPlacementDrag(image.id);
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('application/x-collage-image-id', image.id);
          e.dataTransfer.setData('text/plain', image.id);
        }}
        onDragEnd={(e) => { e.stopPropagation(); onEndManualPlacementDrag(); }}
      >
        <img
          {...bind()}
          src={previewSrc}
          alt={image.fileName}
          className={`w-full h-full object-cover ${zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
          loading="lazy"
          draggable={false}
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: 'center',
            touchAction: 'none',
          }}
        />
        <div className={`absolute top-2 right-2 text-white text-xs font-semibold px-2.5 py-1.5 rounded-md ${isUsed ? 'bg-green-500/80' : 'bg-amber-500/60'}`}>
          {isUsed ? '✓ Used' : 'New'}
        </div>
        {zoom > 1 && (
          <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md pointer-events-none">
            {zoom.toFixed(1)}×
          </div>
        )}
        {showPlacementHints && !isUsed && (
          <div
            className="absolute left-2 top-2 flex items-center gap-1 rounded-md border border-amber-300/35 bg-black/55 px-2 py-1 text-[10px] font-semibold text-amber-100"
            title="Drag to canvas"
          >
            <GripVertical className="h-3 w-3" aria-hidden="true" />
            Drag to canvas
          </div>
        )}
        {hasEnhancedVersion && (
          <div className="absolute bottom-2 right-2 flex items-center rounded-md border border-white/20 bg-black/50 text-[10px] text-white overflow-hidden">
            <button
              className={`px-2 py-1 transition ${showBefore ? 'bg-white/15' : 'hover:bg-white/10'}`}
              onClick={(e) => { e.stopPropagation(); setShowBefore(true); }}
            >
              Before
            </button>
            <button
              className={`px-2 py-1 transition ${!showBefore ? 'bg-white/15' : 'hover:bg-white/10'}`}
              onClick={(e) => { e.stopPropagation(); setShowBefore(false); }}
            >
              After
            </button>
          </div>
        )}
      </div>

      {/* Info & Controls */}
      <div className="p-3.5 space-y-2">
        <div>
          <p className="text-xs font-semibold text-white truncate">{image.fileName}</p>
          <p className="text-xs text-muted">{image.naturalWidth} × {image.naturalHeight}</p>
        </div>

        {/* Zoom Slider */}
        <div className="text-xs">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-muted">Zoom: {zoom.toFixed(2)}×</label>
            {zoom > 1 && (
              <button
                className="text-amber-400 text-xs underline"
                onClick={(e) => { e.stopPropagation(); setImageZoom(image.id, 1); setImagePan(image.id, 0, 0); }}
              >
                Reset
              </button>
            )}
          </div>
          <input
            className="w-full h-1 accent-amber-400"
            type="range" min="1" max="3" step="0.05"
            value={zoom}
            onChange={(e) => {
              const v = Number(e.target.value);
              setImageZoom(image.id, v);
              if (v === 1) setImagePan(image.id, 0, 0);
            }}
            onClick={(e) => e.stopPropagation()}
          />
          {zoom > 1 && <p className="mt-1 text-muted">Drag image above to pan</p>}
        </div>

        {/* Max W / H */}
        <div className="grid grid-cols-2 gap-2">
          <Field label="Max W" className="mb-0">
            <input className="field-input py-0.5 text-xs" type="number" min="1" max={CANVAS_CM} step="0.1"
              value={image.maxWidthCm}
              onChange={(e) => onUpdateImage({ maxWidthCm: Math.min(CANVAS_CM, Number(e.target.value)) })} />
          </Field>
          <Field label="Max H" className="mb-0">
            <input className="field-input py-0.5 text-xs" type="number" min="1" max={CANVAS_CM} step="0.1"
              value={image.maxHeightCm}
              onChange={(e) => onUpdateImage({ maxHeightCm: Math.min(CANVAS_CM, Number(e.target.value)) })} />
          </Field>
        </div>

        <label className="themed-checkbox flex items-center gap-2 text-xs text-ink/90 cursor-pointer pt-1">
          <input type="checkbox"
            checked={image.frameEnabled}
            onChange={(e) => onUpdateImage({ frameEnabled: e.target.checked })} />
          <span>Frame</span>
        </label>

        {/* Action buttons */}
        <div className="flex gap-2 pt-1 border-t border-line/20">
          <button
            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 transition"
            title="Remove from canvas"
            onClick={(e) => { e.stopPropagation(); onRemoveFromCanvas(); }}
          >
            <X className="w-3.5 h-3.5" />
            Remove
          </button>
          <button
            className="flex-1 flex items-center justify-center gap-1.5 text-xs py-1.5 rounded-md bg-red-500/10 hover:bg-red-500/20 text-red-400 transition"
            title="Delete image"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete
          </button>
        </div>

        {/* Auto Enhancement */}
        <div className="pt-1 border-t border-line/20 space-y-2" onClick={(e) => e.stopPropagation()}>
          <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-muted">Auto Enhance</p>
          <p className="text-[10px] text-muted/90">Subtle, content-preserving adjustments only.</p>
          <select
            className="field-input py-0.5 text-xs w-full"
            value={enhancePreset}
            onChange={(e) => setEnhancePreset(e.target.value as EnhancePreset)}
          >
            {(Object.keys(ENHANCE_PRESET_LABELS) as EnhancePreset[]).map((key) => (
              <option key={key} value={key}>{ENHANCE_PRESET_LABELS[key]}</option>
            ))}
          </select>
          <button
            disabled={isEnhancing}
            className="w-full flex items-center justify-center gap-1.5 text-xs py-2 rounded-md bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={() => onEnhance(enhancePreset)}
          >
            {isEnhancing
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Enhancing…</>
              : <><Sparkles className="w-3.5 h-3.5" /> Apply</>}
          </button>
          {hasEnhancedVersion ? (
            <button
              disabled={isEnhancing}
              className="w-full text-xs py-1.5 rounded-md border border-line/25 bg-white/5 hover:bg-white/10 text-ink/85 transition disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={() => {
                setShowBefore(false);
                onRestoreOriginal();
              }}
            >
              Return to initial state
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function ImageDrawer({ images, pages, onUpdateImage, onDeleteImage, onRemoveFromCanvas, onEnhanceImage, onRestoreOriginalImage, onEnhanceAll, enhancingImageIds, onBeginManualPlacementDrag, onEndManualPlacementDrag, onUploadFiles, onUploadFileList, sceneControls }: ImageDrawerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [sceneCollapsed, setSceneCollapsed] = useState(false);
  const [globalPreset, setGlobalPreset] = useState<EnhancePreset>('consistent');
  const [enhancingAll, setEnhancingAll] = useState(false);
  const { drawerSelectedImageId, setDrawerSelectedImageId } = useEditorUIStore();
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [dragOver, setDragOver] = useState(false);

  // Keep selected drawer image visible when selection changes from canvas interactions.
  useEffect(() => {
    if (collapsed || !drawerSelectedImageId) {
      return;
    }

    const selectedCard = cardRefs.current[drawerSelectedImageId];
    if (!selectedCard) {
      return;
    }

    selectedCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    selectedCard.focus({ preventScroll: true });
  }, [collapsed, drawerSelectedImageId]);

  const usedImageIds = new Set<string>();
  pages.forEach((page) => page.items.forEach((item) => usedImageIds.add(item.imageId)));
  const hasPlacedItems = pages.some((page) => page.items.length > 0);

  const atLimit = images.length >= MAX_IMAGES;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (atLimit) return;
    const remaining = MAX_IMAGES - images.length;
    const files = Array.from(e.dataTransfer.files).slice(0, remaining);
    if (files.length > 0) void onUploadFileList(files);
  };

  return (
    <div
      className={`fixed right-0 top-0 bottom-0 bg-[#0a0f1a]/95 backdrop-blur-sm border-l border-line/20 transition-all duration-300 z-40 overflow-hidden flex flex-col shadow-[-8px_0_24px_rgba(0,0,0,0.4)] ${
        collapsed ? 'w-12' : 'w-[28vw] min-w-[400px]'
      }`}
    >
      {/* Drawer toggle button */}
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex-shrink-0 h-12 border-b border-line/20 flex items-center justify-center hover:bg-amber-500/10 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70"
        aria-label={collapsed ? 'Expand settings drawer' : 'Collapse settings drawer'}
      >
        {collapsed ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>

      {/* Vertical label shown only when collapsed */}
      {collapsed && (
        <div className="flex-1 flex items-center justify-center">
          <span
            className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-muted select-none"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Settings
          </span>
        </div>
      )}

      {!collapsed && (
        <div className="flex-1 overflow-y-auto flex flex-col min-h-0 scrollbar-themed">

          {/* Scene Controls Section */}
          <div className="flex-shrink-0 border-b border-line/20">
            <button
              onClick={() => setSceneCollapsed((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold hover:bg-amber-500/5 transition"
            >
              <span>Scene Controls</span>
              {sceneCollapsed ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronUp className="w-4 h-4 text-muted" />}
            </button>
            {!sceneCollapsed && (
              <div className="px-4 pb-4">
                <CollageControls {...sceneControls} />
              </div>
            )}
          </div>

          {/* Full-width divider label + Enhance All */}
          <div className="flex-shrink-0 border-b border-line/20">
            <div className="flex items-center gap-3 px-5 py-3">
              <h3 className="text-sm font-semibold">Images</h3>
              <span className="text-xs text-muted">{images.length}/{MAX_IMAGES}</span>
              {usedImageIds.size > 0 && <span className="text-xs text-amber-300 ml-auto">{usedImageIds.size} used</span>}
            </div>
            {images.length > 0 && (
              <div className="flex items-center gap-2 px-5 pb-3">
                <select
                  className="field-input py-0.5 text-xs flex-1"
                  value={globalPreset}
                  onChange={(e) => setGlobalPreset(e.target.value as EnhancePreset)}
                >
                  {(Object.keys(ENHANCE_PRESET_LABELS) as EnhancePreset[]).map((key) => (
                    <option key={key} value={key}>{ENHANCE_PRESET_LABELS[key]}</option>
                  ))}
                </select>
                <button
                  disabled={enhancingAll || enhancingImageIds.size > 0}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-violet-500/15 hover:bg-violet-500/25 text-violet-300 transition disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  onClick={async () => {
                    setEnhancingAll(true);
                    await onEnhanceAll(globalPreset);
                    setEnhancingAll(false);
                  }}
                >
                  {enhancingAll
                    ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Working…</>
                    : <><Sparkles className="w-3.5 h-3.5" /> All</>}
                </button>
              </div>
            )}
          </div>

          {/* Images list */}
          <div className="flex-1 overflow-y-auto scrollbar-themed">
            <div className="p-4 space-y-3">
              {images.length === 0 ? (
                <p className="text-xs text-muted text-center py-8">No images yet — upload below</p>
              ) : (
                images.map((image) => (
                  <ImageDrawerCard
                    key={image.id}
                    image={image}
                    isUsed={usedImageIds.has(image.id)}
                    isSelected={drawerSelectedImageId === image.id}
                    isEnhancing={enhancingImageIds.has(image.id)}
                    onSelect={() => setDrawerSelectedImageId(image.id)}
                    onUpdateImage={(patch) => onUpdateImage(image.id, patch)}
                    onDelete={() => onDeleteImage(image.id)}
                    onRemoveFromCanvas={() => onRemoveFromCanvas(image.id)}
                    onEnhance={(preset) => void onEnhanceImage(image.id, preset)}
                    onRestoreOriginal={() => void onRestoreOriginalImage(image.id)}
                    onBeginManualPlacementDrag={onBeginManualPlacementDrag}
                    onEndManualPlacementDrag={onEndManualPlacementDrag}
                    showPlacementHints={!hasPlacedItems}
                    cardRef={(node: HTMLDivElement | null) => { cardRefs.current[image.id] = node; }}
                  />
                ))
              )}
            </div>
          </div>

          {/* Upload zone — always visible at the bottom */}
          <div className="flex-shrink-0 border-t border-line/20 p-4">
            <input
              ref={uploadInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              disabled={atLimit}
              onChange={onUploadFiles}
            />
            <button
              type="button"
              disabled={atLimit}
              onClick={() => !atLimit && uploadInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); if (!atLimit) setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              className={`w-full rounded-xl border-2 border-dashed py-6 flex flex-col items-center gap-2 transition select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70 ${
                atLimit
                  ? 'border-line/20 opacity-40 cursor-not-allowed'
                : dragOver
                  ? 'border-amber-400 bg-amber-400/10 cursor-copy'
                  : 'border-line/30 hover:border-amber-400/60 hover:bg-amber-400/5 cursor-pointer'
              }`}
              aria-label="Upload photos"
            >
              <UploadCloud className={`w-7 h-7 ${dragOver ? 'text-amber-400' : 'text-muted'}`} />
              <div className="text-center">
                {atLimit ? (
                  <p className="text-xs font-medium text-muted">Limit reached ({MAX_IMAGES} photos)</p>
                ) : (
                  <>
                    <p className="text-xs font-medium text-ink/80">Upload Photos</p>
                    <p className="text-xs text-muted mt-0.5">Click or drag &amp; drop · {MAX_IMAGES - images.length} remaining</p>
                  </>
                )}
              </div>
            </button>
          </div>

        </div>
      )}
    </div>
  );
}
