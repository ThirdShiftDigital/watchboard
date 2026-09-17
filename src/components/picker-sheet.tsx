import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Overlay } from "./overlay";

type Option = { id: string; label: string; hint?: string };

export function PickerSheet({
  title,
  options,
  value,
  onChange,
  onClose,
  searchable = true,
  searchPlaceholder = "Search",
}: {
  title: string;
  options: Option[];
  value: string;
  onChange: (id: string) => void;
  onClose: () => void;
  searchable?: boolean;
  searchPlaceholder?: string;
}) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return options;
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(needle) ||
        o.hint?.toLowerCase().includes(needle) ||
        o.id.toLowerCase().includes(needle),
    );
  }, [options, q]);

  return (
    <Overlay>
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-0 sm:items-center sm:p-6">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close picker"
        onClick={onClose}
      />
      <div className="relative flex max-h-dvh w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-border bg-card shadow-panel sm:rounded-xl">
        <header className="border-b border-border px-5 py-4">
          <h2 className="font-display text-xl font-semibold uppercase tracking-wide">
            {title}
          </h2>
        </header>
        {searchable ? (
          <div className="px-4 pt-3">
            <Input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
            />
          </div>
        ) : null}
        <ul className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {filtered.map((opt) => {
            const selected = opt.id === value;
            return (
              <li key={opt.id}>
                <button
                  type="button"
                  onClick={() => onChange(opt.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors",
                    selected ? "bg-primary/10" : "hover:bg-card-2",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border",
                      selected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border-strong",
                    )}
                  >
                    {selected ? <Check className="size-3" strokeWidth={3} /> : null}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium tracking-wide">
                      {opt.label}
                    </span>
                    {opt.hint ? (
                      <span className="text-xs text-muted">{opt.hint}</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
          {filtered.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted">No matches</li>
          ) : null}
        </ul>
        <footer className="flex justify-end border-t border-border px-4 py-3">
          <Button variant="ghost" onClick={onClose} className="text-primary">
            Done
          </Button>
        </footer>
      </div>
    </div>
    </Overlay>
  );
}
