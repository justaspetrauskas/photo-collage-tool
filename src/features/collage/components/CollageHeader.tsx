import { CANVAS_CM, CANVAS_SIZE_PX } from '../model/constants';

export function CollageHeader() {
  return (
    <header className="animate-fade-up rounded-2xl bg-[#0b1221]/60 px-4 py-3 shadow-panel backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="m-0 text-[0.68rem] font-semibold uppercase tracking-[0.26em] text-cyan-300">Creative AI Studio</p>
          <h1 className="m-0.5 font-display text-[clamp(1.45rem,3.2vw,2.25rem)] tracking-[0.02em] text-ink">
            Futuristic Collage Workspace
          </h1>
          <p className="m-0 text-sm text-muted">
            {CANVAS_CM}cm x {CANVAS_CM}cm at 300 DPI ({CANVAS_SIZE_PX}px)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <button className="rounded-full bg-cyan-400/12 px-3 py-1 font-semibold text-cyan-200 transition hover:bg-cyan-400/22" type="button">
            Upload
          </button>
          <button className="rounded-full bg-violet-400/12 px-3 py-1 font-semibold text-violet-200 transition hover:bg-violet-400/24" type="button">
            Settings
          </button>
          <button className="rounded-full bg-[#121b2e]/85 px-3 py-1 font-semibold text-ink/90 transition hover:bg-[#18233b]/88" type="button">
            Profile
          </button>
        </div>
      </div>
    </header>
  );
}
