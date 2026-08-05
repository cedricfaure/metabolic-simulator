import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createProfile, type Gender, type ProfileInput } from "@/lib/metabolism/engine";

interface Props {
  onStart: (input: ProfileInput) => void;
  savedAvailable: boolean;
  onResume: () => void;
}

export function Onboarding({ onStart, savedAvailable, onResume }: Props) {
  const [gender, setGender] = useState<Gender>("male");
  const [heightCm, setHeightCm] = useState(178);
  const [weightKg, setWeightKg] = useState(78);
  const [bodyfatPct, setBodyfatPct] = useState(18);

  const errors: string[] = [];
  if (heightCm < 100 || heightCm > 250) errors.push("Height must be between 100 and 250 cm.");
  if (weightKg < 30 || weightKg > 300) errors.push("Weight must be between 30 and 300 kg.");
  if (bodyfatPct < 3 || bodyfatPct > 70) errors.push("Body fat must be between 3% and 70%.");

  const valid = errors.length === 0;
  const preview = valid ? createProfile({ gender, heightCm, weightKg, bodyfatPct }) : null;

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-6 px-4 py-10">
      <header className="animate-[rise_0.4s_ease-out_both]">
        <p className="text-xs uppercase tracking-[0.35em] text-primary">Metabolic Gauge</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Watch your metabolism run in real time
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your body composition. Everything else — glycogen, fat, ketosis, autophagy — is
          simulated from it.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your body</CardTitle>
          <CardDescription>Used to derive BMR and glycogen capacity.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-2">
            <Label>Gender</Label>
            <div className="grid grid-cols-2 gap-2">
              {(["male", "female"] as const).map((g) => (
                <Button
                  key={g}
                  type="button"
                  variant={gender === g ? "default" : "secondary"}
                  aria-pressed={gender === g}
                  onClick={() => setGender(g)}
                  className="capitalize"
                >
                  {g}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label htmlFor="height">Height (cm)</Label>
              <Input
                id="height"
                type="number"
                className="numeric"
                value={heightCm}
                onChange={(e) => setHeightCm(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="weight">Weight (kg)</Label>
              <Input
                id="weight"
                type="number"
                className="numeric"
                value={weightKg}
                onChange={(e) => setWeightKg(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bodyfat">Body fat (%)</Label>
              <Input
                id="bodyfat"
                type="number"
                className="numeric"
                value={bodyfatPct}
                onChange={(e) => setBodyfatPct(Math.max(0, Number(e.target.value) || 0))}
              />
            </div>
          </div>

          {errors.length > 0 && (
            <ul className="space-y-1 text-xs text-destructive" role="alert">
              {errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}

          {preview && (
            <dl className="grid grid-cols-3 gap-2 rounded-lg border border-border bg-card/60 p-3 text-center">
              {[
                ["Lean mass", `${preview.LBM.toFixed(1)} kg`],
                ["BMR", `${Math.round(preview.BMR)} kcal`],
                ["Glycogen", `${Math.round(preview.Gcap)} kcal`],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] uppercase tracking-widest text-muted-foreground">{k}</dt>
                  <dd className="numeric text-sm font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          )}

          <Button
            className="w-full"
            size="lg"
            disabled={!valid}
            onClick={() => onStart({ gender, heightCm, weightKg, bodyfatPct })}
          >
            Start simulation
          </Button>

          {savedAvailable && (
            <Button variant="outline" className="w-full" onClick={onResume}>
              Resume last saved session
            </Button>
          )}
        </CardContent>
      </Card>
    </main>
  );
}