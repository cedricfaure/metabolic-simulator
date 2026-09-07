# Metabolic Simulator

Prompt for Claude Code / Lovable (functional build) — self-contained

Build a responsive, client-side web app: "Metabolic Gauge" — a real-time simulation
of human metabolism visualized as an animated body silhouette / energy gauge.

This document is fully self-contained: all formulas, constants, and behavior rules
needed to implement the simulation engine are specified below. Do not infer or
substitute alternative physiology formulas — implement exactly as written, with the
tunable constants centralized in one config file.

═══════════════════════════════════════════════════════════════
1. STACK
═══════════════════════════════════════════════════════════════
- React + TypeScript, Tailwind for styling, Framer Motion (or CSS transitions) for
  the gauge fill and body-expansion animation.
- Client-side only: all state in React state/useReducer. No backend.
- Optional (see §7): persist session to localStorage so a refresh doesn't lose
  progress — implement as an explicit opt-in, not silent.

═══════════════════════════════════════════════════════════════
2. USER PROFILE & DERIVED CONSTANTS
═══════════════════════════════════════════════════════════════
Inputs collected at onboarding: gender (male/female), height (cm), weight (kg),
bodyfat (%).

Derived once, stored in a `profile` object:

| Constant | Formula |
|---|---|
| Lean body mass, `LBM` (kg) | `weight × (1 − bodyfat/100)` |
| Initial fat mass, `Fat0` (kg) | `weight × (bodyfat/100)` |
| BMR (kcal/day) | `370 + 21.6 × LBM` (Katch-McArdle) |
| BMR_hr (kcal/hour) | `BMR / 24` |
| Glycogen capacity, `Gcap` (kcal) | `5 × LBM` |

═══════════════════════════════════════════════════════════════
3. SIMULATION STATE
═══════════════════════════════════════════════════════════════
| Variable | Meaning | Bounds | Init |
|---|---|---|---|
| `G` | Glycogen store (kcal) | `[0, Gcap]` (overflow handled separately, see §5) | `Gcap` |
| `Fat` | Fat mass (kg) | `≥ FatFloor` (see §8) | `Fat0` |
| `K` | Ketosis level | `[0, 100]` | `0` |
| `Auto` | Autophagy level | `[0, 100]` | `0` |
| `D_carb, D_protein, D_fat` | Undigested macro buffers (kcal) | `≥ 0` | `0` |
| `hoursSinceLastFeed` | Hours since last confirmed Feed action | `≥ 0` | `0` |
| `lastMealKcal` | kcal of most recent meal | `≥ 0` | `0` |
| `activeActivity` | `{ remainingMinutes, kcalPerHour }` or `null` | — | `null` |
| `simulatedTime` | Elapsed simulated hours since start | `≥ 0` | `0` |
| `overflowEvent` | Boolean flag, true for the animation tick when G would exceed Gcap | — | `false` |

Config constants (centralize in `config.ts`, all tunable):

| Constant | Value | Used in |
|---|---|---|
| `τ_carb` | 1.0 h | Digestion |
| `τ_protein` | 3.0 h | Digestion |
| `τ_fat` | 5.0 h | Digestion |
| `kcal_per_g_carb` | 4 | Feed input conversion |
| `kcal_per_g_protein` | 4 | Feed input conversion |
| `kcal_per_g_fat` | 9 | Feed input conversion |
| `fatKcalPerKg` | 9300 | Fat↔energy conversion |
| `lipogenesisEfficiency` | 0.75 | Overflow → fat storage |
| `fatOxidationEfficiency` | 0.90 | Fat → energy on deficit |
| `k1` (ketosis onset rate) | 15 | Ketosis |
| `k2` (ketosis decay rate) | 0.5 | Ketosis |
| `ketosisGlycogenThreshold` | 0.20 (of Gcap) | Ketosis |
| `ketosisFastingDelayHours` | 4 | Ketosis |
| `ketosisBmrDiscount` | 0.97 (applied when K > 30) | Ketosis |
| `a1` (autophagy onset rate) | 2 | Autophagy |
| `a2` (autophagy decay rate) | 0.8 | Autophagy |
| `autophagyGlycogenThreshold` | 0.25 (of Gcap) | Autophagy |
| `autophagyFastingDelayHours` | 12 | Autophagy |
| `autophagySuppressionMealKcal` | 400 | Autophagy |
| `autophagySuppressionFactor` | 0.3 (multiply Auto on qualifying feed) | Autophagy |
| `FatFloorFraction` | 0.03 (of weight) | Floor / deficit dampening |

═══════════════════════════════════════════════════════════════
4. DIGESTION (absorption kinetics)
═══════════════════════════════════════════════════════════════
On a confirmed Feed action with grams (carb_g, protein_g, fat_g):

Intake_carb = carb_g × kcal_per_g_carb
Intake_protein = protein_g × kcal_per_g_protein
Intake_fat = fat_g × kcal_per_g_fat

D_carb += Intake_carb
D_protein += Intake_protein
D_fat += Intake_fat

