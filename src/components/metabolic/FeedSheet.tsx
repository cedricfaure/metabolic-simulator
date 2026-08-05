import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { CONFIG, MAX_MACRO_GRAMS } from "@/lib/metabolism/config";
import type { FeedInput } from "@/lib/metabolism/engine";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (meal: FeedInput) => void;
  prefill?: FeedInput | null;
}

const MACROS = [
  { key: "carb_g", label: "Carbohydrate", kcal: CONFIG.kcal_per_g_carb },
  { key: "protein_g", label: "Protein", kcal: CONFIG.kcal_per_g_protein },
  { key: "fat_g", label: "Fat", kcal: CONFIG.kcal_per_g_fat },
] as const;

export function FeedSheet({ open, onOpenChange, onConfirm, prefill }: Props) {
  const [meal, setMeal] = useState<FeedInput>({ carb_g: 60, protein_g: 30, fat_g: 15 });

  useEffect(() => {
    if (open && prefill) setMeal(prefill);
  }, [open, prefill]);

  const set = (key: keyof FeedInput, raw: number) =>
    setMeal((m) => ({ ...m, [key]: Number.isFinite(raw) ? Math.max(0, raw) : 0 }));

  const total =
    meal.carb_g * CONFIG.kcal_per_g_carb +
    meal.protein_g * CONFIG.kcal_per_g_protein +
    meal.fat_g * CONFIG.kcal_per_g_fat;
  const overCap = MACROS.some(({ key }) => meal[key] > MAX_MACRO_GRAMS);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-xl rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Log a meal</SheetTitle>
          <SheetDescription>
            Macros are converted to kcal and absorbed over time, not instantly.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4">
          {MACROS.map(({ key, label, kcal }) => {
            const value = meal[key];
            const over = value > MAX_MACRO_GRAMS;
            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor={key}>
                    {label}{" "}
                    <span className="text-xs text-muted-foreground">({kcal} kcal/g)</span>
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id={key}
                      type="number"
                      min={0}
                      step={5}
                      value={value}
                      onChange={(e) => set(key, Number(e.target.value))}
                      className="numeric h-8 w-24"
                      aria-describedby={over ? `${key}-hint` : undefined}
                    />
                    <span className="text-xs text-muted-foreground">g</span>
                  </div>
                </div>
                <Slider
                  value={[Math.min(value, MAX_MACRO_GRAMS)]}
                  max={MAX_MACRO_GRAMS}
                  step={1}
                  onValueChange={([v]) => set(key, v ?? 0)}
                  aria-label={`${label} grams`}
                />
                {over && (
                  <p id={`${key}-hint`} className="text-xs text-destructive">
                    Cap is {MAX_MACRO_GRAMS} g per meal.
                  </p>
                )}
              </div>
            );
          })}

          <div className="flex items-baseline justify-between rounded-lg border border-border bg-card/60 px-4 py-3">
            <span className="text-sm text-muted-foreground">Total intake</span>
            <span className="numeric text-2xl font-semibold text-primary">
              {Math.round(total)} kcal
            </span>
          </div>
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={overCap || total <= 0}
            onClick={() => {
              onConfirm(meal);
              onOpenChange(false);
            }}
          >
            Eat this
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}