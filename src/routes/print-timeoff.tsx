import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { downloadReportPdf } from "@/lib/report-export";
import { formatShort, todayISO } from "@/lib/dates";
import { getOfficerReport } from "@/lib/off-audit";
import { actionLabel, formatCT } from "@/lib/off-audit-rules";
import { kindLabel, type RequestKind } from "@/lib/types";

const search = z.object({
  officerId: z.string().catch(""),
  unit: z.enum(["week", "month"]).catch("week"),
  anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).catch(todayISO()),
});

export const Route = createFileRoute("/print-timeoff")({
  validateSearch: (s) => search.parse(s),
  component: PrintTimeOff,
});

/** Print-friendly report. Data comes from the gated getOfficerReport (commander only). */
function PrintTimeOff() {
  const { officerId, unit, anchor } = Route.useSearch();
  const q = useQuery({
    queryKey: ["officer-report", officerId, unit, anchor],
    queryFn: () => getOfficerReport({ data: { officerId, unit, anchor } }),
    enabled: Boolean(officerId),
    retry: false,
  });
  if (q.isError) return <p className="p-6 text-sm">{(q.error as Error).message}</p>;
  if (!q.data) return <p className="p-6 text-sm">Loading…</p>;
  const r = q.data;
  return (
    <div className="min-h-screen bg-white"><div className="print-report mx-auto max-w-2xl bg-white p-6 text-black">
      <style>{`@media print { .no-print { display: none !important } body { background: #fff } @page { margin: 0.6in } }
        .print-report table { width: 100%; border-collapse: collapse } .print-report td, .print-report th { border-bottom: 1px solid #ccc; padding: 4px 6px; text-align: left; font-size: 12px; vertical-align: top }`}</style>
      <div className="no-print mb-4 flex gap-2">
        <button type="button" className="rounded border border-black px-3 py-2 text-sm" onClick={() => window.print()}>
          Print
        </button>
        <button type="button" className="rounded border border-black px-3 py-2 text-sm" onClick={() => downloadReportPdf(r)}>
          Download PDF
        </button>
      </div>
      <h1 className="text-xl font-bold">Time off · {r.officerName}</h1>
      <p className="text-sm">
        {r.shiftName ? `${r.shiftName} · ` : ""}
        {unit === "week" ? "Week" : "Month"} {formatShort(r.totals.from)} – {formatShort(r.totals.to)}
      </p>
      <p className="mt-3 text-lg font-semibold">
        {r.totals.total} approved {r.totals.total === 1 ? "day" : "days"} off
      </p>
      <p className="text-sm">
        {Object.entries(r.totals.byKind)
          .map(([k, n]) => `${kindLabel(k as RequestKind)} ${n}`)
          .join(" · ") || "None"}
      </p>
      {r.totals.days.length ? (
        <table className="mt-3">
          <thead>
            <tr><th>Date</th><th>Type</th></tr>
          </thead>
          <tbody>
            {r.totals.days.map((d) => (
              <tr key={d.date}><td>{formatShort(d.date)}</td><td>{kindLabel(d.kind as RequestKind)}</td></tr>
            ))}
          </tbody>
        </table>
      ) : null}
      <h2 className="mt-5 text-base font-bold">Who marked off / changed (Central time)</h2>
      {r.history.length ? (
        <table className="mt-1">
          <thead>
            <tr><th>When</th><th>Action</th><th>By</th><th>Detail</th></tr>
          </thead>
          <tbody>
            {r.history.map((h) => (
              <tr key={h.id}>
                <td>{formatCT(h.at)}</td><td>{actionLabel(h.action)}</td><td>{h.actorName}</td><td>{h.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="text-sm">None recorded in this period.</p>
      )}
      <p className="mt-6 text-xs">Approved leave only; RDOs not counted. Printed {formatCT(new Date().toISOString())}.</p>
    </div></div>
  );
}
