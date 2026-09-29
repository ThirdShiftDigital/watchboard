import { WEEKDAYS } from "./types.ts";

/**
 * Agency time zone. Every "today" and every event-to-day conversion uses this,
 * never the server clock (Netlify runs in UTC, so after 7 PM Central the UTC
 * date is already tomorrow) and never `new Date("YYYY-MM-DD")` (UTC midnight).
 */
export const AGENCY_TIME_ZONE = "America/Chicago";

const zoneFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: AGENCY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

/** Wall-clock parts of an instant in the agency time zone. */
function zoneParts(d: Date): { date: string; time: string } {
  const parts: Record<string, string> = {};
  for (const p of zoneFormatter.formatToParts(d)) parts[p.type] = p.value;
  const hour = parts.hour === "24" ? "00" : parts.hour;
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${hour}:${parts.minute}:${parts.second}`,
  };
}

/** Today's calendar date in the agency time zone (YYYY-MM-DD). */
export function todayISO(now: Date = new Date()): string {
  return zoneParts(now).date;
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const HAS_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i;

/**
 * Agency-local "YYYY-MM-DDTHH:MM:SS" for a date-time string. Strings carrying
 * a zone (Z / ±hh:mm) are converted; naive strings are taken as already local;
 * date-only strings are returned unchanged (a calendar date, not UTC midnight).
 */
export function toAgencyLocal(value: string): string {
  const raw = value.trim();
  if (DATE_ONLY.test(raw)) return raw;
  if (HAS_ZONE.test(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      const { date, time } = zoneParts(d);
      return `${date}T${time}`;
    }
  }
  return raw;
}

/** Agency-local calendar day of a date or date-time string. */
export function agencyDayOf(value: string): string {
  return toAgencyLocal(value).slice(0, 10);
}

/**
 * Inclusive agency-local day span of an event. `end` for all-day events is
 * expected to be the inclusive last day (Google/ICS exclusive ends are
 * converted at parse time). A timed event ending exactly at local midnight
 * does not spill onto the next day.
 */
export function eventDayRange(start: string, end: string | null): { start: string; end: string } {
  const startLocal = toAgencyLocal(start);
  const startDay = startLocal.slice(0, 10);
  if (!end) return { start: startDay, end: startDay };
  const endLocal = toAgencyLocal(end);
  let endDay = endLocal.slice(0, 10);
  if (!DATE_ONLY.test(endLocal) && /T00:00(?::00(?:\.\d+)?)?$/.test(endLocal) && endDay > startDay) {
    endDay = addDays(endDay, -1);
  }
  if (endDay < startDay) endDay = startDay;
  return { start: startDay, end: endDay };
}

/**
 * Google (and iCal) all-day events use an EXCLUSIVE end date: a one-day event
 * on Sep 28 has end.date "2026-09-29". Return the inclusive last day.
 */
export function inclusiveAllDayEnd(start: string, end: string | null): string {
  const startDay = start.slice(0, 10);
  if (!end || !DATE_ONLY.test(end)) return startDay;
  return end > startDay ? addDays(end, -1) : startDay;
}

/** Last day of the month containing `iso`. */
export function endOfMonth(iso: string): string {
  return addDays(startOfMonth(addDays(startOfMonth(iso), 32)), -1);
}

export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function weekdayOf(iso: string): number {
  return parseISODate(iso).getDay();
}

export function addDays(iso: string, n: number): string {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayOf(iso));
}

export function startOfMonth(iso: string): string {
  const d = parseISODate(iso);
  d.setDate(1);
  return toISODate(d);
}

export function formatLong(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatShort(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export function formatStamp(value: string): string {
  const d = parseStamp(value);
  if (!d) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseStamp(value: string): Date | null {
  const raw = value.trim();
  if (!raw) return null;
  const isoish = raw.includes("T") ? raw : raw.replace(" ", "T");
  const d = new Date(isoish);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date(raw);
    return Number.isNaN(fallback.getTime()) ? null : fallback;
  }
  return d;
}

export function formatWeekday(iso: string): string {
  return WEEKDAYS[weekdayOf(iso)] ?? "";
}

export function monthTitle(iso: string): string {
  return parseISODate(iso).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

export function daysInMonth(iso: string): string[] {
  const start = parseISODate(startOfMonth(iso));
  const year = start.getFullYear();
  const month = start.getMonth();
  const last = new Date(year, month + 1, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= last; d += 1) {
    out.push(toISODate(new Date(year, month, d, 12)));
  }
  return out;
}

export function formatHired(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y.slice(2)}`;
}

export function isValidISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseISODate(value).getTime());
}

export function parseRdoDays(raw: string | null | undefined): number[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((p) => Number(p.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}

export function serializeRdoDays(days: number[]): string {
  return [...new Set(days)].sort((a, b) => a - b).join(",");
}

export function dateInRange(iso: string, start: string, end: string): boolean {
  return iso >= start && iso <= end;
}

export function eventTouchesDate(startIso: string, endIso: string | null, date: string): boolean {
  const { start, end } = eventDayRange(startIso, endIso);
  return date >= start && date <= end;
}

export function eventOverlapsRange(
  startIso: string,
  endIso: string | null,
  from: string,
  to: string,
): boolean {
  const { start, end } = eventDayRange(startIso, endIso);
  return end >= from && start <= to;
}
