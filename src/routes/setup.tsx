import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createShift, listShifts } from "@/lib/shifts";
import { useMyAccess, usePendingCount } from "@/lib/hooks";
import { todayISO } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { ZoneListEditor } from "@/components/zone-list-editor";
import { STARTER_ZONES, normalizeZoneOrder } from "@/lib/types";

export const Route = createFileRoute("/setup")({ component: SetupPage });

function SetupPage() {
  const access = useMyAccess();
  const pendingCount = usePendingCount();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const canCreate = Boolean(access.data?.caps.manageAgency);
  const shiftsQuery = useQuery({
    queryKey: ["shifts"],
    queryFn: () => listShifts(),
    enabled: Boolean(access.data),
  });

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

  const create = useMutation({
    mutationFn: () =>
      createShift({
        data: {
          name,
          startTime,
          endTime,
          effectiveDate,
          minWorking,
          zoneOrder: normalizeZoneOrder(zones),
          copyRoster,
          commanderName,
          commanderEmail,
          commanderPassword,
        },
      }),
    onSuccess: async (res) => {
      toast.success(`Shift saved. Commander login: ${res.commander.email}`);
      await queryClient.invalidateQueries({ queryKey: ["shifts"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["staff"] });
      void res;
      navigate({ to: "/dashboard" });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <AppShell title="New shift" pendingCount={pendingCount}>
      <form
        className="mx-auto w-full max-w-lg space-y-6 px-4 py-6"
        onSubmit={(e) => {
          e.preventDefault();
          if (!canCreate) return;
          if (name.trim().length < 2) {
            toast.error("Name the shift.");
            return;
          }
          if (commanderName.trim().length < 2 || !commanderEmail.trim() || commanderPassword.length < 8) {
            toast.error("Add the commander name, email, and a password (8+).");
            return;
          }
          create.mutate();
        }}
      >
        <div>
          <p className="font-display text-2xl font-semibold uppercase tracking-wide">
            New shift setup
          </p>
          <p className="mt-2 text-sm text-muted">
            Stand up another watch and appoint its shift commander. Save creates
            the shift and their login.
          </p>
        </div>

        {canCreate ? null : (
          <p className="rounded-md border border-border bg-card px-4 py-3 text-sm text-muted">
            New shifts are set up by a division leader or the operator. Shift
            commanders manage people on Accounts.
          </p>
        )}

        {shiftsQuery.data?.shifts.length ? (
          <p className="text-xs text-muted">
            Current shifts: {shiftsQuery.data.shifts.map((s) => s.name).join(" · ")}
          </p>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="shift-name">Shift name</Label>
          <Input
            id="shift-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="3rd Watch · Team B"
            required
            minLength={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="start">Start</Label>
            <Input
              id="start"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="end">End</Label>
            <Input
              id="end"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="effective">Effective date</Label>
            <Input
              id="effective"
              type="date"
              value={effectiveDate}
              onChange={(e) => setEffectiveDate(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="min">Min working</Label>
            <Input
              id="min"
              type="number"
              min={1}
              max={30}
              value={minWorking}
              onChange={(e) => setMinWorking(Number(e.target.value) || 10)}
              required
            />
          </div>
        </div>

        <label className="flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
          <input
            type="checkbox"
            className="mt-1"
            checked={copyRoster}
            onChange={(e) => setCopyRoster(e.target.checked)}
          />
          <span>
            <span className="block text-sm">Copy current roster</span>
            <span className="text-xs text-muted">
              Duplicates names and RDOs onto the new shift. Leave off to start empty
              and onboard.
            </span>
          </span>
        </label>

        <div className="space-y-3 rounded-lg border border-border bg-card px-4 py-4">
          <p className="text-2xs uppercase tracking-wide text-muted">Shift commander</p>
          <div className="space-y-2">
            <Label htmlFor="cmd-name">Name</Label>
            <Input
              id="cmd-name"
              value={commanderName}
              onChange={(e) => setCommanderName(e.target.value)}
              placeholder="LT. C. KEYES"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cmd-email">Email</Label>
            <Input
              id="cmd-email"
              type="email"
              value={commanderEmail}
              onChange={(e) => setCommanderEmail(e.target.value)}
              placeholder="commander@agency.gov"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cmd-pass">Temporary password</Label>
            <Input
              id="cmd-pass"
              type="password"
              value={commanderPassword}
              onChange={(e) => setCommanderPassword(e.target.value)}
              placeholder="8+ characters"
            />
          </div>
        </div>

        {canCreate ? (
          <Button className="h-12 w-full text-base" type="submit" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Save shift"}
          </Button>
        ) : (
          <p className={cn("text-sm text-muted")}>
            The agency adds shifts. Shift commanders manage officers on Accounts.
          </p>
        )}

        <div className="space-y-2">
          <Label>Zones</Label>
          <ZoneListEditor value={zones} onChange={setZones} />
        </div>
      </form>
    </AppShell>
  );
}
