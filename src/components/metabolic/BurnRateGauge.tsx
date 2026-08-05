import { InfoPopover } from "./InfoPopover";

interface Props {
  restingPerHour: number;
  activityPerHour: number;
  basalPerDay: number;
}

export function BurnRateGauge({ restingPerHour, activityPerHour, basalPerDay }: Props) {
  const total = restingPerHour + activityPerHour;
  // Scale: resting rate = 1/3 of the arc, so activity has room to push it up.
  const max = Math.max(restingPerHour * 3, 1);
  const pct = Math.min(total / max, 1);
  const r = 30;
  const c = Math.PI * r; // half circle

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4">
      <div className="mb-1 flex items-center gap-1">
        <span className="text-xs uppercase tracking-widest text-muted-foreground">
          Metabolic rate
        </span>
        <InfoPopover
          title="Metabolic rate"
          body="Your basal metabolic rate is what your body burns at complete rest. The burn rate is what you are spending right now — resting burn plus any activity in progress."
        />
      </div>
      <div className="flex items-center gap-4">
        <svg
          viewBox="0 0 72 44"
          className="h-20 w-28 shrink-0"
          role="meter"
          aria-label={`Current burn rate ${Math.round(total)} kcal per hour`}
          aria-valuenow={Math.round(total)}
          aria-valuemin={0}
          aria-valuemax={Math.round(max)}
        >
          <path
            d={`M6 38 A ${r} ${r} 0 0 1 66 38`}
            fill="none"
            stroke="var(--grid)"
            strokeWidth="7"
            strokeLinecap="round"
          />
          <path
            d={`M6 38 A ${r} ${r} 0 0 1 66 38`}
            fill="none"
            stroke="var(--energy)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            style={{ transition: "stroke-dashoffset 300ms linear" }}
          />
          {/* basal reference tick at 1/3 of the arc */}
          <line x1="36" y1="4" x2="36" y2="12" stroke="var(--muted-foreground)" strokeWidth="1.2" />
          <text
            x="36"
            y="36"
            textAnchor="middle"
            className="numeric"
            fontSize="13"
            fill="currentColor"
          >
            {Math.round(total)}
          </text>
        </svg>
        <dl className="grid flex-1 grid-cols-1 gap-1 text-xs">
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Basal (BMR)</dt>
            <dd className="numeric font-semibold">{Math.round(basalPerDay)} kcal/day</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Resting burn</dt>
            <dd className="numeric font-semibold">{Math.round(restingPerHour)} kcal/h</dd>
          </div>
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">Activity burn</dt>
            <dd className="numeric font-semibold">{Math.round(activityPerHour)} kcal/h</dd>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-border pt-1">
            <dt className="text-foreground">Current burn rate</dt>
            <dd className="numeric font-semibold text-primary">{Math.round(total)} kcal/h</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}