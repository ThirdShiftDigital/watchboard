import { formatLong } from "./dates";
import {
  DEFAULT_ZONE_ORDER,
  normalizeZoneOrder,
  orderedZones,
  zoneHint,
  type WatchRow,
} from "./types";

function pad(value: string, width: number): string {
  const s = value.trim();
  if (s.length >= width) return s;
  return s + " ".repeat(width - s.length);
}

function zoneRank(zone: string | null, order: string[]): number {
  const i = order.indexOf(zone ?? "");
  return i === -1 ? 999 : i;
}

/** Assigned working officers, in saved zone order — the posted watch. */
export function postedWatchRows(
  rows: WatchRow[],
  order: string[] = DEFAULT_ZONE_ORDER,
): WatchRow[] {
  const seq = normalizeZoneOrder(order);
  return rows
    .filter((r) => r.status === "working" && r.zone)
    .sort((a, b) => {
      const z = zoneRank(a.zone, seq) - zoneRank(b.zone, seq);
      if (z !== 0) return z;
      return a.officer.rankSort - b.officer.rankSort;
    });
}

export function sortWatchRows(
  rows: WatchRow[],
  order: string[] = DEFAULT_ZONE_ORDER,
  includeOffDuty = false,
): WatchRow[] {
  const posted = postedWatchRows(rows, order);
  const postedIds = new Set(posted.map((r) => r.officer.id));
  const unassigned = rows
    .filter((r) => r.status === "working" && !postedIds.has(r.officer.id))
    .sort((a, b) => a.officer.rankSort - b.officer.rankSort || a.officer.name.localeCompare(b.officer.name));
  if (!includeOffDuty) return [...unassigned, ...posted];
  const off = rows.filter((r) => r.status !== "working");
  return [...unassigned, ...posted, ...off];
}

function openZones(posted: WatchRow[], order: string[]): string[] {
  const used = new Set(posted.map((r) => r.zone));
  return orderedZones(order)
    .filter((z) => z.id !== "ALL" && !used.has(z.id))
    .map((z) => z.id);
}

function zoneTable(posted: WatchRow[]): string {
  const nameW = Math.max(6, ...posted.map((r) => r.officer.name.length));
  const header = `${pad("DEPUTY", nameW)}  UNIT  ZONE`;
  const body = posted.map((r) => {
    return `${pad(r.officer.name, nameW)}  ${pad(r.officer.unit, 4)}  ${r.zone}`;
  });
  return [header, ...body].join("\n");
}

export function formatShiftList(
  date: string,
  rows: WatchRow[],
  order: string[] = DEFAULT_ZONE_ORDER,
): string {
  const posted = postedWatchRows(rows, order);
  return [`ZONES  ${formatLong(date).toUpperCase()}`, "", zoneTable(posted)].join("\n");
}

export function formatDispatchList(
  date: string,
  rows: WatchRow[],
  order: string[] = DEFAULT_ZONE_ORDER,
): string {
  const posted = postedWatchRows(rows, order);
  const open = openZones(posted, order);
  const lines = [`ZONES  ${formatLong(date).toUpperCase()}`, "", zoneTable(posted)];

  const legends = posted
    .map((r) => r.zone)
    .filter((z): z is string => Boolean(z))
    .filter((z, i, all) => all.indexOf(z) === i)
    .map((z) => {
      const hint = zoneHint(z);
      return hint && hint.toUpperCase() !== z.toUpperCase() ? `${z}  ${hint}` : null;
    })
    .filter((line): line is string => Boolean(line));

  if (legends.length) {
    lines.push("", ...legends);
  }
  if (open.length) {
    lines.push(
      "",
      "OPEN",
      ...open.map((z) => {
        const hint = zoneHint(z);
        return hint && hint.toUpperCase() !== z.toUpperCase() ? `${z}  ${hint}` : z;
      }),
    );
  }
  return lines.join("\n");
}

export function formatRequestInvite(url: string): string {
  return [
    "Request days off",
    "",
    "Open this link, pick your name and dates, and submit.",
    "Once a supervisor approves it, you are filled on the calendar and dropped from the zone list.",
    "",
    url,
  ].join("\n");
}

export function shiftShareTitle(date: string): string {
  return `Zones — ${formatLong(date)}`;
}

export function dispatchShareTitle(date: string): string {
  return `Dispatch zones — ${formatLong(date)}`;
}
