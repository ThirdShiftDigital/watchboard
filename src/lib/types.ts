export const WEEKDAYS = ["SUN", "MON", "TUES", "WEDS", "THURS", "FRI", "SAT"] as const;
export const WEEKDAY_SHORT = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export const ZONES = [
  { id: "ALL", label: "ALL", hint: "Supervisor / countywide" },
  { id: "RE", label: "RE", hint: "Roving East" },
  { id: "NE", label: "NE", hint: "Northeast" },
  { id: "SE", label: "SE", hint: "Southeast" },
  { id: "CENTRAL", label: "CENTRAL", hint: "Central" },
  { id: "RW", label: "RW", hint: "Roving West" },
  { id: "NW", label: "NW", hint: "Northwest" },
  { id: "SW", label: "SW", hint: "Southwest" },
  { id: "VANDY ER", label: "VANDY ER", hint: "Vanderbilt ER" },
] as const;

export type ZoneId = (typeof ZONES)[number]["id"];

export const ROLES = [
  { id: "lt", label: "Lieutenant", short: "LT" },
  { id: "sgt", label: "Sergeant", short: "SGT" },
  { id: "cpl", label: "Corporal", short: "CPL" },
  { id: "fto", label: "FTO", short: "FTO" },
  { id: "deputy", label: "Deputy", short: "DEP" },
] as const;

export const RDO_PAIRS = [
  { days: [5, 6], label: "FRI–SAT" },
  { days: [6, 0], label: "SAT–SUN" },
  { days: [0, 1], label: "SUN–MON" },
  { days: [1, 2], label: "MON–TUE" },
  { days: [2, 3], label: "TUE–WED" },
  { days: [3, 4], label: "WED–THU" },
  { days: [4, 5], label: "THU–FRI" },
] as const;

export const REQUEST_KINDS = [
  { id: "vacation", label: "Vacation" },
  { id: "sick", label: "Sick" },
  { id: "training", label: "Training" },
  { id: "court", label: "Court" },
  { id: "other", label: "Other" },
] as const;

export type RequestKind = (typeof REQUEST_KINDS)[number]["id"];
export type RequestStatus = "pending" | "approved" | "denied";
export type DutyStatus = "working" | "rdo" | "leave" | "calendar";
export type OfficerRole = (typeof ROLES)[number]["id"];

export type Officer = {
  id: string;
  name: string;
  unit: string;
  rankSort: number;
  role: OfficerRole;
  hireDate: string | null;
  tmt: boolean;
  radioNum: number | null;
  rdoDays: number[];
  defaultZone: string | null;
  lastName: string;
};

export function applySeniority(officers: Officer[]): Officer[] {
  const ranked = officers
    .filter((o) => isBelowCpl(o.role) && o.hireDate)
    .sort((a, b) => {
      const byDate = (a.hireDate ?? "").localeCompare(b.hireDate ?? "");
      if (byDate !== 0) return byDate;
      return a.name.localeCompare(b.name);
    });
  const rn = new Map(ranked.map((o, i) => [o.id, i + 1]));
  return officers.map((o) => ({
    ...o,
    radioNum: isBelowCpl(o.role) ? (rn.get(o.id) ?? null) : null,
  }));
}

export function roleRank(role: OfficerRole): number {
  switch (role) {
    case "lt":
      return 0;
    case "sgt":
      return 1;
    case "cpl":
      return 2;
    case "fto":
      return 3;
    case "deputy":
      return 4;
  }
}

export function isBelowCpl(role: OfficerRole): boolean {
  return role === "fto" || role === "deputy";
}

/** Supervisors by rank, then deputies/FTOs by hire-date seniority. */
export function sortRoster(officers: Officer[]): Officer[] {
  return [...officers].sort((a, b) => {
    const aSup = !isBelowCpl(a.role);
    const bSup = !isBelowCpl(b.role);
    if (aSup !== bSup) return aSup ? -1 : 1;
    if (aSup) {
      const byRole = roleRank(a.role) - roleRank(b.role);
      if (byRole !== 0) return byRole;
      return (a.hireDate ?? "9999").localeCompare(b.hireDate ?? "9999") || a.name.localeCompare(b.name);
    }
    const byRn = (a.radioNum ?? 9999) - (b.radioNum ?? 9999);
    if (byRn !== 0) return byRn;
    return (a.hireDate ?? "9999").localeCompare(b.hireDate ?? "9999") || a.name.localeCompare(b.name);
  });
}

