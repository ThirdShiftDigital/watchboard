import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { cleanZoneId, ZONE_PRESETS } from "@/lib/types";

export function ZoneListEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function setAt(index: number, raw: string) {
    const next = [...value];
    next[index] = raw;
    onChange(next);
  }

  function removeAt(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  function add() {
    onChange([...value, ""]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {ZONE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="rounded-md border border-border px-2 py-1 text-2xs uppercase tracking-wide text-muted hover:border-primary hover:text-foreground"
            onClick={() => onChange([...p.zones])}
          >
            {p.label}
          </button>
        ))}
      </div>
      <ul className="space-y-2">
        {value.map((zone, index) => (
          <li key={index} className="flex items-center gap-2">
            <span className="w-6 text-center text-2xs tabular text-subtle">{index + 1}</span>
            <Input
              value={zone}
              onChange={(e) => setAt(index, e.target.value)}
              onBlur={() => setAt(index, cleanZoneId(zone))}
              placeholder="Zone (NE, BEAT 1, DOWNTOWN)"
              className="flex-1"
            />
            <button
              type="button"
              aria-label="Remove zone"
              className="flex size-11 items-center justify-center text-muted hover:text-destructive"
              onClick={() => removeAt(index)}
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
      <Button type="button" variant="secondary" className="w-full" onClick={add}>
        <Plus className="size-4" />
        Add zone
      </Button>
      <p className={cn("text-xs text-muted")}>
        These are the zones a supervisor picks on the watch. Order here is the
        order on the board and the send list.
      </p>
    </div>
  );
}
