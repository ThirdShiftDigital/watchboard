import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Building2, Clock, Shield, Users } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loadDashboard, openShift } from "@/lib/dashboard";
import { listAgencies, createAgencyInvite, listAgencyInvites, renameAgency, switchAgency } from "@/lib/agencies";
import { PatchUploader } from "@/components/patch-uploader";
import { useMyAccess, usePendingCount } from "@/lib/hooks";
import {
  listPendingSetups,
  rejectSetup,
  submitAgencySetup,
  submitShiftSetup,
  verifySetup,
} from "@/lib/setups";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { ZoneListEditor } from "@/components/zone-list-editor";
import { ShiftHoursForm } from "@/components/shift-hours-form";
import { STARTER_ZONES, normalizeZoneOrder } from "@/lib/types";

export const Route = createFileRoute("/dashboard")({ component: DashboardPage });

function DashboardPage() {
  const access = useMyAccess();
  const pendingCount = usePendingCount();
  const can = Boolean(access.data?.caps.manageAgency || access.data?.caps.managePlatform);
  const owner = Boolean(access.data?.caps.managePlatform);
  const dash = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => loadDashboard(),
    enabled: can,
  });
  const pending = useQuery({
    queryKey: ["pending-setups"],
    queryFn: () => listPendingSetups(),
    enabled: can,
  });
  const [selectedId, setSelectedId] = useState("");
  const [panel, setPanel] = useState<"shifts" | "add" | "office" | "onboard">("shifts");
  const queryClient = useQueryClient();
  const pickAgency = useMutation({
    mutationFn: (agencyId: string) => switchAgency({ data: { agencyId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(err.message),
  });

  if (access.data && !can) {
    return (
      <AppShell title="Command" pendingCount={pendingCount} requireSupervisor={false}>
        <p className="px-4 py-8 text-sm text-muted">
          The command dashboard is for the operator and agency admins. Shift
          commanders manage officers on Accounts.
        </p>
      </AppShell>
    );
  }

  const stats = dash.data?.stats;
  const agencies = dash.data?.agencies ?? [];
  const selected =
    agencies.find((a) => a.id === selectedId) ??
    agencies.find((a) => a.id === dash.data?.currentAgencyId) ??
    agencies[0];
  const selectedShifts = (dash.data?.shifts ?? []).filter((s) => s.agencyId === selected?.id);

  return (
    <AppShell title="Command" pendingCount={pendingCount} requireSupervisor={false}>
      <div className="flex min-h-0 flex-col gap-4 px-4 py-4 md:h-[calc(100dvh-4.75rem)]">
        <div className="shrink-0">
          <p className="font-display text-3xl font-semibold uppercase tracking-wide">Command</p>
          <p className="mt-1 text-sm text-muted">
            {owner
              ? "You are not on any agency. Pick one below WatchBoard, then the shift, to support that office."
              : "Add shifts and commanders. Shift commanders manage officers on Accounts."}
          </p>
        </div>

        <div className="grid shrink-0 grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={Building2} label="Agencies" value={stats?.agencies ?? "—"} />
          <Stat icon={Clock} label="Shifts" value={stats?.shifts ?? "—"} />
          <Stat icon={Shield} label="Waiting" value={stats?.pending ?? "—"} warn={Boolean(stats?.pending)} />
          <Stat icon={Users} label="People" value={stats?.people ?? "—"} />
        </div>

        {(pending.data?.setups.length ?? 0) > 0 ? (
          <div className="max-h-40 shrink-0 overflow-y-auto">
            <PendingPanel setups={pending.data?.setups ?? []} owner={owner} />
          </div>
        ) : null}

        <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[17rem_minmax(0,1fr)]">
          <aside className="min-h-0 overflow-y-auto rounded-lg border border-border bg-card">
            <p className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-3 py-2 text-2xs uppercase tracking-wide text-muted">
              <span>Agencies</span>
              {owner ? (
                <button
                  type="button"
                  className={cn("hover:underline", panel === "onboard" ? "text-primary" : "text-primary")}
                  onClick={() => {
                    setSelectedId("");
                    setPanel("onboard");
                  }}
                >
                  New
                </button>
              ) : null}
            </p>
            {agencies.length === 0 ? (
              <p className="px-3 py-6 text-sm text-muted">No live agencies yet.</p>
            ) : (
              <ul>
                {agencies.map((a) => {
                  const on = a.id === selected?.id;
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        className={cn(
                          "w-full px-3 py-3 text-left",
                          on ? "bg-primary text-primary-foreground" : "hover:bg-card-2",
                        )}
                        onClick={() => {
                          setSelectedId(a.id);
                          setPanel("shifts");
                          if (owner) pickAgency.mutate(a.id);
                        }}
                      >
                        <p className="truncate font-display text-sm font-semibold uppercase tracking-wide">
                          {a.name}
                        </p>
                        <p className={cn("text-2xs", on ? "text-primary-foreground/80" : "text-muted")}>
                          {a.shortName} · {a.shifts} shifts · {a.people} logins
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <section className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
            {panel === "onboard" && owner ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <OnboardAgencyForm
                  onCreated={async (agencyId) => {
                    setSelectedId(agencyId);
                    setPanel("shifts");
                    pickAgency.mutate(agencyId);
                  }}
                />
              </div>
            ) : (
              <>
            <div className="flex shrink-0 flex-wrap gap-1 border-b border-border p-2">
              {(
                [
                  ["shifts", "Shifts"],
                  ["add", "Add shift"],
                  ["office", "Office"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  className={cn(
                    "rounded-md px-3 py-1.5 text-2xs uppercase tracking-wide",
                    panel === id ? "bg-primary text-primary-foreground" : "text-muted hover:bg-card-2",
                  )}
                  onClick={() => setPanel(id)}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {panel === "shifts" && selected ? (
                <AgencyShifts
                  agency={selected}
                  shifts={selectedShifts}
                  owner={owner}
                />
              ) : null}
              {panel === "add" && access.data?.caps.manageAgency ? (
                <AddShiftForm
                  key={selected?.id ?? "add"}
                  agencies={agencies}
                  currentAgencyId={selected?.id ?? dash.data?.currentAgencyId ?? ""}
                  owner={owner}
                />
              ) : null}
              {panel === "office" ? (
                <div className="space-y-6">
                  {access.data?.caps.manageAgency ? <PatchPanel /> : null}
                  {owner ? <InvitesPanel /> : null}
                </div>
              ) : null}
            </div>
              </>
            )}
          </section>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  warn,
}: {
  icon: typeof Building2;
  label: string;
  value: number | string;
  warn?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-3">
      <Icon className={cn("size-4", warn ? "text-warning" : "text-primary")} strokeWidth={1.75} />
      <p className="mt-2 font-display text-3xl font-semibold tabular">{value}</p>
      <p className="text-2xs uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function PendingPanel({
  setups,
  owner,
}: {
  setups: Awaited<ReturnType<typeof listPendingSetups>>["setups"];
  owner: boolean;
}) {
  const queryClient = useQueryClient();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const verify = useMutation({
    mutationFn: (id: string) => verifySetup({ data: { id } }),
    onSuccess: async (res) => {
      toast.success(res.kind === "agency" ? "Agency is live" : "Shift is live");
      setConfirmId(null);
      await queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(err.message),
  });
  const reject = useMutation({
    mutationFn: (id: string) => rejectSetup({ data: { id } }),
    onSuccess: async () => {
      toast.success("Setup rejected — nothing created");
      await queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <section className="space-y-3">
      <p className="text-2xs uppercase tracking-wide text-muted">Verify before live</p>
      {setups.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted">
          No setups waiting. Submit an agency or shift below — it will sit here until
          you verify it.
        </p>
      ) : (
        <ul className="space-y-3">
          {setups.map((s) => {
            const p = s.payload;
            const title =
              s.kind === "agency"
                ? String(p.agencyName ?? "New agency")
                : String(p.name ?? "New shift");
            const detail =
              s.kind === "agency"
                ? `${p.shortName || "—"} · leader ${p.commanderName || "—"} · ${p.commanderEmail || ""}`
                : `${p.startTime}–${p.endTime} · min ${p.minWorking}${p.copyRoster ? " · copy roster" : ""}`;
            const zones = s.kind === "shift" ? (p.zoneOrder ?? []).filter(Boolean) : [];
            const canVerify = s.kind === "shift" || owner;
            return (
              <li key={s.id} className="rounded-lg border border-border bg-card px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xs uppercase tracking-wide text-primary">
                      {s.kind === "agency" ? "Agency setup" : "Shift setup"}
                    </p>
                    <p className="mt-1 font-display text-xl font-semibold uppercase tracking-wide">
                      {title}
                    </p>
                    <p className="mt-1 text-sm text-muted">{detail}</p>
                    {zones.length ? (
                      <p className="mt-1 text-xs text-muted">Zones: {zones.join(" · ")}</p>
                    ) : (
                      <p className="mt-1 text-xs text-warning">No zones set — starter compass list will be used</p>
                    )}
                    <p className="mt-1 text-xs text-subtle">Submitted by {s.submittedName}</p>
                  </div>
                </div>
                {canVerify ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {confirmId === s.id ? (
                      <>
                        <Button
                          className="flex-1"
                          disabled={verify.isPending}
                          onClick={() => verify.mutate(s.id)}
                        >
                          {verify.isPending ? "Going live…" : "Confirm — go live"}
                        </Button>
                        <Button variant="secondary" onClick={() => setConfirmId(null)}>
                          Back
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button className="flex-1" onClick={() => setConfirmId(s.id)}>
                          Verify setup
                        </Button>
                        <Button
                          variant="secondary"
                          disabled={reject.isPending}
                          onClick={() => reject.mutate(s.id)}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-muted">Waiting on the operator to verify.</p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function AgencyShifts({
  agency,
  shifts,
  owner,
}: {
  agency: { id: string; name: string; shortName: string; shifts: number; people: number };
  shifts: {
    id: string;
    name: string;
    hours: string;
    startTime: string;
    endTime: string;
    agencyId: string;
    officers: number;
    commander: string;
    minWorking: number;
  }[];
  owner: boolean;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [hoursFor, setHoursFor] = useState<string | null>(null);
  const open = useMutation({
    mutationFn: async (input: { shiftId: string; to: "/account" | "/" }) => {
      const res = await openShift({ data: { shiftId: input.shiftId } });
      return { ...res, to: input.to };
    },
    onSuccess: async (res) => {
      await queryClient.invalidateQueries();
      toast.success(`Opened ${res.shift.name}`);
      navigate({ to: res.to });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <div className="space-y-3">
      <div>
        <p className="font-display text-xl font-semibold uppercase tracking-wide">{agency.name}</p>
        <p className="text-xs text-muted">
          {agency.shortName} · {agency.shifts} shifts · {agency.people} logins
          {owner ? " · support view" : ""}
        </p>
      </div>
      <ul className="divide-y divide-border rounded-md border border-border">
        {shifts.length === 0 ? (
          <li className="px-3 py-3 text-sm text-muted">No live shifts yet. Use Add shift.</li>
        ) : (
          shifts.map((s) => (
            <li key={s.id} className="px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {s.name} <span className="text-muted">{s.hours}</span>
                  </p>
                  <p className="text-xs text-muted">
                    {s.officers} on roster · commander {s.commander} · min {s.minWorking}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button
                    variant="secondary"
                    onClick={() => setHoursFor(hoursFor === s.id ? null : s.id)}
                  >
                    Hours
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={open.isPending}
                    onClick={() => open.mutate({ shiftId: s.id, to: "/" })}
                  >
                    Zones
                  </Button>
                  <Button
                    variant="secondary"
                    disabled={open.isPending}
                    onClick={() => open.mutate({ shiftId: s.id, to: "/account" })}
                  >
                    People
                  </Button>
                </div>
              </div>
              {hoursFor === s.id ? (
                <div className="mt-3">
                  <ShiftHoursForm
                    compact
                    shiftId={s.id}
                    name={s.name}
                    startTime={s.startTime}
                    endTime={s.endTime}
                  />
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}

function PatchPanel() {
  const queryClient = useQueryClient();
  const agencies = useQuery({ queryKey: ["agencies"], queryFn: () => listAgencies() });
  const current = agencies.data?.current;
  return (
    <section className="space-y-3">
      <p className="text-2xs uppercase tracking-wide text-muted">Agency patch</p>
      <div className="space-y-3 rounded-lg border border-border bg-card px-4 py-4">
        <p className="text-sm text-muted">
          Used on the printed shift / RDO schedule. Square badge works best.
        </p>
        <PatchUploader
          patchData={current?.patchData}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["agencies"] })}
        />
      </div>
    </section>
  );
}

function OnboardAgencyForm({ onCreated }: { onCreated?: (agencyId: string) => void | Promise<void> }) {
  const queryClient = useQueryClient();
  const [agencyName, setAgencyName] = useState("");
  const [shortName, setShortName] = useState("");
  const [commanderName, setCommanderName] = useState("");
  const [commanderEmail, setCommanderEmail] = useState("");
  const [commanderPassword, setCommanderPassword] = useState("");
  const submit = useMutation({
    mutationFn: () =>
      submitAgencySetup({
        data: {
          agencyName,
          shortName,
          commanderName,
          commanderEmail,
          commanderPassword,
        },
      }),
    onSuccess: async (res) => {
      const email =
        "commander" in res && res.commander ? res.commander.email : commanderEmail;
      toast.success(`Separate agency saved. Division leader login: ${email}`);
      setAgencyName("");
      setShortName("");
      setCommanderName("");
      setCommanderEmail("");
      setCommanderPassword("");
      await queryClient.invalidateQueries({ queryKey: ["pending-setups"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["agencies"] });
      if ("agencyId" in res && res.agencyId) await onCreated?.(res.agencyId);
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <section className="space-y-3">
      <p className="text-2xs uppercase tracking-wide text-muted">Onboard agency</p>
      <form
        className="space-y-3 rounded-lg border border-border bg-card px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (agencyName.trim().length < 2) {
            toast.error("Name the agency.");
            return;
          }
          if (commanderName.trim().length < 2 || !commanderEmail.trim() || commanderPassword.length < 8) {
            toast.error("Add the division leader name, email, and a password (8+).");
            return;
          }
          submit.mutate();
        }}
      >
        <p className="text-sm text-muted">
          Creates a separate office with its own division leader, shifts, and
          logins. It is not added under the agency you have selected.
        </p>
        <div className="space-y-2">
          <Label htmlFor="ag-name">Agency name</Label>
          <Input
            id="ag-name"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            placeholder="County Sheriff’s Office"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="ag-short">Short name</Label>
          <Input
            id="ag-short"
            value={shortName}
            onChange={(e) => setShortName(e.target.value.toUpperCase())}
            placeholder="WCSO"
            maxLength={12}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dl-name">Division leader</Label>
          <Input
            id="dl-name"
            value={commanderName}
            onChange={(e) => setCommanderName(e.target.value)}
            placeholder="Capt. J. Doe"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dl-email">Leader email</Label>
          <Input
            id="dl-email"
            type="email"
            value={commanderEmail}
            onChange={(e) => setCommanderEmail(e.target.value)}
            placeholder="captain@agency.gov"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="dl-pass">Temporary password</Label>
          <Input
            id="dl-pass"
            type="password"
            value={commanderPassword}
            onChange={(e) => setCommanderPassword(e.target.value)}
            placeholder="8+ characters"
            minLength={8}
            required
          />
        </div>
        <Button className="h-12 w-full text-base" type="submit" disabled={submit.isPending}>
          {submit.isPending ? "Saving…" : "Save agency"}
        </Button>
      </form>
    </section>
  );
}

function AddShiftForm({
  agencies,
  currentAgencyId,
  owner,
}: {
  agencies: { id: string; name: string }[];
  currentAgencyId: string;
  owner: boolean;
}) {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("14:00");
  const [endTime, setEndTime] = useState("02:00");
  const [effectiveDate, setEffectiveDate] = useState(todayISO());
  const [minWorking, setMinWorking] = useState(10);
  const [copyRoster, setCopyRoster] = useState(false);
  const [zones, setZones] = useState<string[]>([...STARTER_ZONES]);
  const [commanderName, setCommanderName] = useState("");
  const [commanderEmail, setCommanderEmail] = useState("");
  const [commanderPassword, setCommanderPassword] = useState("");
  const submit = useMutation({
    mutationFn: () =>
      submitShiftSetup({
        data: {
          name,
          startTime,
          endTime,
          effectiveDate,
          minWorking,
          copyRoster,
          agencyId: currentAgencyId || undefined,
          zoneOrder: normalizeZoneOrder(zones),
          commanderName,
          commanderEmail,
          commanderPassword,
        },
      }),
    onSuccess: async (res) => {
      toast.success(`Shift saved. Commander login: ${res.commander.email}`);
      setName("");
      setCommanderName("");
      setCommanderEmail("");
      setCommanderPassword("");
      await queryClient.invalidateQueries({ queryKey: ["pending-setups"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["shifts"] });
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <section id="add-shift" className="space-y-3">
      <p className="text-2xs uppercase tracking-wide text-muted">Add a shift</p>
      <form
        className="space-y-3 rounded-lg border border-border bg-card px-4 py-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim().length < 2) {
            toast.error("Name the shift.");
            return;
          }
          if (commanderName.trim().length < 2 || !commanderEmail.trim() || commanderPassword.length < 8) {
            toast.error("Add the commander name, email, and a password (8+).");
            return;
          }
          submit.mutate();
        }}
      >
        <p className="text-sm text-muted">
          Saves the shift on{" "}
          <span className="text-foreground">
            {agencies.find((a) => a.id === currentAgencyId)?.name ?? "this agency"}
          </span>{" "}
          and creates the commander login. Not a new agency.
        </p>
        <div className="space-y-2">
          <Label htmlFor="sh-name">Shift name</Label>
          <Input
            id="sh-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="2nd Watch"
            required
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Start</Label>
            <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>End</Label>
            <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Effective</Label>
            <Input
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Min working</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={minWorking}
              onChange={(e) => setMinWorking(Number(e.target.value) || 10)}
            />
          </div>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            className="mt-1"
            checked={copyRoster}
            onChange={(e) => setCopyRoster(e.target.checked)}
          />
          Copy current roster onto the new shift
        </label>
        <div className="space-y-2">
          <Label htmlFor="cmd-name">Commander name</Label>
          <Input
            id="cmd-name"
            value={commanderName}
            onChange={(e) => setCommanderName(e.target.value)}
            placeholder="LT. C. KEYES"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cmd-email">Commander email</Label>
          <Input
            id="cmd-email"
            type="email"
            value={commanderEmail}
            onChange={(e) => setCommanderEmail(e.target.value)}
            placeholder="commander@agency.gov"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="cmd-pass">Commander password</Label>
          <Input
            id="cmd-pass"
            type="password"
            value={commanderPassword}
            onChange={(e) => setCommanderPassword(e.target.value)}
            placeholder="Temporary password (8+)"
          />
        </div>
        <Button className="h-12 w-full text-base" type="submit" disabled={submit.isPending}>
          {submit.isPending ? "Saving…" : "Save shift"}
        </Button>
        <div className="space-y-2">
          <Label>Zones</Label>
          <ZoneListEditor value={zones} onChange={setZones} />
        </div>
      </form>
    </section>
  );
}

function InvitesPanel() {
  const queryClient = useQueryClient();
  const invites = useQuery({ queryKey: ["agency-invites"], queryFn: () => listAgencyInvites() });
  const [agencyName, setAgencyName] = useState("");

  return (
    <section className="space-y-3">
      <p className="text-2xs uppercase tracking-wide text-muted">Invites</p>
      <div className="space-y-3 rounded-lg border border-border bg-card px-4 py-4">
        <p className="text-sm text-muted">
          Send a code. They fill setup — it still waits here until you verify.
        </p>
        <Button
          className="w-full"
          onClick={async () => {
            try {
              const res = await createAgencyInvite({ data: { kind: "agency" } });
              const url = `${window.location.origin}/onboard?code=${res.code}`;
              await navigator.clipboard.writeText(`WatchBoard agency invite ${res.code}\n${url}`);
              await queryClient.invalidateQueries({ queryKey: ["agency-invites"] });
              toast.success(`Code ${res.code} copied`);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not create invite");
            }
          }}
        >
          Copy agency invite
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          onClick={async () => {
            try {
              const res = await createAgencyInvite({ data: { kind: "join" } });
              const url = `${window.location.origin}/onboard?code=${res.code}`;
              await navigator.clipboard.writeText(`WatchBoard join invite ${res.code}\n${url}`);
              await queryClient.invalidateQueries({ queryKey: ["agency-invites"] });
              toast.success(`Join code ${res.code} copied`);
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not create invite");
            }
          }}
        >
          Copy join-this-agency invite
        </Button>
        <form
          className="space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!agencyName.trim()) return;
            try {
              await renameAgency({ data: { name: agencyName.trim() } });
              setAgencyName("");
              await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
              toast.success("Agency name saved");
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not rename");
            }
          }}
        >
          <Label>Rename this agency</Label>
          <Input
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            placeholder="Sheriff’s Office name"
          />
          <Button type="submit" variant="secondary" className="w-full" disabled={!agencyName.trim()}>
            Save name
          </Button>
        </form>
        {invites.data?.invites.length ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {invites.data.invites.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between px-3 py-2">
                <span className="font-display text-lg tracking-wide">{inv.code}</span>
                <span className="text-2xs uppercase text-muted">
                  {inv.kind === "join" ? "Join" : "New agency"}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
