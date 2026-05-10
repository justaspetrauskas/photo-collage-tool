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
