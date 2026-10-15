// Segmented reps bar for the rehab sidebars: one cell per target rep,
// filled as reps are counted (e.g. 2 of 6 → two cells lit). Replaces
// the hold-timer bar, which emptied the moment a hold finished; the
// hold countdown stays in the hint text under the bar.

export function RepSegmentsBar({ reps, target }: { reps: number; target: number }) {
  const cells = Math.max(1, Math.round(target));
  const done = Math.min(cells, Math.max(0, reps));
  return (
    <div
      className={`mt-4 flex h-3 ${cells > 12 ? "gap-0.5" : "gap-1"}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={cells}
      aria-valuenow={done}
      aria-label={`${done} of ${cells} reps`}
    >
      {Array.from({ length: cells }, (_, i) => (
        <div
          key={i}
          className={`h-full flex-1 rounded-full transition-colors duration-200 ${
            i < done ? "bg-accent" : "bg-border"
          }`}
        />
      ))}
    </div>
  );
}
