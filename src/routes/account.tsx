import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
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
import { PERMISSIONS, assignablePermissions, permissionHint, permissionLabel, type Permission } from "@/lib/access";
import { useMyAccess, usePendingCount } from "@/lib/hooks";
import {
  changeMyPassword,
  claimShiftCommand,
  createStaffUser,
  deleteMyAccount,
  deleteStaffUser,
  listStaff,
  setStaffPassword,
  setStaffPermission,
} from "@/lib/staff";

export const Route = createFileRoute("/account")({ component: AccountPage });

function AccountPage() {
  const { user, isPending } = useCurrentUserState();
  const pendingCount = usePendingCount();
  const access = useMyAccess();
  const queryClient = useQueryClient();
  const mine = access.data;
  const staffQuery = useQuery({
    queryKey: ["staff", mine?.activeShiftId, mine?.agencyId],
    queryFn: () => listStaff(),
    enabled: Boolean(mine?.caps.manageAccounts),
  });
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
            {canManage
              ? `Logins for ${staffQuery.data?.shift?.name ?? "the selected shift"} only. Switch shift under WatchBoard to see another.`
              : "Your login and password."}
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
          <div className="max-h-28 shrink-0 overflow-y-auto rounded-lg border border-border bg-card">
            <p className="sticky top-0 border-b border-border bg-card px-3 py-2 text-2xs uppercase tracking-wide text-muted">
              Pending reset codes
            </p>
            <ul>
              {staffQuery.data.resets.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-3 py-2">
                  <span className="truncate text-sm">{r.email}</span>
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
                <p className="px-1 text-2xs uppercase tracking-wide text-muted">
                  {staffQuery.data?.shift?.name ?? "This shift"} · {people.length} logins
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
                    No logins on this shift yet. Add a user, or pick another shift.
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
                          <p className="truncate text-sm font-medium">{person.name}</p>
                          <p className={cn("truncate text-2xs", on ? "text-primary-foreground/80" : "text-muted")}>
                            {permissionLabel(person.permission)} · {person.email}
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
                  mineId={mine.userId}
                  allowed={allowed}
                  officers={staffQuery.data?.officers ?? []}
                  shifts={staffQuery.data?.shifts ?? []}
                  canMoveShift={Boolean(mine.caps.manageAgency || mine.isOwner)}
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
  mineId,
  allowed,
  officers,
  shifts,
  canMoveShift,
  onChanged,
}: {
  person: {
    userId: string;
    name: string;
    email: string;
    permission: Permission;
    officerId: string | null;
    shiftId: string | null;
  };
  mineId: string;
  allowed: Permission[];
  officers: { id: string; name: string }[];
  shifts: { id: string; name: string }[];
  canMoveShift: boolean;
  onChanged: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-xl font-semibold uppercase tracking-wide">{person.name}</p>
          <p className="text-xs text-muted">{person.email}</p>
        </div>
        <Badge tone={person.permission === "captain" || person.permission === "admin" ? "success" : "neutral"}>
          {permissionLabel(person.permission)}
        </Badge>
      </div>
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
      {canMoveShift && shifts.length > 0 ? (
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
      {person.userId !== mineId ? (
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
        ) : mine && mine.permission !== "admin" && !mine.caps.manageAgency ? (
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
  onCreated,
}: {
  officers: { id: string; name: string }[];
  allowed: Permission[];
  onCreated: () => Promise<void>;
}) {
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
    onSuccess: async () => {
      setName("");
      setEmail("");
      setPassword("");
      setOfficerId("");
      toast.success("Account created");
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
      <p className="text-sm text-muted">Create a login for the shift selected under WatchBoard.</p>
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