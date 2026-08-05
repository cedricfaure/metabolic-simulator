import { useEffect, useState } from "react";
import type { Gender } from "@/lib/metabolism/engine";

const MALE_PATH =
  "M50 4c5.5 0 9.5 4.3 9.5 9.8S55.5 24 50 24s-9.5-4.7-9.5-10.2S44.5 4 50 4zM33 28c3.5-2 10-3.5 17-3.5S63.5 26 67 28c6 3.4 9 9 10 16l3.5 22c.6 4-1.4 6.7-4.6 7.2-3.2.5-5.7-1.4-6.4-5.2L67 55v27l4 44c.5 5-2.2 8-6.3 8-3.7 0-6-2.3-6.6-6.6L54 92h-8l-4.1 35.4c-.5 4.3-2.9 6.6-6.6 6.6-4.1 0-6.8-3-6.3-8l4-44V55l-2.5 13c-.7 3.8-3.2 5.7-6.4 5.2C20.9 72.7 18.9 70 19.5 66L23 44c1-7 4-12.6 10-16z";

const FEMALE_PATH =
  "M50 4c5.3 0 9.2 4.3 9.2 9.8S55.3 24 50 24s-9.2-4.7-9.2-10.2S44.7 4 50 4zM35 28c3.2-2 9.5-3.5 15-3.5S62.8 26 66 28c5.6 3.3 8.4 9 9.4 16l3.2 21c.6 4-1.3 6.7-4.4 7.2-3.1.5-5.5-1.4-6.2-5.2L66 54l1.8 20.5c.3 3.4-1.4 5.5-4.6 5.5h-1.4l3.1 45.5c.3 4.6-2.2 7.5-6.1 7.5-3.5 0-5.8-2.3-6.3-6.7L50 94l-2.5 32.3c-.5 4.4-2.8 6.7-6.3 6.7-3.9 0-6.4-2.9-6.1-7.5L38.2 80h-1.4c-3.2 0-4.9-2.1-4.6-5.5L34 54l-2 13c-.7 3.8-3.1 5.7-6.2 5.2-3.1-.5-5-3.2-4.4-7.2l3.2-21c1-7 3.8-12.7 9.4-16z";

interface Props {
  gender: Gender;
  fillRatio: number;
  scale: number;
  overflowPulse: boolean;
  reducedMotion: boolean;
}

export function BodySilhouette({ gender, fillRatio, scale, overflowPulse, reducedMotion }: Props) {
  const [pulseKey, setPulseKey] = useState(0);
  useEffect(() => {
    if (overflowPulse && !reducedMotion) setPulseKey((k) => k + 1);
  }, [overflowPulse, reducedMotion]);

  const pct = Math.round(fillRatio * 100);
  const path = gender === "female" ? FEMALE_PATH : MALE_PATH;

  return (
    <div
      className="relative flex items-center justify-center"
      role="img"
      aria-label={`Body energy gauge, glycogen ${pct} percent full, body mass scale ${scale.toFixed(2)}`}
    >
      <svg
        key={pulseKey}
        viewBox="0 0 100 140"
        className="h-[52vh] max-h-[460px] w-auto"
        style={{
          transform: `scaleX(${scale}) scaleY(${1 + (scale - 1) * 0.35})`,
          transformOrigin: "50% 100%",
          transition: reducedMotion ? "none" : "transform 600ms cubic-bezier(.22,1,.36,1)",
          animation: overflowPulse && !reducedMotion ? "var(--animate-pulse-glow)" : undefined,
        }}
      >
        <defs>
          <linearGradient id="energyFill" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="var(--energy-dim)" />
            <stop offset="100%" stopColor="var(--energy)" />
          </linearGradient>
          <clipPath id="bodyClip">
            <path d={path} />
          </clipPath>
        </defs>

        <path d={path} fill="var(--surface)" stroke="var(--border)" strokeWidth="0.8" />

        <g clipPath="url(#bodyClip)">
          <rect
            x="0"
            y={140 - fillRatio * 140}
            width="100"
            height={fillRatio * 140}
            fill="url(#energyFill)"
            style={{ transition: reducedMotion ? "none" : "y 400ms linear, height 400ms linear" }}
          />
          {Array.from({ length: 13 }).map((_, i) => (
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

        <path
          d={path}
          fill="none"
          stroke="var(--energy)"
          strokeOpacity="0.5"
          strokeWidth="0.9"
        />
      </svg>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center">
        <span className="numeric text-5xl font-semibold text-foreground drop-shadow-lg">{pct}%</span>
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Energy</span>
      </div>
    </div>
  );
}