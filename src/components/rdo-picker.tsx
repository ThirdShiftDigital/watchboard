import { cn } from "@/lib/cn";
import { RDO_PAIRS, WEEKDAY_SHORT } from "@/lib/types";

export function RdoPicker({
  value,
  onChange,
}: {
  value: number[];
  onChange: (days: number[]) => void;
}) {
  const selected = new Set(value);

  function toggle(day: number) {
    if (selected.has(day)) onChange(value.filter((d) => d !== day));
    else onChange([...value, day].sort((a, b) => a - b));
  }

  function applyPair(days: readonly number[]) {
    const same =
      days.length === selected.size && days.every((d) => selected.has(d));
    onChange(same ? [] : [...days]);
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {RDO_PAIRS.map((pair) => {
          const active =
            pair.days.length === selected.size &&
            pair.days.every((d) => selected.has(d));
          return (
            <button
              key={pair.label}
              type="button"
              onClick={() => applyPair(pair.days)}
              className={cn(
                "h-8 rounded-sm px-2.5 text-2xs font-medium tracking-wide",
                active
                  ? "bg-primary text-primary-foreground"
                  : "bg-card-2 text-muted hover:text-foreground",
              )}
            >
              {pair.label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {WEEKDAY_SHORT.map((label, day) => {
          const on = selected.has(day);
          return (
            <button
              key={label}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(day)}
              className={cn(
                "flex h-12 flex-col items-center justify-center rounded-sm text-2xs font-medium tracking-wide",
                on
                  ? "bg-rdo text-rdo-fg"
                  : "border border-border-strong text-muted hover:text-foreground",
              )}
            >
              <span>{label}</span>
              <span className="mt-0.5 text-micro">{on ? "RDO" : "ON"}</span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted">
        Most deputies run two consecutive days. Tap a pair or toggle individual
        days.
      </p>
    </div>
  );
}
