import { ChevronDown, X } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/overlay";
import { PickerSheet } from "@/components/picker-sheet";
import { SheriffMark } from "@/components/sheriff-mark";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { REQUEST_KINDS, type RequestKind } from "@/lib/types";
import { deriveLastName } from "@/lib/watch-logic";

export type RequestPayload = {
  officerId: string;
  startDate: string;
  endDate: string;
  kind: RequestKind;
  reason: string;
  /** Call-in only: optional Google event label ("ANDERSON - <LABEL>"). */
  calendarLabel?: string;
};

export function RequestForm({
  officers,
  onCancel,
  onSubmit,
  embedded = false,
  initialStart = "",
  initialEnd = "",
  lockedOfficerId,
  mode = "request",
}: {
  officers: { id: string; name: string; unit: string }[];
  onCancel?: () => void;
  onSubmit: (payload: RequestPayload) => Promise<void>;
  embedded?: boolean;
  initialStart?: string;
  initialEnd?: string;
  lockedOfficerId?: string;
  mode?: "request" | "call-in";
}) {
  const [officerId, setOfficerId] = useState(lockedOfficerId ?? "");
  const [kind, setKind] = useState<RequestKind>(mode === "call-in" ? "sick" : "vacation");
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd || initialStart);
  const [reason, setReason] = useState("");
  const [calendarLabel, setCalendarLabel] = useState("");
  const [picking, setPicking] = useState<"officer" | "kind" | null>(null);
  const [saving, setSaving] = useState(false);

  const officer = officers.find((o) => o.id === officerId);
  const kindOpt = REQUEST_KINDS.find((k) => k.id === kind);
  const canSave = Boolean(officerId && startDate && endDate);
  const endMin = useMemo(() => startDate, [startDate]);

  async function submit() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onSubmit({
        officerId,
        startDate,
        endDate: endDate < startDate ? startDate : endDate,
        kind,
        reason,
        ...(mode === "call-in" ? { calendarLabel: calendarLabel.trim() } : {}),
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSaving(false);
    }
  }

  const fields = (
    <>
      {lockedOfficerId ? null : (
      <Field label="Deputy">
        <button
          type="button"
          onClick={() => setPicking("officer")}
          className="flex h-12 w-full items-center justify-between rounded-md border border-border-strong px-3 text-left"
        >
          <span className={officer ? "text-foreground" : "text-subtle"}>
            {officer?.name ?? (mode === "call-in" ? "Who called in" : "Select your name")}
          </span>
          <ChevronDown className="size-4 text-muted" />
        </button>
      </Field>
      )}
      <Field label="Type">
        <button
          type="button"
          onClick={() => setPicking("kind")}
          className="flex h-12 w-full items-center justify-between rounded-md border border-border-strong px-3 text-left"
        >
          <span>{kindOpt?.label}</span>
          <ChevronDown className="size-4 text-muted" />
        </button>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Start">
          <Input
            type="date"
            value={startDate}
            onChange={(e) => {
              setStartDate(e.target.value);
              if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
            }}
            required
          />
        </Field>
        <Field label="End">
          <Input
            type="date"
            min={endMin || undefined}
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
          />
        </Field>
      </div>
      <Field label="Notes">
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={mode === "call-in" ? "Called in" : "Optional"}
          maxLength={280}
        />
      </Field>
      {mode === "call-in" ? (
        <Field label="Calendar label" optional>
          <Input
            value={calendarLabel}
            onChange={(e) => setCalendarLabel(e.target.value)}
            placeholder="Optional"
            maxLength={40}
            list="calendar-label-picks"
            autoCapitalize="characters"
          />
          <datalist id="calendar-label-picks">
            {REQUEST_KINDS.map((k) => (
              <option key={k.id} value={k.label.toUpperCase()} />
            ))}
          </datalist>
          <p className="text-xs text-muted">
            Google Calendar title:{" "}
            <span className="font-medium text-foreground">
              {previewTitle(officer?.name, kind, calendarLabel)}
            </span>
            . Leave blank for just the last name (sick adds “- SICK”).
          </p>
        </Field>
      ) : null}
    </>
  );

  const pickers = (
    <>
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
      {picking === "kind" ? (
        <PickerSheet
          title="Type"
          searchable={false}
          options={REQUEST_KINDS.map((k) => ({ id: k.id, label: k.label }))}
          value={kind}
          onChange={(id) => {
            setKind(id as RequestKind);
            setPicking(null);
          }}
          onClose={() => setPicking(null)}
        />
      ) : null}
    </>
  );

  if (embedded) {
    return (
      <div>
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {fields}
          <Button className="w-full" disabled={!canSave || saving} type="submit">
            {saving ? "Saving…" : mode === "call-in" ? "Put on leave" : "Submit request"}
          </Button>
        </form>
        {pickers}
      </div>
    );
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
            {mode === "call-in" ? "Call in" : "Days Off"}
          </h2>
        </header>

        <form
          className="flex-1 space-y-5 overflow-y-auto px-5 py-6"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {fields}
          <div className="h-16" />
        </form>

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
            {saving ? "Saving…" : mode === "call-in" ? "Put on leave" : "Submit"}
          </Button>
        </footer>
        {pickers}
      </div>
    </Overlay>
  );
}

function previewTitle(name: string | undefined, kind: RequestKind, label: string): string {
  // Preview only — the server adds a first initial when a last name is shared.
  const last = name ? deriveLastName(name) : "LASTNAME";
  const tag = label.replace(/\s+/g, " ").trim().toUpperCase();
  if (tag) return `${last} - ${tag}`;
  return kind === "sick" ? `${last} - SICK` : last;
}

function Field({
  label,
  optional,
  children,
}: {
  label: string;
  optional?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label>
        {label}{" "}
        {label !== "Notes" && !optional ? <span className="text-primary">*</span> : null}
      </Label>
      {children}
    </div>
  );
}
