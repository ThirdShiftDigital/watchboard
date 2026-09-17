import { eventTouchesDate } from "./dates";
import type {
  CalendarEvent,
  DutyStatus,
  Officer,
  TimeOffRequest,
  WatchRow,
  ZoneAssignment,
  RequestKind,
} from "./types";
import { kindShort } from "./types";

export function statusForOfficer(
  officer: Officer,
  weekday: number,
  date: string,
  requests: TimeOffRequest[],
  events: CalendarEvent[],
): { status: DutyStatus; statusLabel: string; eventTitle?: string } {
  if (officer.rdoDays.includes(weekday)) {
    return { status: "rdo", statusLabel: "RDO" };
  }
  const leave = requests.find(
    (r) =>
      r.status === "approved" &&
      r.officerId === officer.id &&
      date >= r.startDate &&
      date <= r.endDate,
  );
  if (leave) {
    return { status: "leave", statusLabel: kindShort(leave.kind) };
  }
  const hit = events.find(
    (e) =>
      e.matchedOfficerIds.includes(officer.id) &&
      eventTouchesDate(e.start, e.end, date),
  );
  if (hit) {
    return {
      status: "calendar",
      statusLabel: "CAL",
      eventTitle: hit.title,
    };
  }
  return { status: "working", statusLabel: "ON" };
}

export function buildRows(
  officers: Officer[],
  weekday: number,
  date: string,
  requests: TimeOffRequest[],
  events: CalendarEvent[],
  assignments: ZoneAssignment[],
): WatchRow[] {
  const zoneByOfficer = new Map(assignments.map((a) => [a.officerId, a.zone]));
  return officers.map((officer) => {
    const s = statusForOfficer(officer, weekday, date, requests, events);
    return {
      officer,
      status: s.status,
      statusLabel: s.statusLabel,
      zone: s.status === "working" ? (zoneByOfficer.get(officer.id) ?? null) : null,
      eventTitle: s.eventTitle,
    };
  });
}

export function lastNameFromTitle(name: string): string {
  const cleaned = name.replace(/[.,]/g, " ").trim();
  const parts = cleaned.split(/\s+/);
  return (parts[parts.length - 1] ?? "").toUpperCase();
}

export function matchOfficersToEvent(
  title: string,
  officers: Officer[],
): string[] {
  const hay = ` ${title.toUpperCase().replace(/[^A-Z0-9 ]/g, " ")} `;
  const hits: string[] = [];
  for (const o of officers) {
    const last = o.lastName.toUpperCase();
    if (last.length < 3) continue;
    if (hay.includes(` ${last} `) || hay.includes(` ${last}'S `)) {
      hits.push(o.id);
    }
  }
  return hits;
}

export function staffingByWeekday(
  officers: Officer[],
  requests: TimeOffRequest[],
  events: CalendarEvent[],
  weekStart: string,
  addDaysFn: (iso: string, n: number) => string,
): number[] {
  return Array.from({ length: 7 }, (_, weekday) => {
    const date = addDaysFn(weekStart, weekday);
    return officers.filter((o) => {
      const s = statusForOfficer(o, weekday, date, requests, events);
      return s.status === "working";
    }).length;
  });
}

export type LeaveChip = {
  id: number;
  officerId: string;
  lastName: string;
  name: string;
  kind: RequestKind;
  kindShort: string;
  startDate: string;
  endDate: string;
};

export function approvedLeaveOnDate(
  date: string,
  requests: TimeOffRequest[],
  officers: Officer[],
): LeaveChip[] {
  const byId = new Map(officers.map((o) => [o.id, o]));
  const chips: LeaveChip[] = [];
  for (const r of requests) {
    if (r.status !== "approved" || date < r.startDate || date > r.endDate) continue;
    const officer = byId.get(r.officerId);
    if (!officer) continue;
    chips.push({
      id: r.id,
      officerId: officer.id,
      lastName: officer.lastName,
      name: officer.name,
      kind: r.kind,
      kindShort: kindShort(r.kind),
      startDate: r.startDate,
      endDate: r.endDate,
    });
  }
  return chips;
}

export function approvedLeaveInRange(
  from: string,
  to: string,
  requests: TimeOffRequest[],
  officers: Officer[],
): (TimeOffRequest & { name: string; lastName: string })[] {
  const byId = new Map(officers.map((o) => [o.id, o]));
  const rows: (TimeOffRequest & { name: string; lastName: string })[] = [];
  for (const r of requests) {
    if (r.status !== "approved" || r.startDate > to || r.endDate < from) continue;
    const officer = byId.get(r.officerId);
    if (!officer) continue;
    rows.push({ ...r, name: officer.name, lastName: officer.lastName });
  }
  return rows.sort(
    (a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name),
  );
}
