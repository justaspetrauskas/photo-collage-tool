import { Field } from '../../../shared/ui/Field';
import { Button } from '../../../shared/ui/Button';
import type { ImageItem, PageLayout } from '../model/types';
import { useState, useRef } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useEditorUIStore } from '../store/editorUIStore';
import { useDrag } from '@use-gesture/react';

interface ImageDrawerProps {
  images: ImageItem[];
  pages: PageLayout[];
  onUpdateImage: (id: string, patch: Partial<ImageItem>) => void;
}

interface ImageDrawerCardProps {
  image: ImageItem;
  isUsed: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onUpdateImage: (patch: Partial<ImageItem>) => void;
}

function ImageDrawerCard({ image, isUsed, isSelected, onSelect, onUpdateImage }: ImageDrawerCardProps) {
  const { imageZoomLevels, setImageZoom, imagePanOffsets, setImagePan } = useEditorUIStore();
  const imgContainerRef = useRef<HTMLDivElement>(null);

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
      className={`rounded-lg transition overflow-hidden border-2 ${
        isSelected ? 'bg-[#121a2b] border-amber-400/60' : 'bg-[#121a2b]/60 hover:bg-[#121a2b] border-line/20'
      }`}
      onClick={onSelect}
    >
      {/* Zoomable/Pannable thumbnail — only the image content zooms, not the card */}
      <div ref={imgContainerRef} className="relative overflow-hidden bg-[#000000]/40 aspect-square select-none">
        <img
          {...bind()}
          src={image.src}
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
            <input className="field-input py-0.5 text-xs" type="number" min="1" max="20" step="0.1"
              value={image.maxWidthCm}
              onChange={(e) => onUpdateImage({ maxWidthCm: Number(e.target.value) })} />
          </Field>
          <Field label="Max H" className="mb-0">
            <input className="field-input py-0.5 text-xs" type="number" min="1" max="20" step="0.1"
              value={image.maxHeightCm}
              onChange={(e) => onUpdateImage({ maxHeightCm: Number(e.target.value) })} />
          </Field>
        </div>

        <label className="flex items-center gap-2 text-xs text-ink/90 cursor-pointer pt-1">
          <input className="h-3 w-3 rounded border-line text-accent focus:ring-accent/30" type="checkbox"
            checked={image.frameEnabled}
            onChange={(e) => onUpdateImage({ frameEnabled: e.target.checked })} />
          <span>Frame</span>
        </label>

        {/* Crop Sliders */}
        {(image.cropMaxOffsetX > 0 || image.cropMaxOffsetY > 0) && (
          <div className="space-y-2 pt-2.5 border-t border-line/10">
            {image.cropMaxOffsetX > 0 && (
              <div className="text-xs">
                <label className="block text-muted mb-1.5">H: {Math.round(image.offsetX)} / {Math.round(image.cropMaxOffsetX)}</label>
                <input className="w-full h-1 accent-amber-400" type="range"
                  min={0} max={Math.max(0, Math.round(image.cropMaxOffsetX))} step={1}
                  value={Math.round(image.offsetX)}
                  onChange={(e) => onUpdateImage({ offsetX: Number(e.target.value) })} />
              </div>
            )}
            {image.cropMaxOffsetY > 0 && (
              <div className="text-xs">
                <label className="block text-muted mb-1.5">V: {Math.round(image.offsetY)} / {Math.round(image.cropMaxOffsetY)}</label>
                <input className="w-full h-1 accent-amber-400" type="range"
                  min={0} max={Math.max(0, Math.round(image.cropMaxOffsetY))} step={1}
                  value={Math.round(image.offsetY)}
                  onChange={(e) => onUpdateImage({ offsetY: Number(e.target.value) })} />
              </div>
            )}
            <Button variant="soft" className="w-full py-1.5 text-xs"
              onClick={() => onUpdateImage({ offsetX: 0, offsetY: 0 })}>
              Reset Crop
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export function ImageDrawer({ images, pages, onUpdateImage }: ImageDrawerProps) {
  const [collapsed, setCollapsed] = useState(false);
  const { drawerSelectedImageId, setDrawerSelectedImageId } = useEditorUIStore();

  const usedImageIds = new Set<string>();
  pages.forEach((page) => page.items.forEach((item) => usedImageIds.add(item.imageId)));

  return (
    <div
      className={`fixed right-0 top-0 bottom-0 bg-[#0a0f1a]/95 backdrop-blur-sm border-l border-line/20 transition-all duration-300 z-40 overflow-hidden flex flex-col shadow-[-8px_0_24px_rgba(0,0,0,0.4)] ${
        collapsed ? 'w-12' : 'w-[28vw] min-w-[400px]'
      }`}
    >
      <button
        onClick={() => setCollapsed((v) => !v)}
        className="flex-shrink-0 h-12 border-b border-line/20 flex items-center justify-center hover:bg-amber-500/10 transition"
      >
        {collapsed ? <ChevronLeft className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
      </button>

      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-3">
            <div className="flex items-center justify-between px-2 mb-4">
              <h3 className="text-sm font-semibold">Images ({images.length})</h3>
              <span className="text-xs text-amber-300">{usedImageIds.size} used</span>
            </div>

            {images.length === 0 ? (
              <p className="text-xs text-muted text-center py-4">No images uploaded yet</p>
            ) : (
              <div className="space-y-3">
                {images.map((image) => (
                  <ImageDrawerCard
                    key={image.id}
                    image={image}
                    isUsed={usedImageIds.has(image.id)}
                    isSelected={drawerSelectedImageId === image.id}
                    onSelect={() => setDrawerSelectedImageId(image.id)}
                    onUpdateImage={(patch) => onUpdateImage(image.id, patch)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


