import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ChevronDown, ChevronLeft, ChevronRight, FileDown, Plus, RefreshCw, Thermometer } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, HeaderIconButton } from "@/components/app-shell";
import { Overlay } from "@/components/overlay";
import { Button } from "@/components/ui/button";
import { CalendarBanner } from "@/components/calendar-banner";
import { OfficerForm, type OfficerPayload } from "@/components/officer-form";
import { RequestForm } from "@/components/request-form";
import { ShiftHoursForm } from "@/components/shift-hours-form";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { addDays, formatShort, startOfWeek, todayISO } from "@/lib/dates";
import {
  createOfficer,
  deleteOfficer,
  getSchedule,
  setMinWorking,
  toggleRdo,
  updateOfficer,
  callInLeave,
} from "@/lib/fns";
import { useMyAccess, usePendingCount, useSupervisorReady } from "@/lib/hooks";
import { useWatchDate } from "@/lib/store";
import {
  WEEKDAY_SHORT,
  rdoLabel,
  type CalendarEvent,
  type Officer,
  type TimeOffRequest,
} from "@/lib/types";
import { statusForOfficer } from "@/lib/watch-logic";
import { buildRdoPdf, shareRdoPdf, downloadRdoPdf } from "@/lib/rdo-pdf";

export const Route = createFileRoute("/schedule")({ component: SchedulePage });

async function invalidateRoster(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ["schedule"] }),
    queryClient.invalidateQueries({ queryKey: ["watch"] }),
    queryClient.invalidateQueries({ queryKey: ["calendar"] }),
    queryClient.invalidateQueries({ queryKey: ["requests"] }),
  ]);
}

