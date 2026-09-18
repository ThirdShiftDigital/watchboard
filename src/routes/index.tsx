import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowUpDown, Check, ChevronRight, Plus, RefreshCw, Share2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, HeaderIconButton } from "@/components/app-shell";
import { CalendarBanner } from "@/components/calendar-banner";
import { DateBar } from "@/components/date-bar";
import { SendSheet } from "@/components/send-sheet";
import { ZoneForm } from "@/components/zone-form";
import { ZoneOrderSheet } from "@/components/zone-order-sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { deleteAssignment, getWatch, rebuildWatch, setZoneOrder, upsertAssignment } from "@/lib/fns";
import { useMyAccess, usePendingCount, useSupervisorReady } from "@/lib/hooks";
import { useWatchDate } from "@/lib/store";
import { DEFAULT_ZONE_ORDER, zoneHint } from "@/lib/types";
import type { Officer, WatchRow } from "@/lib/types";
import { sortWatchRows } from "@/lib/watch-text";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    // Signed-out visitors should hit login first — not the board's
    // "Checking supervisor access…" gate.
    if (!context.sessionUser) {
      throw redirect({ to: "/login", search: { switch: false } });
    }
  },
  component: ZonesPage,
});

function ZonesPage() {
  const { date, setDate } = useWatchDate();
  const { ready } = useSupervisorReady();
  const access = useMyAccess();
  const canEdit = Boolean(access.data?.caps.editWatch);
  const pendingCount = usePendingCount();
  const queryClient = useQueryClient();
  const [showOffDuty, setShowOffDuty] = useState(false);
  const [form, setForm] = useState<{ officer?: Officer; zone?: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [ordering, setOrdering] = useState(false);

  const watchQuery = useQuery({
    queryKey: ["watch", date],
    queryFn: () => getWatch({ data: { date } }),
    enabled: ready,
  });

  const rebuild = useMutation({
    mutationFn: () => rebuildWatch({ data: { date } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["watch", date] });
    },
    onError: (err) => toast.error(err.message),
  });

  const save = useMutation({
    mutationFn: (input: { officerId: string; zone: string }) =>
      upsertAssignment({ data: { date, ...input } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["watch", date] });
      setForm(null);
      toast.success("Zone saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const remove = useMutation({
    mutationFn: (officerId: string) => deleteAssignment({ data: { date, officerId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["watch", date] });
      setForm(null);
      toast.success("Assignment cleared");
    },
    onError: (err) => toast.error(err.message),
  });

  const orderSave = useMutation({
    mutationFn: (order: string[]) => setZoneOrder({ data: { order } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["watch"] });
      setOrdering(false);
      toast.success("Zone order saved");
    },
    onError: (err) => toast.error(err.message),
  });

  const data = watchQuery.data;
  const zoneOrder = data?.zoneOrder?.length ? data.zoneOrder : DEFAULT_ZONE_ORDER;
  const visible = useMemo(() => {
    const rows = data?.rows ?? [];
    return sortWatchRows(rows, zoneOrder, showOffDuty);
  }, [data, zoneOrder, showOffDuty]);
  const working = useMemo(
    () => data?.rows.filter((r) => r.status === "working") ?? [],
    [data],
  );
  const unassigned = useMemo(
    () => working.filter((r) => !r.zone).map((r) => r.officer),
    [working],
  );
  const extra = data
    ? `${data.workingCount} working · ${data.rdoCount + data.leaveCount + data.calendarOffCount} off`
    : undefined;
  const rosterEmpty = Boolean(data && data.officers.length === 0);

  return (
    <AppShell
      title="Zones"
      pendingCount={pendingCount}
      actions={
        <>
          {canEdit ? (
            <HeaderIconButton label="Zone order" onClick={() => setOrdering(true)}>
              <ArrowUpDown className="size-5" />
            </HeaderIconButton>
          ) : null}
          {canEdit ? (
            <HeaderIconButton
              label="Clear posted zones"
              onClick={() => {
                rebuild.mutate(undefined, {
                  onSuccess: async () => {
                    await queryClient.invalidateQueries({ queryKey: ["watch", date] });
                    toast.success("Posted zones cleared");
                  },
                });
              }}
              disabled={rebuild.isPending}
            >
              <RefreshCw className={cn("size-5", rebuild.isPending && "animate-spin")} />
            </HeaderIconButton>
          ) : null}
          <HeaderIconButton
            label="Post and send watch"
            onClick={() => setSending(true)}
            disabled={!data}
          >
            <Check className="size-5" />
          </HeaderIconButton>
        </>
      }
      fab={
        canEdit && unassigned.length > 0 ? (
          <button
            type="button"
            aria-label="Assign a zone"
            onClick={() => setForm({ officer: unassigned[0] })}
            className="fab-dock fixed right-5 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-panel"
          >
            <Plus className="size-7" strokeWidth={2.25} />
          </button>
        ) : undefined
      }
    >
      <DateBar date={date} onChange={setDate} extra={extra} />
      {data ? <CalendarBanner calendar={data.calendar} compact /> : null}

      <div className="flex items-center justify-between px-4 py-2">
        <p className="text-2xs uppercase tracking-wide-plus text-muted">
          {data
            ? `Roster from ${data.shiftName ?? "the"} schedule · ${data.assignedCount} of ${data.workingCount} zoned`
            : "Roster from the shift schedule"}
        </p>
        <button
          type="button"
          onClick={() => setShowOffDuty((v) => !v)}
          className="text-2xs uppercase tracking-label text-primary"
        >
          {showOffDuty ? "Hide off-duty" : "Show off-duty"}
        </button>
      </div>

      <div className="zone-cols grid border-y border-border bg-card-2 px-4 py-2 text-2xs font-medium uppercase tracking-wide-plus text-muted">
        <span>Deputy</span>
        <span>Unit</span>
        <span>Zone</span>
      </div>

      {watchQuery.isLoading ? (
        <div className="space-y-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 border-b border-border bg-card/60" />
          ))}
        </div>
      ) : null}
      {watchQuery.isError ? (
        <p className="px-4 py-8 text-sm text-muted">Could not load the watch. Try again.</p>
      ) : null}
      {!watchQuery.isLoading && rosterEmpty ? (
        <div className="px-6 py-16 text-center">
          <p className="font-display text-xl uppercase tracking-wide">No roster yet</p>
          <p className="mt-2 text-sm text-muted">
            Zones always pulls who is working from the shift schedule. Onboard
            officers there first.
          </p>
          <Link
            to="/schedule"
            className="mt-4 inline-block text-sm text-primary underline-offset-4 hover:underline"
          >
            Open shift schedule
          </Link>
        </div>
      ) : null}
      {!watchQuery.isLoading && !rosterEmpty && visible.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="font-display text-xl uppercase tracking-wide">No one on this watch</p>
          <p className="mt-2 text-sm text-muted">
            Everyone on the schedule is RDO or on approved leave.
          </p>
        </div>
      ) : null}

      <ul>
        {visible.map((row) => (
          <ZoneRow
            key={row.officer.id}
            row={row}
            onOpen={
              canEdit && row.status === "working"
                ? () => setForm({ officer: row.officer, zone: row.zone ?? undefined })
                : undefined
            }
          />
        ))}
      </ul>

      {data && working.length > 0 ? (
        <div className="max-md:pr-20 space-y-3 px-4 py-4">
          <Button className="w-full" onClick={() => setSending(true)}>
            <Share2 className="size-4" />
            Send to shift & dispatch
          </Button>
        </div>
      ) : null}

      {form ? (
        <ZoneForm
          officers={working.map((r) => r.officer)}
          zoneOrder={zoneOrder}
          initialOfficerId={form.officer?.id}
          initialZone={form.zone}
          onCancel={() => setForm(null)}
          onSave={(officerId, zone) => save.mutate({ officerId, zone })}
          onRemove={form.officer ? () => remove.mutate(form.officer!.id) : undefined}
        />
      ) : null}
      {sending && data ? (
        <SendSheet
          date={date}
          rows={data.rows}
          zoneOrder={zoneOrder}
          onClose={() => setSending(false)}
        />
      ) : null}
      {ordering ? (
        <ZoneOrderSheet
          order={zoneOrder}
          onClose={() => setOrdering(false)}
          onSave={async (order) => {
            await orderSave.mutateAsync(order);
          }}
        />
      ) : null}
    </AppShell>
  );
}

