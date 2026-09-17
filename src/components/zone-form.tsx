import { useState } from "react";
import { ChevronDown, RefreshCw, X } from "lucide-react";
import { ZONES, orderedZones, zoneHint } from "@/lib/types";
import type { Officer } from "@/lib/types";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { PickerSheet } from "./picker-sheet";
import { Overlay } from "./overlay";
import { SheriffMark } from "./sheriff-mark";

export function ZoneForm({
  officers,
  zoneOrder,
  initialOfficerId,
  initialZone,
  onSave,
  onCancel,
  onRemove,
}: {
  officers: Officer[];
  zoneOrder?: string[];
  initialOfficerId?: string;
  initialZone?: string;
  onSave: (officerId: string, zone: string) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [officerId, setOfficerId] = useState(initialOfficerId ?? "");
  const [zone, setZone] = useState(initialZone ?? "");
  const [picking, setPicking] = useState<"officer" | "zone" | null>(null);

  const officer = officers.find((o) => o.id === officerId);
  const canSave = Boolean(officerId && zone);

  return (
    <Overlay>
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <header className="flex items-center gap-3 border-b border-border bg-header px-2 py-2">
        <button
          type="button"
          aria-label="Back"
          onClick={onCancel}
          className="flex size-11 items-center justify-center text-foreground"
        >
          <X className="size-5" />
        </button>
        <SheriffMark className="size-8" />
        <h2 className="flex-1 font-display text-2xl font-semibold uppercase tracking-wider">
          Zones Form
        </h2>
        <span className="flex size-11 items-center justify-center text-muted">
          <RefreshCw className="size-5" />
        </span>
      </header>

      <div className="flex-1 space-y-6 px-5 py-6">
        <div className="space-y-2">
          <Label>
            Deputy <span className="text-primary">*</span>
          </Label>
          <button
            type="button"
            onClick={() => setPicking("officer")}
            className="flex h-12 w-full items-center justify-between rounded-md border border-border-strong bg-transparent px-3 text-left"
          >
            <span className={officer ? "text-foreground" : "text-subtle"}>
              {officer?.name ?? ""}
            </span>
            <ChevronDown className="size-4 text-muted" />
          </button>
        </div>
        <div className="space-y-2">
          <Label>
            Zone <span className="text-primary">*</span>
          </Label>
          <button
            type="button"
            onClick={() => setPicking("zone")}
            className="flex h-12 w-full items-center justify-between rounded-md border border-border-strong bg-transparent px-3 text-left"
          >
            <span className={zone ? "text-foreground" : "text-subtle"}>
              {zone ? (zoneHint(zone) ? `${zone} · ${zoneHint(zone)}` : zone) : ""}
            </span>
            <ChevronDown className="size-4 text-muted" />
          </button>
        </div>
      </div>

      {onRemove ? (
        <div className="px-5 pb-2">
          <Button variant="ghost" className="w-full text-destructive" onClick={onRemove}>
            Clear zone
          </Button>
        </div>
      ) : null}

      <footer className="grid grid-cols-2 border-t border-border">
        <Button
          variant="ghost"
          className="h-14 rounded-none text-base text-muted"
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          variant="ghost"
          className="h-14 rounded-none text-base text-primary disabled:text-subtle"
          disabled={!canSave}
          onClick={() => {
            if (canSave) onSave(officerId, zone);
          }}
        >
          Save
        </Button>
      </footer>

      {picking === "officer" ? (
        <PickerSheet
          title="Deputy"
          options={officers.map((o) => ({
            id: o.id,
            label: o.name,
            hint: `Unit ${o.unit}`,
          }))}
          value={officerId}
          onChange={(id) => {
            setOfficerId(id);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      ) : null}
      {picking === "zone" ? (
        <PickerSheet
          title="Zone"
          searchPlaceholder="Add or search"
          options={(zoneOrder ? orderedZones(zoneOrder) : ZONES).map((z) => ({
            id: z.id,
            label: z.label,
            hint: z.hint,
          }))}
          value={zone}
          onChange={(id) => {
            setZone(id);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </div>
    </Overlay>
  );
}
