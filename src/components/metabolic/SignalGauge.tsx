import { InfoPopover } from "./InfoPopover";
import { GAUGE_ACTIVE_THRESHOLD } from "@/lib/metabolism/config";

interface Props {
  label: string;
  value: number;
  color: "ketosis" | "autophagy";
  info: string;
  trend: "rising" | "falling" | "steady";
}

export function SignalGauge({ label, value, color, info, trend }: Props) {
  const active = value >= GAUGE_ACTIVE_THRESHOLD;
  const stroke = color === "ketosis" ? "var(--ketosis)" : "var(--autophagy)";
  const r = 26;
  const c = 2 * Math.PI * r;

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card/60 p-3">
      <svg
        viewBox="0 0 64 64"
        className="h-16 w-16 shrink-0"
        style={{ filter: active ? `drop-shadow(0 0 8px ${stroke})` : "none" }}
        role="meter"
        aria-label={`${label} level ${Math.round(value)} of 100, ${trend}`}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--grid)" strokeWidth="6" />
        <circle
          cx="32"
          cy="32"
          r={r}
          fill="none"
          stroke={stroke}
          strokeOpacity={active ? 1 : 0.3}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          transform="rotate(-90 32 32)"
          style={{ transition: "stroke-dashoffset 300ms linear" }}
        />
        <text
          x="32"
          y="37"
          textAnchor="middle"
          className="numeric"
          fontSize="15"
          fill="currentColor"
          opacity={active ? 1 : 0.5}
        >
          {Math.round(value)}
        </text>
      </svg>
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span
            className={`text-sm font-medium ${active ? "text-foreground" : "text-muted-foreground"}`}
          >
            {label}
          </span>
          <InfoPopover title={label} body={info} />
        </div>
        <p className="text-xs text-muted-foreground">
          {active ? (trend === "rising" ? "Rising" : trend === "falling" ? "Falling" : "Active") : "Inactive"}
        </p>
      </div>
    </div>
  );
}