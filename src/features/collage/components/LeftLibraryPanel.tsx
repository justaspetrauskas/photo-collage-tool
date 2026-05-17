import { useState, useRef, type ChangeEvent, type DragEvent } from 'react';
import { useDrag } from '@use-gesture/react';
import { UploadCloud, Sparkles, Loader2, X, GripVertical } from 'lucide-react';
import type { ImageItem, PageLayout } from '../model/types';
import { type EnhancePreset, ENHANCE_PRESET_LABELS } from '../lib/openaiImageEdit';
import { cn } from '../../../shared/lib/cn';
import { useEditorUIStore } from '../store/editorUIStore';

const MAX_IMAGES = 24;

interface LeftLibraryPanelProps {
  images: ImageItem[];
  pages: PageLayout[];
  enhancingImageIds: Set<string>;
  selectedImageId: string | null;
  onSelectImage: (id: string) => void;
  onDeleteImage: (id: string) => void;
  onRemoveFromCanvas: (id: string) => void;
  onEnhanceAll: (preset: EnhancePreset) => Promise<void>;
  onBeginManualPlacementDrag: (id: string) => void;
  onEndManualPlacementDrag: () => void;
  onUploadFiles: (event: ChangeEvent<HTMLInputElement>) => Promise<void>;
  onUploadFileList: (files: File[]) => Promise<void>;
  onPlaceImageOnCanvas: (id: string) => void;
  onReplaceSelectedImage: (id: string) => void;
  /** Mobile: whether the panel is visible as an overlay */
  isOpen: boolean;
  onClose: () => void;
}

interface LibraryCardProps {
  image: ImageItem;
  isUsed: boolean;
  isSelected: boolean;
  isEnhancing: boolean;
  onSelect: () => void;
  onBeginDrag: (id: string) => void;
  onEndDrag: () => void;
  onPlaceOnCanvas: () => void;
  onReplaceSelected: () => void;
  onRemoveFromCanvas: () => void;
  onDelete: () => void;
}

function LibraryCard({
  image,
  isUsed,
  isSelected,
  isEnhancing,
  onSelect,
  onBeginDrag,
  onEndDrag,
  onPlaceOnCanvas,
  onReplaceSelected,
  onRemoveFromCanvas,
  onDelete,
}: LibraryCardProps) {
  const { imageZoomLevels, imagePanOffsets, setImagePan } = useEditorUIStore();
  const thumbnailRef = useRef<HTMLDivElement>(null);
  const zoom = imageZoomLevels[image.id] ?? 1;
  const pan = imagePanOffsets[image.id] ?? { x: 0, y: 0 };

  const bindPan = useDrag(
    ({ offset: [x, y], event }) => {
      event.stopPropagation();
      const width = thumbnailRef.current?.clientWidth ?? 44;
      const height = thumbnailRef.current?.clientHeight ?? 44;
      const maxPanX = (width * (zoom - 1)) / 2;
      const maxPanY = (height * (zoom - 1)) / 2;
      setImagePan(
        image.id,
        Math.max(-maxPanX, Math.min(maxPanX, x)),
        Math.max(-maxPanY, Math.min(maxPanY, y)),
      );
    },
    {
      from: () => [pan.x, pan.y],
      enabled: zoom > 1,
      preventDefault: true,
    },
  );

  const handleDragStart = (e: DragEvent) => {
    e.stopPropagation();
    onBeginDrag(image.id);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('application/x-collage-image-id', image.id);
    e.dataTransfer.setData('text/plain', image.id);
  };

  const handleDragEnd = (e: DragEvent) => {
    e.stopPropagation();
    onEndDrag();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        'group flex cursor-pointer items-center gap-2.5 rounded-lg p-2 transition select-none',
        isSelected
          ? 'bg-amber-400/12 ring-1 ring-amber-400/40'
          : 'hover:bg-white/5',
      )}
      onClick={onSelect}
      onKeyDown={(e) => e.key === 'Enter' && onSelect()}
    >
      {/* Drag handle */}
      <div
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing touch-none"
        title="Drag to canvas"
        aria-label="Drag to canvas"
        onClick={(e) => e.stopPropagation()}
      >
        <GripVertical className="h-3.5 w-3.5 text-muted/50 group-hover:text-muted" />
      </div>

      {/* Thumbnail */}
      <div
        ref={thumbnailRef}
        className="relative h-11 w-11 flex-shrink-0 overflow-hidden rounded-md bg-black/40"
      >
        {isEnhancing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
          </div>
        )}
        <img
          {...bindPan()}
          src={image.src}
          alt={image.fileName}
          draggable={false}
          className={cn(
            'h-full w-full object-cover',
            zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-default',
          )}
          loading="lazy"
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: 'center',
            touchAction: 'none',
          }}
        />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-ink/90">{image.fileName}</p>
        <p className="text-[10px] text-muted">{image.naturalWidth}×{image.naturalHeight}</p>
      </div>

      {/* Used / New badge */}
      <span
        className={cn(
          'flex-shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold',
          isUsed
            ? 'bg-green-500/15 text-green-400'
            : 'bg-amber-500/15 text-amber-400',
        )}
      >
        {isUsed ? '✓' : 'New'}
      </span>

      {/* Quick actions (on hover, desktop) */}
      <div className="hidden gap-1 group-hover:flex" onClick={(e) => e.stopPropagation()}>
        {isUsed ? (
          <button
            className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-white/10 hover:text-ink"
            title="Remove from canvas"
            onClick={onRemoveFromCanvas}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : (
          <button
            className="rounded-md border border-amber-300/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300 hover:bg-amber-500/20"
            title="Place on canvas"
            onClick={onPlaceOnCanvas}
          >
            Place
          </button>
        )}
      </div>
    </div>
  );
}

