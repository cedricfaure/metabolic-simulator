import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { MOVE_KCAL_PER_MIN_WARN, MOVE_PRESETS } from "@/lib/metabolism/config";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (durationMinutes: number, totalKcal: number) => void;
  blocked: boolean;
  prefill?: { durationMinutes: number; totalKcal: number } | null;
}

export function MoveSheet({ open, onOpenChange, onConfirm, blocked, prefill }: Props) {
  const [duration, setDuration] = useState(30);
  const [kcal, setKcal] = useState(300);

  useEffect(() => {
    if (open && prefill) {
      setDuration(prefill.durationMinutes);
      setKcal(prefill.totalKcal);
    }
  }, [open, prefill]);

  const intensity = duration > 0 ? kcal / duration : 0;
  const tooIntense = intensity > MOVE_KCAL_PER_MIN_WARN;
  const invalid = duration <= 0 || kcal <= 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto max-w-xl rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Start an activity</SheetTitle>
          <SheetDescription>
            Fuel is split between glycogen and fat based on how full your stores are.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {MOVE_PRESETS.map((p) => (
              <Button
                key={p.label}
                variant="secondary"
                size="sm"
                onClick={() => {
                  setDuration(p.durationMinutes);
                  setKcal(p.totalKcal);
                }}
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="duration">Duration (min)</Label>
              <Input
                id="duration"
                type="number"
                min={1}
                value={duration}
                onChange={(e) => setDuration(Math.max(0, Number(e.target.value) || 0))}
                className="numeric"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="kcal">Energy burned (kcal)</Label>
              <Input
                id="kcal"
                type="number"
                min={1}
                value={kcal}
                onChange={(e) => setKcal(Math.max(0, Number(e.target.value) || 0))}
                className="numeric"
                aria-describedby={tooIntense ? "kcal-warn" : undefined}
              />
            </div>
          </div>

          <div className="flex items-baseline justify-between rounded-lg border border-border bg-card/60 px-4 py-3">
            <span className="text-sm text-muted-foreground">Intensity</span>
            <span className="numeric text-xl font-semibold text-primary">
              {intensity.toFixed(1)} kcal/min
            </span>
          </div>

          {tooIntense && (
            <p id="kcal-warn" className="text-xs text-destructive">
              Above {MOVE_KCAL_PER_MIN_WARN} kcal/min is hard to sustain — you can still continue.
            </p>
          )}
          {blocked && (
            <p className="text-xs text-destructive">
              An activity is already running. Wait for it to finish.
            </p>
          )}
        </div>

        <SheetFooter className="flex-row gap-2">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={invalid || blocked}
            onClick={() => {
              onConfirm(duration, kcal);
              onOpenChange(false);
            }}
          >
            Start moving
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}