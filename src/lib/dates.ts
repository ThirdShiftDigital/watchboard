import { WEEKDAYS } from "./types";

export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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
  const start = startIso.slice(0, 10);
  const end = (endIso ?? startIso).slice(0, 10);
  if (end < start) return start === date;
  return date >= start && date <= end;
}
