import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/overlay";
import { PickerSheet } from "@/components/picker-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatShort, weekdayOf } from "@/lib/dates";
import { createOvertime, createSwap, removeOverride } from "@/lib/overrides-fns";
import { WEEKDAYS, rdoLabel, type DutyOverride, type Officer } from "@/lib/types";

type Step = "menu" | "swap" | "confirm";

/**
 * Overtime & swaps sheet for one officer on one date.
 * - No `existing`: the officer is RDO that date — offer Overtime, Swap…, and
 *   (when `onChangeRdo` is given) the old "change the standing RDO" action.
 * - `existing`: show what the entry is and let a supervisor remove it.
 */
export function OverrideSheet({
  officer,
  date,
  officers,
  existing,
  canOverride,
  onChangeRdo,
  onClose,
  onDone,
}: {
  officer: Officer;
  date: string;
  officers: Officer[];
  existing?: DutyOverride;
  canOverride: boolean;
  onChangeRdo?: () => void;
  onClose: () => void;
  onDone: (message: string) => Promise<void> | void;
}) {
  const [step, setStep] = useState<Step>("menu");
  const [busy, setBusy] = useState(false);
  const [partnerId, setPartnerId] = useState("");
  const [paybackDate, setPaybackDate] = useState("");
  const [reason, setReason] = useState("");
  const [picking, setPicking] = useState(false);
  const weekday = weekdayOf(date);
  const nameOf = (id: string | null) => officers.find((o) => o.id === id)?.name ?? "another officer";
  const partner = officers.find((o) => o.id === partnerId);
  // Swap partners: same shift, scheduled to work that date (not their RDO).
  const partnerOptions = officers.filter((o) => o.id !== officer.id && !o.rdoDays.includes(weekday));

  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await fn();
      await onDone(message);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  let body: ReactNode;
  if (existing) {
    const what =
      existing.kind === "ot"
        ? "Overtime: working on their RDO."
        : existing.status === "working"
          ? `Swap: working on their RDO, covering ${nameOf(existing.partnerOfficerId)}.`
          : `Swap: off. ${nameOf(existing.partnerOfficerId)} is covering.`;
    body =
      step === "confirm" ? (
        <div className="mt-4 space-y-3">
          <p className="text-sm">
            {existing.kind === "ot"
              ? `Remove overtime for ${officer.name} on ${formatShort(date)}? They go back to RDO.`
              : "Remove this swap? Both officers go back to their normal schedule, and the payback date (if any) is removed too."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => setStep("menu")}>
              Keep
            </Button>
            <Button
              variant="destructive"
              disabled={busy}
              onClick={() =>
                void run(
                  () => removeOverride({ data: { id: existing.id } }),
                  existing.kind === "ot" ? "Overtime removed" : "Swap removed",
                )
              }
            >
              {busy ? "Removing…" : "Remove"}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <p className="text-sm">{what}</p>
          {existing.isPayback ? <p className="text-xs text-muted">This is the payback day of a swap.</p> : null}
          {existing.reason ? <p className="text-xs text-muted">Reason: {existing.reason}</p> : null}
          {canOverride ? (
            <Button variant="outline" className="w-full" onClick={() => setStep("confirm")}>
              {existing.kind === "ot" ? "Remove overtime" : "Remove swap…"}
            </Button>
          ) : null}
        </div>
      );
  } else if (step === "swap") {
    body = (
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!partnerId) return;
          void run(
            () =>
              createSwap({
                data: {
                  officerId: officer.id,
                  partnerId,
                  date,
                  paybackDate: paybackDate || null,
                  reason: reason.trim() || undefined,
                },
              }),
            paybackDate ? "Swap and payback saved" : "Swap saved",
          );
        }}
      >
        <div className="space-y-2">
          <Label>
            Covering for <span className="text-primary">*</span>
          </Label>
          <button
            type="button"
            onClick={() => setPicking(true)}
            className="flex h-12 w-full items-center justify-between rounded-md border border-border-strong px-3 text-left"
          >
            <span className={partner ? "text-foreground" : "text-subtle"}>
              {partner?.name ?? "Who is off that day"}
            </span>
            <ChevronDown className="size-4 text-muted" />
          </button>
          <p className="text-xs text-muted">
            {officer.name} works; the officer you pick is off on {formatShort(date)}.
          </p>
        </div>
        <div className="space-y-2">
          <Label>Payback date (optional)</Label>
          <Input type="date" value={paybackDate} onChange={(e) => setPaybackDate(e.target.value)} />
          <p className="text-xs text-muted">
            {partner
              ? `${partner.name} works their RDO (${rdoLabel(partner.rdoDays)}) and ${officer.name} is off that day. You can also set it later from Swaps.`
              : "The day the favor is returned. You can also set it later from Swaps."}
          </p>
        </div>
        <div className="space-y-2">
          <Label>Reason (optional)</Label>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={140} placeholder="Optional" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button type="button" variant="secondary" disabled={busy} onClick={() => setStep("menu")}>
            Back
          </Button>
          <Button type="submit" disabled={busy || !partnerId}>
            {busy ? "Saving…" : "Save swap"}
          </Button>
        </div>
      </form>
    );
  } else {
    body = (
      <div className="mt-4 space-y-2">
        {canOverride ? (
          <>
            <Button
              className="w-full"
              disabled={busy}
              onClick={() =>
                void run(() => createOvertime({ data: { officerId: officer.id, date } }), "Overtime saved")
              }
            >
              {busy ? "Saving…" : "Working this date: Overtime"}
            </Button>
            <Button variant="secondary" className="w-full" disabled={busy} onClick={() => setStep("swap")}>
              Swap…
            </Button>
          </>
        ) : null}
        {onChangeRdo ? (
          <Button
            variant="outline"
            className="w-full"
            disabled={busy}
            onClick={() => {
              onChangeRdo();
              onClose();
            }}
          >
            Change standing RDO (every week)
          </Button>
        ) : null}
        {onChangeRdo ? (
          <p className="text-xs text-muted">
            Changing the standing RDO makes every {WEEKDAYS[weekday]} a work day for {officer.name}, not just this date.
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <Overlay>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 sm:items-center">
        <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
        <div className="relative w-full max-w-md rounded-t-xl border border-border bg-card p-5 shadow-panel sm:rounded-xl">
          <p className="font-display text-2xl font-semibold uppercase tracking-wide">{officer.name}</p>
          <p className="mt-1 text-sm text-muted">
            {formatShort(date)} · {existing ? (existing.kind === "ot" ? "Overtime" : "Swap") : "RDO"}
          </p>
          {body}
          <Button variant="ghost" className="mt-2 w-full text-muted" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
      {picking ? (
        <PickerSheet
          title="Covering for"
          options={partnerOptions.map((o) => ({ id: o.id, label: o.name, hint: `Unit ${o.unit} · ${rdoLabel(o.rdoDays)}` }))}
          value={partnerId}
          onChange={(id) => {
            setPartnerId(id);
            setPicking(false);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </Overlay>
  );
}
