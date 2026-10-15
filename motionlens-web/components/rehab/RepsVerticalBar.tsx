// Reps count beside a tall vertical position bar, in the same style as
// the RepCountShell depth bar: the fill rises from the start end of the
// movement (bottom) to the far end (top) as the body part moves, so the
// patient sees each rep go up and come back down. Count-only: no
// angles or raw values are shown.

export function RepsVerticalBar({
  reps,
  target,
  fraction,
  label = "Reps",
}: {
  reps: number;
  /** Heading over the count. */
  label?: string;
  /** Omit for sessions without a rep target (e.g. timed cycling). */
  target?: number;
  /** 0 = start end, 1 = far end; null while the body part isn't seen. */
  fraction: number | null;
}) {
  const pct = fraction === null ? 0 : Math.min(100, Math.max(0, fraction * 100));
  return (
    <div className="flex items-stretch gap-4">
      <div className="flex flex-col justify-center">
        <p className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</p>
        <p className="tabular mt-1 text-5xl font-semibold leading-none">{reps}</p>
        {target != null && (
          <p className="tabular mt-1 text-lg text-muted">/ {target}</p>
        )}
      </div>
      <div className="flex flex-1 items-stretch gap-3">
        <div className="relative h-48 w-12 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-950">
          <div
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-orange-500 to-amber-300 transition-[height] duration-150"
            style={{ height: `${pct}%` }}
          />
          <div className="absolute inset-x-0 top-0 h-[2px] bg-emerald-400/70" />
        </div>
        <div className="flex flex-col justify-between py-1 text-[11px] text-muted">
          <span>Far end</span>
          <span className="text-amber-300">{fraction === null ? "Not in view" : ""}</span>
          <span>Start</span>
        </div>
      </div>
    </div>
  );
}
