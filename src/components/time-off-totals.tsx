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

/**
 * Days off this week / month for one officer, with prev / next. Rendered only
 * when the server included `timeOff` (shift commander of this officer's shift);
 * navigation goes through the same gated endpoint.
 */
export function TimeOffTotalsCard({
  officerId,
  initial,
}: {
  officerId: string;
  initial: { week: TimeOffTotals; month: TimeOffTotals };
}) {
  const today = todayISO();
  const [unit, setUnit] = useState<PeriodUnit>("week");
  const [anchor, setAnchor] = useState(today);
  const [sharing, setSharing] = useState(false);
  const isCurrent = periodRange(unit, anchor).from === periodRange(unit, today).from;
  const q = useQuery({
    queryKey: ["officer-timeoff", officerId, unit, anchor],
    queryFn: () => getOfficerTimeOff({ data: { officerId, unit, anchor } }),
    enabled: !isCurrent,
  });
  const t: TimeOffTotals | undefined = isCurrent ? initial[unit] : q.data;
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
      {q.isError ? <p className="mt-2 text-center text-xs text-destructive">{(q.error as Error).message}</p> : null}
      <p className="mt-2 text-center text-micro text-subtle">Approved leave only · RDOs not counted · Central time</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Link
          to="/print-timeoff"
          search={{ officerId, unit, anchor }}
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
      {sharing ? <ShareReportDialog officerId={officerId} unit={unit} anchor={anchor} onClose={() => setSharing(false)} /> : null}
    </section>
  );
}
