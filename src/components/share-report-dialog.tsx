import { useQuery } from "@tanstack/react-query";
import { Download, Mail, X } from "lucide-react";
import { useState } from "react";
import { getOfficerReport } from "@/lib/off-audit";
import { downloadReportPdf, reportToLines } from "@/lib/report-export";
import { mailtoHref, type PeriodUnit } from "@/lib/time-off-totals";

/**
 * Email the time-off summary. Nothing is sent by WatchBoard: "Open email"
 * builds a mailto: link that opens the commander's own mail app with the
 * summary pre-filled; they review and press Send there. "Download PDF" saves
 * a PDF they can attach.
 */
export function ShareReportDialog({
  officerId,
  unit,
  anchor,
  onClose,
}: {
  officerId: string;
  unit: PeriodUnit;
  anchor: string;
  onClose: () => void;
}) {
  const [to, setTo] = useState("");
  const q = useQuery({
    queryKey: ["officer-report", officerId, unit, anchor],
    queryFn: () => getOfficerReport({ data: { officerId, unit, anchor } }),
  });
  const lines = q.data ? reportToLines(q.data) : [];
  const subject = q.data ? `Time off: ${q.data.officerName} ${q.data.totals.from} to ${q.data.totals.to}` : "";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center" role="dialog" aria-label="Email time off">
      <div className="max-h-[90vh] w-full max-w-md overflow-auto rounded-t-xl bg-card p-4 sm:rounded-xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold uppercase tracking-wide">Email time off</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="flex size-10 items-center justify-center">
            <X className="size-5" />
          </button>
        </div>
        {q.isError ? <p className="text-sm text-destructive">{(q.error as Error).message}</p> : null}
        {q.isLoading ? <p className="text-sm text-muted">Loading…</p> : null}
        {q.data ? (
          <>
            <label className="mt-2 block text-2xs uppercase tracking-wide text-muted" htmlFor="share-to">
              To
            </label>
            <input
              id="share-to"
              type="email"
              inputMode="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="name@agency.gov"
              className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            />
            <p className="mt-3 text-2xs uppercase tracking-wide text-muted">Subject</p>
            <p className="text-sm">{subject}</p>
            <p className="mt-3 text-2xs uppercase tracking-wide text-muted">Message preview</p>
            <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-card-2 p-3 text-xs">{lines.join("\n")}</pre>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <a
                href={mailtoHref(to, subject, lines)}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-md bg-primary text-sm font-medium text-primary-foreground"
              >
                <Mail className="size-4" /> Open email
              </a>
              <button
                type="button"
                onClick={() => downloadReportPdf(q.data)}
                className="flex min-h-[44px] items-center justify-center gap-1.5 rounded-md border border-border text-sm"
              >
                <Download className="size-4" /> Download PDF
              </button>
            </div>
            <p className="mt-2 text-micro text-subtle">
              Opens your mail app with this filled in. Nothing is sent until you press Send there.
            </p>
          </>
        ) : null}
      </div>
    </div>
  );
}
