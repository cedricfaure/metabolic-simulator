import { CONFIG, type SimConfig } from "./config";

export type Gender = "male" | "female";

export interface ProfileInput {
  gender: Gender;
  heightCm: number;
  weightKg: number;
  bodyfatPct: number;
}

export interface Profile extends ProfileInput {
  LBM: number;
  Fat0: number;
  BMR: number;
  BMR_hr: number;
  Gcap: number;
  FatFloor: number;
}

export interface ActiveActivity {
  remainingMinutes: number;
  kcalPerHour: number;
}

export interface SimState {
  G: number;
  Fat: number;
  K: number;
  Auto: number;
  D_carb: number;
  D_protein: number;
  D_fat: number;
  hoursSinceLastFeed: number;
  lastMealKcal: number;
  activeActivity: ActiveActivity | null;
  simulatedTime: number;
  overflowEvent: boolean;
}

export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function createProfile(input: ProfileInput, config: SimConfig = CONFIG): Profile {
  const LBM = input.weightKg * (1 - input.bodyfatPct / 100);
  const Fat0 = input.weightKg * (input.bodyfatPct / 100);
  const BMR = 370 + 21.6 * LBM;
  return {
    ...input,
    LBM,
    Fat0,
    BMR,
    BMR_hr: BMR / 24,
    Gcap: 5 * LBM,
    FatFloor: config.FatFloorFraction * input.weightKg,
  };
}

export function createInitialState(profile: Profile): SimState {
  return {
    G: profile.Gcap,
    Fat: profile.Fat0,
    K: 0,
    Auto: 0,
    D_carb: 0,
    D_protein: 0,
    D_fat: 0,
    hoursSinceLastFeed: 0,
    lastMealKcal: 0,
    activeActivity: null,
    simulatedTime: 0,
    overflowEvent: false,
  };
}

/** §9 — dampening factor applied to any further fat-depleting delta. */
export function deficitDampening(Fat: number, FatFloor: number): number {
  if (Fat <= FatFloor * 1.1) {
    return clamp((Fat - FatFloor) / (FatFloor * 0.1), 0, 1);
  }
  return 1;
}

function depleteFat(Fat: number, deltaKg: number, FatFloor: number): number {
  const damped = deltaKg * deficitDampening(Fat, FatFloor);
  return Math.max(Fat - damped, FatFloor);
}

export interface FeedInput {
  carb_g: number;
  protein_g: number;
  fat_g: number;
}

/** §4 — confirmed Feed action. Also applies §8 meal suppression of autophagy. */
export function applyFeed(
  state: SimState,
  meal: FeedInput,
  config: SimConfig = CONFIG,
): SimState {
  const intakeCarb = meal.carb_g * config.kcal_per_g_carb;
  const intakeProtein = meal.protein_g * config.kcal_per_g_protein;
  const intakeFat = meal.fat_g * config.kcal_per_g_fat;
  const lastMealKcal = intakeCarb + intakeProtein + intakeFat;

  const Auto =
    lastMealKcal > config.autophagySuppressionMealKcal
      ? state.Auto * config.autophagySuppressionFactor
      : state.Auto;

  return {
    ...state,
    D_carb: state.D_carb + intakeCarb,
    D_protein: state.D_protein + intakeProtein,
    D_fat: state.D_fat + intakeFat,
    lastMealKcal,
    hoursSinceLastFeed: 0,
    Auto,
  };
}

/** §6 — confirmed Move action. */
export function applyMove(
  state: SimState,
  move: { durationMinutes: number; totalKcal: number },
): SimState {
  if (move.durationMinutes <= 0) return state;
  return {
    ...state,
    activeActivity: {
      remainingMinutes: move.durationMinutes,
      kcalPerHour: move.totalKcal / (move.durationMinutes / 60),
    },
  };
}

/**
 * §4–§9 — pure single integration step. `dt` is in simulated hours and should
 * be <= config.maxSubStepHours for stability (see `simulate`).
 */
