import { Field } from '../../../shared/ui/Field';
import { CANVAS_SIZE_PRESETS, type CanvasSizePresetId } from '../model/constants';

export interface CanvasSizeDropdownProps {
  canvasPresetId: CanvasSizePresetId;
  setCanvasPresetId: (id: CanvasSizePresetId) => void;
  customCanvasWidthCm: number;
  setCustomCanvasWidthCm: (value: number) => void;
  customCanvasHeightCm: number;
  setCustomCanvasHeightCm: (value: number) => void;
}

const MIN_CANVAS_CM = 5;
const MAX_CANVAS_CM = 60;

export function CanvasSizeDropdown({
  canvasPresetId,
  setCanvasPresetId,
  customCanvasWidthCm,
  setCustomCanvasWidthCm,
  customCanvasHeightCm,
  setCustomCanvasHeightCm,
}: CanvasSizeDropdownProps) {
  return (
    <div className="space-y-2">
      <Field label="Canvas Size" className="mb-0">
        <select
          className="field-input min-h-11 py-1 text-sm"
          value={canvasPresetId}
          onChange={(event) => setCanvasPresetId(event.target.value as CanvasSizePresetId)}
        >
          {CANVAS_SIZE_PRESETS.map((preset) => (
            <option key={preset.id} value={preset.id}>
              {preset.label}
            </option>
          ))}
        </select>
      </Field>

      {canvasPresetId === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <Field label="Width (cm)" className="mb-0">
            <input
              className="field-input min-h-11 py-1 text-sm"
              type="number"
              min={MIN_CANVAS_CM}
              max={MAX_CANVAS_CM}
              step="0.1"
              value={customCanvasWidthCm}
              onChange={(event) =>
                setCustomCanvasWidthCm(
                  Math.max(MIN_CANVAS_CM, Math.min(MAX_CANVAS_CM, Number(event.target.value))),
                )
              }
            />
          </Field>
          <Field label="Height (cm)" className="mb-0">
            <input
              className="field-input min-h-11 py-1 text-sm"
              type="number"
              min={MIN_CANVAS_CM}
              max={MAX_CANVAS_CM}
              step="0.1"
              value={customCanvasHeightCm}
              onChange={(event) =>
                setCustomCanvasHeightCm(
                  Math.max(MIN_CANVAS_CM, Math.min(MAX_CANVAS_CM, Number(event.target.value))),
                )
              }
            />
          </Field>
        </div>
      )}
    </div>
  );
}
