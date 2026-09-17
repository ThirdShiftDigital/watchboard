import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Share2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { RequestForm } from "@/components/request-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatShort, formatStamp } from "@/lib/dates";
import { createRequest, listRequests, setRequestStatus } from "@/lib/fns";
import { usePendingCount, useSupervisorReady } from "@/lib/hooks";
import { formatRequestInvite } from "@/lib/watch-text";
import { requestFormUrl, shareOrCopy } from "@/lib/share";
import { kindLabel, type TimeOffRequest } from "@/lib/types";

export const Route = createFileRoute("/requests")({ component: RequestsPage });

function RequestsPage() {
  const pendingCount = usePendingCount();
  const { ready } = useSupervisorReady();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const q = useQuery({
    queryKey: ["requests"],
    queryFn: () => listRequests(),
    enabled: ready,
  });

  const setStatus = useMutation({
    mutationFn: (input: { id: number; status: "approved" | "denied" | "pending" }) =>
      setRequestStatus({ data: input }),
    onSuccess: async (_data, vars) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["requests"] }),
        queryClient.invalidateQueries({ queryKey: ["watch"] }),
        queryClient.invalidateQueries({ queryKey: ["schedule"] }),
        queryClient.invalidateQueries({ queryKey: ["calendar"] }),
      ]);
      if (vars.status === "approved") {
        toast.success("Approved — filled on the calendar and dropped from the watch");
      } else if (vars.status === "denied") {
        toast.success("Removed from the calendar");
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const officers = q.data?.officers ?? [];
  const requests = q.data?.requests ?? [];
  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

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
          Officers submit leave from the request form. Approve it here and it fills the
          calendar — they drop off the zone list for those dates.
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
              officerName={officers.find((o) => o.id === req.officerId)?.name ?? req.officerId}
              actions={
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setStatus.mutate({ id: req.id, status: "denied" })}
                  >
                    Deny
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setStatus.mutate({ id: req.id, status: "approved" })}
                  >
                    Approve
                  </Button>
                </div>
              }
            />
          ))}
        </ul>
      </Section>

      <Section title="History">
        {decided.length === 0 && !q.isLoading ? (
          <p className="px-4 py-6 text-sm text-muted">Nothing decided yet.</p>
        ) : null}
        <ul>
          {decided.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              officerName={officers.find((o) => o.id === req.officerId)?.name ?? req.officerId}
              actions={
                req.status === "approved" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setStatus.mutate({ id: req.id, status: "denied" })}
                  >
                    Remove from calendar
                  </Button>
                ) : req.status === "denied" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setStatus.mutate({ id: req.id, status: "approved" })}
                  >
                    Restore
                  </Button>
                ) : null
              }
            />
          ))}
        </ul>
      </Section>

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
        <Badge
          tone={
            req.status === "approved" ? "success" : req.status === "denied" ? "danger" : "warning"
          }
        >
          {req.status}
        </Badge>
      </div>
      {actions ? <div className="mt-3">{actions}</div> : null}
    </li>
  );
}
