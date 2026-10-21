/** Client helpers to turn the gated getOfficerReport result into text / PDF. */
import type { getOfficerReport } from "@/lib/off-audit";
import { actionLabel, formatCT } from "@/lib/off-audit-rules";
import { reportLines, textPdf } from "@/lib/time-off-totals";

export type Report = Awaited<ReturnType<typeof getOfficerReport>>;

export function reportSubject(r: Report): string {
  const who = r.officers.length === 1 ? r.officers[0]!.officerName : `${r.officers.length} officers`;
  return `Time off: ${who} ${r.from} to ${r.to}`;
}

export function reportToLines(r: Report): string[] {
  const out: string[] = [];
  if (r.officers.length > 1) {
    const kinds = Object.entries(r.byKind).map(([k, n]) => `${k} ${n}`).join(", ");
    out.push(
      `Time off: ${r.officers.length} officers${r.shiftName ? ` (${r.shiftName})` : ""}`,
      `${r.unit === "week" ? "Week" : "Month"} ${r.from} to ${r.to}`,
      `Approved days off, all selected: ${r.total}${kinds ? ` (${kinds})` : ""}`,
      "",
    );
  }
  r.officers.forEach((o, i) => {
    if (i > 0) out.push("", "----");
    out.push(
      ...reportLines({
        officerName: o.officerName,
        shiftName: o.shiftName,
        totals: o.totals,
        history: o.history,
        label: actionLabel,
        formatAt: formatCT,
      }),
    );
  });
  return out;
}

export function downloadReportPdf(r: Report) {
  const blob = new Blob([textPdf(reportToLines(r))], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const who = r.officers.length === 1 ? r.officers[0]!.officerId : `${r.officers.length}-officers`;
  a.download = `timeoff-${who}-${r.from}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
