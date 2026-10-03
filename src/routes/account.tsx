import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/cn";
import { formatStamp } from "@/lib/dates";
import { ROLES, roleLabel } from "@/lib/types";
import {
  CAP_INFO,
  PERMISSIONS,
  TOGGLE_CAPS,
  assignablePermissions,
  permissionHint,
  permissionLabel,
  type Caps,
  type Permission,
  type ToggleCap,
} from "@/lib/access";
import { useMyAccess, usePendingCount } from "@/lib/hooks";
import {
  assignLogin,
  attachExistingLogin,
  changeMyPassword,
  claimShiftCommand,
  createStaffUser,
  deleteMyAccount,
  deleteStaffUser,
  listStaff,
  setStaffCaps,
  setStaffPassword,
  setStaffPermission,
  updateStaffUser,
  type ExistingLoginConflict,
  type StaffScope,
} from "@/lib/staff";

const SCOPES: readonly StaffScope[] = ["shift", "agency", "all", "unassigned"];

export const Route = createFileRoute("/account")({
  component: AccountPage,
  validateSearch: (search: Record<string, unknown>): { scope?: StaffScope } => {
    const scope = SCOPES.find((s) => s === search.scope);
    return scope && scope !== "shift" ? { scope } : {};
  },
});

type PlacementOption = { id: string; name: string; shifts: { id: string; name: string }[] };
type RosterOption = {
  id: string;
  name: string;
  role: string;
  shiftId: string | null;
  agencyId: string | null;
};

