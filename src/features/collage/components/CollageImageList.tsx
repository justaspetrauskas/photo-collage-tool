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
      <div className="mb-3 flex items-center justify-between">
        <h2 className="m-0 text-xl font-semibold text-ink">Image Cards</h2>
        <span className="rounded-full bg-cyan-400/12 px-3 py-1 text-xs font-semibold text-cyan-200">
          {images.length} loaded
        </span>
      </div>

      <div className="relative mt-2">
        <div className="pointer-events-none absolute inset-y-0 left-0 z-[1] w-8 bg-gradient-to-r from-[#0a1224] to-transparent sm:hidden" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[1] w-8 bg-gradient-to-l from-[#0a1224] to-transparent sm:hidden" />

        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:grid sm:overflow-visible sm:pb-0 sm:[scrollbar-width:auto] sm:[-ms-overflow-style:auto] sm:[&::-webkit-scrollbar]:block sm:grid-cols-2 xl:grid-cols-1">
          {images.map((image) => (
            <article
              key={image.id}
              className="group min-w-[84vw] snap-center overflow-hidden rounded-2xl bg-[#0d172c]/82 p-3 transition duration-200 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(15,23,42,0.65)] sm:min-w-0"
            >
            <div className="relative">
              <img className="h-40 w-full rounded-xl object-cover" src={image.src} alt={image.fileName} loading="lazy" />
              <div className="pointer-events-none absolute inset-0 rounded-xl bg-gradient-to-t from-[#05070d]/82 via-[#05070d]/28 to-transparent opacity-90" />
              <div className="absolute inset-x-2 bottom-2 flex items-center justify-between rounded-lg bg-[#090f1e]/70 px-2 py-1 backdrop-blur-sm">
                <strong className="truncate text-xs font-semibold text-white">{image.fileName}</strong>
                <span className="ml-2 text-[11px] text-cyan-200">{image.naturalWidth} x {image.naturalHeight}</span>
              </div>
            </div>

            <div className="mt-3 grid gap-2">
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

              <Field label="Max Height (cm)">
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

              <label className="mt-1 flex items-center gap-2 text-sm text-ink/90">
                <input
                  className="h-4 w-4 rounded border-line text-accent focus:ring-accent/30"
                  type="checkbox"
                  checked={image.frameEnabled}
                  onChange={(event) => onUpdateImage(image.id, { frameEnabled: event.target.checked })}
                />
                Frame enabled
              </label>

              <div className="mt-2 rounded-xl bg-[#0a1224]/78 p-2.5">
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
                  <p className="mt-1 text-xs text-muted/90">
                    No crop room yet. Generate layout first, then drag in preview or use sliders.
                  </p>
                )}
              </div>
            </div>
            </article>
          ))}
        </div>
      </div>
    </Panel>
  );
}
