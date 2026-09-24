import {
  createGoogleLeaveEvent,
  createGoogleLeaveEventOAuth,
  deleteGoogleLeaveEvent,
  fetchGoogleCalendar,
  fetchGoogleCalendarOAuth,
  leaveEventTitle,
} from "@/lib/google-calendar";
import { getConnectorAccessToken } from "@/lib/app-data/client.server";
import { normalizeFeedUrl, parseIcsEvents } from "@/lib/ics";
import { kindLabel, type CalendarEvent, type CalendarState, type Officer, type RequestKind, type Shift } from "@/lib/types";
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

async function loadCache(shiftId: string, officers: Officer[]): Promise<CalendarEvent[]> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<CacheRow>`
    select event_id, title, start_at, end_at, all_day from calendar_cache where shift_id = ${shiftId}
  `;
  return rows.map((row) => {
    const event = mapCache(row);
    return { ...event, matchedOfficerIds: matchOfficersToEvent(event.title, officers) };
  });
}

async function saveCache(shiftId: string, events: CalendarEvent[]) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql`delete from calendar_cache where shift_id = ${shiftId}`;
  const batch = events.slice(0, 200);
  await Promise.all(
    batch.map(
      (event) => sql`
        insert into calendar_cache (shift_id, event_id, title, start_at, end_at, all_day)
        values (${shiftId}, ${event.id}, ${event.title}, ${event.start}, ${event.end}, ${event.allDay})
        on conflict (shift_id, event_id) do update set
          title = excluded.title,
          start_at = excluded.start_at,
          end_at = excluded.end_at,
          all_day = excluded.all_day
      `,
    ),
  );
  await sql`
    update shifts set calendar_synced_at = now() where id = ${shiftId}
  `;
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
): Promise<CalendarEvent[] | null> {
  const cached = await loadCache(shiftId, officers);
  if (!cached.length) return null;
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const meta = await sql<{ synced: string | null }>`
    select calendar_synced_at::text as synced from shifts where id = ${shiftId}
  `;
  const synced = meta[0]?.synced ? Date.parse(meta[0].synced) : NaN;
  // Missing stamp: treat existing rows as fresh once so we do not pay Google
  // on the first load after this deploy.
  if (!Number.isFinite(synced)) {
    await sql`update shifts set calendar_synced_at = now() where id = ${shiftId}`;
    return cached;
  }
  if (Date.now() - synced > CALENDAR_CACHE_TTL_MS) return null;
  return cached;
}

export async function loadShiftCalendar(input: {
  shift: Pick<Shift, "id" | "calendarFeedUrl" | "googleCalendar">;
  officers: Officer[];
  timeMin: string;
  timeMax: string;
  canConnect: boolean;
}): Promise<CalendarState> {
  const { shift, officers, timeMin, timeMax, canConnect } = input;
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

  // Serve a fresh-enough cache so Zones / Schedule stay snappy.
  const fresh = await recentCalendarCache(shift.id, officers);
  if (fresh) {
    return {
      kind: "ok",
      source: "google",
      events: mergeEvents(fresh, ics?.kind === "ok" ? ics.events : []),
    };
  }

  // Prefer standalone OAuth tokens stored on the shift (Netlify).
  const { getValidAccessTokenForShift } = await import("@/lib/google-oauth");
  const oauth = await getValidAccessTokenForShift(shift.id).catch(() => null);
  if (oauth?.accessToken) {
    const google = await fetchGoogleCalendarOAuth(shift.id, officers, timeMin, timeMax);
    if (google.kind === "ok") {
      await saveCache(shift.id, google.events).catch(() => undefined);
      return {
        ...google,
        events: mergeEvents(google.events, ics?.kind === "ok" ? ics.events : []),
      };
    }
    if (google.kind === "login" && canConnect) {
      return google;
    }
  }

  const hasToken = Boolean(getConnectorAccessToken());
  if (hasToken || canConnect) {
    const google = await fetchGoogleCalendar(officers, timeMin, timeMax);
    if (google.kind === "ok") {
      await saveCache(shift.id, google.events).catch(() => undefined);
      return {
        ...google,
        events: mergeEvents(google.events, ics?.kind === "ok" ? ics.events : []),
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
    await saveCache(shiftId, probe.events).catch(() => undefined);
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

export async function disconnectShiftGoogle(shiftId: string) {
  const { clearShiftGoogleTokens } = await import("@/lib/google-oauth");
  await clearShiftGoogleTokens(shiftId);
}

export async function writeApprovedLeave(input: {
  shiftId: string;
  googleCalendar: boolean;
  lastName: string;
  kind: RequestKind;
  startDate: string;
  endDate: string;
  reason: string;
}): Promise<string | null> {
  if (!input.googleCalendar) return null;
  const summary = leaveEventTitle(input.lastName, kindLabel(input.kind));
  // Prefer standalone OAuth on Netlify.
  const oauthWritten = await createGoogleLeaveEventOAuth({
    shiftId: input.shiftId,
    summary,
    description: input.reason,
    startDate: input.startDate,
    endDate: input.endDate,
  });
  if (oauthWritten.ok) return oauthWritten.eventId;
  const written = await createGoogleLeaveEvent({
    summary,
    description: input.reason,
    startDate: input.startDate,
    endDate: input.endDate,
  });
  if (!written.ok) return null;
  return written.eventId;
}

export async function removeApprovedLeave(eventId: string | null | undefined) {
  if (!eventId) return;
  await deleteGoogleLeaveEvent(eventId).catch(() => undefined);
}
