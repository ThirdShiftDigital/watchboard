import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { formatShort } from "@/lib/dates";
import { addSwapPayback, listSwaps, removeOverride } from "@/lib/overrides-fns";

/**
 * Swaps list, folded away at the bottom of Shift Schedule: who swapped with
 * whom, and whether the payback is owed, scheduled, or done.
 */
export function SwapsFold({ onChanged }: { onChanged: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: ["swaps"],
    queryFn: () => listSwaps(),
    enabled: open,
  });
  const swaps = q.data?.swaps ?? [];
  const owed = swaps.filter((s) => s.state === "owed").length;

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["swaps"] });
    await onChanged();
  }

  return (
    <div className="border-y border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="text-2xs uppercase tracking-wide text-muted">Swaps</p>
          <p className="truncate text-sm">
            {open && q.data ? `${swaps.length} recent · ${owed} payback owed` : "Swaps and paybacks"}
          </p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="px-4 pb-4">
          {q.isLoading ? <p className="text-sm text-muted">Loading…</p> : null}
          {q.isError ? <p className="text-sm text-muted">Could not load swaps.</p> : null}
          {q.data && swaps.length === 0 ? (
            <p className="text-sm text-muted">
              No swaps yet. Tap an RDO day on the schedule and choose Swap… to add one.
            </p>
          ) : null}
          <ul className="space-y-2">
            {swaps.map((s) => (
              <SwapItem key={s.swapGroup} swap={s} onChanged={refresh} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

type Swap = Awaited<ReturnType<typeof listSwaps>>["swaps"][number];

function SwapItem({ swap, onChanged }: { swap: Swap; onChanged: () => Promise<void> }) {
  const [mode, setMode] = useState<"view" | "payback" | "confirm">("view");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(message);
      setMode("view");
      await onChanged();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="rounded-md border border-border bg-card-2 px-3 py-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">
            {formatShort(swap.date)} · {swap.workerName} covered {swap.partnerName}
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {swap.payback
              ? `Payback ${formatShort(swap.payback.date)}: ${swap.partnerName} covers ${swap.workerName}`
              : `${swap.partnerName} owes ${swap.workerName} a day`}
            {swap.reason ? ` · ${swap.reason}` : ""}
          </p>
        </div>
        <Badge tone={swap.state === "owed" ? "warning" : swap.state === "scheduled" ? "primary" : "neutral"}>
          {swap.state === "owed" ? "Owed" : swap.state === "scheduled" ? "Scheduled" : "Done"}
        </Badge>
      </div>
      {mode === "view" ? (
        <div className="mt-2 flex gap-2">
          {swap.state === "owed" ? (
            <Button size="sm" variant="secondary" onClick={() => setMode("payback")}>
              Set payback
            </Button>
          ) : null}
          {swap.removeId ? (
            <Button size="sm" variant="ghost" className="text-muted" onClick={() => setMode("confirm")}>
              Remove
            </Button>
          ) : null}
        </div>
      ) : null}
      {mode === "payback" ? (
        <form
          className="mt-2 flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!date) return;
            void run(
              () => addSwapPayback({ data: { swapGroup: swap.swapGroup, paybackDate: date } }),
              "Payback scheduled",
            );
          }}
        >
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
          <Button size="sm" type="submit" disabled={busy || !date}>
            Save
          </Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setMode("view")}>
            Cancel
          </Button>
        </form>
      ) : null}
      {mode === "confirm" && swap.removeId ? (
        <div className="mt-2 space-y-2">
          <p className="text-xs">
            Remove this swap{swap.payback ? " and its payback" : ""}? Both officers go back to their normal schedule.
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              disabled={busy}
              onClick={() => void run(() => removeOverride({ data: { id: swap.removeId! } }), "Swap removed")}
            >
              {busy ? "Removing…" : "Remove"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
              Keep
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
