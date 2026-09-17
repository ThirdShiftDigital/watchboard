import type { CalendarState } from "@/lib/types";

export function CalendarBanner({
  calendar,
  compact = false,
  canConnect = false,
  onConnect,
}: {
  calendar: CalendarState;
  compact?: boolean;
  canConnect?: boolean;
  onConnect?: () => void;
}) {
  if (calendar.kind === "ok") {
    const source = calendar.source === "google" ? "Google Calendar" : "iCal feed";
    if (calendar.events.length === 0) {
      if (compact) return null;
      return (
        <p className="border-b border-border bg-card-2 px-4 py-2 text-xs text-muted">
          {source} connected. No matching events in this range.
        </p>
      );
    }
    return (
      <p className="border-b border-border bg-card-2 px-4 py-2 text-xs text-muted">
        {calendar.events.length} leave event
        {calendar.events.length === 1 ? "" : "s"} from {source} pulled into this watch.
      </p>
    );
  }

  if (calendar.kind === "login" && canConnect) {
    return (
      <div className="flex items-center justify-between gap-3 border-b border-border bg-card-2 px-4 py-2">
        <p className="text-xs text-muted">Connect Google Calendar to pull leave and write approved days off.</p>
        {onConnect ? (
          <button
            type="button"
            className="shrink-0 text-2xs uppercase tracking-wide text-primary hover:underline"
            onClick={onConnect}
          >
            Connect
          </button>
        ) : null}
      </div>
    );
  }

  if (calendar.kind === "pending") {
    return (
      <p className="border-b border-border bg-card-2 px-4 py-2 text-xs text-muted">
        Connecting Google Calendar…
      </p>
    );
  }

  if (calendar.kind === "not_connected" || calendar.kind === "unavailable") {
    if (compact) return null;
    return (
      <p className="border-b border-border bg-card-2 px-4 py-2 text-xs text-muted">
        {canConnect
          ? "Connect Google Calendar, or link a secret iCal address. Approved requests still show."
          : "Link a secret iCal address to pull leave. Approved requests still show without a feed."}
      </p>
    );
  }

  if (compact && calendar.kind !== "error") return null;
  if (compact && calendar.kind === "error") return null;

  return (
    <p className="border-b border-border bg-card-2 px-4 py-2 text-xs text-muted">
      {calendar.message ?? "Calendar unavailable. Using RDO and approved requests only."}
    </p>
  );
}