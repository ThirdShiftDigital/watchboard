/**
 * Normalize what a commander pastes into the "Calendar ID" box.
 *
 * Accepts a bare calendar ID (e.g. `abc123@group.calendar.google.com` or an
 * email address), the literal `primary`, or any Google Calendar link that
 * embeds the ID: secret/public iCal URLs (`/calendar/ical/<id>/…`) and
 * embed/share links (`?src=<id>` or `?cid=<base64 id>`).
 *
 * Empty input means "primary" (the connected account's main calendar).
 */
export function normalizeGoogleCalendarId(raw: string): string {
  const value = raw.trim();
  if (!value) return "primary";
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const ical = url.pathname.match(/\/calendar\/ical\/([^/]+)\//i);
      if (ical?.[1]) return decodeURIComponent(ical[1]);
      const src = url.searchParams.get("src");
      if (src) return src.trim();
      const cid = url.searchParams.get("cid");
      if (cid) {
        try {
          const decoded = atob(cid.replace(/-/g, "+").replace(/_/g, "/"));
          if (decoded.includes("@") || decoded === "primary") return decoded.trim();
        } catch {
          // fall through — cid was not base64
        }
        return cid.trim();
      }
    } catch {
      // not a URL we understand — fall through and treat as a raw ID
    }
  }
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function isPrimaryCalendarId(id: string | null | undefined): boolean {
  return !id || id === "primary";
}