export type ZoneAssignment = {
  id: number;
  date: string;
  officerId: string;
  zone: string;
};

export type TimeOffRequest = {
  id: number;
  officerId: string;
  startDate: string;
  endDate: string;
  kind: RequestKind;
  reason: string;
  status: RequestStatus;
  createdAt: string;
  calendarEventId?: string | null;
};

export type CalendarEvent = {
  id: string;
  title: string;
  start: string;
  end: string | null;
  allDay: boolean;
  matchedOfficerIds: string[];
};

export type CalendarState = {
  kind:
    | "ok"
    | "pending"
    | "login"
    | "not_connected"
    | "error"
    | "unavailable";
  source?: "feed" | "google";
  message?: string;
  loginUrl?: string;
  events: CalendarEvent[];
};

export type WatchRow = {
  officer: Officer;
  status: DutyStatus;
  statusLabel: string;
  zone: string | null;
  eventTitle?: string;
};

export type WatchBoard = {
  date: string;
  weekday: number;
  officers: Officer[];
  rows: WatchRow[];
  workingCount: number;
  rdoCount: number;
  leaveCount: number;
  calendarOffCount: number;
  assignedCount: number;
  calendar: CalendarState;
  effectiveDate: string;
  generated: boolean;
  zoneOrder: string[];
  minWorking: number;
  shiftName?: string;
};

export const DEFAULT_ZONE_ORDER: string[] = ZONES.map((z) => z.id);

export const STARTER_ZONES = ["ALL", "NORTH", "SOUTH", "EAST", "WEST"];

export const ZONE_PRESETS: { id: string; label: string; zones: string[] }[] = [
  { id: "starter", label: "Compass", zones: STARTER_ZONES },
  { id: "beats", label: "Beats", zones: ["ALL", "BEAT 1", "BEAT 2", "BEAT 3", "BEAT 4", "BEAT 5"] },
  { id: "wcso", label: "WCSO", zones: DEFAULT_ZONE_ORDER },
];

export function cleanZoneId(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toUpperCase().slice(0, 24);
}

export function normalizeZoneOrder(raw: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const id = cleanZoneId(item.split("|")[0] ?? item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

export function orderedZones(order: string[]) {
  const ids = normalizeZoneOrder(order);
  return ids.map((id) => {
    const known = ZONES.find((z) => z.id === id);
    return known ?? { id, label: id, hint: "" };
  });
}

export function zoneHint(id: string): string {
  return ZONES.find((z) => z.id === id)?.hint ?? "";
}

export function rdoLabel(days: number[]): string {
  const found = RDO_PAIRS.find(
    (p) => p.days.length === days.length && p.days.every((d, i) => d === days[i]),
  );
  if (found) return found.label;
  return days.map((d) => WEEKDAY_SHORT[d] ?? String(d)).join("–");
}

export function roleLabel(role: OfficerRole): string {
  return ROLES.find((r) => r.id === role)?.label ?? role;
}

export function kindLabel(kind: RequestKind): string {
  return REQUEST_KINDS.find((k) => k.id === kind)?.label ?? kind;
}

export function kindShort(kind: RequestKind): string {
  switch (kind) {
    case "vacation":
      return "VAC";
    case "sick":
      return "SICK";
    case "training":
      return "TNG";
    case "court":
      return "CRT";
    default:
      return "OTH";
  }
}

export type Agency = {
  id: string;
  name: string;
  shortName: string;
  patchData?: string | null;
};

export type Shift = {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  effectiveDate: string;
  minWorking: number;
  zoneOrder: string[];
  calendarFeedUrl: string;
  googleCalendar?: boolean;
  agencyId?: string;
};

export function shiftHoursLabel(shift: Pick<Shift, "startTime" | "endTime">): string {
  const fmt = (t: string) => t.replace(":", "");
  return `${fmt(shift.startTime)}–${fmt(shift.endTime)}`;
}
