import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateShiftSettings } from "@/lib/shifts";

export function ShiftHoursForm({
  shiftId,
  name,
  startTime,
  endTime,
  effectiveDate,
  compact = false,
  showHeading = true,
}: {
  shiftId?: string;
  name: string;
  startTime: string;
  endTime: string;
  effectiveDate?: string;
  compact?: boolean;
  showHeading?: boolean;
}) {
  const queryClient = useQueryClient();
  const [shiftName, setShiftName] = useState(name);
  const [start, setStart] = useState(startTime.slice(0, 5));
  const [end, setEnd] = useState(endTime.slice(0, 5));
  const [effective, setEffective] = useState(effectiveDate ?? "");

  useEffect(() => {
    setShiftName(name);
    setStart(startTime.slice(0, 5));
    setEnd(endTime.slice(0, 5));
    setEffective(effectiveDate ?? "");
  }, [shiftId, name, startTime, endTime, effectiveDate]);

  const save = useMutation({
    mutationFn: () =>
      updateShiftSettings({
        data: {
          shiftId,
          name: shiftName,
          startTime: start.slice(0, 5),
          endTime: end.slice(0, 5),
          effectiveDate: effective || undefined,
        },
      }),
    onSuccess: async () => {
      toast.success("Shift hours saved");
      await queryClient.invalidateQueries({ queryKey: ["schedule"] });
      await queryClient.invalidateQueries({ queryKey: ["shifts"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["watch"] });
    },
    onError: (err) => toast.error(err.message),
  });

  return (
    <form
      className={compact ? "space-y-3" : "space-y-4 rounded-lg border border-border bg-card px-4 py-4"}
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      {compact || !showHeading ? null : (
        <p className="text-2xs uppercase tracking-wide text-muted">This shift</p>
      )}
      <div className={compact ? "space-y-2" : "space-y-3"}>
        {compact ? null : (
          <div className="space-y-2">
            <Label htmlFor={`shift-name-${shiftId ?? "current"}`}>Name</Label>
            <Input
              id={`shift-name-${shiftId ?? "current"}`}
              value={shiftName}
              onChange={(e) => setShiftName(e.target.value)}
            />
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor={`shift-start-${shiftId ?? "current"}`}>Start</Label>
            <Input
              id={`shift-start-${shiftId ?? "current"}`}
              type="time"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`shift-end-${shiftId ?? "current"}`}>End</Label>
            <Input
              id={`shift-end-${shiftId ?? "current"}`}
              type="time"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
        </div>
        {compact ? null : (
          <div className="space-y-2">
            <Label htmlFor={`shift-eff-${shiftId ?? "current"}`}>Effective date</Label>
            <Input
              id={`shift-eff-${shiftId ?? "current"}`}
              type="date"
              value={effective}
              onChange={(e) => setEffective(e.target.value)}
            />
          </div>
        )}
        <Button className="w-full" type="submit" disabled={save.isPending || shiftName.trim().length < 2}>
          {save.isPending ? "Saving…" : "Save hours"}
        </Button>
      </div>
    </form>
  );
}
