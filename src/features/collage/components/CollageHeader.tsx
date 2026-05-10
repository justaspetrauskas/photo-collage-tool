import { CANVAS_CM, CANVAS_SIZE_PX } from '../model/constants';

export function CollageHeader() {
  return (
    <header className="animate-fade-up">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-5 sm:px-8 sm:py-6">
        <h1 className="m-0 font-display text-[clamp(1.4rem,3.1vw,2.1rem)] font-black tracking-[0.02em] text-ink">
          collage-io
        </h1>
        <p className="m-0 text-sm text-muted">
          {CANVAS_CM}cm x {CANVAS_CM}cm at 300 DPI ({CANVAS_SIZE_PX}px)
        </p>
      </div>
    </header>
  );
}
