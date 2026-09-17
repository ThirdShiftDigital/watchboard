import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell, HeaderIconButton } from "@/components/app-shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { CalendarBanner } from "@/components/calendar-banner";
import { CalendarFeedPanel } from "@/components/calendar-feed-sheet";
import { RequestForm } from "@/components/request-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import {
  addDays,
  daysInMonth,
  formatLong,
  formatShort,
  monthTitle,
  startOfMonth,
  startOfWeek,
  todayISO,
  weekdayOf,
} from "@/lib/dates";
import { callInLeave, connectGoogleCalendar, createRequest, disconnectGoogleCalendar, getCalendarFeed, getCalendarMonth, setCalendarFeed, setRequestStatus } from "@/lib/fns";
import { useMyAccess, usePendingCount, useSupervisorReady } from "@/lib/hooks";
import { useRefetchWhenConnectorReady } from "@/lib/app-data";
import { useWatchDate } from "@/lib/store";
import { WEEKDAYS, kindLabel } from "@/lib/types";
import { approvedLeaveInRange, approvedLeaveOnDate, statusForOfficer } from "@/lib/watch-logic";

export const Route = createFileRoute("/calendar")({ component: CalendarPage });

function CalendarPage() {
  const { date, setDate } = useWatchDate();
  const { user, isPending } = useCurrentUserState();
  const pendingCount = usePendingCount();
  const { ready } = useSupervisorReady();
  const access = useMyAccess();
  const canEditFeed = Boolean(access.data?.caps.editWatch);
  const canRemoveLeave = Boolean(access.data?.caps.approveRequests);
  const queryClient = useQueryClient();
  const [requesting, setRequesting] = useState(false);
  const [callIn, setCallIn] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const monthStart = startOfMonth(date);
  const monthDays = daysInMonth(date);
  const gridStart = startOfWeek(monthStart);
  const last = monthDays[monthDays.length - 1] ?? monthStart;
  const cells = useMemo(() => {
    const out: string[] = [];
    for (let i = 0; i < 42; i += 1) out.push(addDays(gridStart, i));
    return out;
  }, [gridStart]);

  const q = useQuery({
    queryKey: ["calendar", monthStart],
    queryFn: () => getCalendarMonth({ data: { from: monthStart, to: last } }),
    enabled: ready,
  });

  const feedQuery = useQuery({
    queryKey: ["calendar-feed"],
    queryFn: () => getCalendarFeed(),
    enabled: ready,
  });

  useRefetchWhenConnectorReady(q.data?.calendar.kind === "pending", () => q.refetch());

  const officers = q.data?.officers ?? [];
  const requests = q.data?.requests ?? [];
  const events = q.data?.calendar.events ?? [];
  const today = todayISO();

  const selectedLeave = useMemo(
    () => approvedLeaveOnDate(date, requests, officers),
    [date, requests, officers],
  );

  const monthLeave = useMemo(
    () => approvedLeaveInRange(monthStart, last, requests, officers),
    [monthStart, last, requests, officers],
  );

  const selectedSummary = useMemo(() => {
    if (!officers.length) return null;
    const weekday = weekdayOf(date);
    const working = officers.filter(
      (o) => statusForOfficer(o, weekday, date, requests, events).status === "working",
    ).length;
    const off = officers.length - working;
    return { working, off };
  }, [officers, date, requests, events]);

  const dayEvents = events.filter((e) => {
    const start = e.start.slice(0, 10);
    const end = (e.end ?? e.start).slice(0, 10);
    return date >= start && date <= end;
  });

  async function removeLeave(id: number, name: string) {
    try {
      await setRequestStatus({ data: { id, status: "denied" } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
        queryClient.invalidateQueries({ queryKey: ["requests"] }),
        queryClient.invalidateQueries({ queryKey: ["watch"] }),
        queryClient.invalidateQueries({ queryKey: ["schedule"] }),
        queryClient.invalidateQueries({ queryKey: ["officer-portal"] }),
      ]);
      toast.success(`${name} removed from the calendar`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove");
    }
  }

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted">
        Checking access…
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  return (
    <AppShell
      title="Calendar"
      pendingCount={pendingCount}
      requireSupervisor={false}
      actions={
        canEditFeed ? (
          <HeaderIconButton label="Leave feed" onClick={() => setFeedOpen((open) => !open)}>
            <Link2 className="size-5" />
          </HeaderIconButton>
        ) : undefined
      }
    >
      <div className="flex items-center justify-between border-b border-border bg-card px-2">
        <HeaderIconButton
          label="Previous month"
          onClick={() => setDate(addDays(monthStart, -1))}
        >
          <ChevronLeft className="size-5" />
        </HeaderIconButton>
        <p className="font-display text-lg font-semibold uppercase tracking-wide">
          {monthTitle(date)}
        </p>
        <HeaderIconButton
          label="Next month"
          onClick={() => setDate(addDays(last, 1))}
        >
          <ChevronRight className="size-5" />
        </HeaderIconButton>
      </div>

      {q.data ? (
        <CalendarBanner
          calendar={q.data.calendar}
          canConnect={canEditFeed}
          onConnect={() => setFeedOpen(true)}
        />
      ) : null}
      {canEditFeed ? (
      <div className="flex items-center justify-between border-b border-border bg-card-2 px-4 py-2">
        <p className="text-xs text-muted">
          {feedQuery.data?.google
            ? "Google Calendar is connected for this shift. Approved days off are written there."
            : feedQuery.data?.ics
              ? "Leave is pulled from the linked iCal feed. Approved requests also fill the watch."
              : "Connect Google Calendar to read leave and write approved days off."}
        </p>
        <Button
          id="add-feed-btn"
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => setFeedOpen((open) => !open)}
        >
          {feedOpen ? "Close" : "Calendar access"}
        </Button>
      </div>
      ) : (
        <p className="border-b border-border bg-card-2 px-4 py-2 text-xs text-muted">
          {feedQuery.data?.google || feedQuery.data?.ics
            ? "Shift leave calendar from the commander’s Google Calendar."
            : "No leave calendar is linked yet."}
        </p>
      )}
      {canEditFeed && feedOpen ? (
        <CalendarFeedPanel
          url={feedQuery.data?.url ?? ""}
          google={Boolean(feedQuery.data?.google)}
          canConnect={canEditFeed}
          onClose={() => setFeedOpen(false)}
          onConnect={async () => {
            const result = await connectGoogleCalendar();
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["calendar-feed"] }),
              queryClient.invalidateQueries({ queryKey: ["calendar"] }),
              queryClient.invalidateQueries({ queryKey: ["watch"] }),
              queryClient.invalidateQueries({ queryKey: ["schedule"] }),
            ]);
            return result;
          }}
          onDisconnect={async () => {
            await disconnectGoogleCalendar();
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["calendar-feed"] }),
              queryClient.invalidateQueries({ queryKey: ["calendar"] }),
              queryClient.invalidateQueries({ queryKey: ["watch"] }),
            ]);
          }}
          onSave={async (url) => {
            await setCalendarFeed({ data: { url } });
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["calendar-feed"] }),
              queryClient.invalidateQueries({ queryKey: ["calendar"] }),
              queryClient.invalidateQueries({ queryKey: ["watch"] }),
              queryClient.invalidateQueries({ queryKey: ["schedule"] }),
            ]);
            setFeedOpen(false);
            toast.success(url ? "Leave feed saved" : "Leave feed removed");
          }}
        />
      ) : null}

      <div className="grid grid-cols-7 border-b border-border bg-card-2 text-center text-2xs uppercase tracking-wide text-muted">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-2">
            {d.slice(0, 3)}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((iso) => {
          const inMonth = iso.slice(0, 7) === monthStart.slice(0, 7);
          const selected = iso === date;
          const isToday = iso === today;
          const leave = approvedLeaveOnDate(iso, requests, officers);
          const hits = events.filter((e) => {
            const start = e.start.slice(0, 10);
            const end = (e.end ?? e.start).slice(0, 10);
            return iso >= start && iso <= end;
          });
          return (
            <button
              key={iso}
              type="button"
              onClick={() => setDate(iso)}
              className={cn(
                "min-h-[4.5rem] border-b border-r border-border px-1 py-1.5 text-left",
                !inMonth && "bg-background/50 text-subtle",
                selected && "bg-primary/15",
              )}
            >
              <span
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full text-xs tabular",
                  isToday && "bg-primary text-primary-foreground",
                  selected && !isToday && "font-semibold text-primary",
                )}
              >
                {Number(iso.slice(8))}
              </span>
              {leave.length > 0 ? (
                <span className="mt-1 block truncate text-[10px] text-destructive">
                  {leave[0]?.name.split(" ").pop()}
                  {leave.length > 1 ? ` +${leave.length - 1}` : ""}
                </span>
              ) : hits.length > 0 ? (
                <span className="mt-1 block truncate text-[10px] text-muted">
                  {hits.length} evt
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <section className="px-4 py-4">
        <h2 className="font-display text-lg font-semibold uppercase tracking-wide">
          {formatLong(date)}
        </h2>
        {selectedSummary ? (
          <p className="mt-1 text-sm text-muted">
            {selectedSummary.working} working · {selectedSummary.off} off
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted">Loading coverage…</p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-2">
          {canRemoveLeave ? (
            <Button className="w-full" onClick={() => setCallIn(true)}>
              Call in sick
            </Button>
          ) : null}
          <Button variant={canRemoveLeave ? "secondary" : undefined} className="w-full" onClick={() => setRequesting(true)}>
            Request this day off
          </Button>
        </div>

        <h3 className="mt-6 text-2xs uppercase tracking-wide-plus text-muted">
          Filled on calendar
        </h3>
        {selectedLeave.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No approved leave on this day.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {selectedLeave.map((chip) => (
              <li key={chip.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{chip.name}</p>
                  <p className="mt-1 text-xs text-muted">
                    {chip.startDate === chip.endDate
                      ? formatShort(chip.startDate)
                      : `${formatShort(chip.startDate)} – ${formatShort(chip.endDate)}`}
                    <span className="mx-1.5 text-subtle">·</span>
                    All day
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone="danger">{kindLabel(chip.kind)}</Badge>
                  {canRemoveLeave ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void removeLeave(chip.id, chip.name)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-6 text-2xs uppercase tracking-wide-plus text-muted">
          Calendar events
        </h3>
        {dayEvents.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            No events from the leave feed on this day.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {dayEvents.map((e) => (
              <li key={e.id} className="py-3">
                <p className="text-sm font-medium">{e.title}</p>
                <p className="mt-1 text-xs text-muted">
                  {e.matchedOfficerIds.length
                    ? `Matched ${e.matchedOfficerIds
                        .map((id) => officers.find((o) => o.id === id)?.name ?? id)
                        .join(", ")}`
                    : "No deputy name matched"}
                </p>
              </li>
            ))}
          </ul>
        )}

        {monthLeave.length > 0 ? (
          <>
            <h3 className="mt-6 text-2xs uppercase tracking-wide-plus text-muted">
              This month
            </h3>
            <ul className="mt-2 divide-y divide-border">
              {monthLeave.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                  <button type="button" className="min-w-0 text-left" onClick={() => setDate(r.startDate)}>
                    <span className="block text-sm">{r.name}</span>
                    <span className="text-xs text-muted">
                      {r.startDate === r.endDate
                        ? formatShort(r.startDate)
                        : `${formatShort(r.startDate)} – ${formatShort(r.endDate)}`}
                    </span>
                  </button>
                  {canRemoveLeave ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void removeLeave(r.id, r.name)}
                    >
                      Remove
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      {callIn ? (
        <RequestForm
          mode="call-in"
          officers={officers}
          initialStart={date}
          initialEnd={date}
          onCancel={() => setCallIn(false)}
          onSubmit={async (payload) => {
            await callInLeave({ data: payload });
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ["calendar"] }),
              queryClient.invalidateQueries({ queryKey: ["requests"] }),
              queryClient.invalidateQueries({ queryKey: ["watch"] }),
              queryClient.invalidateQueries({ queryKey: ["schedule"] }),
              queryClient.invalidateQueries({ queryKey: ["officer-portal"] }),
            ]);
            setCallIn(false);
            toast.success("On leave — watch and calendar updated");
          }}
        />
      ) : null}
      {requesting ? (
        <RequestForm
          officers={officers}
          initialStart={date}
          initialEnd={date}
          onCancel={() => setRequesting(false)}
          onSubmit={async (payload) => {
            await createRequest({ data: payload });
            await queryClient.invalidateQueries({ queryKey: ["requests"] });
            await queryClient.invalidateQueries({ queryKey: ["calendar"] });
            setRequesting(false);
            toast.success("Request submitted — it fills the calendar after approval");
          }}
        />
      ) : null}
    </AppShell>
  );
}
