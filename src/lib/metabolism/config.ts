/**
 * Centralized, tunable simulation constants.
 * Every physiological coefficient used by the engine lives here.
 */
export const CONFIG = {
  // Digestion time constants (hours)
  tau_carb: 1.0,
  tau_protein: 3.0,
  tau_fat: 5.0,

  // Macro energy density
  kcal_per_g_carb: 4,
  kcal_per_g_protein: 4,
  kcal_per_g_fat: 9,

  // Fat <-> energy
  fatKcalPerKg: 9300,
  lipogenesisEfficiency: 0.75,
  fatOxidationEfficiency: 0.9,

  // Ketosis
  k1: 15,
  k2: 0.5,
  ketosisGlycogenThreshold: 0.2,
  ketosisFastingDelayHours: 4,
  ketosisBmrDiscount: 0.97,

  // Autophagy
  a1: 2,
  a2: 0.8,
  autophagyGlycogenThreshold: 0.25,
  autophagyFastingDelayHours: 12,
  autophagySuppressionMealKcal: 400,
  autophagySuppressionFactor: 0.3,

  // Fat floor
  FatFloorFraction: 0.03,

  // Integration
  maxSubStepHours: 0.05,
} as const;

export type SimConfig = typeof CONFIG;

export const TIME_SCALES = [1, 10, 60, 360] as const;
export type TimeScale = (typeof TIME_SCALES)[number];

export const MOVE_PRESETS = [
  { label: "Walk", durationMinutes: 45, totalKcal: 160 },
  { label: "Run", durationMinutes: 30, totalKcal: 330 },
  { label: "Gym", durationMinutes: 60, totalKcal: 400 },
  { label: "HIIT", durationMinutes: 20, totalKcal: 260 },
] as const;

export const MAX_MACRO_GRAMS = 300;
export const MOVE_KCAL_PER_MIN_WARN = 20;
export const HISTORY_WINDOW_HOURS = 48;
export const GAUGE_ACTIVE_THRESHOLD = 10;