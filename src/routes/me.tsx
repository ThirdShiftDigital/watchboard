import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, ChevronDown, Shield } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PickerSheet } from "@/components/picker-sheet";
import { RequestForm } from "@/components/request-form";
import { SheriffMark } from "@/components/sheriff-mark";
import { InstallAppButton } from "@/components/install-app";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RedirectToSignIn, UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/cn";
import { addDays, formatLong, formatShort, formatStamp, startOfWeek, todayISO } from "@/lib/dates";
import { cancelMyRequest, createRequest, getOfficerPortal } from "@/lib/fns";
import { useMyAccess } from "@/lib/hooks";
import { useOfficerSession } from "@/lib/officer-session";
import { linkMyOfficer } from "@/lib/staff";
import { WEEKDAY_SHORT, kindLabel, rdoLabel, statusLabel, statusTone, zoneHint } from "@/lib/types";
import { statusForOfficer } from "@/lib/watch-logic";

export const Route = createFileRoute("/me")({ component: OfficerPage });

function OfficerPage() {
  const { user, isPending } = useCurrentUserState();
  const access = useMyAccess();
  const { officerId, ready, pick } = useOfficerSession();
  const linkedId = access.data?.officerId ?? null;
  const activeId = linkedId ?? officerId;
  const supervisorTo = access.data?.caps.viewBoard ? "/" : "/login";
  const supervisorSearch = access.data?.caps.viewBoard ? undefined : { switch: true };
  const today = todayISO();
  const weekStart = startOfWeek(today);
  const queryClient = useQueryClient();
  const [picking, setPicking] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const portalQuery = useQuery({
    queryKey: ["officer-portal", activeId],
    queryFn: () => getOfficerPortal({ data: { officerId: activeId ?? undefined } }),
    enabled: ready && Boolean(user) && !access.isPending,
  });

  const officers = portalQuery.data?.officers ?? [];
  const officer = officers.find((o) => o.id === activeId) ?? portalQuery.data?.officer ?? null;
  const requests = portalQuery.data?.requests ?? [];
  const watchRow = portalQuery.data?.todayRow ?? undefined;
  const events = portalQuery.data?.calendar?.events ?? [];
  const locked = Boolean(linkedId);

  const week = useMemo(() => {
    if (!officer) return [];
    return WEEKDAY_SHORT.map((label, weekday) => {
      const iso = addDays(weekStart, weekday);
      const s = statusForOfficer(officer, weekday, iso, requests, events);
      return { label, iso, ...s };
    });
  }, [officer, weekStart, requests, events]);

  const weekLeave = useMemo(() => {
    return events.filter((e) => {
      const start = e.start.slice(0, 10);
      const end = (e.end ?? e.start).slice(0, 10);
      return end >= weekStart && start <= addDays(weekStart, 6);
    });
  }, [events, weekStart]);

  async function submitRequest(payload: {
    officerId: string;
    startDate: string;
    endDate: string;
    kind: "vacation" | "sick" | "training" | "court" | "other";
    reason: string;
  }) {
    await createRequest({ data: payload });
    await queryClient.invalidateQueries({ queryKey: ["officer-portal"] });
    setRequesting(false);
    toast.success("Request submitted — waiting on a supervisor");
  }

  async function cancelRequest(id: number) {
    try {
      await cancelMyRequest({ data: { id } });
      await queryClient.invalidateQueries({ queryKey: ["officer-portal"] });
      toast.success("Request cancelled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel request");
    }
  }

  async function chooseOfficer(id: string) {
    pick(id);
    try {
      await linkMyOfficer({ data: { officerId: id } });
      await queryClient.invalidateQueries({ queryKey: ["my-access"] });
      await queryClient.invalidateQueries({ queryKey: ["officer-portal"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not link officer");
    }
    setPicking(false);
  }

  if (isPending || !ready || (user && access.isPending)) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted">
        Checking officer access…
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-header px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]">
        <SheriffMark className="size-9" />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-semibold uppercase tracking-wider leading-none">
            Officer
          </h1>
          <p className="mt-1 text-2xs uppercase tracking-wide text-muted">Days off · calendar</p>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/calendar">
            <CalendarDays className="size-4" />
            Calendar
          </Link>
        </Button>
        {access.data?.caps.viewBoard ? (
          <Button variant="ghost" size="sm" asChild>
            <Link to={supervisorTo} search={supervisorSearch}>
              <Shield className="size-4" />
              Board
            </Link>
          </Button>
        ) : null}
        <UserButton />
      </header>

      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-5 pb-16">
        <InstallAppButton className="mb-4 w-full" />
        {!officer ? (
          <div className="rounded-lg border border-border bg-card px-5 py-8 text-center">
            <p className="font-display text-2xl font-semibold uppercase tracking-wide">
              Who are you?
            </p>
            <p className="mt-2 text-sm text-muted">
              Tie this login to your roster name. The shift commander can also do this
              on Accounts.
            </p>
            <Button className="mt-6 w-full" onClick={() => setPicking(true)}>
              Select your name
            </Button>
          </div>
        ) : (
          <div className="space-y-5">
            <button
              type="button"
              onClick={() => {
                if (!locked) setPicking(true);
              }}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-card px-4 py-3 text-left"
            >
              <span>
                <span className="block text-sm font-medium tracking-wide">{officer.name}</span>
                <span className="mt-0.5 block text-xs text-muted">
                  Unit {officer.unit}
                  {officer.radioNum != null ? (
                    <>
                      <span className="mx-1.5 text-subtle">·</span>
                      S {officer.radioNum}
                    </>
                  ) : null}
                  <span className="mx-1.5 text-subtle">·</span>
                  {rdoLabel(officer.rdoDays)}
                  {officer.tmt ? <span className="mx-1.5 text-subtle">·</span> : null}
                  {officer.tmt ? "SRT" : null}
                </span>
              </span>
              {locked ? null : <ChevronDown className="size-4 text-muted" />}
            </button>

            <section className="rounded-lg border border-border bg-card px-4 py-4">
              <p className="text-2xs uppercase tracking-wide text-muted">Today</p>
              <p className="mt-1 font-display text-xl font-semibold uppercase tracking-wide">
                {formatLong(today)}
              </p>
              <TodayStatus row={watchRow} />
            </section>

            <section>
              <p className="mb-2 text-2xs uppercase tracking-wide text-muted">This week</p>
              <div className="grid grid-cols-7 gap-1">
                {week.map((d) => {
                  const isToday = d.iso === today;
                  const isRdo = d.status === "rdo";
                  const isLeave = d.status === "leave" || d.status === "calendar";
                  return (
                    <div
                      key={d.iso}
                      className={cn(
                        "flex flex-col items-center rounded-sm py-2",
                        isRdo && "bg-rdo text-rdo-fg",
                        isLeave && "bg-destructive/20 text-destructive",
                        d.status === "working" && "bg-card-2 text-muted",
                        isToday && "ring-1 ring-primary/70",
                      )}
                    >
                      <span className="text-micro uppercase tracking-wide">{d.label}</span>
                      <span className="tabular text-sm font-medium">{Number(d.iso.slice(8))}</span>
                      <span className="mt-0.5 text-micro font-medium">
                        {isRdo ? "RDO" : isLeave ? d.statusLabel : "ON"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-2xs uppercase tracking-wide text-muted">Leave calendar</p>
                <Link to="/calendar" className="text-2xs uppercase tracking-wide text-primary">
                  Full month
                </Link>
              </div>
              {weekLeave.length === 0 ? (
                <p className="text-sm text-muted">
                  No leave on the commander’s calendar this week.
                </p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                  {weekLeave.map((e) => (
                    <li key={e.id} className="px-4 py-3">
                      <p className="text-sm">{e.title}</p>
                      <p className="text-xs text-muted">
                        {formatShort(e.start.slice(0, 10))}
                        {e.end && e.end.slice(0, 10) !== e.start.slice(0, 10)
                          ? ` – ${formatShort(e.end.slice(0, 10))}`
                          : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-2xs uppercase tracking-wide text-muted">My requests</p>
                <button
                  type="button"
                  onClick={() => setRequesting((v) => !v)}
                  className="text-2xs uppercase tracking-wide text-primary"
                >
                  {requesting ? "Close" : "Request days off"}
                </button>
              </div>
              {requesting ? (
                <div className="rounded-lg border border-border bg-card px-4 py-4">
                  <RequestForm
                    embedded
                    officers={officers}
                    lockedOfficerId={officer.id}
                    onCancel={() => setRequesting(false)}
                    onSubmit={submitRequest}
                  />
                </div>
              ) : null}
              {requests.length === 0 && !requesting ? (
                <p className="text-sm text-muted">No requests yet.</p>
              ) : (
                <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                  {requests.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-4 py-3">
                      <span>
                        <span className="block text-sm">{kindLabel(r.kind)}</span>
                        <span className="text-xs text-muted">
                          {formatShort(r.startDate)}
                          {r.endDate !== r.startDate ? ` – ${formatShort(r.endDate)}` : ""}
                          {r.createdAt ? ` · ${formatStamp(r.createdAt)}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <Badge tone={statusTone(r.status)}>{statusLabel(r.status)}</Badge>
                        {r.status === "pending" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2 text-xs text-muted"
                            onClick={() => void cancelRequest(r.id)}
                          >
                            Cancel
                          </Button>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        )}
      </main>

      {picking ? (
        <PickerSheet
          title="Deputy"
          options={officers.map((o) => ({
            id: o.id,
            label: o.name,
            hint: `Unit ${o.unit} · ${rdoLabel(o.rdoDays)}`,
          }))}
          value={activeId ?? ""}
          onChange={(id) => {
            void chooseOfficer(id);
          }}
          onClose={() => setPicking(false)}
        />
      ) : null}
    </div>
  );
}

function TodayStatus({
  row,
}: {
  row:
    | {
        status: string;
        statusLabel: string;
        zone: string | null;
        eventTitle?: string;
      }
    | null
    | undefined;
}) {
  if (!row) {
    return <p className="mt-3 text-sm text-muted">Loading today's watch…</p>;
  }
  if (row.status === "rdo") {
    return (
      <p className="mt-3 font-display text-3xl font-semibold uppercase tracking-wide text-muted">
        RDO
      </p>
    );
  }
  if (row.status === "leave" || row.status === "calendar") {
    return (
      <div className="mt-3">
        <p className="font-display text-3xl font-semibold uppercase tracking-wide text-destructive">
          {row.statusLabel}
        </p>
        {row.eventTitle ? <p className="mt-1 text-sm text-muted">{row.eventTitle}</p> : null}
      </div>
    );
  }
  return (
    <p className="mt-3 font-display text-3xl font-semibold uppercase tracking-wide">
      {row.zone ? (
        <>
          {row.zone}
          <span className="ml-2 text-base font-normal text-muted">{zoneHint(row.zone)}</span>
        </>
      ) : (
        "Working"
      )}
    </p>
  );
}