export function LeftLibraryPanel({
  images,
  pages,
  enhancingImageIds,
  selectedImageId,
  onSelectImage,
  onDeleteImage,
  onRemoveFromCanvas,
  onEnhanceAll,
  onBeginManualPlacementDrag,
  onEndManualPlacementDrag,
  onUploadFiles,
  onUploadFileList,
  onPlaceImageOnCanvas,
  onReplaceSelectedImage,
  isOpen,
  onClose,
}: LeftLibraryPanelProps) {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [enhancePreset, setEnhancePreset] = useState<EnhancePreset>('consistent');
  const [enhancingAll, setEnhancingAll] = useState(false);
  const [showEnhanceRow, setShowEnhanceRow] = useState(false);

  const atLimit = images.length >= MAX_IMAGES;
  const usedImageIds = new Set<string>();
  pages.forEach((page) => page.items.forEach((item) => usedImageIds.add(item.imageId)));

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (atLimit) return;
    const remaining = MAX_IMAGES - images.length;
    const files = Array.from(e.dataTransfer.files).slice(0, remaining);
    if (files.length > 0) void onUploadFileList(files);
  };

  const panelContent = (
    <div className="scrollbar-themed flex h-full flex-col overflow-hidden">
      {/* Panel header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-line/30 px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">
            Library
          </span>
          {images.length > 0 && (
            <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
              {usedImageIds.size}/{images.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {images.length > 0 && (
            <button
              className="rounded-md p-1.5 text-muted hover:bg-white/5 hover:text-ink"
              title={showEnhanceRow ? 'Hide enhance controls' : 'Batch enhance'}
              onClick={() => setShowEnhanceRow((v) => !v)}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </button>
          )}
          {/* Close button — mobile only */}
          <button
            className="rounded-md p-1.5 text-muted hover:bg-white/5 hover:text-ink md:hidden"
            onClick={onClose}
            aria-label="Close library"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Batch enhance row */}
      {showEnhanceRow && images.length > 0 && (
        <div className="flex flex-shrink-0 items-center gap-2 border-b border-line/30 px-3 py-2">
          <select
            className="field-input flex-1 py-1 text-xs"
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
            disabled={enhancingAll || enhancingImageIds.size > 0}
            className="flex min-h-8 items-center gap-1 whitespace-nowrap rounded-md bg-violet-500/15 px-2.5 py-1 text-xs text-violet-300 hover:bg-violet-500/25 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={async () => {
              setEnhancingAll(true);
              await onEnhanceAll(enhancePreset);
              setEnhancingAll(false);
            }}
          >
            {enhancingAll ? (
              <><Loader2 className="h-3 w-3 animate-spin" /> Working…</>
            ) : (
              <><Sparkles className="h-3 w-3" /> All</>
            )}
          </button>
        </div>
      )}

      {/* Image list */}
      <div className="scrollbar-themed min-h-0 flex-1 overflow-y-auto">
        {images.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
            <UploadCloud className="h-8 w-8 text-muted/40" />
            <p className="text-xs text-muted">No images yet</p>
            <p className="text-[10px] text-muted/60">Upload below to get started</p>
          </div>
        ) : (
          <div className="p-2 space-y-0.5">
            {images.map((image) => (
              <LibraryCard
                key={image.id}
                image={image}
                isUsed={usedImageIds.has(image.id)}
                isSelected={selectedImageId === image.id}
                isEnhancing={enhancingImageIds.has(image.id)}
                onSelect={() => onSelectImage(image.id)}
                onBeginDrag={onBeginManualPlacementDrag}
                onEndDrag={onEndManualPlacementDrag}
                onPlaceOnCanvas={() => onPlaceImageOnCanvas(image.id)}
                onReplaceSelected={() => onReplaceSelectedImage(image.id)}
                onRemoveFromCanvas={() => onRemoveFromCanvas(image.id)}
                onDelete={() => onDeleteImage(image.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Upload zone */}
      <div className="flex-shrink-0 border-t border-line/30 p-3">
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
          onDragOver={(e) => {
            e.preventDefault();
            if (!atLimit) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={cn(
            'flex w-full select-none items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/70',
            atLimit
              ? 'cursor-not-allowed border-line/20 text-muted/50 opacity-40'
              : dragOver
                ? 'cursor-copy border-amber-400 bg-amber-400/10 text-amber-300'
                : 'cursor-pointer border-line/30 text-muted hover:border-amber-400/50 hover:bg-amber-400/5 hover:text-ink/70',
          )}
          aria-label="Upload photos"
        >
          <UploadCloud className="h-4 w-4" />
          {atLimit ? (
            <span>Limit reached ({MAX_IMAGES})</span>
          ) : (
            <span>
              {images.length === 0 ? 'Upload photos' : 'Add photos'}
              {' '}
              <span className="text-muted/60">· {MAX_IMAGES - images.length} left</span>
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop: always-visible left panel */}
      <aside className="scrollbar-themed hidden w-[240px] flex-shrink-0 border-r border-line/30 bg-[#0a0f1a]/95 backdrop-blur-md md:flex md:flex-col">
        {panelContent}
      </aside>

      {/* Mobile: overlay sheet */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
            onClick={onClose}
          />
          <aside className="scrollbar-themed fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-line/20 bg-[#0a0f1a]/98 md:hidden">
            {panelContent}
          </aside>
        </>
      )}
    </>
  );
}
