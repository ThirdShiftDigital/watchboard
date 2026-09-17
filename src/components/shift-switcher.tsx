import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { listShifts, switchShift } from "@/lib/shifts";
import { listAgencies, switchAgency } from "@/lib/agencies";
import { shiftHoursLabel } from "@/lib/types";
import { useMyAccess } from "@/lib/hooks";

export function ShiftSwitcher() {
  const access = useMyAccess();
  const queryClient = useQueryClient();
  const support = Boolean(access.data?.caps.managePlatform);
  const q = useQuery({
    queryKey: ["shifts"],
    queryFn: () => listShifts(),
    enabled: Boolean(access.data),
  });
  const agencies = useQuery({
    queryKey: ["agencies"],
    queryFn: () => listAgencies(),
    enabled: Boolean(access.data),
  });
  const switchAgencyMut = useMutation({
    mutationFn: (agencyId: string) => switchAgency({ data: { agencyId } }),
    onSuccess: async (res) => {
      toast.success(`Viewing ${res.agency?.name ?? "that agency"}`);
      await queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(err.message),
  });
  const switchMut = useMutation({
    mutationFn: (shiftId: string) => switchShift({ data: { shiftId } }),
    onSuccess: async (res) => {
      toast.success(`Now on ${res.shift.name}`);
      await queryClient.invalidateQueries();
    },
    onError: (err) => toast.error(err.message),
  });

  const shifts = q.data?.shifts ?? [];
  const current = shifts.find((s) => s.id === q.data?.currentId) ?? shifts[0];

  const agencyList = agencies.data?.agencies ?? [];
  const currentAgency =
    agencyList.find((a) => a.id === agencies.data?.currentId) ?? agencies.data?.current;
  const showAgencySelect = support || agencyList.length > 1;
  const showShiftSelect = support || (shifts.length > 1 && Boolean(access.data?.caps.viewBoard));

  return (
    <div className="space-y-2">
      {showAgencySelect && agencyList.length > 0 ? (
        <label className="block space-y-1">
          <span className="px-0.5 text-2xs uppercase tracking-wide text-muted">Agency</span>
          <select
            aria-label="Active agency"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            value={currentAgency?.id ?? ""}
            disabled={switchAgencyMut.isPending}
            onChange={(e) => switchAgencyMut.mutate(e.target.value)}
          >
            {agencyList.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </label>
      ) : currentAgency ? (
        <p className="truncate px-1 text-2xs uppercase tracking-wide text-muted">
          {currentAgency.shortName || currentAgency.name}
        </p>
      ) : null}
      {showShiftSelect && shifts.length > 0 ? (
        <label className="block space-y-1">
          <span className="px-0.5 text-2xs uppercase tracking-wide text-muted">Shift</span>
          <select
            aria-label="Active shift"
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-xs"
            value={current?.id ?? ""}
            disabled={switchMut.isPending}
            onChange={(e) => switchMut.mutate(e.target.value)}
          >
            {shifts.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {shiftHoursLabel(s)}
              </option>
            ))}
          </select>
        </label>
      ) : current ? (
        <p className="truncate px-1 text-xs text-muted">
          {current.name} · {shiftHoursLabel(current)}
        </p>
      ) : support ? (
        <p className="px-0.5 text-2xs text-muted">No shift on this agency yet</p>
      ) : null}
    </div>
  );
}