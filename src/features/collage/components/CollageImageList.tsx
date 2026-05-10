import { Panel } from '../../../shared/ui/Panel';
import { Field } from '../../../shared/ui/Field';
import { Button } from '../../../shared/ui/Button';
import type { ImageItem } from '../model/types';

interface CollageImageListProps {
  images: ImageItem[];
  onUpdateImage: (id: string, patch: Partial<ImageItem>) => void;
}

export function CollageImageList({ images, onUpdateImage }: CollageImageListProps) {
  return (
    <Panel className="animate-fade-up [animation-delay:180ms]">
      <h2 className="m-0 text-xl font-extrabold">Images ({images.length})</h2>
      <div className="mt-2 grid gap-2.5">
        {images.map((image) => (
          <article
            key={image.id}
            className="grid grid-cols-[78px_1fr] gap-3 rounded-xl border border-line bg-white/60 p-2"
          >
            <img className="h-[78px] w-[78px] rounded-lg object-cover" src={image.src} alt={image.fileName} loading="lazy" />
            <div>
              <strong className="text-sm font-extrabold">{image.fileName}</strong>
              <p className="mb-2 mt-0.5 text-xs text-muted">
                {image.naturalWidth} x {image.naturalHeight}px
              </p>

              <Field label="Max Width (cm)">
                <input
                  className="field-input"
                  type="number"
                  min="1"
                  max="20"
                  step="0.1"
                  value={image.maxWidthCm}
                  onChange={(event) => onUpdateImage(image.id, { maxWidthCm: Number(event.target.value) })}
                />
              </Field>

              <Field label="Max Height (cm)" className="mt-2">
                <input
                  className="field-input"
                  type="number"
                  min="1"
                  max="20"
                  step="0.1"
                  value={image.maxHeightCm}
                  onChange={(event) => onUpdateImage(image.id, { maxHeightCm: Number(event.target.value) })}
                />
              </Field>

              <label className="mt-2 flex items-center gap-2 text-sm">
                <input
                  className="h-4 w-4 rounded border-line text-accent focus:ring-accent/30"
                  type="checkbox"
                  checked={image.frameEnabled}
                  onChange={(event) => onUpdateImage(image.id, { frameEnabled: event.target.checked })}
                />
                Frame enabled
              </label>

              <div className="mt-3 rounded-lg border border-line/70 bg-paper/80 p-2">
                <p className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-muted">Crop Offsets (px)</p>
                {image.cropMaxOffsetX > 0 || image.cropMaxOffsetY > 0 ? (
                  <>
                    <Field label={`Horizontal (${image.offsetX} / ${Math.round(image.cropMaxOffsetX)})`} className="mt-2">
                      <input
                        className="w-full accent-accent"
                        type="range"
                        min={0}
                        max={Math.max(0, Math.round(image.cropMaxOffsetX))}
                        step={1}
                        value={Math.round(image.offsetX)}
                        onChange={(event) => onUpdateImage(image.id, { offsetX: Number(event.target.value) })}
                      />
                    </Field>

                    <Field label={`Vertical (${image.offsetY} / ${Math.round(image.cropMaxOffsetY)})`} className="mt-2">
                      <input
                        className="w-full accent-accent"
                        type="range"
                        min={0}
                        max={Math.max(0, Math.round(image.cropMaxOffsetY))}
                        step={1}
                        value={Math.round(image.offsetY)}
                        onChange={(event) => onUpdateImage(image.id, { offsetY: Number(event.target.value) })}
                      />
                    </Field>

                    <Button
                      variant="soft"
                      className="mt-2"
                      onClick={() => onUpdateImage(image.id, { offsetX: 0, offsetY: 0 })}
                    >
                      Reset Crop
                    </Button>
                  </>
                ) : (
                  <p className="mt-1 text-xs text-muted">
                    No crop room yet. Generate layout first, then drag in preview or use sliders.
                  </p>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}
