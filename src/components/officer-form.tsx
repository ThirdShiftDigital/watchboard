import { ChevronDown, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/overlay";
import { PickerSheet } from "@/components/picker-sheet";
import { RdoPicker } from "@/components/rdo-picker";
import { SheriffMark } from "@/components/sheriff-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import {
  ROLES,
  ZONES,
  rdoLabel,
  roleLabel,
  type Officer,
  type OfficerRole,
} from "@/lib/types";

export type OfficerPayload = {
  name: string;
  unit: string;
  role: OfficerRole;
  hireDate: string;
  tmt: boolean;
  radioNum: number | null;
  rdoDays: number[];
  defaultZone: string | null;
};

export function OfficerForm({
  initial,
  onCancel,
  onSave,
  onRemove,
}: {
  initial?: Officer;
  onCancel: () => void;
  onSave: (payload: OfficerPayload) => Promise<void>;
  onRemove?: () => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [unit, setUnit] = useState(initial?.unit ?? "");
  const [role, setRole] = useState<OfficerRole>(initial?.role ?? "deputy");
  const [hireDate, setHireDate] = useState(initial?.hireDate ?? "");
  const [tmt, setTmt] = useState(initial?.tmt ?? false);
  const [rdoDays, setRdoDays] = useState<number[]>(initial?.rdoDays ?? []);
  const [defaultZone, setDefaultZone] = useState(initial?.defaultZone ?? "");
  const [picking, setPicking] = useState<"role" | "zone" | null>(null);
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length >= 2 && unit.trim().length >= 1;

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        unit: unit.trim(),
        role,
        hireDate,
        tmt,
        radioNum: null,
        rdoDays,
        defaultZone: defaultZone || null,
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save officer");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Overlay>
      <div className="fixed inset-0 z-50 flex flex-col bg-background">
        <header className="flex items-center gap-3 border-b border-border bg-header px-2 py-2">
          <button
            type="button"
            aria-label="Close"
            onClick={onCancel}
            className="flex size-11 items-center justify-center"
          >
            <X className="size-5" />
          </button>
          <SheriffMark className="size-8" />
          <h2 className="flex-1 font-display text-2xl font-semibold uppercase tracking-wider">
            {initial ? "Edit officer" : "Onboard officer"}
          </h2>
        </header>

        <form
          className="flex-1 space-y-5 overflow-y-auto px-5 py-6"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <Field label="Name">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="J. SMITH"
              autoCapitalize="characters"
              required
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Rank">
              <button
                type="button"
                onClick={() => setPicking("role")}
                className="flex h-12 w-full items-center justify-between rounded-md border border-border-strong px-3 text-left"
              >
                <span>{roleLabel(role)}</span>
                <ChevronDown className="size-4 text-muted" />
              </button>
            </Field>
            <Field label="Unit">
              <Input
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="321"
                inputMode="numeric"
                required
              />
            </Field>
          </div>
          <Field label={`Regular days off · ${rdoLabel(rdoDays)}`}>
            <RdoPicker value={rdoDays} onChange={setRdoDays} />
          </Field>
          <Field label="Home zone">
            <button
              type="button"
              onClick={() => setPicking("zone")}
              className="flex h-12 w-full items-center justify-between rounded-md border border-border-strong px-3 text-left"
            >
              <span className={defaultZone ? "text-foreground" : "text-subtle"}>
                {defaultZone || "None"}
              </span>
              <ChevronDown className="size-4 text-muted" />
            </button>
          </Field>
          <Field label="Hire date">
            <Input
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
            />
            <p className="text-xs text-muted">
              Seniority (S) starts below CPL from hire date — earliest deputy/FTO is S 1.
              LTs, SGTs, and CPLs are listed by rank and do not get an S number.
              {initial?.radioNum != null ? ` Currently S ${initial.radioNum}.` : ""}
            </p>
          </Field>
          <button
            type="button"
            onClick={() => setTmt((v) => !v)}
            className={cn(
              "flex h-12 w-full items-center justify-between rounded-md border px-3 text-left",
              tmt ? "border-warning bg-warning/10" : "border-border-strong",
            )}
          >
            <span className="text-sm">Special Response Team (SRT)</span>
            <span className={cn("text-2xs uppercase tracking-wide", tmt ? "text-warning" : "text-muted")}>
              {tmt ? "Yes" : "No"}
            </span>
          </button>
          <div className="h-16" />
        </form>

        {onRemove ? (
          <div className="px-5 pb-2">
            <Button
              variant="ghost"
              className="w-full text-destructive"
              onClick={() => void onRemove()}
            >
              Remove from roster
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
            className="h-14 rounded-none text-base text-primary"
            disabled={!canSave || saving}
            onClick={() => void submit()}
          >
            {initial ? "Save" : "Onboard"}
          </Button>
        </footer>

        {picking === "role" ? (
          <PickerSheet
            title="Rank"
            searchable={false}
            options={ROLES.map((r) => ({ id: r.id, label: r.label, hint: r.short }))}
            value={role}
            onChange={(id) => {
              setRole(id as OfficerRole);
              setPicking(null);
            }}
            onClose={() => setPicking(null)}
          />
        ) : null}
        {picking === "zone" ? (
          <PickerSheet
            title="Home zone"
            options={[
              { id: "", label: "None", hint: "Assign on the watch" },
              ...ZONES.map((z) => ({ id: z.id, label: z.label, hint: z.hint })),
            ]}
            value={defaultZone}
            onChange={(id) => {
              setDefaultZone(id);
              setPicking(null);
            }}
            onClose={() => setPicking(null)}
          />
        ) : null}
      </div>
    </Overlay>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