lastMealKcal = Intake_carb + Intake_protein + Intake_fat
hoursSinceLastFeed = 0

Every simulation tick (dt in hours), each buffer decays exponentially into the
absorbed pool:

for x in [carb, protein, fat]:
absorbed_x = D_x / τ_x × dt
D_x -= absorbed_x

AbsorptionRate_kcal_per_tick = absorbed_carb + absorbed_protein + absorbed_fat


═══════════════════════════════════════════════════════════════
5. CORE ENERGY BALANCE (per tick, dt in hours)
═══════════════════════════════════════════════════════════════

ActivityRate = activeActivity ? activeActivity.kcalPerHour : 0
NetFlow = (AbsorptionRate_kcal_per_tick / dt) − BMR_hr_effective − ActivityRate
// BMR_hr_effective = BMR_hr × ketosisBmrDiscount if K > 30, else BMR_hr

G_new = G + NetFlow × dt


**Overflow (G_new > Gcap):**

excess = G_new − Gcap
G = Gcap
Fat += lipogenesisEfficiency × excess / fatKcalPerKg
overflowEvent = true // triggers body-expansion animation this tick


**Deficit (G_new < 0), draw from Fat:**

deficit = −G_new
G = 0
Fat -= deficit / (fatKcalPerKg × fatOxidationEfficiency)
Fat = max(Fat, FatFloor) // see §8


**Normal range:**

G = clamp(G_new, 0, Gcap)


`hoursSinceLastFeed += dt` every tick.

═══════════════════════════════════════════════════════════════
6. ACTIVITY ("Move")
═══════════════════════════════════════════════════════════════
On confirmed Move action with `durationMinutes` and `totalKcal`:

kcalPerHour = totalKcal / (durationMinutes / 60)
activeActivity = { remainingMinutes: durationMinutes, kcalPerHour }

Each tick while `activeActivity` is active, fuel mix is split before being applied
to §5's balance — i.e. `ActivityRate` above is decomposed as:

fatFraction = clamp(0.30 + 0.55 × (1 − G/Gcap), 0.30, 0.85)
carbActivityRate = ActivityRate × (1 − fatFraction) // drawn from G via NetFlow
fatActivityRate = ActivityRate × fatFraction // drawn directly from Fat

Fat -= (fatActivityRate × dt) / (fatKcalPerKg × fatOxidationEfficiency)

(Only `carbActivityRate` participates in the `NetFlow` glycogen equation in §5;
`fatActivityRate` is deducted from Fat directly, independent of the glycogen
overflow/deficit branches.)

activeActivity.remainingMinutes -= dt × 60
if activeActivity.remainingMinutes <= 0: activeActivity = null


═══════════════════════════════════════════════════════════════
7. KETOSIS (hidden gauge)
═══════════════════════════════════════════════════════════════

if (G/Gcap < ketosisGlycogenThreshold) and (hoursSinceLastFeed > ketosisFastingDelayHours):
dK = k1 × (ketosisGlycogenThreshold − G/Gcap) × dt
else:
dK = −k2 × K × dt

K = clamp(K + dK, 0, 100)


═══════════════════════════════════════════════════════════════
8. AUTOPHAGY (hidden gauge)
═══════════════════════════════════════════════════════════════

if G/Gcap < autophagyGlycogenThreshold:
dAuto = a1 × max(0, hoursSinceLastFeed − autophagyFastingDelayHours) × dt
else:
dAuto = −a2 × Auto × dt

Auto = clamp(Auto + dAuto, 0, 100)

// on a confirmed Feed event only:
if lastMealKcal > autophagySuppressionMealKcal:
Auto *= autophagySuppressionFactor


═══════════════════════════════════════════════════════════════
9. FAT FLOOR (deficit dampening)
═══════════════════════════════════════════════════════════════

FatFloor = FatFloorFraction × weight // ~3% of bodyweight, essential fat

As `Fat` approaches `FatFloor`, dampen further deficit draw (diminishing returns)
rather than hard-stopping:

if Fat <= FatFloor × 1.1:
deficitDampening = clamp((Fat − FatFloor) / (FatFloor × 0.1), 0, 1)
// multiply any further Fat-depleting delta by deficitDampening


═══════════════════════════════════════════════════════════════
10. BODY EXPANSION (visual mapping)
═══════════════════════════════════════════════════════════════

ΔFat = Fat − Fat0
bodyScale = clamp(1 + 0.15 × ln(1 + max(0, ΔFat)/5), 1, 1.6)

Recompute every tick; drive the silhouette's scale transform. On a tick where
`overflowEvent === true`, additionally trigger a one-shot glow/pulse animation,
then clear the flag.

═══════════════════════════════════════════════════════════════
11. SIMULATION LOOP
═══════════════════════════════════════════════════════════════
- Drive via `requestAnimationFrame`. Compute `realDt` (seconds since last frame),
  convert to simulated hours: `dt_sim = (realDt/3600) × timeScale`.
