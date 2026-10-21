import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, History } from "lucide-react";
import { useState } from "react";
import { getOffHistory } from "@/lib/off-audit";
import { actionLabel, formatCT } from "@/lib/off-audit-rules";

/**
 * "Marked off by <name> · <time CT>" plus a tap-to-open history. Renders
 * nothing unless the server attached an `audit` stamp — which it only does
 * for the shift commander of the entry's shift.
 */
export function OffAuditLine({
  entityType,
  entityId,
  audit,
  className,
}: {
  entityType: "request" | "override";
  entityId: number;
  audit?: { markedBy: string; markedAt: string };
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const history = useQuery({
    queryKey: ["off-history", entityType, entityId],
    queryFn: () => getOffHistory({ data: { entityType, entityId } }),
    enabled: open && Boolean(audit),
    staleTime: 30_000,
  });
  if (!audit) return null;
  return (
    <div className={className}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        className="flex min-h-[32px] items-center gap-1 text-left text-xs text-subtle"
        aria-expanded={open}
      >
        <History className="size-3.5 shrink-0" aria-hidden />
        <span>
          Marked off by {audit.markedBy} · {formatCT(audit.markedAt)}
        </span>
        {open ? <ChevronUp className="size-3.5" aria-hidden /> : <ChevronDown className="size-3.5" aria-hidden />}
      </button>
      {open ? (
        <ol className="mt-1 space-y-1 border-l border-border pl-3 text-xs text-muted">
          {history.isLoading ? <li>Loading…</li> : null}
          {history.error ? <li className="text-destructive">{(history.error as Error).message}</li> : null}
          {history.data?.entries.map((h) => (
            <li key={h.id}>
              <span className="font-medium text-foreground">{actionLabel(h.action)}</span> · {h.actorName} ·{" "}
              {formatCT(h.at)}
              {h.summary ? <span className="block text-subtle">{h.summary}</span> : null}
            </li>
          ))}
          {history.data && !history.data.entries.length ? <li>No history recorded.</li> : null}
        </ol>
      ) : null}
    </div>
  );
}
