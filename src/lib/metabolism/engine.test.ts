import { describe, expect, it } from "vitest";
import { CONFIG } from "./config";
import {
  applyFeed,
  applyMove,
  bodyScale,
  createInitialState,
  createProfile,
  deficitDampening,
  simulate,
  simulateTick,
} from "./engine";

const profile = createProfile({
  gender: "male",
  heightCm: 180,
  weightKg: 80,
  bodyfatPct: 20,
});

describe("profile derivation", () => {
  it("uses Katch-McArdle", () => {
    expect(profile.LBM).toBeCloseTo(64);
    expect(profile.Fat0).toBeCloseTo(16);
    expect(profile.BMR).toBeCloseTo(370 + 21.6 * 64);
    expect(profile.Gcap).toBeCloseTo(320);
    expect(profile.FatFloor).toBeCloseTo(2.4);
  });
});

describe("digestion", () => {
  it("converts grams to kcal buffers", () => {
    const s = applyFeed(createInitialState(profile), { carb_g: 50, protein_g: 20, fat_g: 10 });
    expect(s.D_carb).toBe(200);
    expect(s.D_protein).toBe(80);
    expect(s.D_fat).toBe(90);
    expect(s.lastMealKcal).toBe(370);
    expect(s.hoursSinceLastFeed).toBe(0);
  });

  it("decays each buffer exponentially with its own tau", () => {
    const base = applyFeed(createInitialState(profile), { carb_g: 50, protein_g: 20, fat_g: 10 });
    const dt = 0.05;
    const next = simulateTick(base, dt, profile);
    expect(next.D_carb).toBeCloseTo(200 - (200 / CONFIG.tau_carb) * dt);
    expect(next.D_protein).toBeCloseTo(80 - (80 / CONFIG.tau_protein) * dt);
    expect(next.D_fat).toBeCloseTo(90 - (90 / CONFIG.tau_fat) * dt);
  });
});

describe("overflow to fat", () => {
  it("caps glycogen and stores excess as fat at lipogenesis efficiency", () => {
    const s = { ...createInitialState(profile), D_carb: 1000 };
    const dt = 0.05;
    const next = simulateTick(s, dt, profile);
    const absorbed = (1000 / CONFIG.tau_carb) * dt;
    const excess = absorbed - profile.BMR_hr * dt;
    expect(next.overflowEvent).toBe(true);
    expect(next.G).toBeCloseTo(profile.Gcap);
    expect(next.Fat - profile.Fat0).toBeCloseTo(
      (CONFIG.lipogenesisEfficiency * excess) / CONFIG.fatKcalPerKg,
    );
  });
});

describe("deficit draws from fat", () => {
  it("zeroes glycogen and burns fat at oxidation efficiency", () => {
    const s = { ...createInitialState(profile), G: 1 };
    const dt = 0.05;
    const next = simulateTick(s, dt, profile);
    const deficit = profile.BMR_hr * dt - 1;
    expect(next.G).toBe(0);
    expect(profile.Fat0 - next.Fat).toBeCloseTo(
      deficit / (CONFIG.fatKcalPerKg * CONFIG.fatOxidationEfficiency),
    );
  });
});

describe("activity fuel mix", () => {
  it("splits between carb and fat by glycogen fullness", () => {
    const s = applyMove(createInitialState(profile), { durationMinutes: 60, totalKcal: 600 });
    expect(s.activeActivity?.kcalPerHour).toBe(600);
    const dt = 0.05;
    const next = simulateTick(s, dt, profile);
    // full glycogen -> fatFraction clamps to 0.30
    const fatRate = 600 * 0.3;
    expect(profile.Fat0 - next.Fat).toBeCloseTo(
      (fatRate * dt) / (CONFIG.fatKcalPerKg * CONFIG.fatOxidationEfficiency),
    );
    const carbRate = 600 * 0.7;
    expect(next.G).toBeCloseTo(profile.Gcap - (profile.BMR_hr + carbRate) * dt);
  });

  it("ends the activity when duration elapses", () => {
    const s = applyMove(createInitialState(profile), { durationMinutes: 3, totalKcal: 30 });
    const next = simulate(s, 0.05, profile);
    expect(next.activeActivity).toBeNull();
  });
});

describe("ketosis", () => {
  it("rises only below the glycogen threshold after the fasting delay", () => {
    const dt = 0.05;
    const low = {
      ...createInitialState(profile),
      G: profile.Gcap * 0.1,
      hoursSinceLastFeed: 10,
    };
    const next = simulateTick(low, dt, profile);
    expect(next.K).toBeGreaterThan(0);

    const early = { ...low, hoursSinceLastFeed: 1, K: 20 };
    const decayed = simulateTick(early, dt, profile);
    expect(decayed.K).toBeCloseTo(20 - CONFIG.k2 * 20 * dt);
  });

  it("decays when glycogen is replenished", () => {
    const s = { ...createInitialState(profile), K: 50, hoursSinceLastFeed: 20 };
    const next = simulateTick(s, 0.05, profile);
    expect(next.K).toBeLessThan(50);
  });
});

describe("autophagy", () => {
  it("rises with fasting hours beyond the delay when glycogen is low", () => {
    const dt = 0.05;
    const s = { ...createInitialState(profile), G: profile.Gcap * 0.1, hoursSinceLastFeed: 20 };
    const next = simulateTick(s, dt, profile);
    expect(next.Auto).toBeCloseTo(CONFIG.a1 * (20 + dt - CONFIG.autophagyFastingDelayHours) * dt);
  });

  it("decays above the glycogen threshold", () => {
    const s = { ...createInitialState(profile), Auto: 40 };
    const next = simulateTick(s, 0.05, profile);
    expect(next.Auto).toBeCloseTo(40 - CONFIG.a2 * 40 * 0.05);
  });

  it("is suppressed by a large meal", () => {
    const s = { ...createInitialState(profile), Auto: 60 };
    const fed = applyFeed(s, { carb_g: 100, protein_g: 20, fat_g: 10 });
    expect(fed.Auto).toBeCloseTo(60 * CONFIG.autophagySuppressionFactor);

    const snack = applyFeed(s, { carb_g: 10, protein_g: 5, fat_g: 2 });
    expect(snack.Auto).toBe(60);
  });
});

describe("fat floor", () => {
  it("dampens depletion near the floor and never crosses it", () => {
    expect(deficitDampening(20, 2.4)).toBe(1);
    expect(deficitDampening(2.4, 2.4)).toBe(0);
    expect(deficitDampening(2.52, 2.4)).toBeCloseTo(0.5);

    let s = { ...createInitialState(profile), Fat: profile.FatFloor * 1.02, G: 0 };
    for (let i = 0; i < 200; i++) s = simulateTick(s, 0.05, profile);
    expect(s.Fat).toBeGreaterThanOrEqual(profile.FatFloor);
  });
});

describe("body scale", () => {
  it("is 1 at baseline and grows logarithmically", () => {
    expect(bodyScale(16, 16)).toBe(1);
    expect(bodyScale(21, 16)).toBeCloseTo(1 + 0.15 * Math.log(2));
    expect(bodyScale(10_000, 16)).toBe(1.6);
  });
});

describe("sub-stepping", () => {
  it("never advances more than maxSubStepHours per internal tick", () => {
    const s = simulate(createInitialState(profile), 1, profile);
    expect(s.simulatedTime).toBeCloseTo(1);
    expect(s.G).toBeLessThan(profile.Gcap);
  });
});