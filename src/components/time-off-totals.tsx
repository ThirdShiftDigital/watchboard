import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, Mail, Printer } from "lucide-react";
import { useState } from "react";
import { formatShort, todayISO } from "@/lib/dates";
import { getOfficerTimeOff } from "@/lib/off-audit";
import { periodRange, shiftPeriod, type PeriodUnit, type TimeOffTotals } from "@/lib/time-off-totals";
import { kindLabel, type RequestKind } from "@/lib/types";
import { cn } from "@/lib/cn";
import { ShareReportDialog } from "@/components/share-report-dialog";
import { OfficerPicker } from "@/components/officer-picker";
import { Users } from "lucide-react";

/**
 * Days off this week / month for one officer, with prev / next. Rendered only
 * when the server included `timeOff` (shift commander of this officer's shift);
 * navigation goes through the same gated endpoint.
 */
export function TimeOffTotalsCard({
  officerId,
  initial,
  roster,
}: {
  officerId: string;
  initial: { week: TimeOffTotals; month: TimeOffTotals };
  /** Officers on the commander's shift, for the picker. */
  roster: { id: string; name: string; unit?: string }[];
}) {
  const today = todayISO();
  const [unit, setUnit] = useState<PeriodUnit>("week");
  const [anchor, setAnchor] = useState(today);
  const [sharing, setSharing] = useState(false);
  const [picking, setPicking] = useState(false);
  const [selected, setSelected] = useState<string[]>([officerId]);
  const onlySelf = selected.length === 1 && selected[0] === officerId;
  const isCurrent = onlySelf && periodRange(unit, anchor).from === periodRange(unit, today).from;
  const q = useQuery({
    queryKey: ["officer-timeoff", selected, unit, anchor],
    queryFn: () => getOfficerTimeOff({ data: { officerIds: selected, unit, anchor } }),
    enabled: !isCurrent,
  });
  const t: Pick<TimeOffTotals, "total" | "byKind"> | undefined = isCurrent ? initial[unit] : q.data;
  const perOfficer = !isCurrent && q.data && q.data.officers.length > 1 ? q.data.officers : [];
  const nameOf = (id: string) => roster.find((o) => o.id === id)?.name ?? id;
  const whoLabel =
    selected.length === roster.length && roster.length > 1
      ? `All officers (${roster.length})`
      : selected.length === 1
        ? nameOf(selected[0]!)
        : `${selected.length} officers`;
  const title =
    unit === "week"
      ? `Week of ${formatShort(periodRange(unit, anchor).from)}`
      : new Date(`${periodRange(unit, anchor).from}T12:00:00`).toLocaleString("en-US", { month: "long", year: "numeric" });
  return (
    <section className="rounded-lg border border-border bg-card px-4 py-4">
      <div className="flex items-center justify-between">
        <p className="text-2xs uppercase tracking-wide text-muted">Time off taken</p>
        <div className="flex rounded-md border border-border text-2xs uppercase">
          {(["week", "month"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => {
                setUnit(u);
                setAnchor(today);
              }}
              className={cn("min-h-[32px] px-3", unit === u ? "bg-primary text-primary-foreground" : "text-muted")}
            >
              {u}
            </button>
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setPicking(true)}
        className="mt-3 flex min-h-[44px] w-full items-center justify-between gap-2 rounded-md border border-border px-3 text-left text-sm"
      >
        <span className="flex min-w-0 items-center gap-2">
          <Users className="size-4 shrink-0 text-muted" />
          <span className="truncate">{whoLabel}</span>
        </span>
        <span className="text-2xs uppercase tracking-wide text-primary">Change</span>
      </button>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          aria-label={`Previous ${unit}`}
          className="flex size-10 items-center justify-center rounded-md border border-border"
          onClick={() => setAnchor(shiftPeriod(unit, anchor, -1))}
        >
          <ChevronLeft className="size-4" />
        </button>
        <div className="text-center">
          <p className="text-sm font-medium">{title}</p>
          <p className="font-display text-3xl font-semibold tabular">
            {t ? t.total : q.isError ? "—" : "…"}
            <span className="ml-1 text-sm font-normal text-muted">{t?.total === 1 ? "day off" : "days off"}</span>
          </p>
        </div>
        <button
          type="button"
          aria-label={`Next ${unit}`}
          className="flex size-10 items-center justify-center rounded-md border border-border"
          onClick={() => setAnchor(shiftPeriod(unit, anchor, 1))}
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      {t && Object.keys(t.byKind).length ? (
        <ul className="mt-3 flex flex-wrap justify-center gap-2 text-xs">
          {Object.entries(t.byKind).map(([k, n]) => (
            <li key={k} className="rounded-full bg-card-2 px-2.5 py-1">
              {kindLabel(k as RequestKind)} <span className="font-semibold tabular">{n}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {perOfficer.length ? (
        <ul className="mt-3 divide-y divide-border rounded-md border border-border text-sm">
          {perOfficer.map((o) => (
            <li key={o.officerId} className="flex items-center justify-between gap-2 px-3 py-2">
              <span className="truncate">{o.officerName}</span>
              <span className="tabular font-semibold">{o.total}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {q.isError ? <p className="mt-2 text-center text-xs text-destructive">{(q.error as Error).message}</p> : null}
      <p className="mt-2 text-center text-micro text-subtle">Approved leave only · RDOs not counted · Central time</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          to="/print-timeoff"
          search={{ officerIds: selected.join(","), unit, anchor }}
          target="_blank"
          className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-md border border-border text-sm"
        >
          <Printer className="size-4" /> Print / PDF
        </Link>
        <button
          type="button"
          onClick={() => setSharing(true)}
          className="flex min-h-[40px] items-center justify-center gap-1.5 rounded-md border border-border text-sm"
        >
          <Mail className="size-4" /> Email
        </button>
      </div>
      {sharing ? <ShareReportDialog officerIds={selected} unit={unit} anchor={anchor} onClose={() => setSharing(false)} /> : null}
      {picking ? (
        <OfficerPicker
          officers={roster}
          selected={selected}
          onClose={() => setPicking(false)}
          onDone={(ids) => {
            setSelected(ids);
            setPicking(false);
          }}
        />
      ) : null}
    </section>
  );
}
