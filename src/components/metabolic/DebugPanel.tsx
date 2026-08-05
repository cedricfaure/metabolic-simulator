import { CONFIG } from "@/lib/metabolism/config";
import type { Profile, SimState } from "@/lib/metabolism/engine";

export function DebugPanel({ state, profile }: { state: SimState; profile: Profile }) {
  const rows: [string, unknown][] = [
    ["G", state.G],
    ["Gcap", profile.Gcap],
    ["G/Gcap", state.G / profile.Gcap],
    ["Fat", state.Fat],
    ["Fat0", profile.Fat0],
    ["FatFloor", profile.FatFloor],
    ["K", state.K],
    ["Auto", state.Auto],
    ["D_carb", state.D_carb],
    ["D_protein", state.D_protein],
    ["D_fat", state.D_fat],
    ["hoursSinceLastFeed", state.hoursSinceLastFeed],
    ["lastMealKcal", state.lastMealKcal],
    ["activityKcalPerHour", state.activeActivity?.kcalPerHour ?? 0],
    ["activityRemainingMin", state.activeActivity?.remainingMinutes ?? 0],
    ["simulatedTime", state.simulatedTime],
    ["BMR_hr", profile.BMR_hr],
    ["LBM", profile.LBM],
  ];

  return (
    <section className="rounded-lg border border-border bg-card/60 p-3">
      <h2 className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">Debug / QA</h2>
      <div className="numeric grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{k}</span>
            <span>{typeof v === "number" ? v.toFixed(4) : String(v)}</span>
          </div>
        ))}
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-muted-foreground">Config constants</summary>
        <div className="numeric mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px] sm:grid-cols-3">
          {Object.entries(CONFIG).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <span className="text-muted-foreground">{k}</span>
              <span>{String(v)}</span>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}