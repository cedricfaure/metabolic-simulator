import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { DEFAULT_TUNING, type ShapeTuning } from "./BodySilhouette";
import { InfoPopover } from "./InfoPopover";

interface Props {
  tuning: ShapeTuning;
  onTuningChange: (t: ShapeTuning) => void;
  showRegions: boolean;
  onShowRegionsChange: (v: boolean) => void;
}

const ROWS: { key: keyof ShapeTuning; label: string; hint: string }[] = [
  { key: "strength", label: "Fat → width strength", hint: "How much every region widens per point of body fat." },
  { key: "waistWeight", label: "Waist weighting", hint: "Extra emphasis on waist expansion." },
  { key: "hipWeight", label: "Hip / thigh weighting", hint: "Extra emphasis on hip and thigh expansion." },
];

export function ShapeControls({ tuning, onTuningChange, showRegions, onShowRegionsChange }: Props) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="flex w-full items-center justify-between rounded-lg border border-border bg-card/50 px-4 py-2 text-sm">
        <span>Silhouette realism</span>
        <span className="text-xs text-muted-foreground">toggle</span>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-2 space-y-4 rounded-xl border border-border bg-card/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <span className="text-sm">Fat distribution overlay</span>
            <InfoPopover
              title="Fat distribution overlay"
              body="Draws waist, hip and thigh measurement lines with their change versus your starting shape, so region-by-region widening is easy to verify."
            />
          </div>
          <Switch
            checked={showRegions}
            onCheckedChange={onShowRegionsChange}
            aria-label="Show fat distribution overlay"
          />
        </div>

        {ROWS.map((row) => (
          <div key={row.key}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">{row.label}</span>
                <InfoPopover title={row.label} body={row.hint} />
              </div>
              <span className="numeric text-xs">{tuning[row.key].toFixed(2)}x</span>
            </div>
            <Slider
              value={[tuning[row.key]]}
              min={0}
              max={2}
              step={0.05}
              aria-label={row.label}
              onValueChange={([v]) => onTuningChange({ ...tuning, [row.key]: v ?? 1 })}
            />
          </div>
        ))}

        <Button variant="outline" size="sm" onClick={() => onTuningChange(DEFAULT_TUNING)}>
          Reset to defaults
        </Button>
      </CollapsibleContent>
    </Collapsible>
  );
}
