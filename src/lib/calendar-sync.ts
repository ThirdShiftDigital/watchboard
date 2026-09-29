import {
  createGoogleLeaveEvent,
  createGoogleLeaveEventOAuth,
  deleteGoogleLeaveEvent,
  deleteGoogleLeaveEventOAuth,
  fetchGoogleCalendar,
  fetchGoogleCalendarOAuth,
  type CalendarWriteFailure,
} from "@/lib/google-calendar";
import { getConnectorAccessToken } from "@/lib/app-data/client.server";
import { addDays, endOfMonth, eventOverlapsRange, inclusiveAllDayEnd, startOfMonth } from "@/lib/dates";
import { normalizeFeedUrl, parseIcsEvents } from "@/lib/ics";
import type { CalendarEvent, CalendarState, Officer, Shift } from "@/lib/types";
import { matchOfficersToEvent } from "@/lib/watch-logic";

const CALENDAR_CACHE_TTL_MS = 5 * 60 * 1000;

type CacheRow = {
  event_id: string;
  title: string;
  start_at: string;
  end_at: string | null;
  all_day: boolean;
};

function mapCache(row: CacheRow): CalendarEvent {
  return {
    id: row.event_id,
    title: row.title,
    start: row.start_at,
    end: row.end_at,
    allDay: row.all_day,
    matchedOfficerIds: [],
  };
}

/**
 * Cache window stamp stored on shifts.calendar_cache_window:
 * "v2:<from>:<to>" (agency-local days). v2 rows hold inclusive all-day ends;
 * anything else is a pre-v2 cache whose all-day ends are Google's exclusive
 * date and whose window is unknown.
 */
const CACHE_VERSION = "v2";

function parseWindow(raw: string | null | undefined): { from: string; to: string } | null {
  const m = /^v2:(\d{4}-\d{2}-\d{2}):(\d{4}-\d{2}-\d{2})$/.exec(raw ?? "");
  return m ? { from: m[1], to: m[2] } : null;
}

/** Google window to fetch/cache for a request: whole month(s) plus a margin. */
function cacheWindowFor(timeMin: string, timeMax: string): { from: string; to: string } {
  return {
    from: addDays(startOfMonth(timeMin), -7),
    to: addDays(endOfMonth(timeMax), 14),
  };
}

async function loadCache(shiftId: string, officers: Officer[]): Promise<CalendarEvent[]> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const [rows, meta] = await Promise.all([
    sql<CacheRow>`
      select event_id, title, start_at, end_at, all_day from calendar_cache where shift_id = ${shiftId}
    `,
    sql<{ calendar_cache_window: string | null }>`
      select calendar_cache_window from shifts where id = ${shiftId}
    `,
  ]);
  const legacy = !parseWindow(meta[0]?.calendar_cache_window);
  return rows.map((row) => {
    const event = mapCache(row);
    // Pre-v2 rows stored Google's exclusive all-day end — show the real last day.
    if (legacy && event.allDay && event.end && /^\d{4}-\d{2}-\d{2}$/.test(event.end)) {
      event.end = inclusiveAllDayEnd(event.start, event.end);
    }
    return { ...event, matchedOfficerIds: matchOfficersToEvent(event.title, officers) };
  });
}

async function saveCache(
  shiftId: string,
  events: CalendarEvent[],
  window: { from: string; to: string },
) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = events.slice(0, 1000).map((e) => ({
    event_id: e.id,
    title: e.title,
    start_at: e.start,
    end_at: e.end,
    all_day: e.allDay,
  }));
  await sql`delete from calendar_cache where shift_id = ${shiftId}`;
  // One statement for all rows — no per-row round trips or parallel clients
  // (Supabase session-mode pooler caps clients; see EMAXCONNSESSION).
  if (rows.length) {
    await sql`
      insert into calendar_cache (shift_id, event_id, title, start_at, end_at, all_day)
      select ${shiftId}, x.event_id, x.title, x.start_at, x.end_at, coalesce(x.all_day, false)
      from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb)
        as x(event_id text, title text, start_at text, end_at text, all_day boolean)
      on conflict (shift_id, event_id) do update set
        title = excluded.title,
        start_at = excluded.start_at,
        end_at = excluded.end_at,
        all_day = excluded.all_day
    `;
  }
  await sql`
    update shifts set
      calendar_synced_at = now(),
      calendar_cache_window = ${`${CACHE_VERSION}:${window.from}:${window.to}`}
    where id = ${shiftId}
  `;
}

