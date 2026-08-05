import type { HistoryPoint } from "@/hooks/useMetabolismSimulation";
import { HISTORY_WINDOW_HOURS } from "@/lib/metabolism/config";

export function Sparkline({ points }: { points: HistoryPoint[] }) {
  const w = 300;
  const h = 56;
  const end = points.length ? (points[points.length - 1]?.t ?? 0) : 0;
  const start = Math.max(0, end - HISTORY_WINDOW_HOURS);
  const span = Math.max(end - start, 0.5);
  const d = points
    .map((p, i) => {
      const x = ((p.t - start) / span) * w;
      const y = h - p.ratio * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span className="uppercase tracking-widest">Energy history</span>
        <span className="numeric">last {Math.min(HISTORY_WINDOW_HOURS, Math.ceil(span))}h</span>
      </div>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        preserveAspectRatio="none"
        className="h-14 w-full rounded-md border border-border bg-card/60"
        role="img"
        aria-label={`Glycogen history over the last ${Math.ceil(span)} simulated hours`}
      >
        {[0.25, 0.5, 0.75].map((g) => (
          <line key={g} x1="0" x2={w} y1={h * g} y2={h * g} stroke="var(--grid)" strokeWidth="1" />
        ))}
        {d && <path d={d} fill="none" stroke="var(--energy)" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      </svg>
    </div>
  );
}