import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CONFIG,
  GAUGE_ACTIVE_THRESHOLD,
  HISTORY_WINDOW_HOURS,
  type TimeScale,
} from "@/lib/metabolism/config";
import {
  applyFeed,
  applyMove,
  createInitialState,
  createProfile,
  simulate,
  type FeedInput,
  type Profile,
  type ProfileInput,
  type SimState,
} from "@/lib/metabolism/engine";

export interface HistoryPoint {
  t: number;
  ratio: number;
}

const STORAGE_KEY = "metabolic-gauge-session";

interface SavedSession {
  profileInput: ProfileInput;
  state: SimState;
  history: HistoryPoint[];
}

export function readSavedSession(): SavedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedSession) : null;
  } catch {
    return null;
  }
}

export function useMetabolismSimulation() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [state, setState] = useState<SimState | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [running, setRunning] = useState(false);
  const [timeScale, setTimeScale] = useState<TimeScale>(60);
  const [undoAvailable, setUndoAvailable] = useState(false);

  const profileRef = useRef<Profile | null>(null);
  const stateRef = useRef<SimState | null>(null);
  const runningRef = useRef(false);
  const scaleRef = useRef<TimeScale>(60);
  const undoRef = useRef<{ state: SimState; history: HistoryPoint[] } | null>(null);
  const lastSampleRef = useRef(0);
  const flagsRef = useRef({ depleted: false, keto: false, auto: false, floor: false });
  const lastToastRef = useRef<Record<string, number>>({});
  const resumeScaleRef = useRef<TimeScale | null>(null);

  profileRef.current = profile;
  scaleRef.current = timeScale;
  runningRef.current = running;

  const notify = useCallback((key: string, message: string, description?: string) => {
    const now = Date.now();
    if (now - (lastToastRef.current[key] ?? 0) < 2500) return;
    lastToastRef.current[key] = now;
    toast(message, description ? { description } : undefined);
  }, []);

  const start = useCallback((input: ProfileInput, restored?: SavedSession) => {
    const p = createProfile(restored ? restored.profileInput : input);
    const s = restored ? restored.state : createInitialState(p);
    profileRef.current = p;
    stateRef.current = s;
    flagsRef.current = { depleted: false, keto: false, auto: false, floor: false };
    lastSampleRef.current = s.simulatedTime;
    setProfile(p);
    setState(s);
    setHistory(restored ? restored.history : [{ t: 0, ratio: 1 }]);
    setUndoAvailable(false);
    undoRef.current = null;
    setRunning(true);
  }, []);

  const reset = useCallback(() => {
    setRunning(false);
    setProfile(null);
    setState(null);
    setHistory([]);
    profileRef.current = null;
    stateRef.current = null;
    undoRef.current = null;
    setUndoAvailable(false);
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  // rAF loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      const realDt = (now - last) / 1000;
      last = now;
      const p = profileRef.current;
      const s = stateRef.current;
      if (runningRef.current && p && s && realDt > 0) {
        const dtSim = (realDt / 3600) * scaleRef.current;
        const next = simulate(s, dtSim, p);
        stateRef.current = next;
        setState(next);

        const ratio = next.G / p.Gcap;
        if (next.simulatedTime - lastSampleRef.current >= 0.1) {
          lastSampleRef.current = next.simulatedTime;
          setHistory((h) =>
            [...h, { t: next.simulatedTime, ratio }].filter(
              (pt) => pt.t >= next.simulatedTime - HISTORY_WINDOW_HOURS,
            ),
          );
        }

        const f = flagsRef.current;
        if (next.overflowEvent) notify("overflow", "Energy overflow", "Excess is being stored as fat.");
        if (ratio <= 0.001 && !f.depleted) {
          f.depleted = true;
          notify("depleted", "Glycogen depleted", "Energy is now coming from fat stores.");
        } else if (ratio > 0.05) f.depleted = false;

        if (next.K >= GAUGE_ACTIVE_THRESHOLD && !f.keto) {
          f.keto = true;
          notify("keto", "Ketosis onset", "Ketone production is ramping up.");
        } else if (next.K < GAUGE_ACTIVE_THRESHOLD * 0.5) f.keto = false;

        if (next.Auto >= GAUGE_ACTIVE_THRESHOLD && !f.auto) {
          f.auto = true;
          notify("auto", "Autophagy onset", "Cellular recycling has begun.");
        } else if (next.Auto < GAUGE_ACTIVE_THRESHOLD * 0.5) f.auto = false;

        if (next.Fat <= p.FatFloor * 1.001 && !f.floor) {
          f.floor = true;
          notify("floor", "Essential fat reached", "Further fat loss is dampened.");
        } else if (next.Fat > p.FatFloor * 1.05) f.floor = false;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [notify]);

  const snapshot = useCallback(() => {
    if (stateRef.current) {
      undoRef.current = { state: stateRef.current, history };
      setUndoAvailable(true);
    }
  }, [history]);

  const feed = useCallback(
    (meal: FeedInput) => {
      const s = stateRef.current;
      if (!s) return;
      snapshot();
      const next = applyFeed(s, meal);
      stateRef.current = next;
      setState(next);
      const kcal = Math.round(next.lastMealKcal);
      toast.success(`Meal logged — ${kcal} kcal`);
    },
    [snapshot],
  );

  const move = useCallback(
    (durationMinutes: number, totalKcal: number) => {
      const s = stateRef.current;
      if (!s || s.activeActivity) return;
      snapshot();
      const next = applyMove(s, { durationMinutes, totalKcal });
      stateRef.current = next;
      setState(next);
      toast.success(`Activity started — ${Math.round(totalKcal)} kcal / ${durationMinutes} min`);
    },
    [snapshot],
  );

  const undo = useCallback(() => {
    const snap = undoRef.current;
    if (!snap) return;
    stateRef.current = snap.state;
    setState(snap.state);
    setHistory(snap.history);
    undoRef.current = null;
    setUndoAvailable(false);
    toast("Last action undone");
  }, []);

  /** Fast-forward a fixed number of simulated hours with no feeding. */
  const skipHours = useCallback((hours: number) => {
    const p = profileRef.current;
    const s = stateRef.current;
    if (!p || !s) return;
    const next = simulate(s, hours, p);
    stateRef.current = next;
    setState(next);
    setHistory((h) =>
      [...h, { t: next.simulatedTime, ratio: next.G / p.Gcap }].filter(
        (pt) => pt.t >= next.simulatedTime - HISTORY_WINDOW_HOURS,
      ),
    );
    lastSampleRef.current = next.simulatedTime;
    toast(`Fast-forwarded ${hours}h`);
  }, []);

  /** §13 — auto-pause while a sheet is open during fast-forward. */
  const holdClock = useCallback(() => {
    if (runningRef.current && scaleRef.current > 1) {
      resumeScaleRef.current = scaleRef.current;
      setRunning(false);
    }
  }, []);
  const releaseClock = useCallback(() => {
    if (resumeScaleRef.current !== null) {
      setTimeScale(resumeScaleRef.current);
      resumeScaleRef.current = null;
      setRunning(true);
    }
  }, []);

  const saveSession = useCallback(() => {
    const p = profileRef.current;
    const s = stateRef.current;
    if (!p || !s) return;
    const payload: SavedSession = {
      profileInput: {
        gender: p.gender,
        heightCm: p.heightCm,
        weightKg: p.weightKg,
        bodyfatPct: p.bodyfatPct,
      },
      state: s,
      history,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    toast.success("Session saved to this device");
  }, [history]);

  return {
    config: CONFIG,
    profile,
    state,
    history,
    running,
    setRunning,
    timeScale,
    setTimeScale,
    start,
    reset,
    feed,
    move,
    undo,
    undoAvailable,
    skipHours,
    holdClock,
    releaseClock,
    saveSession,
  };
}