function SchedulePage() {
  const { date, setDate } = useWatchDate();
  const weekStart = startOfWeek(date);
  const pendingCount = usePendingCount();
  const { ready } = useSupervisorReady();
  const access = useMyAccess();
  const canEdit = Boolean(access.data?.caps.manageRoster);
  const queryClient = useQueryClient();
  const [form, setForm] = useState<"new" | Officer | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [callIn, setCallIn] = useState(false);
  const today = todayISO();

  const scheduleQuery = useQuery({
    queryKey: ["schedule", weekStart],
    queryFn: () => getSchedule({ data: { weekStart } }),
    enabled: ready,
  });

  const toggle = useMutation({
    mutationFn: (input: { officerId: string; weekday: number }) =>
      toggleRdo({ data: input }),
    onSuccess: async () => {
      await invalidateRoster(queryClient);
    },
    onError: (err) => toast.error(err.message),
  });

  const data = scheduleQuery.data;
  const officers = data?.officers ?? [];
  const requests = data?.requests ?? [];
  const events = data?.calendar.events ?? [];
  const minWorking = data?.minWorking ?? 10;

  const counts = WEEKDAY_SHORT.map((_, weekday) => {
    const iso = addDays(weekStart, weekday);
    return officers.filter((o) => {
      return statusForOfficer(o, weekday, iso, requests, events).status === "working";
    }).length;
  });

  async function saveOfficer(payload: OfficerPayload) {
    if (form && form !== "new") {
      await updateOfficer({ data: { id: form.id, ...payload } });
      toast.success("Officer updated");
    } else {
      await createOfficer({ data: payload });
      toast.success("Officer onboarded");
    }
    await invalidateRoster(queryClient);
    setForm(null);
  }

  return (
    <AppShell
      title="Shift Schedule"
      pendingCount={pendingCount}
      actions={
        <>
          {canEdit ? (
            <HeaderIconButton
              label="Call in sick"
              onClick={() => setCallIn(true)}
              disabled={officers.length === 0}
            >
              <Thermometer className="size-5" />
            </HeaderIconButton>
          ) : null}
          <HeaderIconButton
            label="Print schedule PDF"
            onClick={() => setPrintOpen(true)}
            disabled={!data || officers.length === 0}
          >
            <FileDown className="size-5" />
          </HeaderIconButton>
          <HeaderIconButton
            label="Reload"
            onClick={() => scheduleQuery.refetch()}
            disabled={scheduleQuery.isFetching}
          >
            <RefreshCw className={cn("size-5", scheduleQuery.isFetching && "animate-spin")} />
          </HeaderIconButton>
        </>
      }
      fab={
        <button
          type="button"
          aria-label="Onboard officer"
          onClick={() => setForm("new")}
          className="fab-dock fixed right-5 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-panel"
        >
          <Plus className="size-7" strokeWidth={2.25} />
        </button>
      }
    >
      <div className="flex items-center justify-between border-b border-border bg-card px-2">
        <HeaderIconButton label="Previous week" onClick={() => setDate(addDays(weekStart, -7))}>
          <ChevronLeft className="size-5" />
        </HeaderIconButton>
        <div className="py-2 text-center">
          {data?.agency?.patchData ? (
            <img
              src={data.agency.patchData}
              alt=""
              className="mx-auto mb-1 size-14 object-contain"
            />
          ) : null}
          <p className="font-display text-lg font-semibold uppercase tracking-wide">
            {formatShort(weekStart)} – {formatShort(addDays(weekStart, 6))}
          </p>
          <p className="text-2xs uppercase tracking-label text-muted">
            {data?.shift
              ? `${data.shift.name} · ${data.shift.startTime.slice(0, 5)}–${data.shift.endTime.slice(0, 5)} · ${officers.length} on roster`
              : `${officers.length} on roster · tap a name to edit`}
          </p>
          {access.data?.caps.manageAccounts ? (
            <Link
              to="/setup"
              className="mt-1 block text-2xs uppercase tracking-wide text-primary"
            >
              New shift setup
            </Link>
          ) : null}
        </div>
        <HeaderIconButton label="Next week" onClick={() => setDate(addDays(weekStart, 7))}>
          <ChevronRight className="size-5" />
        </HeaderIconButton>
      </div>

      {data ? <CalendarBanner calendar={data.calendar} /> : null}

      <div className="grid grid-cols-7 border-b border-border bg-card-2 px-2 py-2 md:px-3">
        {WEEKDAY_SHORT.map((label, i) => {
          const iso = addDays(weekStart, i);
          const isToday = iso === today;
          return (
            <div
              key={label}
              className={cn(
                "flex flex-col items-center rounded-sm py-1",
                isToday && "bg-primary/15",
              )}
            >
              <span className="text-2xs font-medium uppercase tracking-wide text-muted">
                {label}
              </span>
              <span className={cn("tabular text-sm", isToday && "font-semibold text-primary")}>
                {Number(iso.slice(8))}
              </span>
              <span
                className={cn(
                  "mt-0.5 tabular text-micro",
                  counts[i] < minWorking ? "text-warning" : "text-muted",
                )}
              >
                {scheduleQuery.isLoading ? "—" : `${counts[i]} on`}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-2 text-micro uppercase tracking-wide text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-xs bg-rdo" /> RDO
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-xs bg-destructive/40" /> Leave
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2.5 rounded-xs bg-card-2 ring-1 ring-border" /> On duty
        </span>
        <label className="ml-auto inline-flex items-center gap-2 text-micro uppercase tracking-wide">
          Min working
          <input
            type="number"
            min={1}
            max={30}
            defaultValue={minWorking}
            key={minWorking}
            disabled={!canEdit}
            className="h-8 w-14 rounded-md border border-border-strong bg-background px-2 text-center text-sm tabular text-foreground disabled:opacity-50"
            onBlur={(e) => {
              const n = Number.parseInt(e.target.value, 10);
              if (!Number.isFinite(n) || n === minWorking) return;
              void (async () => {
                try {
                  await setMinWorking({ data: { min: Math.min(30, Math.max(1, n)) } });
                  await queryClient.invalidateQueries({ queryKey: ["schedule"] });
                  await queryClient.invalidateQueries({ queryKey: ["watch"] });
                  toast.success(`Minimum working set to ${Math.min(30, Math.max(1, n))}`);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Could not save minimum");
                }
              })();
            }}
          />
        </label>
      </div>

      {canEdit && data?.shift ? (
        <ShiftHoursFold shift={data.shift} />
      ) : null}

      {scheduleQuery.isLoading ? (
        <div className="space-y-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 border-b border-border bg-card/40" />
          ))}
        </div>
      ) : null}

      <ul className="pb-8 md:hidden">
        {officers.map((officer) => (
          <OfficerCard
            key={officer.id}
            officer={officer}
            weekStart={weekStart}
            today={today}
            requests={requests}
            events={events}
            onEdit={() => setForm(officer)}
            onToggle={(weekday) => toggle.mutate({ officerId: officer.id, weekday })}
          />
        ))}
      </ul>

      <div className="hidden md:block">
        {officers.map((officer) => (
          <OfficerRow
            key={officer.id}
            officer={officer}
            weekStart={weekStart}
            today={today}
            requests={requests}
            events={events}
            onEdit={() => setForm(officer)}
            onToggle={(weekday) => toggle.mutate({ officerId: officer.id, weekday })}
          />
        ))}
        <div className="sched-grid border-t border-border bg-header px-0 text-xs">
          <div className="px-4 py-3 font-medium uppercase tracking-wide text-muted">
            Total
          </div>
          {counts.map((n, i) => (
            <div
              key={i}
              className={cn(
                "flex items-center justify-center py-3 tabular font-medium",
                n < minWorking && "text-warning",
              )}
            >
              {n}
            </div>
          ))}
        </div>
      </div>

      {form ? (
        <OfficerForm
          initial={form === "new" ? undefined : form}
          onCancel={() => setForm(null)}
          onSave={saveOfficer}
          onRemove={
            form === "new"
              ? undefined
              : async () => {
                  await deleteOfficer({ data: { id: form.id } });
                  await invalidateRoster(queryClient);
                  setForm(null);
                  toast.success("Removed from roster");
                }
          }
        />
      ) : null}
      {callIn ? (
        <RequestForm
          mode="call-in"
          officers={officers}
          initialStart={today}
          initialEnd={today}
          onCancel={() => setCallIn(false)}
          onSubmit={async (payload) => {
            await callInLeave({ data: payload });
            await invalidateRoster(queryClient);
            setCallIn(false);
            toast.success("On leave — watch and calendar updated");
          }}
        />
      ) : null}
      {printOpen && data ? (
        <PrintSheet
          weekStart={weekStart}
          onClose={() => setPrintOpen(false)}
          onPrint={async ({ rdoOnly, download, showDates, weeks }) => {
            try {
              const { bytes, filename } = await buildRdoPdf({
                weekStart,
                officers,
                requests,
                events,
                effectiveDate: data.effectiveDate,
                rdoOnly,
                showDates,
                weeks,
                agency: data.agency,
              });
              if (download) {
                downloadRdoPdf(bytes, filename);
                setPrintOpen(false);
                toast.success(rdoOnly ? "RDO-only PDF downloaded" : "Schedule PDF downloaded");
                return;
              }
              const result = await shareRdoPdf(bytes, filename);
              setPrintOpen(false);
              toast.success(
                result === "shared"
                  ? rdoOnly
                    ? "RDO schedule sent"
                    : "Schedule sent"
                  : rdoOnly
                    ? "RDO-only PDF downloaded"
                    : "Schedule PDF downloaded",
              );
            } catch (err) {
              if (err instanceof DOMException && err.name === "AbortError") return;
              toast.error("Could not build the PDF");
            }
          }}
        />
      ) : null}
    </AppShell>
  );
}

function ShiftHoursFold({
  shift,
}: {
  shift: { id: string; name: string; startTime: string; endTime: string; effectiveDate: string };
}) {
  const [open, setOpen] = useState(false);
  const hours = `${shift.startTime.slice(0, 5)}–${shift.endTime.slice(0, 5)}`;
  return (
    <div className="border-b border-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="min-w-0 flex-1">
          <p className="text-2xs uppercase tracking-wide text-muted">This shift</p>
          <p className="truncate text-sm">
            {shift.name} · {hours}
          </p>
        </div>
        <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="px-4 pb-4">
          <ShiftHoursForm
            shiftId={shift.id}
            name={shift.name}
            startTime={shift.startTime}
            endTime={shift.endTime}
            effectiveDate={shift.effectiveDate}
            showHeading={false}
          />
        </div>
      ) : null}
    </div>
  );
}

