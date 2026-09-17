import {
  classifyCallToolError,
  ConnectorType,
  GoogleCalendarTools,
} from "@/lib/app-data";
import { callTool } from "@/lib/app-data/client.server";
import { addDays } from "@/lib/dates";
import type { CalendarEvent, CalendarState, Officer } from "@/lib/types";
import { matchOfficersToEvent } from "@/lib/watch-logic";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  const rec = asRecord(value);
  if (!rec) return [];
  for (const key of ["events", "items", "data", "result", "calendars"]) {
    if (Array.isArray(rec[key])) return rec[key] as unknown[];
  }
  return [];
}

function pickString(rec: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const v = rec[key];
    if (typeof v === "string" && v.trim()) return v;
  }
  return "";
}

function dateFromUnknown(value: unknown): string {
  if (typeof value === "string") return value;
  const rec = asRecord(value);
  if (!rec) return "";
  return pickString(rec, ["dateTime", "date", "date_time"]);
}

export function parseCalendarEvents(data: unknown, officers: Officer[]): CalendarEvent[] {
  return asArray(data)
    .map((item, index) => {
      const rec = asRecord(item);
      if (!rec) return null;
      const title =
        pickString(rec, ["summary", "title", "name", "subject"]) || "Untitled event";
      const start = dateFromUnknown(rec.start) || pickString(rec, ["start", "startTime"]);
      const end = dateFromUnknown(rec.end) || pickString(rec, ["end", "endTime"]) || null;
      if (!start) return null;
      const id = pickString(rec, ["id", "eventId", "iCalUID"]) || `evt-${index}`;
      const allDay =
        rec.allDay === true ||
        (typeof rec.start === "string" && rec.start.length === 10);
      return {
        id,
        title,
        start,
        end,
        allDay,
        matchedOfficerIds: matchOfficersToEvent(title, officers),
      } satisfies CalendarEvent;
    })
    .filter((e): e is CalendarEvent => e !== null);
}

export function calendarStateFromTool(
  result: Awaited<ReturnType<typeof callTool>>,
  officers: Officer[],
): CalendarState {
  if (result.ok) {
    return { kind: "ok", source: "google", events: parseCalendarEvents(result.data, officers) };
  }
  const classified = classifyCallToolError(result);
  if (classified?.kind === "pending") {
    return { kind: "pending", source: "google", message: classified.message, events: [] };
  }
  if (classified?.kind === "login") {
    return {
      kind: "login",
      source: "google",
      message: classified.message,
      loginUrl: result.loginUrl,
      events: [],
    };
  }
  if (classified?.kind === "not_connected") {
    return { kind: "not_connected", source: "google", message: classified.message, events: [] };
  }
  const raw = (result.errorMessage ?? "").toLowerCase();
  if (raw.includes("cannot resolve gate host") || raw.includes("missing_connector_token")) {
    return {
      kind: "unavailable",
      source: "google",
      message: "Google Calendar connects when this app is opened from Grok with Calendar granted.",
      events: [],
    };
  }
  return {
    kind: "error",
    source: "google",
    message: classified?.message ?? result.errorMessage ?? "Could not load Google Calendar.",
    events: [],
  };
}

export async function fetchGoogleCalendar(
  officers: Officer[],
  timeMin: string,
  timeMax: string,
): Promise<CalendarState> {
  const result = await callTool(
    GoogleCalendarTools.search,
    {
      query: "",
      timeMin: `${timeMin}T00:00:00`,
      timeMax: `${timeMax}T23:59:59`,
      maxResults: 80,
    },
    { connectorType: ConnectorType.GoogleCalendar },
  );
  return calendarStateFromTool(result, officers);
}

function eventIdFromResult(data: unknown): string | null {
  const rec = asRecord(data);
  if (!rec) return null;
  const nested = asRecord(rec.event) ?? asRecord(rec.data);
  return (
    pickString(rec, ["id", "eventId", "iCalUID"]) ||
    (nested ? pickString(nested, ["id", "eventId", "iCalUID"]) : "") ||
    null
  );
}

export async function createGoogleLeaveEvent(input: {
  summary: string;
  description: string;
  startDate: string;
  endDate: string;
}): Promise<{ ok: true; eventId: string } | { ok: false; message: string; loginUrl?: string }> {
  const exclusiveEnd = addDays(input.endDate, 1);
  const args = {
    summary: input.summary,
    title: input.summary,
    description: input.description,
    start: input.startDate,
    end: exclusiveEnd,
    startDate: input.startDate,
    endDate: exclusiveEnd,
    allDay: true,
  };
  const result = await callTool(GoogleCalendarTools.createEvent, args, {
    connectorType: ConnectorType.GoogleCalendar,
  });
  if (result.ok) {
    const eventId = eventIdFromResult(result.data) ?? `wb-${input.startDate}-${input.summary}`;
    return { ok: true, eventId };
  }
  const classified = classifyCallToolError(result);
  return {
    ok: false,
    message:
      classified?.message ??
      result.errorMessage ??
      "Could not write the leave event to Google Calendar.",
    loginUrl: result.loginUrl,
  };
}

export async function deleteGoogleLeaveEvent(
  eventId: string,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const result = await callTool(
    GoogleCalendarTools.deleteEvent,
    { eventId, id: eventId },
    { connectorType: ConnectorType.GoogleCalendar },
  );
  if (result.ok) return { ok: true };
  const classified = classifyCallToolError(result);
  return {
    ok: false,
    message: classified?.message ?? result.errorMessage ?? "Could not delete the calendar event.",
  };
}

export function leaveEventTitle(lastName: string, kindLabel: string): string {
  return `${lastName.toUpperCase()} ${kindLabel.toUpperCase()}`;
}
