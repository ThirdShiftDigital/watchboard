import { Check, X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";

/** Phone-friendly multi-select of officers on the commander's shift. */
export function OfficerPicker({
  officers,
  selected,
  onDone,
  onClose,
}: {
  officers: { id: string; name: string; unit?: string }[];
  selected: string[];
  onDone: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [picked, setPicked] = useState<Set<string>>(new Set(selected));
  const all = picked.size === officers.length;
  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-label="Choose officers">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-t-xl bg-card sm:rounded-xl">
        <div className="flex items-center justify-between px-4 pt-3">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Officers</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="flex size-10 items-center justify-center">
            <X className="size-5" />
          </button>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 pb-2">
          <p className="text-xs text-muted">
            {picked.size} of {officers.length} selected
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPicked(new Set(officers.map((o) => o.id)))}
              disabled={all}
              className="min-h-[36px] rounded-md border border-border px-3 text-sm disabled:opacity-40"
            >
              Select all
            </button>
            <button
              type="button"
              onClick={() => setPicked(new Set())}
              disabled={!picked.size}
              className="min-h-[36px] rounded-md border border-border px-3 text-sm disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>
        <ul className="flex-1 overflow-auto border-y border-border">
          {officers.map((o) => {
            const on = picked.has(o.id);
            return (
              <li key={o.id}>
                <label className="flex min-h-[48px] cursor-pointer items-center gap-3 px-4 py-2 active:bg-card-2">
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => toggle(o.id)} />
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded border",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border",
                    )}
                  >
                    {on ? <Check className="size-4" /> : null}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{o.name}</span>
                  {o.unit ? <span className="tabular text-xs text-muted">{o.unit}</span> : null}
                </label>
              </li>
            );
          })}
        </ul>
        <div className="p-4">
          <button
            type="button"
            disabled={!picked.size}
            onClick={() => onDone(officers.filter((o) => picked.has(o.id)).map((o) => o.id))}
            className="min-h-[44px] w-full rounded-md bg-primary text-sm font-medium text-primary-foreground disabled:opacity-40"
          >
            {picked.size ? `Show ${picked.size === officers.length ? "all" : picked.size} ${picked.size === 1 ? "officer" : "officers"}` : "Pick at least one"}
          </button>
        </div>
      </div>
    </div>
  );
}