function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  const pendingCount = usePendingCount();
  const access = useMyAccess();
  const queryClient = useQueryClient();
  const mine = access.data;
  const navigate = useNavigate({ from: "/account" });
  const requested = Route.useSearch().scope ?? "shift";
  // Fall back to the shift view when the caller can't use the requested list.
  const scope: StaffScope =
    (requested === "agency" && mine?.caps.manageAgency) ||
    ((requested === "all" || requested === "unassigned") && mine?.caps.managePlatform)
      ? requested
      : "shift";
  const staffQuery = useQuery({
    queryKey: ["staff", mine?.activeShiftId, mine?.agencyId, scope],
    queryFn: () => listStaff({ data: { scope } }),
    enabled: Boolean(mine?.caps.manageAccounts),
  });
  const scopeOptions: [StaffScope, string][] = [["shift", "This shift"]];
  if (mine?.caps.manageAgency) scopeOptions.push(["agency", "This agency"]);
  if (mine?.caps.managePlatform) {
    scopeOptions.push(["all", "All agencies"]);
    scopeOptions.push(["unassigned", `Unassigned (${staffQuery.data?.unassignedCount ?? 0})`]);
  }
  const scopeTitle =
    scope === "unassigned"
      ? "Unassigned"
      : scope === "all"
        ? "All agencies"
        : scope === "agency"
          ? (staffQuery.data?.agency?.name ?? "This agency")
          : (staffQuery.data?.shift?.name ?? "This shift");
  const [panel, setPanel] = useState<"people" | "add" | "me">("people");
  const [selectedId, setSelectedId] = useState("");
  const [filter, setFilter] = useState("");
  const people = staffQuery.data?.people ?? [];
  const visible = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return people;
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        permissionLabel(p.permission).toLowerCase().includes(q),
    );
  }, [people, filter]);

  if (isPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background text-sm text-muted">
        Checking access…
      </div>
    );
  }
  if (!user) return <RedirectToSignIn />;

  const selected =
    people.find((p) => p.userId === selectedId) ??
    visible[0] ??
    people[0];
  const canManage = Boolean(mine?.caps.manageAccounts);
  const allowed = mine ? assignablePermissions(mine.caps) : [];

  return (
    <AppShell title="Accounts" pendingCount={pendingCount} requireSupervisor={false}>
      <div className="flex min-h-0 flex-col gap-4 px-4 py-4 md:h-[calc(100dvh-4.75rem)]">
        <div className="shrink-0">
          <p className="font-display text-3xl font-semibold uppercase tracking-wide">Accounts</p>
          <p className="mt-1 text-sm text-muted">
            {!canManage
              ? "Your login and password."
              : scope === "unassigned"
                ? "Logins with no agency or shift. They see nothing until you assign them."
                : scope === "all"
                  ? "Every login on every agency."
                  : scope === "agency"
                    ? `Every login on ${staffQuery.data?.agency?.name ?? "this agency"}.`
                    : `Logins for ${staffQuery.data?.shift?.name ?? "the selected shift"} only. Switch shift under WatchBoard to see another.`}
          </p>
          {mine?.caps.manageAgency ? (
            <p className="mt-1 text-sm text-muted">
              Agencies and shifts live on{" "}
              <Link to="/dashboard" className="text-primary underline-offset-4 hover:underline">
                Command
              </Link>
              .
            </p>
          ) : null}
        </div>

        {staffQuery.data?.resets.length ? (
          <div className="max-h-40 shrink-0 overflow-y-auto rounded-lg border border-border bg-card">
            <p className="sticky top-0 border-b border-border bg-card px-3 py-2 text-2xs uppercase tracking-wide text-muted">
              Pending reset codes
            </p>
            <ul>
              {staffQuery.data.resets.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="min-w-0">
                    <span className="block truncate text-sm">{r.name || r.email}</span>
                    <span className="block truncate text-2xs text-muted">
                      {r.email} · expires {formatStamp(r.expiresAt)}
                    </span>
                  </span>
                  <span className="font-display text-lg font-semibold tracking-wide">{r.code}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {canManage ? (
          <div className="flex shrink-0 flex-wrap gap-1">
            {(
              [
                ["people", "People"],
                ["add", "Add user"],
                ["me", "My login"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={cn(
                  "rounded-md px-3 py-1.5 text-2xs uppercase tracking-wide",
                  panel === id ? "bg-primary text-primary-foreground" : "border border-border text-muted hover:bg-card-2",
                )}
                onClick={() => setPanel(id)}
              >
                {label}
              </button>
            ))}
          </div>
        ) : null}

        {canManage && panel === "people" ? (
          <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[17rem_minmax(0,1fr)]">
            <aside className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-card">
              <div className="shrink-0 space-y-2 border-b border-border p-2">
                {scopeOptions.length > 1 ? (
                  <select
                    aria-label="Which logins"
                    className="flex h-9 w-full rounded-md border border-border-strong bg-background px-2 text-sm"
                    value={scope}
                    onChange={(e) => {
                      const next = e.target.value as StaffScope;
                      setSelectedId("");
                      void navigate({ search: next === "shift" ? {} : { scope: next } });
                    }}
                  >
                    {scopeOptions.map(([id, label]) => (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : null}
                <p className="px-1 text-2xs uppercase tracking-wide text-muted">
                  {scopeTitle} · {people.length} logins
                </p>
                <Input
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  placeholder="Search name or email"
                />
              </div>
              <ul className="min-h-0 flex-1 overflow-y-auto">
                {visible.length === 0 ? (
                  <li className="px-3 py-6 text-sm text-muted">
                    {scope === "unassigned"
                      ? "Every login is on an agency and shift."
                      : "No logins on this shift yet. Add a user, or pick another shift."}
                  </li>
                ) : (
                  visible.map((person) => {
                    const on = person.userId === selected?.userId;
                    return (
                      <li key={person.userId}>
                        <button
                          type="button"
                          className={cn(
                            "w-full px-3 py-3 text-left",
                            on ? "bg-primary text-primary-foreground" : "hover:bg-card-2",
                          )}
                          onClick={() => setSelectedId(person.userId)}
                        >
                          <p className="truncate text-sm font-medium">
                            {person.name}
                            {person.disabled ? (
                              <span className={cn("ml-2 text-2xs uppercase", on ? "" : "text-warning")}>
                                Disabled
                              </span>
                            ) : null}
                          </p>
                          <p className={cn("truncate text-2xs", on ? "text-primary-foreground/80" : "text-muted")}>
                            {permissionLabel(person.permission)} · {person.email}
                          </p>
                          {scope !== "shift" ? (
                            <p className={cn("truncate text-2xs", on ? "text-primary-foreground/80" : "text-muted")}>
                              {person.unassigned ? (
                                <span className={on ? "font-semibold" : "font-semibold text-warning"}>
                                  Unassigned
                                </span>
                              ) : (
                                [person.agencyName, person.shiftName].filter(Boolean).join(" · ")
                              )}
                            </p>
                          ) : null}
                          <p className={cn("truncate text-2xs", on ? "text-primary-foreground/70" : "text-subtle")}>
                            {person.lastLoginAt
                              ? `Last login ${formatStamp(person.lastLoginAt)}`
                              : "Never signed in"}
                          </p>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </aside>
            <section className="min-h-0 overflow-y-auto rounded-lg border border-border bg-card p-4">
              {selected && mine ? (
                <PersonDetail
                  person={selected}
                  // Shift and roster controls only make sense for logins on the
                  // agency + shift you're looking at.
                  here={
                    !selected.unassigned &&
                    selected.agencyId === (staffQuery.data?.agency?.id ?? null)
                  }
                  onShift={
                    !selected.unassigned &&
                    Boolean(staffQuery.data?.shift?.id) &&
                    (selected.shiftId || selected.activeShiftId) === staffQuery.data?.shift?.id
                  }
                  placement={staffQuery.data?.placement ?? null}
                  roster={staffQuery.data?.roster ?? null}
                  agencyShifts={staffQuery.data?.shifts ?? []}
                  isOwner={Boolean(mine.caps.managePlatform)}
                  mineId={mine.userId}
                  allowed={allowed}
                  officers={staffQuery.data?.officers ?? []}
                  shifts={staffQuery.data?.shifts ?? []}
                  canMoveShift={Boolean(mine.caps.manageAgency || mine.isOwner)}
                  myCaps={mine.caps}
                  onChanged={async () => {
                    await queryClient.invalidateQueries({ queryKey: ["staff"] });
                    await queryClient.invalidateQueries({ queryKey: ["my-access"] });
                  }}
                />
              ) : (
                <p className="text-sm text-muted">Select a login to edit permissions.</p>
              )}
            </section>
          </div>
        ) : null}

        {canManage && panel === "add" ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <CreateAccountForm
              officers={staffQuery.data?.officers ?? []}
              allowed={allowed}
              placeName={[staffQuery.data?.agency?.name, staffQuery.data?.shift?.name]
                .filter(Boolean)
                .join(" · ")}
              onCreated={async () => {
                await queryClient.invalidateQueries({ queryKey: ["staff"] });
                setPanel("people");
              }}
            />
          </div>
        ) : null}

        {(!canManage || panel === "me") ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <MyLoginCard mine={mine} queryClient={queryClient} />
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}

function PersonDetail({
  person,
  here,
  onShift,
  placement,
  roster,
  agencyShifts,
  isOwner,
  mineId,
  allowed,
  officers,
  shifts,
  canMoveShift,
  myCaps,
  onChanged,
}: {
  person: {
    userId: string;
    name: string;
    email: string;
    permission: Permission;
    officerId: string | null;
    shiftId: string | null;
    activeShiftId?: string | null;
    agencyId?: string | null;
    agencyName?: string | null;
    shiftName?: string | null;
    unassigned?: boolean;
    rank?: string | null;
    disabled?: boolean;
    editable?: boolean;
    lastLoginAt?: string | null;
    toggles: Record<ToggleCap, boolean>;
    defaultToggles: Record<ToggleCap, boolean>;
    customizable: boolean;
    manageable: boolean;
    lockedReason: string | null;
    canLinkOfficer: boolean;
  };
  /** On the agency being viewed (shift select is limited to its shifts). */
  here: boolean;
  /** On the shift being viewed (the officer list is that shift's roster). */
  onShift: boolean;
  placement: PlacementOption[] | null;
  roster: RosterOption[] | null;
  /** Shifts of the agency being viewed (division leaders' shift list). */
  agencyShifts: { id: string; name: string }[];
  isOwner: boolean;
  mineId: string;
  allowed: Permission[];
  officers: { id: string; name: string }[];
  shifts: { id: string; name: string }[];
  canMoveShift: boolean;
  myCaps: Caps;
  onChanged: () => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-semibold uppercase tracking-wide">{person.name}</p>
          <p className="text-xs text-muted">{person.email}</p>
          <p className="mt-1 text-2xs uppercase tracking-wide text-muted">
            {person.unassigned ? (
              <span className="text-warning">Unassigned — sees nothing yet</span>
            ) : (
              [person.agencyName, person.shiftName].filter(Boolean).join(" · ")
            )}
          </p>
          <p className="mt-1 text-2xs uppercase tracking-wide text-muted">
            Last login
            <span className="ml-2 normal-case tracking-normal text-foreground">
              {person.lastLoginAt ? formatStamp(person.lastLoginAt) : "Never"}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone={person.permission === "captain" || person.permission === "admin" ? "success" : "neutral"}>
            {permissionLabel(person.permission)}
          </Badge>
          {person.rank ? <Badge tone="neutral">{roleLabel(person.rank as (typeof ROLES)[number]["id"])}</Badge> : null}
          {person.disabled ? <Badge tone="warning">Disabled</Badge> : null}
        </div>
      </div>
      {person.editable && roster ? (
        editing ? (
          <EditDetailsForm
            key={person.userId}
            person={person}
            self={person.userId === mineId}
            isOwner={isOwner}
            allowed={allowed}
            placement={placement}
            agencyShifts={agencyShifts}
            roster={roster}
            onDone={async (saved) => {
              setEditing(false);
              if (saved) await onChanged();
            }}
          />
        ) : (
          <Button type="button" variant="outline" onClick={() => setEditing(true)}>
            Edit details
          </Button>
        )
      ) : null}
      {!person.manageable ? (
        <p className="rounded-md border border-border bg-card-2 px-3 py-2 text-xs text-muted">
          {person.userId === mineId
            ? "This is your login. Change your password under My login; a division leader can change your role."
            : `${person.lockedReason ?? "Outside your authority."} Role, password and delete are locked.`}
        </p>
      ) : null}
      {placement && person.userId !== mineId && (person.unassigned || !here) ? (
        <AssignPanel person={person} placement={placement} allowed={allowed} onChanged={onChanged} />
      ) : null}
      {person.manageable && here ? (
        <div>
          <p className="mb-2 text-2xs uppercase tracking-wide text-muted">Permission</p>
          <div className="grid grid-cols-2 gap-2">
            {allowed.map((p) => (
              <button
                key={p}
                type="button"
                className={`rounded-md border px-2 py-2 text-left text-2xs uppercase tracking-wide ${
                  person.permission === p
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border text-muted"
                }`}
                onClick={async () => {
                  try {
                    await setStaffPermission({
                      data: { userId: person.userId, permission: p },
                    });
                    await onChanged();
                    toast.success(`${person.name} is ${permissionLabel(p)}`);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not update");
                  }
                }}
              >
                {permissionLabel(p)}
              </button>
            ))}
          </div>
        </div>
      ) : null}
      {here ? <PermissionToggles person={person} myCaps={myCaps} onChanged={onChanged} /> : null}
      {canMoveShift && here && person.manageable && person.permission !== "captain" && shifts.length > 0 ? (
        <div className="space-y-2">
          <Label>Shift</Label>
          <select
            className="flex h-11 w-full rounded-md border border-border-strong bg-background px-3 text-sm"
            value={person.shiftId ?? ""}
            onChange={async (e) => {
              const shiftId = e.target.value;
              if (!shiftId) return;
              try {
                await setStaffPermission({
                  data: {
                    userId: person.userId,
                    permission: person.permission,
                    shiftId,
                  },
                });
                await onChanged();
                toast.success(`${person.name} moved to that shift`);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not move");
              }
            }}
          >
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {person.canLinkOfficer && onShift ? (
        <div className="space-y-2">
          <Label>Tied officer</Label>
          <select
            className="flex h-11 w-full rounded-md border border-border-strong bg-background px-3 text-sm"
            value={person.officerId ?? ""}
            onChange={async (e) => {
              try {
                await setStaffPermission({
                  data: {
                    userId: person.userId,
                    permission: person.permission,
                    officerId: e.target.value || null,
                  },
                });
                await onChanged();
                toast.success("Officer link saved");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not link");
              }
            }}
          >
            <option value="">Not linked</option>
            {officers.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {person.manageable ? (
        <PasswordForm
          title="Set password"
          compact
          onSave={async (password) => {
            await setStaffPassword({
              data: { userId: person.userId, password },
            });
            toast.success(`Password set for ${person.name}`);
          }}
        />
      ) : null}
      {person.manageable && person.userId !== mineId ? (
        <DeleteAccountButton
          name={person.name}
          onDelete={async () => {
            await deleteStaffUser({ data: { userId: person.userId } });
            await onChanged();
            toast.success(`${person.name} deleted`);
          }}
        />
      ) : null}
    </div>
  );
}

const SELECT_CLASS = "flex h-11 w-full rounded-md border border-border-strong bg-background px-3 text-sm";

/**
 * Edit details (spec §1): name, email, rank, permission, agency (operator),
 * shift, roster link and Active/Disabled in one save. The server re-checks
 * every field; this form only hides what the caller can't change.
 */
function EditDetailsForm({
  person,
  self,
  isOwner,
  allowed,
  placement,
  agencyShifts,
  roster,
  onDone,
}: {
  person: {
    userId: string;
    name: string;
    email: string;
    permission: Permission;
    officerId: string | null;
    shiftId: string | null;
    activeShiftId?: string | null;
    agencyId?: string | null;
    rank?: string | null;
    disabled?: boolean;
  };
  self: boolean;
  isOwner: boolean;
  allowed: Permission[];
  placement: PlacementOption[] | null;
  agencyShifts: { id: string; name: string }[];
  roster: RosterOption[];
  onDone: (saved: boolean) => Promise<void>;
}) {
  const initial = {
    name: person.name,
    email: person.email,
    rank: person.rank ?? "",
    permission: person.permission,
    agencyId: person.agencyId ?? "",
    shiftId: person.shiftId || person.activeShiftId || "",
    officerId: person.officerId ?? "",
    disabled: Boolean(person.disabled),
  };
  const [form, setForm] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const shiftOptions = isOwner
    ? (placement?.find((a) => a.id === form.agencyId)?.shifts ?? [])
    : agencyShifts;
  const needsShift = form.permission !== "captain" && Boolean(form.agencyId);
  const officerOptions = roster.filter((o) =>
    form.shiftId ? o.shiftId === form.shiftId : form.agencyId !== "" && o.agencyId === form.agencyId,
  );
  const linked = roster.find((o) => o.id === form.officerId) ?? null;
  const roleChoices = PERMISSIONS.filter((p) => allowed.includes(p) || p === person.permission);

  const save = useMutation({
    mutationFn: () => {
      const data: Parameters<typeof updateStaffUser>[0]["data"] = { userId: person.userId };
      if (form.name !== initial.name) data.name = form.name;
      if (form.email !== initial.email) data.email = form.email;
      if (form.rank !== initial.rank) data.rank = (form.rank || null) as typeof data.rank;
      if (!self) {
        if (form.permission !== initial.permission) data.permission = form.permission;
        if (isOwner && form.agencyId !== initial.agencyId) data.agencyId = form.agencyId || null;
        if (form.shiftId !== initial.shiftId || data.agencyId !== undefined) {
          data.shiftId = needsShift ? form.shiftId || null : null;
        }
        if (form.officerId !== initial.officerId) data.officerId = form.officerId || null;
        if (form.disabled !== initial.disabled) data.disabled = form.disabled;
      }
      return updateStaffUser({ data });
    },
    onSuccess: async (res) => {
      setError(null);
      toast.success(res.changed.length ? `${form.name} saved` : "Nothing changed");
      if (res.note) toast.message(res.note);
      await onDone(true);
    },
    onError: (err) => setError(err.message),
  });

  return (
    <form
      className="space-y-3 rounded-md border border-border bg-card-2 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <p className="text-2xs uppercase tracking-wide text-muted">Edit details</p>
      <div className="space-y-1">
        <Label htmlFor="edit-name">Name</Label>
        <Input
          id="edit-name"
          value={form.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={80}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="edit-email">Email</Label>
        <Input
          id="edit-email"
          type="email"
          value={form.email}
          onChange={(e) => set("email", e.target.value.trim().toLowerCase())}
          required
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="edit-rank">Rank</Label>
        <select
          id="edit-rank"
          className={SELECT_CLASS}
          value={linked && form.officerId !== initial.officerId && form.rank === initial.rank ? linked.role : form.rank}
          onChange={(e) => set("rank", e.target.value)}
        >
          <option value="">None</option>
          {ROLES.map((r) => (
            <option key={r.id} value={r.id}>
              {r.label}
            </option>
          ))}
        </select>
        {form.officerId ? (
          <p className="text-2xs text-muted">
            Linked to the roster: rank is saved on the roster officer. Rank never changes permissions.
          </p>
        ) : null}
      </div>
      {!self ? (
        <>
          <div className="space-y-1">
            <Label htmlFor="edit-permission">Permission</Label>
            <select
              id="edit-permission"
              className={SELECT_CLASS}
              value={form.permission}
              onChange={(e) => set("permission", e.target.value as Permission)}
            >
              {roleChoices.map((p) => (
                <option key={p} value={p} disabled={!allowed.includes(p)}>
                  {permissionLabel(p)}
                </option>
              ))}
            </select>
          </div>
          {isOwner && placement ? (
            <div className="space-y-1">
              <Label htmlFor="edit-agency">Agency</Label>
              <select
                id="edit-agency"
                className={SELECT_CLASS}
                value={form.agencyId}
                onChange={(e) =>
                  // A new agency clears shift and roster link unless new ones are chosen.
                  setForm((f) => ({ ...f, agencyId: e.target.value, shiftId: "", officerId: "" }))
                }
              >
                <option value="">Unassigned</option>
                {placement.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {needsShift ? (
            <div className="space-y-1">
              <Label htmlFor="edit-shift">Shift</Label>
              <select
                id="edit-shift"
                className={SELECT_CLASS}
                value={form.shiftId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    shiftId: e.target.value,
                    officerId: roster.find((o) => o.id === f.officerId)?.shiftId === e.target.value ? f.officerId : "",
                  }))
                }
                required
              >
                <option value="">Pick a shift…</option>
                {shiftOptions.map((sh) => (
                  <option key={sh.id} value={sh.id}>
                    {sh.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {form.agencyId ? (
            <div className="space-y-1">
              <Label htmlFor="edit-officer">Roster officer</Label>
              <select
                id="edit-officer"
                className={SELECT_CLASS}
                value={form.officerId}
                onChange={(e) => set("officerId", e.target.value)}
              >
                <option value="">Not linked</option>
                {officerOptions.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className="space-y-1">
            <Label>Status</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  [false, "Active"],
                  [true, "Disabled"],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={label}
                  type="button"
                  className={cn(
                    "rounded-md border px-2 py-2 text-2xs uppercase tracking-wide",
                    form.disabled === value
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border text-muted",
                  )}
                  onClick={() => set("disabled", value)}
                >
                  {label}
                </button>
              ))}
            </div>
            {form.disabled && !initial.disabled ? (
              <p className="text-2xs text-muted">Signs them out now and blocks sign-in until re-enabled.</p>
            ) : null}
          </div>
        </>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex gap-2">
        <Button type="submit" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => void onDone(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** Operator: put a login (usually an Unassigned one) on an agency + shift. */
function AssignPanel({
  person,
  placement,
  allowed,
  onChanged,
}: {
  person: { userId: string; name: string; permission: Permission; agencyId?: string | null };
  placement: PlacementOption[];
  allowed: Permission[];
  onChanged: () => Promise<void>;
}) {
  const [agencyId, setAgencyId] = useState(
    placement.find((a) => a.id === person.agencyId)?.id ?? placement[0]?.id ?? "",
  );
  const agency = placement.find((a) => a.id === agencyId);
  const [shiftId, setShiftId] = useState("");
  const [permission, setPermission] = useState<Permission>(
    person.permission === "admin" || person.permission === "captain" ? "officer" : person.permission,
  );
  const needsShift = permission !== "captain";
  const assign = useMutation({
    mutationFn: () =>
      assignLogin({
        data: {
          userId: person.userId,
          agencyId,
          shiftId: needsShift ? shiftId : null,
          permission,
        },
      }),
    onSuccess: async () => {
      toast.success(`${person.name} assigned to ${agency?.name ?? "the agency"}`);
      await onChanged();
    },
    onError: (err) => toast.error(err.message),
  });
  return (
    <form
      className="space-y-2 rounded-md border border-warning/40 bg-warning/10 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        assign.mutate();
      }}
    >
      <p className="text-2xs uppercase tracking-wide text-muted">Assign to an agency</p>
      <select
        aria-label="Agency"
        className="flex h-11 w-full rounded-md border border-border-strong bg-background px-3 text-sm"
        value={agencyId}
        onChange={(e) => {
          setAgencyId(e.target.value);
          setShiftId("");
        }}
      >
        {placement.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      {needsShift ? (
        <select
          aria-label="Shift"
          className="flex h-11 w-full rounded-md border border-border-strong bg-background px-3 text-sm"
          value={shiftId}
          onChange={(e) => setShiftId(e.target.value)}
          required
        >
          <option value="">Pick a shift…</option>
          {(agency?.shifts ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      ) : null}
      <select
        aria-label="Permission"
        className="flex h-11 w-full rounded-md border border-border-strong bg-background px-3 text-sm"
        value={permission}
        onChange={(e) => setPermission(e.target.value as Permission)}
      >
        {PERMISSIONS.filter((p) => allowed.includes(p)).map((p) => (
          <option key={p} value={p}>
            {permissionLabel(p)}
          </option>
        ))}
      </select>
      <Button
        type="submit"
        className="w-full"
        disabled={assign.isPending || !agencyId || (needsShift && !shiftId)}
      >
        {assign.isPending ? "Assigning…" : "Assign"}
      </Button>
    </form>
  );
}

function PermissionToggles({
  person,
  myCaps,
  onChanged,
}: {
  person: {
    userId: string;
    name: string;
    permission: Permission;
    toggles: Record<ToggleCap, boolean>;
    defaultToggles: Record<ToggleCap, boolean>;
    customizable: boolean;
    manageable: boolean;
    lockedReason: string | null;
  };
  myCaps: Caps;
  onChanged: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<ToggleCap | "reset" | null>(null);
  const custom = TOGGLE_CAPS.some((k) => person.toggles[k] !== person.defaultToggles[k]);

  async function save(toggles: Partial<Record<ToggleCap, boolean>>, key: ToggleCap | "reset") {
    setBusy(key);
    try {
      await setStaffCaps({ data: { userId: person.userId, toggles } });
      await onChanged();
      if (key === "reset") toast.success(`${person.name} is back to ${permissionLabel(person.permission)} defaults`);
      else toast.success(`${CAP_INFO[key].label} ${toggles[key] ? "on" : "off"} for ${person.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update permissions");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-2xs uppercase tracking-wide text-muted">Permissions</p>
        {person.customizable && custom ? (
          <button
            type="button"
            disabled={busy !== null}
            className="text-2xs uppercase tracking-wide text-primary disabled:opacity-40"
            onClick={() => void save({ ...person.defaultToggles }, "reset")}
          >
            Reset to role defaults
          </button>
        ) : null}
      </div>
      {!person.customizable ? (
        <p className="text-sm text-muted">
          {person.permission === "admin" || person.permission === "captain"
            ? `${permissionLabel(person.permission)}s always have full access.`
            : person.manageable
              ? "Agency admins always have full access."
              : person.lockedReason === "This is your login."
                ? "You can’t change your own permissions."
                : "Only a division leader can change this login’s permissions."}
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-md border border-border">
          {TOGGLE_CAPS.map((key) => {
            const info = CAP_INFO[key];
            const on = person.toggles[key];
            const changed = on !== person.defaultToggles[key];
            const blocked = Boolean(info.requires && !person.toggles[info.requires]);
            const cannotGrant = !on && !myCaps[key];
            return (
              <li key={key} className="flex items-center justify-between gap-3 px-3 py-2.5">
                <span className="min-w-0">
                  <span className="block text-sm">
                    {info.label}
                    {changed ? (
                      <span className="ml-2 text-2xs uppercase tracking-wide text-primary">Custom</span>
                    ) : null}
                  </span>
                  <span className="block text-2xs text-muted">
                    {info.hint}
                    {blocked && info.requires ? ` · needs ${CAP_INFO[info.requires].label}` : ""}
                  </span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={on}
                  aria-label={info.label}
                  disabled={busy !== null || cannotGrant}
                  className={cn(
                    "w-14 shrink-0 rounded-md border px-2 py-1.5 text-2xs uppercase tracking-wide disabled:opacity-40",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted",
                  )}
                  onClick={() => void save({ [key]: !on }, key)}
                >
                  {busy === key ? "…" : on ? "On" : "Off"}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function MyLoginCard({
  mine,
  queryClient,
}: {
  mine: ReturnType<typeof useMyAccess>["data"];
  queryClient: ReturnType<typeof useQueryClient>;
}) {
  return (
    <section className="mx-auto w-full max-w-lg space-y-3">
      <p className="text-2xs uppercase tracking-wide text-muted">Signed in</p>
      <div className="rounded-lg border border-border bg-card px-4 py-4">
        <p className="text-sm font-medium">{mine?.name ?? "—"}</p>
        <p className="mt-1 text-xs text-muted">{mine?.email}</p>
        {mine ? (
          <p className="mt-2 text-xs text-muted">
            {permissionLabel(mine.permission)} — {permissionHint(mine.permission)}
          </p>
        ) : null}
        {mine && mine.permission === "captain" ? (
          <p className="mt-3 text-xs uppercase tracking-wide text-primary">You lead this division</p>
        ) : mine && mine.canClaimCommand ? (
          <Button
            className="mt-4 w-full"
            onClick={async () => {
              try {
                await claimShiftCommand();
                await queryClient.invalidateQueries({ queryKey: ["my-access"] });
                await queryClient.invalidateQueries({ queryKey: ["staff"] });
                toast.success("You are the shift commander");
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Could not take command");
              }
            }}
          >
            Make me shift commander
          </Button>
        ) : mine?.permission === "admin" ? (
          <p className="mt-3 text-xs uppercase tracking-wide text-primary">You command this shift</p>
        ) : mine?.isOwner ? (
          <p className="mt-3 text-xs uppercase tracking-wide text-primary">Platform operator — not tied to an agency</p>
        ) : null}
      </div>
      <PasswordForm
        title="Change my password"
        onSave={async (password, current) => {
          await changeMyPassword({ data: { current: current ?? "", next: password } });
          toast.success("Password updated");
        }}
        needCurrent
      />
      <DeleteMyAccountForm />
    </section>
  );
}

function PasswordForm({
  title,
  onSave,
  needCurrent = false,
  compact = false,
}: {
  title: string;
  onSave: (password: string, current?: string) => Promise<void>;
  needCurrent?: boolean;
  compact?: boolean;
}) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={compact ? "mt-3 space-y-2" : "space-y-3"}
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await onSave(password, current);
          setPassword("");
          setCurrent("");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save password");
        } finally {
          setBusy(false);
        }
      }}
    >
      <p className="text-2xs uppercase tracking-wide text-muted">{title}</p>
      {needCurrent ? (
        <Input
          type="password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
          placeholder="Current password"
          autoComplete="current-password"
          required
        />
      ) : null}
      <div className="flex gap-2">
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (8+)"
          minLength={8}
          required
          autoComplete="new-password"
        />
        <Button type="submit" disabled={busy || password.length < 8}>
          Save
        </Button>
      </div>
    </form>
  );
}

function CreateAccountForm({
  officers,
  allowed,
  placeName,
  onCreated,
}: {
  officers: { id: string; name: string }[];
  allowed: Permission[];
  /** "Agency · Shift" the new login lands on. */
  placeName: string;
  onCreated: () => Promise<void>;
}) {
  const [conflict, setConflict] = useState<ExistingLoginConflict | null>(null);
  const [resetPassword, setResetPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [permission, setPermission] = useState<Permission>("supervisor");
  const [officerId, setOfficerId] = useState("");
  const create = useMutation({
    mutationFn: () =>
      createStaffUser({
        data: {
          name,
          email,
          password,
          permission,
          officerId: officerId || undefined,
        },
      }),
    onSuccess: async (res) => {
      if (res.conflict) {
        // The email already has a login nobody placed (or the operator is
        // adding): offer to attach it instead of failing.
        setConflict(res.conflict);
        setResetPassword(false);
        return;
      }
      setName("");
      setEmail("");
      setPassword("");
      setOfficerId("");
      toast.success("Account created");
      await onCreated();
    },
    onError: (err) => toast.error(err.message),
  });
  const attach = useMutation({
    mutationFn: (existing: ExistingLoginConflict) =>
      attachExistingLogin({
        data: {
          userId: existing.userId,
          permission,
          officerId: officerId || null,
          password: resetPassword && password.length >= 8 ? password : undefined,
        },
      }),
    onSuccess: async () => {
      toast.success(`${conflict?.name ?? "Login"} attached`);
      setConflict(null);
      setName("");
      setEmail("");
      setPassword("");
      setOfficerId("");
      await onCreated();
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <form
      className="mx-auto w-full max-w-lg space-y-3 rounded-lg border border-border bg-card px-4 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        create.mutate();
      }}
    >
      <p className="font-display text-lg font-semibold uppercase tracking-wide">Add user</p>
      <p className="text-sm text-muted">
        Create a login for {placeName || "the shift selected under WatchBoard"}.
      </p>
      {conflict ? (
        <div className="space-y-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <p>
            <span className="font-semibold">{conflict.email}</span> already has a login
            {conflict.unassigned
              ? " with no agency yet."
              : ` on ${conflict.agencyName ?? "another agency"}.`}
          </p>
          <p className="text-muted">
            Attach it to {placeName || "this shift"} as {permissionLabel(permission)}? Their name
            and password stay as they are{resetPassword ? " (password will be replaced)" : ""}.
          </p>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={resetPassword}
              onChange={(e) => setResetPassword(e.target.checked)}
            />
            Also set the temporary password above (signs them out)
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              disabled={attach.isPending}
              onClick={() => attach.mutate(conflict)}
            >
              {attach.isPending ? "Attaching…" : "Attach existing login"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConflict(null)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}
      <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
      <Input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Email"
        required
      />
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Temporary password (8+)"
        minLength={8}
        required
      />
      <div className="grid grid-cols-2 gap-2">
        {PERMISSIONS.filter((p) => allowed.includes(p)).map((p) => (
          <button
            key={p}
            type="button"
            className={`rounded-md border px-2 py-2 text-left ${
              permission === p
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border"
            }`}
            onClick={() => setPermission(p)}
          >
            <span className="block text-2xs uppercase tracking-wide">{permissionLabel(p)}</span>
            <span className="mt-1 block text-micro opacity-80">{permissionHint(p)}</span>
          </button>
        ))}
      </div>
      <div className="space-y-2">
        <Label htmlFor="officer">Link officer (optional)</Label>
        <select
          id="officer"
          className="flex h-11 w-full rounded-md border border-border-strong bg-background px-3 text-sm"
          value={officerId}
          onChange={(e) => setOfficerId(e.target.value)}
        >
          <option value="">None</option>
          {officers.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>
      <Button className="w-full" type="submit" disabled={create.isPending}>
        {create.isPending ? "Creating…" : "Create account"}
      </Button>
    </form>
  );
}

function DeleteAccountButton({
  name,
  onDelete,
}: {
  name: string;
  onDelete: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="mt-3 w-full text-destructive"
        onClick={() => setOpen(true)}
      >
        Delete account
      </Button>
    );
  }
  return (
    <div className="mt-3 space-y-2 rounded-md border border-destructive/40 bg-card-2 px-3 py-3">
      <p className="text-sm">
        Delete <span className="font-medium">{name}</span>? They will not be able to sign in.
        The roster name stays.
      </p>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="destructive"
          className="flex-1"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await onDelete();
            } catch (err) {
              toast.error(err instanceof Error ? err.message : "Could not delete");
              setBusy(false);
              return;
            }
            setBusy(false);
            setOpen(false);
          }}
        >
          {busy ? "Deleting…" : "Delete"}
        </Button>
        <Button type="button" variant="secondary" className="flex-1" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function DeleteMyAccountForm() {
  const [password, setPassword] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!open) {
    return (
      <Button type="button" variant="ghost" className="w-full text-destructive" onClick={() => setOpen(true)}>
        Delete my account
      </Button>
    );
  }
  return (
    <form
      className="space-y-3 rounded-lg border border-destructive/40 bg-card px-4 py-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        try {
          await deleteMyAccount({ data: { password } });
          try {
            await signOut("/login");
          } catch {
            window.location.href = "/login";
          }
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not delete account");
          setBusy(false);
        }
      }}
    >
      <p className="text-2xs uppercase tracking-wide text-muted">Delete my account</p>
      <p className="text-sm text-muted">
        Removes this login. The last shift commander cannot delete themselves.
      </p>
      <Input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Current password"
        autoComplete="current-password"
        required
      />
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" className="flex-1" disabled={busy || !password}>
          {busy ? "Deleting…" : "Delete my account"}
        </Button>
        <Button type="button" variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  );
}