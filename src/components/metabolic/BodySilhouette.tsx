import { useEffect, useMemo, useState } from "react";
import type { Gender } from "@/lib/metabolism/engine";

type Pt = [number, number];

/** Catmull-Rom → cubic bezier, closed loop. */
function smoothClosedPath(pts: Pt[], tension = 0.5): string {
  const n = pts.length;
  const p = (i: number): Pt => pts[((i % n) + n) % n] as Pt;
  let d = `M${p(0)[0].toFixed(2)},${p(0)[1].toFixed(2)}`;
  for (let i = 0; i < n; i++) {
    const p0 = p(i - 1);
    const p1 = p(i);
    const p2 = p(i + 1);
    const p3 = p(i + 2);
    const c1: Pt = [p1[0] + ((p2[0] - p0[0]) / 6) * tension * 2, p1[1] + ((p2[1] - p0[1]) / 6) * tension * 2];
    const c2: Pt = [p2[0] - ((p3[0] - p1[0]) / 6) * tension * 2, p2[1] - ((p3[1] - p1[1]) / 6) * tension * 2];
    d += ` C${c1[0].toFixed(2)},${c1[1].toFixed(2)} ${c2[0].toFixed(2)},${c2[1].toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d + "Z";
}

interface Metrics {
  neck: number;
  shoulder: number;
  chest: number;
  waist: number;
  hip: number;
  thigh: number;
  knee: number;
  calf: number;
  ankle: number;
  arm: number;
  head: number;
}

const BASE: Record<Gender, Metrics> = {
  male: { neck: 4.6, shoulder: 18.4, chest: 13.2, waist: 11.0, hip: 14.0, thigh: 7.0, knee: 4.7, calf: 5.3, ankle: 2.9, arm: 4.0, head: 6.2 },
  female: { neck: 4.0, shoulder: 15.6, chest: 11.6, waist: 9.6, hip: 14.6, thigh: 7.2, knee: 4.4, calf: 5.0, ankle: 2.7, arm: 3.5, head: 6.0 },
};

/** Gradual, region-weighted response to body-fat %. Reference physique = 18%. */
function metricsFor(gender: Gender, bf: number): Metrics {
  const b = BASE[gender];
  const d = (bf - 18) / 100;
  const g = (k: number) => 1 + d * k;
  // Female fat deposits more on hips/thighs, male more on waist.
  const waistK = gender === "male" ? 2.5 : 1.9;
  const hipK = gender === "male" ? 1.3 : 2.0;
  const thighK = gender === "male" ? 1.1 : 1.8;
  return {
    neck: b.neck * g(0.5),
    shoulder: b.shoulder * g(0.45),
    chest: b.chest * g(1.15),
    waist: b.waist * g(waistK),
    hip: b.hip * g(hipK),
    thigh: b.thigh * g(thighK),
    knee: b.knee * g(0.4),
    calf: b.calf * g(0.6),
    ankle: b.ankle * g(0.25),
    arm: b.arm * g(1.0),
    head: b.head,
  };
}

/** Head + torso + legs as one smooth closed outline (x mirrored around 50). */
function bodyPath(m: Metrics): string {
  const C = 50;
  const legAxis = m.hip * 0.42;
  const right: Pt[] = [
    [C + m.neck * 0.6, 20.5],
    [C + m.neck, 24.5],
    [C + m.chest * 0.72, 28],
    [C + m.chest * 1.02, 34],
    [C + m.chest * 1.0, 40],
    [C + m.chest, 46],
    [C + m.chest * 0.9, 53],
    [C + m.waist, 61],
    [C + m.hip * 0.93, 68],
    [C + m.hip, 75],
    [C + m.hip * 0.94, 82],
    [C + legAxis + m.thigh, 90],
    [C + legAxis * 0.94 + m.thigh * 0.88, 101],
    [C + legAxis * 0.82 + m.knee, 112],
    [C + legAxis * 0.78 + m.calf, 120],
    [C + legAxis * 0.62 + m.ankle, 131],
    [C + legAxis * 0.62 + m.ankle * 1.3, 136.5],
  ];
  const innerRight: Pt[] = [
    [C + 1.9, 137],
    [C + 2.1, 131],
    [C + 2.7, 120],
    [C + 2.3, 112],
    [C + 2.9, 100],
    [C + 2.1, 88],
  ];
  const mirror = (p: Pt): Pt => [2 * C - p[0], p[1]];
  const pts: Pt[] = [
    ...right,
    ...innerRight,
    [C, 84],
    ...innerRight.map(mirror).reverse(),
    ...right.map(mirror).reverse(),
    [C - m.neck * 0.6, 20.5],
  ];
  return smoothClosedPath(pts, 0.5);
}

function headPath(m: Metrics): string {
  const C = 50;
  return `M${C},${5.5}a${m.head},${m.head * 1.22} 0 1 0 0.01,0Z`;
}

/** One arm hanging beside the torso; side = 1 (right) or -1 (left). */
function armPath(m: Metrics, side: 1 | -1): string {
  const C = 50;
  const axis = m.shoulder - m.arm;
  const spine: { x: number; y: number; w: number }[] = [
    { x: axis * 0.86, y: 33, w: m.arm * 1.02 },
    { x: axis, y: 43, w: m.arm * 0.92 },
    { x: axis * 0.99, y: 56, w: m.arm * 0.76 },
    { x: axis * 0.96, y: 70, w: m.arm * 0.6 },
    { x: axis * 0.92, y: 84, w: m.arm * 0.52 },
  ];
  const outer: Pt[] = spine.map((s) => [C + side * (s.x + s.w), s.y]);
  const inner: Pt[] = spine.map((s) => [C + side * (s.x - s.w), s.y]);
  return smoothClosedPath([...outer, ...inner.reverse()], 0.5);
}

interface Props {
  gender: Gender;
  fillRatio: number;
  bodyFat: number;
  baseBodyFat: number;
  overflowPulse: boolean;
  reducedMotion: boolean;
}

export function BodySilhouette({
  gender,
  fillRatio,
  bodyFat,
  baseBodyFat,
  overflowPulse,
  reducedMotion,
}: Props) {
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    if (overflowPulse && !reducedMotion) setPulseKey((k) => k + 1);
  }, [overflowPulse, reducedMotion]);

  const pct = Math.round(fillRatio * 100);

  const shape = useMemo(() => {
    const m = metricsFor(gender, bodyFat);
    return { body: bodyPath(m), head: headPath(m), armR: armPath(m, 1), armL: armPath(m, -1) };
  }, [gender, bodyFat]);

  const ghost = useMemo(() => {
    const m = metricsFor(gender, baseBodyFat);
    return { body: bodyPath(m), head: headPath(m), armR: armPath(m, 1), armL: armPath(m, -1) };
  }, [gender, baseBodyFat]);

  const ghostVisible = Math.abs(bodyFat - baseBodyFat) > 0.15;

  return (
    <div
      className="relative flex items-center justify-center"
      role="img"
      aria-label={`Body composition figure, glycogen ${pct} percent full, body fat ${bodyFat.toFixed(1)} percent versus starting ${baseBodyFat.toFixed(1)} percent`}
    >
      <svg
        key={pulseKey}
        viewBox="0 0 100 144"
        className="h-[52vh] max-h-[460px] w-auto"
        style={{
          animation: overflowPulse && !reducedMotion ? "var(--animate-pulse-glow)" : undefined,
        }}
      >
        <defs>
          <linearGradient id="energyFill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--energy-dim)" />
            <stop offset="100%" stopColor="var(--energy)" />
          </linearGradient>
          <clipPath id="bodyClip">
            <path d={shape.head} />
            <path d={shape.body} />
            <path d={shape.armR} />
            <path d={shape.armL} />
          </clipPath>
        </defs>

        {/* Starting-shape ghost */}
        <g
          opacity={ghostVisible ? 0.45 : 0}
          style={{ transition: reducedMotion ? "none" : "opacity 600ms ease" }}
        >
          {[ghost.head, ghost.body, ghost.armR, ghost.armL].map((d, i) => (
            <path
              key={i}
              d={d}
              fill="var(--muted-foreground)"
              fillOpacity="0.07"
              stroke="var(--muted-foreground)"
              strokeOpacity="0.55"
              strokeWidth="0.7"
              strokeDasharray="2.5 2"
            />
          ))}
        </g>

        {/* Current shape */}
        {[shape.head, shape.body, shape.armR, shape.armL].map((d, i) => (
          <path key={i} d={d} fill="var(--surface)" stroke="var(--border)" strokeWidth="0.8" />
        ))}

        <g clipPath="url(#bodyClip)">
          <rect
            x="0"
            y={144 - fillRatio * 144}
            width="100"
            height={fillRatio * 144}
            fill="url(#energyFill)"
            style={{ transition: reducedMotion ? "none" : "y 400ms linear, height 400ms linear" }}
          />
          {Array.from({ length: 14 }).map((_, i) => (
            <line
              key={i}
              x1="0"
              x2="100"
              y1={i * 10 + 5}
              y2={i * 10 + 5}
              stroke="var(--background)"
              strokeOpacity="0.18"
              strokeWidth="0.6"
            />
          ))}
        </g>

        {[shape.head, shape.body, shape.armR, shape.armL].map((d, i) => (
          <path
            key={i}
            d={d}
            fill="none"
            stroke="var(--energy)"
            strokeOpacity="0.5"
            strokeWidth="0.9"
          />
        ))}
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="numeric text-5xl font-semibold text-foreground drop-shadow-lg">{pct}%</span>
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Energy</span>
      </div>
    </div>
  );
}
