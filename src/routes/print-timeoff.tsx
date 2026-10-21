import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { downloadReportPdf } from "@/lib/report-export";
import { formatShort, todayISO } from "@/lib/dates";
import { getOfficerReport } from "@/lib/off-audit";
import { actionLabel, formatCT } from "@/lib/off-audit-rules";
import { kindLabel, type RequestKind } from "@/lib/types";

const search = z.object({
  /** Comma-separated officer ids (one, several, or the whole shift). */
  officerIds: z.string().catch(""),
  unit: z.enum(["week", "month"]).catch("week"),
  anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).catch(todayISO()),
});

export const Route = createFileRoute("/print-timeoff")({
  validateSearch: (s) => search.parse(s),
  component: PrintTimeOff,
});

const kinds = (byKind: Record<string, number>) =>
  Object.entries(byKind)
    .map(([k, n]) => `${kindLabel(k as RequestKind)} ${n}`)
    .join(" · ") || "None";

/** Print-friendly report. Data comes from the gated getOfficerReport (commander only). */
function PrintTimeOff() {
  const { officerIds: raw, unit, anchor } = Route.useSearch();
  const officerIds = raw.split(",").map((x) => x.trim()).filter(Boolean);
  const q = useQuery({
    queryKey: ["officer-report", officerIds, unit, anchor],
    queryFn: () => getOfficerReport({ data: { officerIds, unit, anchor } }),
    enabled: officerIds.length > 0,
    retry: false,
  });
  return (
    <div className="print-page fixed inset-0 overflow-auto bg-white text-black print:static print:overflow-visible">
      <style>{`html, body { background: #fff !important } @media print { .no-print { display: none !important } @page { margin: 0.6in } .officer-block { break-inside: avoid } }
        .print-page table { width: 100%; border-collapse: collapse } .print-page td, .print-page th { border-bottom: 1px solid #ccc; padding: 4px 6px; text-align: left; font-size: 12px; vertical-align: top }`}</style>
      <div className="mx-auto max-w-2xl p-6">
        {!officerIds.length ? <p className="text-sm">Pick at least one officer.</p> : null}
        {q.isError ? <p className="text-sm">{(q.error as Error).message}</p> : null}
        {officerIds.length && !q.data && !q.isError ? <p className="text-sm">Loading…</p> : null}
        {q.data ? (
          <>
            <div className="no-print mb-4 flex gap-2">
              <button type="button" className="rounded border border-black px-3 py-2 text-sm" onClick={() => window.print()}>
                Print
              </button>
              <button type="button" className="rounded border border-black px-3 py-2 text-sm" onClick={() => downloadReportPdf(q.data)}>
                Download PDF
              </button>
            </div>
            <h1 className="text-xl font-bold">
              Time off · {q.data.officers.length === 1 ? q.data.officers[0]!.officerName : `${q.data.officers.length} officers`}
            </h1>
            <p className="text-sm">
              {q.data.shiftName ? `${q.data.shiftName} · ` : ""}
              {unit === "week" ? "Week" : "Month"} {formatShort(q.data.from)} – {formatShort(q.data.to)}
            </p>
            {q.data.officers.length > 1 ? (
              <p className="mt-2 text-sm">
                All selected: <b>{q.data.total}</b> approved days off · {kinds(q.data.byKind)}
              </p>
            ) : null}
            {q.data.officers.map((o) => (
              <section key={o.officerId} className="officer-block mt-5 border-t border-black pt-3">
                {q.data.officers.length > 1 ? <h2 className="text-base font-bold">{o.officerName}</h2> : null}
                <p className="text-lg font-semibold">
                  {o.totals.total} approved {o.totals.total === 1 ? "day" : "days"} off
                </p>
                <p className="text-sm">{kinds(o.totals.byKind)}</p>
                {o.totals.days.length ? (
                  <table className="mt-2">
                    <thead>
                      <tr><th>Date</th><th>Type</th></tr>
                    </thead>
                    <tbody>
                      {o.totals.days.map((d) => (
                        <tr key={d.date}><td>{formatShort(d.date)}</td><td>{kindLabel(d.kind as RequestKind)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                ) : null}
                <h3 className="mt-3 text-sm font-bold">Who marked off / changed (Central time)</h3>
                {o.history.length ? (
                  <table className="mt-1">
                    <thead>
                      <tr><th>When</th><th>Action</th><th>By</th><th>Detail</th></tr>
                    </thead>
                    <tbody>
                      {o.history.map((h) => (
                        <tr key={h.id}>
                          <td>{formatCT(h.at)}</td><td>{actionLabel(h.action)}</td><td>{h.actorName}</td><td>{h.summary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-sm">None recorded in this period.</p>
                )}
              </section>
            ))}
            <p className="mt-6 text-xs">Approved leave only; RDOs not counted. Printed {formatCT(new Date().toISOString())}.</p>
          </>
        ) : null}
      </div>
    </div>
  );
}