function PrintSheet({
  weekStart,
  onClose,
  onPrint,
}: {
  weekStart: string;
  onClose: () => void;
  onPrint: (opts: {
    rdoOnly: boolean;
    download: boolean;
    showDates: boolean;
    weeks: number;
  }) => Promise<void>;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [showDates, setShowDates] = useState(false);
  const [weeks, setWeeks] = useState(4);
  async function run(rdoOnly: boolean, download: boolean) {
    const key = `${rdoOnly ? "rdo" : "full"}-${download ? "dl" : "send"}`;
    setBusy(key);
    try {
      await onPrint({
        rdoOnly,
        download,
        showDates: rdoOnly ? showDates : true,
        weeks: rdoOnly && showDates ? weeks : 1,
      });
    } finally {
      setBusy(null);
    }
  }
  const rangeEnd = addDays(weekStart, weeks * 7 - 1);
  return (
    <Overlay>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 sm:items-center">
        <button type="button" className="absolute inset-0" aria-label="Close" onClick={onClose} />
        <div className="relative w-full max-w-md rounded-t-xl border border-border bg-card p-5 shadow-panel sm:rounded-xl">
          <p className="font-display text-2xl font-semibold uppercase tracking-wide">Print schedule</p>
          <p className="mt-2 text-sm text-muted">
            RDO only is the standing weekday pattern. Date range is optional for a
            posting period.
          </p>
          <div className="mt-4 space-y-4">
            <div className="space-y-2">
              <p className="text-2xs uppercase tracking-wide text-muted">RDO only</p>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showDates}
                  onChange={(e) => setShowDates(e.target.checked)}
                  className="size-4 accent-primary"
                />
                Date range
              </label>
              {showDates ? (
                <div className="flex items-center gap-3 rounded-md border border-border px-3 py-2">
                  <span className="text-2xs uppercase tracking-wide text-muted">Weeks</span>
                  <input
                    type="number"
                    min={1}
                    max={12}
                    value={weeks}
                    onChange={(e) => setWeeks(Math.min(12, Math.max(1, Number(e.target.value) || 1)))}
                    className="h-8 w-14 rounded-md border border-border-strong bg-background px-2 text-center text-sm tabular"
                  />
                  <span className="text-xs text-muted">
                    {formatShort(weekStart)} – {formatShort(rangeEnd)}
                  </span>
                </div>
              ) : (
                <p className="text-xs text-muted">Weekdays only. Effective date still prints.</p>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button disabled={Boolean(busy)} onClick={() => void run(true, true)}>
                  {busy === "rdo-dl" ? "Saving…" : "Download"}
                </Button>
                <Button variant="secondary" disabled={Boolean(busy)} onClick={() => void run(true, false)}>
                  {busy === "rdo-send" ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-2xs uppercase tracking-wide text-muted">Include leave</p>
              <p className="text-xs text-muted">This week, with calendar dates.</p>
              <div className="grid grid-cols-2 gap-2">
                <Button disabled={Boolean(busy)} onClick={() => void run(false, true)}>
                  {busy === "full-dl" ? "Saving…" : "Download"}
                </Button>
                <Button variant="secondary" disabled={Boolean(busy)} onClick={() => void run(false, false)}>
                  {busy === "full-send" ? "Sending…" : "Send"}
                </Button>
              </div>
            </div>
            <Button variant="ghost" className="w-full text-muted" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </Overlay>
  );
}

function OfficerCard({
  officer,
  weekStart,
  today,
  requests,
  events,
  onEdit,
  onToggle,
}: {
  officer: Officer;
  weekStart: string;
  today: string;
  requests: TimeOffRequest[];
  events: CalendarEvent[];
  onEdit: () => void;
  onToggle: (weekday: number) => void;
}) {
  return (
    <li className="border-b border-border px-3 py-3">
      <button type="button" onClick={onEdit} className="flex w-full items-start justify-between gap-3 text-left">
        <span>
          <span className="block text-sm font-medium tracking-wide">{officer.name}</span>
          <span className="mt-0.5 block text-xs text-muted">
            Unit {officer.unit}
            <span className="mx-1.5 text-subtle">·</span>
            {rdoLabel(officer.rdoDays)}
          </span>
        </span>
        {officer.tmt ? <Badge tone="warning">SRT</Badge> : null}
      </button>
      <div className="mt-3 grid grid-cols-7 gap-1">
        {WEEKDAY_SHORT.map((_, weekday) => (
          <DayCell
            key={weekday}
            officer={officer}
            weekday={weekday}
            iso={addDays(weekStart, weekday)}
            today={today}
            requests={requests}
            events={events}
            onToggle={onToggle}
          />
        ))}
      </div>
    </li>
  );
}

function OfficerRow({
  officer,
  weekStart,
  today,
  requests,
  events,
  onEdit,
  onToggle,
}: {
  officer: Officer;
  weekStart: string;
  today: string;
  requests: TimeOffRequest[];
  events: CalendarEvent[];
  onEdit: () => void;
  onToggle: (weekday: number) => void;
}) {
  return (
    <div className="sched-grid border-b border-border">
      <button
        type="button"
        onClick={onEdit}
        className="flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-card-2"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium tracking-wide">{officer.name}</span>
          <span className="block text-xs text-muted">
            {officer.unit}
            <span className="mx-1.5 text-subtle">·</span>
            {rdoLabel(officer.rdoDays)}
          </span>
        </span>
        {officer.tmt ? <Badge tone="warning">SRT</Badge> : null}
      </button>
      {WEEKDAY_SHORT.map((_, weekday) => (
        <div key={weekday} className="p-1">
          <DayCell
            officer={officer}
            weekday={weekday}
            iso={addDays(weekStart, weekday)}
            today={today}
            requests={requests}
            events={events}
            onToggle={onToggle}
          />
        </div>
      ))}
    </div>
  );
}

function DayCell({
  officer,
  weekday,
  iso,
  today,
  requests,
  events,
  onToggle,
}: {
  officer: Officer;
  weekday: number;
  iso: string;
  today: string;
  requests: TimeOffRequest[];
  events: CalendarEvent[];
  onToggle: (weekday: number) => void;
}) {
  const s = statusForOfficer(officer, weekday, iso, requests, events);
  const isToday = iso === today;
  const isRdo = s.status === "rdo";
  const isLeave = s.status === "leave" || s.status === "calendar";
  const label = isRdo
    ? "RDO"
    : s.status === "calendar"
      ? "CAL"
      : s.status === "leave"
        ? s.statusLabel
        : "ON";

  return (
    <button
      type="button"
      onClick={() => {
        if (isLeave) {
          toast.message(`${officer.name} is off — ${s.statusLabel}`);
          return;
        }
        onToggle(weekday);
      }}
      aria-label={`${officer.name} ${WEEKDAY_SHORT[weekday]} ${label}`}
      className={cn(
        "flex h-12 w-full flex-col items-center justify-center rounded-sm text-2xs font-medium tracking-wide",
        isRdo && "bg-rdo text-rdo-fg",
        isLeave && "bg-destructive/20 text-destructive",
        s.status === "working" && "bg-card-2 text-muted hover:text-foreground",
        isToday && "ring-1 ring-primary/70",
      )}
    >
      {label}
    </button>
  );
}
