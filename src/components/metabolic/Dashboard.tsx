import { useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, RotateCcw, Save, Undo2, UtensilsCrossed, Activity, FastForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TIME_SCALES, type TimeScale } from "@/lib/metabolism/config";
import { bodyFatPercent, burnRate, type FeedInput } from "@/lib/metabolism/engine";
import type { useMetabolismSimulation } from "@/hooks/useMetabolismSimulation";
import { BodySilhouette } from "./BodySilhouette";
import { SignalGauge } from "./SignalGauge";
import { BurnRateGauge } from "./BurnRateGauge";
import { Sparkline } from "./Sparkline";
import { FeedSheet } from "./FeedSheet";
import { MoveSheet } from "./MoveSheet";
import { DebugPanel } from "./DebugPanel";
import { InfoPopover } from "./InfoPopover";

type Sim = ReturnType<typeof useMetabolismSimulation>;

function formatSimTime(hours: number) {
  const d = Math.floor(hours / 24);
  const h = Math.floor(hours % 24);
  const m = Math.floor((hours % 1) * 60);
  return `${d > 0 ? `${d}d ` : ""}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

function useTrend(value: number) {
  const prev = useRef(value);
  const [trend, setTrend] = useState<"rising" | "falling" | "steady">("steady");
  useEffect(() => {
    const delta = value - prev.current;
    prev.current = value;
    if (Math.abs(delta) < 0.01) setTrend("steady");
    else setTrend(delta > 0 ? "rising" : "falling");
  }, [value]);
  return trend;
}

export function Dashboard({ sim }: { sim: Sim }) {
  const { profile, state } = sim;
  const [feedOpen, setFeedOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [feedPrefill, setFeedPrefill] = useState<FeedInput | null>(null);
  const [movePrefill, setMovePrefill] = useState<{
    durationMinutes: number;
    totalKcal: number;
  } | null>(null);
  const [debug, setDebug] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).get("debug") === "1");
  }, []);

  const openSheet = (which: "feed" | "move") => {
    sim.holdClock();
    if (which === "feed") setFeedOpen(true);
    else setMoveOpen(true);
  };
  const closeSheet = (which: "feed" | "move", open: boolean) => {
    if (which === "feed") setFeedOpen(open);
    else setMoveOpen(open);
    if (!open) sim.releaseClock();
  };

  const ketosisTrend = useTrend(state?.K ?? 0);
  const autoTrend = useTrend(state?.Auto ?? 0);

  if (!profile || !state) return null;
  const ratio = state.G / profile.Gcap;
  const bf = bodyFatPercent(state.Fat, profile.LBM);
  const burn = burnRate(state, profile);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-primary">Metabolic Gauge</p>
          <h1 className="text-xl font-semibold tracking-tight">Live metabolism simulation</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={sim.saveSession} aria-label="Save session">
            <Save className="h-4 w-4" /> Save
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" aria-label="Reset simulation">
                <RotateCcw className="h-4 w-4" /> Reset
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reset the simulation?</AlertDialogTitle>
                <AlertDialogDescription>
                  All simulated state and any saved session on this device will be cleared.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Keep going</AlertDialogCancel>
                <AlertDialogAction onClick={sim.reset}>Reset</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </header>

      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] sm:items-start">
        <section className="rounded-xl border border-border bg-card/50 p-4">
          <BodySilhouette
            gender={profile.gender}
            fillRatio={ratio}
            bodyFat={bf}
            baseBodyFat={profile.bodyfatPct}
            overflowPulse={state.overflowEvent}
            reducedMotion={reducedMotion}
          />
          <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
            {[
              ["Glycogen", `${Math.round(state.G)} kcal`],
              ["Fat mass", `${state.Fat.toFixed(2)} kg`],
              ["Body fat", `${bf.toFixed(1)}%`],
              ["Δ Fat", `${(state.Fat - profile.Fat0 >= 0 ? "+" : "") + (state.Fat - profile.Fat0).toFixed(2)} kg`],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-background/40 py-2">
                <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</dt>
                <dd className="numeric text-sm font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="space-y-4">
          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Simulated time
                </p>
                <p className="numeric text-2xl font-semibold">{formatSimTime(state.simulatedTime)}</p>
              </div>
              <Button
                size="icon"
                className="min-h-11 min-w-11"
                onClick={() => sim.setRunning(!sim.running)}
                aria-label={sim.running ? "Pause clock" : "Play clock"}
              >
                {sim.running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {TIME_SCALES.map((s: TimeScale) => (
                <Button
                  key={s}
                  size="sm"
                  variant={sim.timeScale === s ? "default" : "secondary"}
                  aria-pressed={sim.timeScale === s}
                  onClick={() => sim.setTimeScale(s)}
                  className="numeric"
                >
                  {s}x
                </Button>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 w-full"
              onClick={() => sim.skipHours(24)}
            >
              <FastForward className="h-4 w-4" /> Fast forward 24h
            </Button>
            {state.activeActivity && (
              <p className="numeric mt-3 text-xs text-primary">
                Activity running — {Math.ceil(state.activeActivity.remainingMinutes)} min left at{" "}
                {Math.round(state.activeActivity.kcalPerHour)} kcal/h
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button size="lg" onClick={() => openSheet("feed")}>
              <UtensilsCrossed className="h-4 w-4" /> Feed
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => openSheet("move")}
              disabled={!!state.activeActivity}
            >
              <Activity className="h-4 w-4" /> Move
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!sim.undoAvailable}
              onClick={sim.undo}
            >
              <Undo2 className="h-4 w-4" /> Undo last action
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card/50 p-4">
            <p className="mb-2 text-xs uppercase tracking-widest text-muted-foreground">
              Scenario presets
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Button variant="secondary" size="sm" onClick={() => sim.skipHours(6)}>
                Skip breakfast
              </Button>
              <Button variant="secondary" size="sm" onClick={() => sim.skipHours(16)}>
                16:8 fast
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setFeedPrefill({ carb_g: 80, protein_g: 40, fat_g: 10 });
                  openSheet("feed");
                }}
              >
                Post-workout refeed
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setMovePrefill({ durationMinutes: 45, totalKcal: 480 });
                  openSheet("move");
                }}
                disabled={!!state.activeActivity}
              >
                Long session
              </Button>
            </div>
          </div>

          <Collapsible defaultOpen>
            <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-2 text-sm">
              <span>Body signals</span>
              <span className="text-xs text-muted-foreground">toggle</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2 grid gap-2 sm:grid-cols-2">
              <SignalGauge
                label="Ketosis"
                value={state.K}
                color="ketosis"
                trend={ketosisTrend}
                info="How strongly your body is producing ketones as an alternative fuel when glycogen runs low during a fast."
              />
              <SignalGauge
                label="Autophagy"
                value={state.Auto}
                color="autophagy"
                trend={autoTrend}
                info="How actively cells are recycling damaged components. It ramps up during longer fasts and is suppressed by large meals."
              />
            </CollapsibleContent>
          </Collapsible>

          <BurnRateGauge
            restingPerHour={burn.restingPerHour}
            activityPerHour={burn.activityPerHour}
            basalPerDay={profile.BMR}
          />

          <div className="rounded-xl border border-border bg-card/50 p-4">
            <div className="mb-1 flex items-center gap-1">
              <span className="text-xs uppercase tracking-widest text-muted-foreground">
                Energy gauge
              </span>
              <InfoPopover
                title="Energy"
                body="The share of your glycogen store still filled. It drains with your resting burn and activity, and refills as food is absorbed."
              />
            </div>
            <Sparkline points={sim.history} />
          </div>

          {debug && <DebugPanel state={state} profile={profile} />}
        </section>
      </div>

      <FeedSheet
        open={feedOpen}
        onOpenChange={(o) => closeSheet("feed", o)}
        onConfirm={sim.feed}
        prefill={feedPrefill}
      />
      <MoveSheet
        open={moveOpen}
        onOpenChange={(o) => closeSheet("move", o)}
        onConfirm={sim.move}
        blocked={!!state.activeActivity}
        prefill={movePrefill}
      />
    </main>
  );
}