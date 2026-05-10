import { Panel } from '../../../shared/ui/Panel';
import { Field } from '../../../shared/ui/Field';
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
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}