function ZoneRow({
  row,
  onOpen,
}: {
  row: WatchRow;
  onOpen?: () => void;
}) {
  const off = row.status !== "working";
  const hint = row.zone ? zoneHint(row.zone) : "";
  return (
    <li className="border-b border-border">
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        className={cn("zone-cols grid w-full items-center px-4 py-3.5 text-left", off && "opacity-55")}
      >
        <span className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-medium tracking-wide">{row.officer.name}</span>
          <span className="mt-0.5 flex items-center gap-1.5">
            {row.officer.tmt ? <Badge tone="warning">SRT</Badge> : null}
            {off ? (
              <Badge tone={row.status === "rdo" ? "rdo" : "danger"}>{row.statusLabel}</Badge>
            ) : null}
            {row.eventTitle ? (
              <span className="truncate text-2xs text-muted">{row.eventTitle}</span>
            ) : null}
          </span>
        </span>
        <span className="tabular text-sm text-muted">{row.officer.unit}</span>
        <span className="flex items-center justify-between gap-1">
          <span className="min-w-0">
            {off ? (
              <span className="text-sm font-medium">—</span>
            ) : (
              <span className="flex flex-col">
                <span className="text-sm font-medium">{row.zone ?? ""}</span>
                {hint && hint.toUpperCase() !== (row.zone ?? "").toUpperCase() ? (
                  <span className="truncate text-micro text-muted">{hint}</span>
                ) : null}
              </span>
            )}
          </span>
          {onOpen ? <ChevronRight className="size-4 shrink-0 text-subtle" /> : null}
        </span>
      </button>
    </li>
  );
}
