import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { Plus, Search, Share2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { RequestForm } from "@/components/request-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { formatShort, formatStamp, todayISO } from "@/lib/dates";
import {
  cancelMyRequest,
  createRequest,
  listRequests,
  retryLeaveCalendar,
  setRequestStatus,
} from "@/lib/fns";
import { useMyAccess, usePendingCount, useSupervisorReady } from "@/lib/hooks";
import { formatRequestInvite } from "@/lib/watch-text";
import { requestFormUrl, shareOrCopy } from "@/lib/share";
import { kindLabel, statusLabel, statusTone, type TimeOffRequest } from "@/lib/types";

export const Route = createFileRoute("/requests")({ component: RequestsPage });

function RequestsPage() {
  const pendingCount = usePendingCount();
  const { ready } = useSupervisorReady();
  const access = useMyAccess();
  const canApprove = Boolean(access.data?.caps.approveRequests);
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<RequestsTab>("pending");
  const [nameFilter, setNameFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [when, setWhen] = useState<"all" | "upcoming" | "past">("all");

  const q = useQuery({
    queryKey: ["requests"],
    queryFn: () => listRequests(),
    enabled: ready && canApprove,
  });

  const setStatus = useMutation({
    mutationFn: (input: { id: number; status: "approved" | "denied" | "pending" }) =>
      setRequestStatus({ data: input }),
    onSuccess: async (data, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests"] }),
        queryClient.invalidateQueries({ queryKey: ["watch"] }),
        queryClient.invalidateQueries({ queryKey: ["schedule"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
      ]);
      const cal = data.calendar;
      if (vars.status === "approved") {
        if (cal.message) {
          toast.warning(`Approved, but couldn’t add to Google Calendar: ${cal.message}`, {
            duration: 12_000,
          });
        } else if (cal.written) {
          toast.success("Approved — added to Google Calendar and dropped from the watch");
        } else {
          toast.success("Approved — filled on the calendar and dropped from the watch");
        }
      } else if (vars.status === "denied") {
        if (cal.message) {
          toast.warning(`Removed, but couldn’t delete the Google Calendar event: ${cal.message}`, {
            duration: 12_000,
          });
        } else {
          toast.success("Removed from the calendar");
        }
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const retryCal = useMutation({
    mutationFn: (id: number) => retryLeaveCalendar({ data: { id } }),
    onSuccess: async (data) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
      ]);
      if (data.calendar.written) toast.success("Added to Google Calendar");
      else
        toast.warning(
          `Couldn’t add to Google Calendar: ${data.calendar.message ?? "unknown error"}`,
          { duration: 12_000 },
        );
    },
    onError: (err) => toast.error(err.message),
  });

  const cancelReq = useMutation({
    mutationFn: (id: number) => cancelMyRequest({ data: { id } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests"] }),
        queryClient.invalidateQueries({ queryKey: ["watch"] }),
        queryClient.invalidateQueries({ queryKey: ["schedule"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
      ]);
      toast.success("Request cancelled");
    },
    onError: (err) => toast.error(err.message),
  });

  const officers = q.data?.officers ?? [];
  const requests = q.data?.requests ?? [];
  const nameOf = (officerId: string) => officers.find((o) => o.id === officerId)?.name ?? officerId;
  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");
  const closed = requests.filter((r) => r.status === "denied" || r.status === "cancelled");
  const today = todayISO();
  const recentlyDenied = closed.filter((r) => r.status === "denied" && r.endDate >= today);

  const approvedVisible = (() => {
    const needle = nameFilter.trim().toLowerCase();
    return approved
      .filter((r) => {
        if (needle) {
          const name = (
            officers.find((o) => o.id === r.officerId)?.name ?? r.officerId
          ).toLowerCase();
          if (!name.includes(needle)) return false;
        }
        if (dateFilter && (r.startDate > dateFilter || r.endDate < dateFilter)) return false;
        if (when === "upcoming" && r.endDate < today) return false;
        if (when === "past" && r.endDate >= today) return false;
        return true;
      })
      .sort((a, b) =>
        a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : b.id - a.id,
      );
  })();

  if (access.data && !canApprove) {
    return <Navigate to={access.data.caps.viewBoard ? "/" : "/me"} />;
  }

  const approvedActions = (req: TimeOffRequest) => (
    <div className="flex flex-wrap gap-2">
      {q.data?.googleCalendar && !req.calendarEventId ? (
        <Button size="sm" disabled={retryCal.isPending} onClick={() => retryCal.mutate(req.id)}>
          {retryCal.isPending && retryCal.variables === req.id
            ? "Adding…"
            : "Add to Google Calendar"}
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setStatus.mutate({ id: req.id, status: "denied" })}
      >
        Remove from calendar
      </Button>
    </div>
  );

  const closedActions = (req: TimeOffRequest) =>
    req.status === "denied" ? (
      <Button
        size="sm"
        variant="secondary"
        onClick={() => setStatus.mutate({ id: req.id, status: "approved" })}
      >
        Restore
      </Button>
    ) : null;

  async function sendFormToShift() {
    const url = requestFormUrl();
    const result = await shareOrCopy("Request days off", formatRequestInvite(url));
    if (result === "shared") toast.success("Request form sent to the shift");
    if (result === "copied") toast.success("Link copied — send it to the shift");
  }

  return (
    <AppShell
      title="Requests"
      pendingCount={pendingCount}
      fab={
        <button
          type="button"
          aria-label="New days-off request"
          onClick={() => setOpen(true)}
          className="fab-dock fixed right-5 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-panel"
        >
          <Plus className="size-7" strokeWidth={2.25} />
        </button>
      }
    >
      <div className="border-b border-border px-4 py-4">
        <p className="text-sm text-muted">
          Officers submit leave from the request form. Approve it here and it fills the calendar —
          they drop off the zone list for those dates.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => void sendFormToShift()}>
            <Share2 className="size-4" />
            Send form to shift
          </Button>
          <Button size="sm" variant="secondary" asChild>
            <Link to="/ask">Open officer form</Link>
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border bg-background px-4 py-2" role="tablist">
        {(
          [
            ["pending", `Pending · ${pending.length}`],
            ["approved", `Approved · ${approved.length}`],
            ["closed", `Denied · ${closed.length}`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              "h-9 flex-1 rounded-sm px-3 text-xs font-medium tracking-wide",
              tab === key
                ? "bg-primary text-primary-foreground"
                : "bg-card-2 text-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "pending" ? (
        <>
          <Section title={`Pending · ${pending.length}`}>
            {q.isLoading ? <p className="px-4 py-6 text-sm text-muted">Loading…</p> : null}
            {pending.length === 0 && !q.isLoading ? (
              <p className="px-4 py-6 text-sm text-muted">No open requests.</p>
            ) : null}
            <ul>
              {pending.map((req) => (
                <RequestCard
                  key={req.id}
                  req={req}
                  officerName={nameOf(req.officerId)}
                  actions={
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => setStatus.mutate({ id: req.id, status: "approved" })}
                      >
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setStatus.mutate({ id: req.id, status: "denied" })}
                      >
                        Deny
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => cancelReq.mutate(req.id)}>
                        Cancel
                      </Button>
                    </div>
                  }
                />
              ))}
            </ul>
          </Section>
          {recentlyDenied.length > 0 ? (
            <Section title={`Denied · upcoming dates · ${recentlyDenied.length}`}>
              <ul>
                {recentlyDenied.map((req) => (
                  <RequestCard
                    key={req.id}
                    req={req}
                    officerName={nameOf(req.officerId)}
                    actions={closedActions(req)}
                  />
                ))}
              </ul>
            </Section>
          ) : null}
        </>
      ) : null}

      {tab === "approved" ? (
        <Section
          title={`Approved archive · ${approvedVisible.length}${approvedVisible.length !== approved.length ? ` of ${approved.length}` : ""}`}
        >
          <div className="space-y-2 border-b border-border px-4 py-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-subtle" />
              <Input
                value={nameFilter}
                onChange={(e) => setNameFilter(e.target.value)}
                placeholder="Search officer"
                className="pl-9"
                aria-label="Search officer"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-auto flex-1"
                aria-label="Off on date"
              />
              {(["all", "upcoming", "past"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={when === key}
                  onClick={() => setWhen(key)}
                  className={cn(
                    "h-9 rounded-sm px-3 text-xs font-medium capitalize tracking-wide",
                    when === key
                      ? "bg-primary text-primary-foreground"
                      : "bg-card-2 text-muted hover:text-foreground",
                  )}
                >
                  {key}
                </button>
              ))}
              {nameFilter || dateFilter || when !== "all" ? (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setNameFilter("");
                    setDateFilter("");
                    setWhen("all");
                  }}
                >
                  Clear
                </Button>
              ) : null}
            </div>
          </div>
          {q.isLoading ? <p className="px-4 py-6 text-sm text-muted">Loading…</p> : null}
          {approvedVisible.length === 0 && !q.isLoading ? (
            <p className="px-4 py-6 text-sm text-muted">
              {approved.length === 0 ? "No approved requests yet." : "No approved requests match."}
            </p>
          ) : null}
          <ul>
            {approvedVisible.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                officerName={nameOf(req.officerId)}
                actions={approvedActions(req)}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {tab === "closed" ? (
        <Section title={`Denied & cancelled · ${closed.length}`}>
          {closed.length === 0 && !q.isLoading ? (
            <p className="px-4 py-6 text-sm text-muted">Nothing denied or cancelled.</p>
          ) : null}
          <ul>
            {closed.map((req) => (
              <RequestCard
                key={req.id}
                req={req}
                officerName={nameOf(req.officerId)}
                actions={closedActions(req)}
              />
            ))}
          </ul>
        </Section>
      ) : null}

      {open ? (
        <RequestForm
          officers={officers}
          onCancel={() => setOpen(false)}
          onSubmit={async (payload) => {
            await createRequest({ data: payload });
            await queryClient.invalidateQueries({ queryKey: ["requests"] });
            setOpen(false);
            toast.success("Request submitted — waiting on approval");
          }}
        />
      ) : null}
    </AppShell>
  );
}

type RequestsTab = "pending" | "approved" | "closed";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="bg-card-2 px-4 py-2 text-2xs font-medium uppercase tracking-wide-plus text-muted">
        {title}
      </h2>
      {children}
    </section>
  );
}

function RequestCard({
  req,
  officerName,
  actions,
}: {
  req: TimeOffRequest;
  officerName: string;
  actions?: React.ReactNode;
}) {
  const range =
    req.startDate === req.endDate
      ? formatShort(req.startDate)
      : `${formatShort(req.startDate)} – ${formatShort(req.endDate)}`;
  return (
    <li className="border-b border-border px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium tracking-wide">{officerName}</p>
          <p className="mt-1 text-sm text-muted">
            {range}
            <span className="mx-2 text-subtle">·</span>
            {kindLabel(req.kind)}
          </p>
          {req.createdAt ? (
            <p className="mt-1 text-xs text-subtle">Submitted {formatStamp(req.createdAt)}</p>
          ) : null}
          {req.reason ? <p className="mt-1 text-sm text-subtle">{req.reason}</p> : null}
        </div>
        <Badge tone={statusTone(req.status)}>{statusLabel(req.status)}</Badge>
      </div>
      {actions ? <div className="mt-3">{actions}</div> : null}
    </li>
  );
}
