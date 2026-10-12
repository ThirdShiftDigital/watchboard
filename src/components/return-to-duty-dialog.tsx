import { useState } from "react";
import { toast } from "sonner";
import { Overlay } from "@/components/overlay";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addDays, formatShort, todayISO } from "@/lib/dates";
import { returnToDuty } from "@/lib/fns";

/**
 * Return to duty / end leave early. Default return date is today (Central).
 * Leave ends the day before; a return on/before the first day cancels it.
 */
export function ReturnToDutyDialog({
  leave,
  name,
  onClose,
  onDone,
}: {
  leave: { id: number; startDate: string; endDate: string };
  name: string;
  onClose: () => void;
  onDone: () => Promise<void> | void;
}) {
  const [date, setDate] = useState(() => {
    const today = todayISO();
    return today > leave.endDate ? leave.endDate : today;
  });
  const [busy, setBusy] = useState(false);
  const removeAll = Boolean(date) && date <= leave.startDate;
  const tooLate = Boolean(date) && date > leave.endDate;
  const preview = !date
    ? ""
    : tooLate
      ? `Leave already ends ${formatShort(leave.endDate)}.`
      : removeAll
        ? "The whole leave is removed (cancelled)."
        : `Leave will end ${formatShort(addDays(date, -1))} instead of ${formatShort(leave.endDate)}.`;

  async function submit() {
    if (!date || tooLate) return;
    setBusy(true);
    try {
      const res = await returnToDuty({ data: { id: leave.id, returnDate: date } });
      if (res.calendar.message) {
        toast.warning(`${name} is back on duty, but Google Calendar wasn’t updated: ${res.calendar.message}`, {
          duration: 12_000,
        });
      } else {
        toast.success(`${name} back on duty ${formatShort(date)}`);
      }
      await onDone();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update the leave");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Overlay>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 sm:items-center">
        <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
        <form
          className="relative w-full max-w-md rounded-t-xl border border-border bg-card p-5 shadow-panel sm:rounded-xl"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="font-display text-2xl font-semibold uppercase tracking-wide">Return to duty</p>
          <p className="mt-1 text-sm text-muted">
            {name} · on leave {formatShort(leave.startDate)}
            {leave.endDate !== leave.startDate ? ` – ${formatShort(leave.endDate)}` : ""}
          </p>
          <div className="mt-4 space-y-2">
            <Label htmlFor="return-date">Back on duty from</Label>
            <Input id="return-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
            <p className={tooLate ? "text-xs text-warning" : "text-xs text-muted"}>{preview}</p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || !date || tooLate}>
              {busy ? "Saving…" : "Return to duty"}
            </Button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}