function inRange(events: CalendarEvent[], from: string, to: string): CalendarEvent[] {
  return events.filter((e) => eventOverlapsRange(e.start, e.end, from, to));
}

function mergeEvents(primary: CalendarEvent[], extra: CalendarEvent[]): CalendarEvent[] {
  const seen = new Set(primary.map((e) => e.id));
  return [...primary, ...extra.filter((e) => !seen.has(e.id))];
}

async function fetchIcs(
  feedUrl: string,
  officers: Officer[],
  timeMin: string,
  timeMax: string,
): Promise<CalendarState> {
  try {
    const url = normalizeFeedUrl(feedUrl);
    const res = await fetch(url, {
      headers: { Accept: "text/calendar, text/plain, */*" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return {
        kind: "error",
        source: "feed",
        message: `Leave feed returned ${res.status}. Check the secret iCal link.`,
        events: [],
      };
    }
    const text = await res.text();
    if (text.length > 2_000_000) {
      return {
        kind: "error",
        source: "feed",
        message: "Leave feed is too large to load.",
        events: [],
      };
    }
    return {
      kind: "ok",
      source: "feed",
      events: parseIcsEvents(text, officers, timeMin, timeMax),
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not read the leave calendar feed.";
    return { kind: "error", source: "feed", message, events: [] };
  }
}

async function recentCalendarCache(
  shiftId: string,
  officers: Officer[],
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[] | null> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const meta = await sql<{ synced: string | null; calendar_cache_window: string | null }>`
    select calendar_synced_at::text as synced, calendar_cache_window from shifts where id = ${shiftId}
  `;
  const synced = meta[0]?.synced ? Date.parse(meta[0].synced) : NaN;
  if (!Number.isFinite(synced) || Date.now() - synced > CALENDAR_CACHE_TTL_MS) return null;
  // Only serve the cache when it was filled for a window covering this request.
  const window = parseWindow(meta[0]?.calendar_cache_window);
  if (!window || window.from > timeMin || window.to < timeMax) return null;
  return loadCache(shiftId, officers);
}

/** DB-only leave events for Save — no Google/ICS round-trip. */
export async function peekCalendarCache(
  shiftId: string,
  officers: Officer[],
): Promise<CalendarEvent[]> {
  return loadCache(shiftId, officers);
}

export async function loadShiftCalendar(input: {
  shift: Pick<Shift, "id" | "calendarFeedUrl" | "googleCalendar">;
  officers: Officer[];
  timeMin: string;
  timeMax: string;
  canConnect: boolean;
}): Promise<CalendarState> {
  const { shift, officers, timeMin, timeMax, canConnect } = input;

  // Google cache first — Zones Save/refetch must not wait on ICS when fresh.
  if (shift.googleCalendar) {
    const fresh = await recentCalendarCache(shift.id, officers, timeMin, timeMax);
    if (fresh) {
      return { kind: "ok", source: "google", events: inRange(fresh, timeMin, timeMax) };
    }
  }

  let ics: CalendarState | null = null;
  if (shift.calendarFeedUrl) {
    ics = await fetchIcs(shift.calendarFeedUrl, officers, timeMin, timeMax);
  }

  if (!shift.googleCalendar) {
    if (ics) return ics;
    return {
      kind: "not_connected",
      source: "google",
      message: canConnect
        ? "Connect Google Calendar to pull leave and write approved days off."
        : "No leave calendar is linked yet.",
      events: [],
    };
  }

  // Fetch/cache whole month(s) so the Watch (one day) and Calendar (month)
  // share one cache instead of overwriting each other's window.
  const win = cacheWindowFor(timeMin, timeMax);

  // Prefer standalone OAuth tokens stored on the shift (Netlify).
  const { getValidAccessTokenForShift } = await import("@/lib/google-oauth");
  const oauth = await getValidAccessTokenForShift(shift.id).catch(() => null);
  if (oauth?.accessToken) {
    const google = await fetchGoogleCalendarOAuth(shift.id, officers, win.from, win.to);
    if (google.kind === "ok") {
      await saveCache(shift.id, google.events, win).catch(() => undefined);
      return {
        ...google,
        events: mergeEvents(
          inRange(google.events, timeMin, timeMax),
          ics?.kind === "ok" ? ics.events : [],
        ),
      };
    }
    if (google.kind === "login" && canConnect) {
      return google;
    }
  }

  const hasToken = Boolean(getConnectorAccessToken());
  if (hasToken || canConnect) {
    const google = await fetchGoogleCalendar(officers, win.from, win.to);
    if (google.kind === "ok") {
      await saveCache(shift.id, google.events, win).catch(() => undefined);
      return {
        ...google,
        events: mergeEvents(
          inRange(google.events, timeMin, timeMax),
          ics?.kind === "ok" ? ics.events : [],
        ),
      };
    }
    if ((google.kind === "login" || google.kind === "pending") && canConnect) {
      const cached = await loadCache(shift.id, officers);
      if (cached.length) {
        return {
          kind: "ok",
          source: "google",
          events: mergeEvents(cached, ics?.kind === "ok" ? ics.events : []),
          message: google.message,
          loginUrl: google.loginUrl,
        };
      }
      return google;
    }
  }

  const cached = await loadCache(shift.id, officers);
  if (cached.length || (ics && ics.kind === "ok" && ics.events.length)) {
    return {
      kind: "ok",
      source: "google",
      events: mergeEvents(cached, ics?.kind === "ok" ? ics.events : []),
    };
  }
  if (ics) return ics;
  return {
    kind: "not_connected",
    source: "google",
    message: canConnect
      ? "Connect Google Calendar for this shift."
      : "The shift commander has not connected Google Calendar yet.",
    events: [],
  };
}

export async function connectShiftGoogle(
  shiftId: string,
  userId: string,
): Promise<{
  connected: boolean;
  pending?: boolean;
  loginRequired?: boolean;
  loginUrl?: string;
  message?: string;
}> {
  const {
    googleOAuthConfigured,
    buildGoogleAuthUrl,
    getValidAccessTokenForShift,
  } = await import("@/lib/google-oauth");

  // Already have stored OAuth tokens — mark connected.
  const existing = await getValidAccessTokenForShift(shiftId).catch(() => null);
  if (existing?.accessToken) {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`update shifts set google_calendar = true where id = ${shiftId}`;
    return { connected: true };
  }

  if (googleOAuthConfigured()) {
    return {
      connected: false,
      loginRequired: true,
      loginUrl: buildGoogleAuthUrl({ shiftId, userId }),
      message: "Continue in Google to connect this shift calendar.",
    };
  }

  // Legacy Grok connector probe (preview / Grok-hosted only).
  const { todayISO, addDays } = await import("@/lib/dates");
  const today = todayISO();
  const probe = await fetchGoogleCalendar([], today, addDays(today, 1));
  if (probe.kind === "ok") {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`update shifts set google_calendar = true where id = ${shiftId}`;
    await saveCache(shiftId, probe.events, { from: today, to: addDays(today, 1) }).catch(
      () => undefined,
    );
    return { connected: true };
  }
  if (probe.kind === "pending") {
    return { connected: false, pending: true, message: probe.message };
  }
  if (probe.kind === "login") {
    return {
      connected: false,
      loginRequired: true,
      loginUrl: probe.loginUrl,
      message: probe.message,
    };
  }
  return {
    connected: false,
    message:
      probe.message ??
      "Google Calendar OAuth is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on Netlify.",
  };
}

/** Drop cached Google events so the next load re-fetches from Google. */
export async function clearCalendarCache(shiftId: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql`delete from calendar_cache where shift_id = ${shiftId}`;
  await sql`update shifts set calendar_synced_at = null where id = ${shiftId}`;
}

/**
 * Point the shift's Google connection at a specific calendar.
 *
 * Uses only the already-granted calendar.events scope: events.list works on any
 * calendar the connected account can see, so we probe it directly instead of
 * calling calendarList.list (which would need calendar.readonly /
 * calendar.calendarlist.readonly).
 */
export async function selectShiftGoogleCalendar(
  shiftId: string,
  rawId: string,
): Promise<{
  calendarId: string;
  calendarName: string | null;
  /** Google's accessRole for the connected account: owner | writer | reader | freeBusyReader. */
  accessRole: string | null;
}> {
  const { normalizeGoogleCalendarId } = await import("@/lib/google-calendar-id");
  const calendarId = normalizeGoogleCalendarId(rawId);
  if (calendarId.length > 320 || /\s/.test(calendarId)) {
    throw new Error("That does not look like a Google Calendar ID.");
  }

  let calendarName: string | null = null;
  let accessRole: string | null = null;
  const { getValidAccessTokenForShift } = await import("@/lib/google-oauth");
  const tokens = await getValidAccessTokenForShift(shiftId).catch((e: unknown) => {
    throw new Error(
      `Could not refresh the shift's Google access (${e instanceof Error ? e.message.slice(0, 120) : "unknown"}). Disconnect and connect Google Calendar again.`,
    );
  });
  if (tokens?.accessToken) {
    const params = new URLSearchParams({ maxResults: "1", singleEvents: "true" });
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events?${params}`,
      {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
        signal: AbortSignal.timeout(8000),
      },
    );
    if (res.status === 404) {
      throw new Error(
        "Google could not find that calendar for the connected account. Check the Calendar ID, and that the calendar is shared with the Google account you connected.",
      );
    }
    if (res.status === 401 || res.status === 403) {
      throw new Error(
        "The connected Google account cannot read that calendar. Share it with that account (\"Make changes to events\"), or reconnect with the right account.",
      );
    }
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Google Calendar API error (${res.status}): ${text.slice(0, 160)}`);
    }
    const data = (await res.json().catch(() => ({}))) as { summary?: string; accessRole?: string };
    calendarName = typeof data.summary === "string" && data.summary.trim() ? data.summary : null;
    accessRole = typeof data.accessRole === "string" ? data.accessRole : null;
  }

  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql`update shifts set google_calendar_id = ${calendarId} where id = ${shiftId}`;
  await clearCalendarCache(shiftId);
  return { calendarId, calendarName, accessRole };
}

export async function disconnectShiftGoogle(shiftId: string) {
  const { clearShiftGoogleTokens } = await import("@/lib/google-oauth");
  await clearShiftGoogleTokens(shiftId);
}

export type LeaveCalendarWrite =
  | { status: "written"; eventId: string }
  | { status: "skipped"; reason: "not_connected"; message: string }
  | { status: "failed"; reason: CalendarWriteFailure["reason"]; message: string };

export async function writeApprovedLeave(input: {
  shiftId: string;
  googleCalendar: boolean;
  /** Event title, e.g. "ANDERSON - VACATION" (see leaveEventSummary). */
  summary: string;
  startDate: string;
  endDate: string;
  reason: string;
}): Promise<LeaveCalendarWrite> {
  if (!input.googleCalendar) {
    return {
      status: "skipped",
      reason: "not_connected",
      message: "Google Calendar is not connected for this shift.",
    };
  }
  const summary = input.summary;
  // Standalone OAuth (Netlify) — tokens + selected calendar live on the shift.
  const oauthWritten = await createGoogleLeaveEventOAuth({
    shiftId: input.shiftId,
    summary,
    description: input.reason,
    startDate: input.startDate,
    endDate: input.endDate,
  });
  if (oauthWritten.ok) return { status: "written", eventId: oauthWritten.eventId };
  // Legacy Grok connector only when this request actually carries a connector
  // token (Grok-hosted). On Netlify it can never succeed and would hide the
  // real OAuth error.
  if (oauthWritten.reason === "not_connected" && getConnectorAccessToken()) {
    const written = await createGoogleLeaveEvent({
      summary,
      description: input.reason,
      startDate: input.startDate,
      endDate: input.endDate,
    });
    if (written.ok) return { status: "written", eventId: written.eventId };
    return { status: "failed", reason: "error", message: written.message };
  }
  if (oauthWritten.reason === "not_connected") {
    return {
      status: "failed",
      reason: "reconnect",
      message: "this shift is marked connected but has no Google sign-in stored — reconnect Google Calendar under Calendar → Calendar access.",
    };
  }
  return { status: "failed", reason: oauthWritten.reason, message: oauthWritten.message };
}

export async function removeApprovedLeave(
  shiftId: string,
  eventId: string | null | undefined,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!eventId) return { ok: true };
  const oauth = await deleteGoogleLeaveEventOAuth(shiftId, eventId).catch((e: unknown) => ({
    ok: false as const,
    reason: "error" as const,
    message: e instanceof Error ? e.message : "could not remove the Google Calendar event",
  }));
  if (oauth.ok) return { ok: true };
  if (oauth.reason === "not_connected" && getConnectorAccessToken()) {
    const legacy = await deleteGoogleLeaveEvent(eventId).catch(() => null);
    if (legacy?.ok) return { ok: true };
  }
  return { ok: false, message: oauth.message };
}
