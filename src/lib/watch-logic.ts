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
import { kindShort, REQUEST_KINDS } from "./types";

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

const NAME_SUFFIXES = new Set(["JR", "SR", "II", "III", "IV", "V"]);
const RANK_WORDS = new Set([
  "LT", "LIEUTENANT", "SGT", "SERGEANT", "CPL", "CORPORAL", "FTO", "CPL/FTO",
  "DEP", "DEPUTY", "OFC", "OFFICER", "CPT", "CAPT", "CAPTAIN", "MAJ", "MAJOR",
  "DET", "INV", "TPR", "PTL", "CHIEF", "SHERIFF",
]);

function nameTokens(name: string): string[] {
  return name
    .toUpperCase()
    .replace(/[.,]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

/** Last name from a display name, skipping suffixes like Jr./III. */
export function deriveLastName(name: string): string {
  const tokens = nameTokens(name).filter((t) => !NAME_SUFFIXES.has(t));
  return tokens[tokens.length - 1] ?? name.trim().toUpperCase();
}

/** Officer's last name, uppercase. Uses last_name unless it is empty or just a suffix. */
export function officerLastName(o: Pick<Officer, "name" | "lastName">): string {
  const stored = (o.lastName ?? "").trim().toUpperCase().replace(/[.,]/g, "");
  if (stored && !NAME_SUFFIXES.has(stored)) return stored;
  return deriveLastName(o.name);
}

/** First initial from the display name ("LT. C. KEYES" -> "C"), or "" if none. */
export function officerFirstInitial(o: Pick<Officer, "name" | "lastName">): string {
  const last = officerLastName(o);
  const tokens = nameTokens(o.name).filter(
    (t) => !NAME_SUFFIXES.has(t) && !RANK_WORDS.has(t) && !t.includes("/"),
  );
  const idx = tokens.lastIndexOf(last);
  const before = (idx > 0 ? tokens.slice(0, idx) : tokens.slice(0, -1)).filter((t) =>
    /^[A-Z]/.test(t),
  );
  return before[0]?.[0] ?? "";
}

/**
 * Google event title for approved leave, matching the shared calendar:
 * just "ANDERSON" for every leave type except sick, which is "ANDERSON - SICK".
 * When another officer on the shift shares the last name: "A. ANDERSON" /
 * "A. ANDERSON - SICK". The leave type goes in the description instead.
 */
export function leaveEventSummary(
  officer: Pick<Officer, "id" | "name" | "lastName">,
  shiftOfficers: Pick<Officer, "id" | "name" | "lastName">[],
  kind: string | null | undefined,
): string {
  const last = officerLastName(officer);
  const shared = shiftOfficers.some((o) => o.id !== officer.id && officerLastName(o) === last);
  const initial = shared ? officerFirstInitial(officer) : "";
  const who = initial ? `${initial}. ${last}` : last;
  return kind === "sick" ? `${who} - SICK` : who;
}

/** Event description: leave type label, then the request notes (if any). */
export function leaveEventDescription(kind: string | null | undefined, reason: string | null | undefined): string {
  const label = REQUEST_KINDS.find((k) => k.id === kind)?.label ?? "";
  const notes = (reason ?? "").trim();
  if (label && notes) return `${label} — ${notes}`;
  return label || notes;
}

/**
 * Match a calendar event title to roster officers by last name (case-insensitive).
 * Handles "SCOTT", "Scott", "SCOTT - VACATION", "J. SCOTT - SICK", "Scott's day off".
 * If several officers share the matched last name and the title carries a first
 * initial/name right before it, only the officer(s) with that initial match.
 */
export function matchOfficersToEvent(
  title: string,
  officers: Officer[],
): string[] {
  const hay = ` ${title.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim()} `;
  const byLast = new Map<string, Officer[]>();
  for (const o of officers) {
    const last = officerLastName(o).replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
    if (last.length < 3) continue;
    if (hay.includes(` ${last} `) || hay.includes(` ${last} S `)) {
      byLast.set(last, [...(byLast.get(last) ?? []), o]);
    }
  }
  const hits: string[] = [];
  for (const [last, group] of byLast) {
    if (group.length > 1) {
      const m = hay.match(new RegExp(` ([A-Z])[A-Z]* ${last} `));
      const initial = m?.[1];
      if (initial) {
        const narrowed = group.filter((o) => officerFirstInitial(o) === initial);
        if (narrowed.length) {
          hits.push(...narrowed.map((o) => o.id));
          continue;
        }
      }
    }
    hits.push(...group.map((o) => o.id));
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
