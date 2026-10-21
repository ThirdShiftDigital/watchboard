/**
 * Time-off totals for one officer (pure; unit-tested). Weeks start Sunday and
 * dates are agency-local (America/Chicago) YYYY-MM-DD strings.
 *
 * Counts APPROVED leave requests only (vacation / sick / training / court /
 * other, including call-ins), one per calendar day inside the period, and
 * skips the officer's standing RDO weekdays (they weren't scheduled anyway).
 * Overtime and swaps are not time off.
 */
import { addDays, endOfMonth, startOfMonth, startOfWeek, weekdayOf } from "./dates.ts";

export type PeriodUnit = "week" | "month";

export function periodRange(unit: PeriodUnit, anchor: string): { from: string; to: string } {
  if (unit === "week") {
    const from = startOfWeek(anchor);
    return { from, to: addDays(from, 6) };
  }
  return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
}

/** Anchor of the previous (-1) / next (+1) week or month. */
export function shiftPeriod(unit: PeriodUnit, anchor: string, delta: number): string {
  const { from } = periodRange(unit, anchor);
  if (unit === "week") return addDays(from, 7 * delta);
  let d = from;
  for (let i = 0; i < Math.abs(delta); i += 1) {
    d = delta > 0 ? addDays(endOfMonth(d), 1) : startOfMonth(addDays(d, -1));
  }
  return d;
}

export type LeaveLike = { status: string; kind: string; startDate: string; endDate: string };
export type TimeOffTotals = {
  unit: PeriodUnit;
  from: string;
  to: string;
  total: number;
  byKind: Record<string, number>;
  days: { date: string; kind: string }[];
};

export function countTimeOff(
  unit: PeriodUnit,
  anchor: string,
  requests: LeaveLike[],
  rdoDays: number[],
): TimeOffTotals {
  const { from, to } = periodRange(unit, anchor);
  const seen = new Map<string, string>();
  for (const r of requests) {
    if (r.status !== "approved") continue;
    let d = r.startDate > from ? r.startDate : from;
    const end = r.endDate < to ? r.endDate : to;
    while (d <= end) {
      if (!rdoDays.includes(weekdayOf(d)) && !seen.has(d)) seen.set(d, r.kind);
      d = addDays(d, 1);
    }
  }
  const days = [...seen.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([date, kind]) => ({ date, kind }));
  const byKind: Record<string, number> = {};
  for (const x of days) byKind[x.kind] = (byKind[x.kind] ?? 0) + 1;
  return { unit, from, to, total: days.length, byKind, days };
}

export type ReportHistory = { action: string; actorName: string; at: string; summary: string };

/** Plain-text summary used for the mailto body and the PDF. */
export function reportLines(input: {
  officerName: string;
  shiftName: string;
  totals: TimeOffTotals;
  history: ReportHistory[];
  label: (action: string) => string;
  formatAt: (iso: string) => string;
}): string[] {
  const t = input.totals;
  const kinds = Object.entries(t.byKind)
    .map(([k, n]) => `${k} ${n}`)
    .join(", ");
  const lines = [
    `Time off: ${input.officerName}${input.shiftName ? ` (${input.shiftName})` : ""}`,
    `${t.unit === "week" ? "Week" : "Month"} ${t.from} to ${t.to}`,
    `Approved days off: ${t.total}${kinds ? ` (${kinds})` : ""}`,
  ];
  if (t.days.length) lines.push(`Days: ${t.days.map((d) => `${d.date} ${d.kind}`).join("; ")}`);
  lines.push("", "History:");
  if (!input.history.length) lines.push("  None recorded in this period.");
  for (const h of input.history) {
    lines.push(`  ${input.formatAt(h.at)} - ${input.label(h.action)} by ${h.actorName}${h.summary ? ` - ${h.summary}` : ""}`);
  }
  return lines;
}

export function mailtoHref(to: string, subject: string, lines: string[]): string {
  return `mailto:${encodeURIComponent(to.trim())}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(lines.join("\n"))}`;
}

function pdfText(s: string): string {
  return s
    .replace(/[–—→]/g, "-")
    .replace(/[^\x20-\x7E]/g, " ")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

/** Minimal one-or-more-page Letter PDF of text lines (Helvetica 10pt). */
export function textPdf(lines: string[]): string {
  const wrapped: string[] = [];
  for (const l of lines) {
    let rest = l;
    while (rest.length > 95) {
      const cut = rest.lastIndexOf(" ", 95) > 20 ? rest.lastIndexOf(" ", 95) : 95;
      wrapped.push(rest.slice(0, cut));
      rest = "    " + rest.slice(cut).trimStart();
    }
    wrapped.push(rest);
  }
  const perPage = 60;
  const pages: string[][] = [];
  for (let i = 0; i < Math.max(wrapped.length, 1); i += perPage) pages.push(wrapped.slice(i, i + perPage));
  const objs: string[] = [];
  objs[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objs[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";
  const kids: string[] = [];
  pages.forEach((pg, i) => {
    const pageId = 4 + i * 2;
    const contentId = pageId + 1;
    kids.push(`${pageId} 0 R`);
    const body =
      "BT /F1 10 Tf 14 TL 50 750 Td " +
      pg.map((l, j) => `${j === 0 && i === 0 ? "/F1 13 Tf " : j === 1 && i === 0 ? "/F1 10 Tf " : ""}(${pdfText(l)}) Tj T*`).join(" ") +
      " ET";
    objs[pageId] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentId} 0 R >>`;
    objs[contentId] = `<< /Length ${body.length} >>\nstream\n${body}\nendstream`;
  });
  objs[2] = `<< /Type /Pages /Kids [${kids.join(" ")}] /Count ${pages.length} >>`;
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  for (let i = 1; i < objs.length; i += 1) {
    offsets[i] = out.length;
    out += `${i} 0 obj\n${objs[i]}\nendobj\n`;
  }
  const xref = out.length;
  out += `xref\n0 ${objs.length}\n0000000000 65535 f \n`;
  for (let i = 1; i < objs.length; i += 1) out += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  out += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return out;
}
