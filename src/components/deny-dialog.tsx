import { useState } from "react";
import { Overlay } from "@/components/overlay";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DENIAL_REASON_MAX } from "@/lib/request-decision";

/**
 * Deny (or remove approved leave) with an optional reason the officer sees as
 * "Denied: <reason>" on their own request.
 */
export function DenyDialog({
  title = "Deny request",
  subtitle,
  confirmLabel = "Deny",
  onCancel,
  onConfirm,
}: {
  title?: string;
  subtitle?: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
}) {
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    setBusy(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setBusy(false);
    }
  }
  return (
    <Overlay>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 sm:items-center">
        <button type="button" className="absolute inset-0" aria-label="Close" onClick={onCancel} />
        <form
          className="relative w-full max-w-md rounded-t-xl border border-border bg-card p-5 shadow-panel sm:rounded-xl"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="font-display text-2xl font-semibold uppercase tracking-wide">{title}</p>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
          <div className="mt-4 space-y-2">
            <Label htmlFor="denial-reason">Reason for denial (optional)</Label>
            <textarea
              id="denial-reason"
              autoFocus
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, DENIAL_REASON_MAX))}
              maxLength={DENIAL_REASON_MAX}
              rows={3}
              placeholder="e.g. Minimum staffing that week"
              className="w-full rounded-md border border-border-strong bg-background px-3 py-2 text-sm text-foreground placeholder:text-subtle focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="flex justify-between text-xs text-muted">
              <span>The officer sees this on their request.</span>
              <span className="tabular">
                {reason.length}/{DENIAL_REASON_MAX}
              </span>
            </p>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button type="button" variant="secondary" disabled={busy} onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={busy}>
              {busy ? "Saving…" : confirmLabel}
            </Button>
          </div>
        </form>
      </div>
    </Overlay>
  );
}