- If `dt_sim > 0.05`, sub-step: run the update in §4–§10 in chunks of ≤0.05
  simulated hours until the full `dt_sim` is consumed (keeps Euler integration
  stable at high `timeScale`).
- `timeScale` options: 1x, 10x, 60x, 360x. Changing speed takes effect on the next
  frame, no discontinuity.
- Pause freezes `simulatedTime` and all state; resume continues from exact state.

═══════════════════════════════════════════════════════════════
12. UI / SCREENS
═══════════════════════════════════════════════════════════════
1. **Onboarding** — gender, height, weight, bodyfat% inputs → compute profile
   constants → route to dashboard.
2. **Main dashboard**
   - Animated body silhouette, fill = `G/Gcap` (0–100%), gender-matched, scaled
     by `bodyScale`.
   - Clock control: play/pause, speed selector, simulated time readout.
   - Feed / Move buttons.
   - Energy % numeric readout.
   - Collapsible "Body signals" drawer: K and Auto as minimal radial/bar gauges,
     visually inert below a low threshold (e.g. 10), highlighted (color + subtle
     glow) above it.
   - History sparkline of `G/Gcap` over `simulatedTime` (rolling window, e.g.
     last 48 simulated hours).
3. **Feed sheet** — carb/protein/fat gram inputs (sliders + numeric steppers),
   live total-kcal readout, confirm/cancel.
4. **Move sheet** — duration (minutes) + kcal-expended inputs, or preset picker
   (walk/run/gym/HIIT with editable kcal), confirm/cancel.
5. Responsive: single column <640px, gauge + controls side-by-side above that.

═══════════════════════════════════════════════════════════════
13. INTERACTIVE FUNCTIONALITY (augmented)
═══════════════════════════════════════════════════════════════
- **Toast/alert notifications** on state transitions: glycogen fully depleted,
  ketosis onset (K crosses 10), autophagy onset (Auto crosses 10), overflow into
  fat storage (each overflowEvent), Fat reaching FatFloor. Debounce so repeated
  crossings near a threshold don't spam.
- **Queued actions during fast-forward**: if the user opens Feed or Move while
  `timeScale > 1`, auto-pause the clock for the duration the sheet is open, then
  resume at the previously selected speed on confirm/cancel.
- **Undo last action**: a single-level undo (re-apply prior state snapshot) for
  the most recent Feed or Move — snapshot state immediately before applying each
  action.
- **Reset simulation**: button to return to onboarding, clearing all state (with
  a confirmation dialog).
- **Scenario presets**: quick-apply buttons (e.g. "Skip breakfast", "16:8
  intermittent fasting", "Post-workout refeed") that pre-fill Feed/Move sheets
  or fast-forward the clock by a set number of hours with no feeding.
- **Info popovers**: tappable "?" on each gauge (energy, ketosis, autophagy)
  with a 1–2 sentence plain-language explanation of what it represents.
- **Debug/QA panel** (dev-mode only, toggle via a hidden gesture or `?debug=1`
  query param): raw numeric readout of every state variable and constant, for
  formula verification.
- **Accessibility**: reduced-motion mode (disables the expansion/pulse
  animation, replaces with a static state change), ARIA labels on all gauges
  announcing current value and trend, full keyboard navigation for Feed/Move
  sheets.
- **Optional persistence**: explicit "Save session" control that writes state to
  localStorage and a "Resume last session" prompt on load — off by default, not
  silent autosave.

═══════════════════════════════════════════════════════════════
14. EDGE CASES / VALIDATION
═══════════════════════════════════════════════════════════════
- Reject negative inputs; cap single-meal macro inputs at 300g each with inline
  hints when exceeded.
- Soft-warn (not block) if Move kcal exceeds a physiologically reasonable
  ceiling for the given duration (e.g. > 20 kcal/min sustained).
- `G` and `Fat` must never go negative; `Fat` respects `FatFloor` per §9.
- If two Move actions would overlap, either queue the second after the first
  completes or block starting a new one while `activeActivity` is active
  (block is simpler — implement this for v1, flag queueing as a future
  enhancement).

═══════════════════════════════════════════════════════════════
15. TESTING REQUIREMENTS
═══════════════════════════════════════════════════════════════
- Implement the simulation engine as an isolated module (e.g.
  `useMetabolismSimulation` hook or a plain `simulateTick(state, dt, config)`
  pure function) decoupled from rendering, so §4–§10 can be unit-tested
  independently of the UI.
- Include unit tests for: digestion buffer decay, overflow → fat conversion,
  deficit → fat draw, activity fuel-mix split, ketosis onset/decay thresholds,
  autophagy onset/decay + meal suppression, fat floor dampening.

═══════════════════════════════════════════════════════════════
16. DELIVERABLE
═══════════════════════════════════════════════════════════════
A working single-page app matching the screens in §12, with all interactive
functionality from §13, built on the exact formulas in §4–§10, with tunable
constants centralized in `config.ts` and the simulation engine unit-tested per
§15.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/323f774d-d288-465d-8691-3b43b443d03b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