export function simulateTick(
  state: SimState,
  dt: number,
  profile: Profile,
  config: SimConfig = CONFIG,
): SimState {
  const s: SimState = { ...state, overflowEvent: false };

  // §4 digestion
  const absorbedCarb = (s.D_carb / config.tau_carb) * dt;
  const absorbedProtein = (s.D_protein / config.tau_protein) * dt;
  const absorbedFat = (s.D_fat / config.tau_fat) * dt;
  s.D_carb = Math.max(0, s.D_carb - absorbedCarb);
  s.D_protein = Math.max(0, s.D_protein - absorbedProtein);
  s.D_fat = Math.max(0, s.D_fat - absorbedFat);
  const absorbedKcal = absorbedCarb + absorbedProtein + absorbedFat;

  // §6 activity fuel mix
  const activityRate = s.activeActivity ? s.activeActivity.kcalPerHour : 0;
  const fatFraction = clamp(0.3 + 0.55 * (1 - s.G / profile.Gcap), 0.3, 0.85);
  const carbActivityRate = activityRate * (1 - fatFraction);
  const fatActivityRate = activityRate * fatFraction;

  if (fatActivityRate > 0) {
    s.Fat = depleteFat(
      s.Fat,
      (fatActivityRate * dt) / (config.fatKcalPerKg * config.fatOxidationEfficiency),
      profile.FatFloor,
    );
  }

  // §5 energy balance
  const bmrHrEffective = s.K > 30 ? profile.BMR_hr * config.ketosisBmrDiscount : profile.BMR_hr;
  const netFlow = absorbedKcal / dt - bmrHrEffective - carbActivityRate;
  const gNew = s.G + netFlow * dt;

  if (gNew > profile.Gcap) {
    const excess = gNew - profile.Gcap;
    s.G = profile.Gcap;
    s.Fat = s.Fat + (config.lipogenesisEfficiency * excess) / config.fatKcalPerKg;
    s.overflowEvent = true;
  } else if (gNew < 0) {
    const deficit = -gNew;
    s.G = 0;
    s.Fat = depleteFat(
      s.Fat,
      deficit / (config.fatKcalPerKg * config.fatOxidationEfficiency),
      profile.FatFloor,
    );
  } else {
    s.G = clamp(gNew, 0, profile.Gcap);
  }

  // §6 activity countdown
  if (s.activeActivity) {
    const remainingMinutes = s.activeActivity.remainingMinutes - dt * 60;
    s.activeActivity = remainingMinutes <= 0 ? null : { ...s.activeActivity, remainingMinutes };
  }

  s.hoursSinceLastFeed = s.hoursSinceLastFeed + dt;

  // §7 ketosis
  const gRatio = s.G / profile.Gcap;
  const dK =
    gRatio < config.ketosisGlycogenThreshold &&
    s.hoursSinceLastFeed > config.ketosisFastingDelayHours
      ? config.k1 * (config.ketosisGlycogenThreshold - gRatio) * dt
      : -config.k2 * s.K * dt;
  s.K = clamp(s.K + dK, 0, 100);

  // §8 autophagy
  const dAuto =
    gRatio < config.autophagyGlycogenThreshold
      ? config.a1 * Math.max(0, s.hoursSinceLastFeed - config.autophagyFastingDelayHours) * dt
      : -config.a2 * s.Auto * dt;
  s.Auto = clamp(s.Auto + dAuto, 0, 100);

  s.simulatedTime = s.simulatedTime + dt;
  return s;
}

/** §11 — sub-stepped advance over an arbitrary simulated-hour delta. */
export function simulate(
  state: SimState,
  dtSim: number,
  profile: Profile,
  config: SimConfig = CONFIG,
): SimState {
  let remaining = dtSim;
  let s = state;
  let sawOverflow = false;
  let guard = 0;
  while (remaining > 1e-9 && guard++ < 20000) {
    const step = Math.min(config.maxSubStepHours, remaining);
    s = simulateTick(s, step, profile, config);
    sawOverflow = sawOverflow || s.overflowEvent;
    remaining -= step;
  }
  return sawOverflow ? { ...s, overflowEvent: true } : s;
}

/** §10 — visual body scale. */
export function bodyScale(Fat: number, Fat0: number): number {
  const dFat = Fat - Fat0;
  return clamp(1 + 0.15 * Math.log(1 + Math.max(0, dFat) / 5), 1, 1.6);
}