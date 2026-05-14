export const DPI = 300;
export const CM_PER_INCH = 2.54;
export const CANVAS_CM = 20;
export const CANVAS_SIZE_PX = Math.round((CANVAS_CM / CM_PER_INCH) * DPI);

export const DEFAULT_MAX_IMAGE_CM = 8;
export const DEFAULT_MIN_IMAGE_CM = 3;
export const DEFAULT_FRAME_MM = 4;
export const DEFAULT_GRID_SPACING_CM = 1;

export function cmToPx(cm: number): number {
  return (cm / CM_PER_INCH) * DPI;
}

export function mmToPx(mm: number): number {
  return cmToPx(mm / 10);
}

export type CanvasSizePresetId =
  | 'square_20'
  | 'photo_10x15'
  | 'photo_13x18'
  | 'photo_15x21'
  | 'photo_20x30'
  | 'a5'
  | 'a4'
  | 'a3'
  | 'us_letter'
  | 'custom';

export interface CanvasSizePreset {
  id: CanvasSizePresetId;
  label: string;
  /** Width in cm */
  widthCm: number;
  /** Height in cm */
  heightCm: number;
}

export const CANVAS_SIZE_PRESETS: CanvasSizePreset[] = [
  { id: 'square_20', label: '20×20 cm (Square)', widthCm: 20, heightCm: 20 },
  { id: 'photo_10x15', label: '10×15 cm (4×6″ Photo)', widthCm: 10, heightCm: 15 },
  { id: 'photo_13x18', label: '13×18 cm (5×7″ Photo)', widthCm: 13, heightCm: 18 },
  { id: 'photo_15x21', label: '15×21 cm (6×8″ Photo)', widthCm: 15, heightCm: 21 },
  { id: 'photo_20x30', label: '20×30 cm (8×12″ Photo)', widthCm: 20, heightCm: 30 },
  { id: 'a5', label: 'A5 (14.8×21 cm)', widthCm: 14.8, heightCm: 21 },
  { id: 'a4', label: 'A4 (21×29.7 cm)', widthCm: 21, heightCm: 29.7 },
  { id: 'a3', label: 'A3 (29.7×42 cm)', widthCm: 29.7, heightCm: 42 },
  { id: 'us_letter', label: 'US Letter (21.6×27.9 cm)', widthCm: 21.6, heightCm: 27.9 },
  { id: 'custom', label: 'Custom', widthCm: 20, heightCm: 20 },
];

export const DEFAULT_CANVAS_PRESET_ID: CanvasSizePresetId = 'square_20';
