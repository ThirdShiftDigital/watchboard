import { ArrowDown, ArrowUp, GripVertical, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Overlay } from "@/components/overlay";
import { SheriffMark } from "@/components/sheriff-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { cleanZoneId, normalizeZoneOrder, zoneHint, ZONE_PRESETS } from "@/lib/types";

export function ZoneOrderSheet({
  order,
  onSave,
  onClose,
}: {
  order: string[];
  onSave: (order: string[]) => Promise<void>;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(() => (order.length ? normalizeZoneOrder(order) : [""]));
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  function move(from: number, to: number) {
    if (to < 0 || to >= draft.length || from === to) return;
    setDraft((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(from, 1);
      if (item === undefined) return prev;
      next.splice(to, 0, item);
      return next;
    });
  }

  const cleaned = normalizeZoneOrder(draft);

  return (
    <Overlay>
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <header className="flex items-center gap-3 border-b border-border bg-header px-2 py-2">
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex size-11 items-center justify-center"
          >
            <X className="size-5" />
          </button>
          <SheriffMark className="size-8" />
          <h2 className="flex-1 font-display text-2xl font-semibold uppercase tracking-wider">
            Zones
          </h2>
        </header>

        <p className="border-b border-border px-5 py-3 text-sm text-muted">
          Add the zones this shift assigns. Drag to set board order. ALL is typically
          the supervisor slot.
        </p>

        <div className="flex flex-wrap gap-2 border-b border-border px-4 py-3">
          {ZONE_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              className="rounded-md border border-border px-2 py-1 text-2xs uppercase tracking-wide text-muted hover:border-primary hover:text-foreground"
              onClick={() => setDraft([...p.zones])}
            >
              {p.label}
            </button>
          ))}
        </div>

        <ul className="flex-1 overflow-y-auto">
          {draft.map((id, index) => (
            <li
              key={index}
              draggable={Boolean(cleanZoneId(id))}
              onDragStart={() => setDragIndex(index)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragIndex === null || dragIndex === index) return;
                move(dragIndex, index);
                setDragIndex(index);
              }}
              onDragEnd={() => setDragIndex(null)}
              className={cn(
                "flex items-center gap-1 border-b border-border px-2 py-1.5",
                dragIndex === index && "bg-card-2",
              )}
            >
              <span className="flex size-11 cursor-grab items-center justify-center text-subtle active:cursor-grabbing">
                <GripVertical className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <Input
                  value={id}
                  onChange={(e) => {
                    const next = [...draft];
                    next[index] = e.target.value;
                    setDraft(next);
                  }}
                  onBlur={() => {
                    const next = [...draft];
                    next[index] = cleanZoneId(id);
                    setDraft(next);
                  }}
                  placeholder="Zone code"
                  className="h-10"
                />
                {zoneHint(cleanZoneId(id)) ? (
                  <p className="px-1 pt-0.5 text-2xs text-muted">{zoneHint(cleanZoneId(id))}</p>
                ) : null}
              </div>
              <button
                type="button"
                aria-label={`Move ${id || "zone"} up`}
                disabled={index === 0}
                onClick={() => move(index, index - 1)}
                className="flex size-11 items-center justify-center text-muted hover:text-foreground disabled:opacity-30"
              >
                <ArrowUp className="size-5" />
              </button>
              <button
                type="button"
                aria-label={`Move ${id || "zone"} down`}
                disabled={index === draft.length - 1}
                onClick={() => move(index, index + 1)}
                className="flex size-11 items-center justify-center text-muted hover:text-foreground disabled:opacity-30"
              >
                <ArrowDown className="size-5" />
              </button>
              <button
                type="button"
                aria-label={`Remove ${id || "zone"}`}
                onClick={() => setDraft(draft.filter((_, i) => i !== index))}
                className="flex size-11 items-center justify-center text-muted hover:text-destructive"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>

        <div className="border-t border-border px-4 py-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            onClick={() => setDraft([...draft, ""])}
          >
            <Plus className="size-4" />
            Add zone
          </Button>
        </div>

        <footer className="grid grid-cols-2 border-t border-border">
          <Button
            variant="ghost"
            className="h-14 rounded-none text-base text-muted"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            variant="ghost"
            className="h-14 rounded-none text-base text-primary disabled:text-subtle"
            disabled={saving || cleaned.length < 1}
            onClick={() => {
              setSaving(true);
              void onSave(cleaned).finally(() => setSaving(false));
            }}
          >
            Save zones
          </Button>
        </footer>
      </div>
    </Overlay>
  );
}