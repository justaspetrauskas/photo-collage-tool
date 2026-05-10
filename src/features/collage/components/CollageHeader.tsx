import { CANVAS_CM, CANVAS_SIZE_PX } from '../model/constants';

export function CollageHeader() {
  return (
    <header className="animate-fade-up">
      <p className="m-0 text-[0.72rem] uppercase tracking-[0.2em] text-accent">Print Layout Studio</p>
      <h1 className="m-0.5 font-display text-[clamp(1.7rem,4vw,2.7rem)] tracking-[0.03em] text-ink">
        Photo Collage Generator
      </h1>
      <p className="m-0 text-sm text-muted">
        {CANVAS_CM}cm x {CANVAS_CM}cm at 300 DPI ({CANVAS_SIZE_PX}px)
      </p>
    </header>
  );
}
