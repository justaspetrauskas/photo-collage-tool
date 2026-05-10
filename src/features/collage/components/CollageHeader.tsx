import { CANVAS_CM, CANVAS_SIZE_PX } from '../model/constants';

export function CollageHeader() {
  return (
    <header className="animate-fade-up bg-[#0a1220]">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-5 sm:px-8 sm:py-6">
        <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-amber-300">Creative AI Studio</p>
        <h1 className="m-0.5 font-display text-[clamp(1.4rem,3.1vw,2.1rem)] tracking-[0.02em] text-ink">
          Workspace Scene Builder
        </h1>
        <p className="m-0 text-sm text-muted">
          {CANVAS_CM}cm x {CANVAS_CM}cm at 300 DPI ({CANVAS_SIZE_PX}px)
        </p>
      </div>
    </header>
  );
}
