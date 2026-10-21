/** Client helpers to turn the gated getOfficerReport result into text / PDF. */
import type { getOfficerReport } from "@/lib/off-audit";
import { actionLabel, formatCT } from "@/lib/off-audit-rules";
import { reportLines, textPdf } from "@/lib/time-off-totals";

export type Report = Awaited<ReturnType<typeof getOfficerReport>>;

export function reportToLines(r: Report): string[] {
  return reportLines({
    officerName: r.officerName,
    shiftName: r.shiftName,
    totals: r.totals,
    history: r.history,
    label: actionLabel,
    formatAt: formatCT,
  });
}

export function downloadReportPdf(r: Report) {
  const blob = new Blob([textPdf(reportToLines(r))], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timeoff-${r.officerId}-${r.totals.from}.pdf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

