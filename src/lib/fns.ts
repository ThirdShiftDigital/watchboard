import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { addDays, parseRdoDays, serializeRdoDays, startOfWeek, todayISO, weekdayOf } from "@/lib/dates";
import { normalizeFeedUrl } from "@/lib/ics";
import type {
  CalendarState,
  Officer,
  OfficerRole,
  RequestKind,
  RequestStatus,
  TimeOffRequest,
  WatchBoard,
  ZoneAssignment,
} from "@/lib/types";
import { buildRows, deriveLastName, leaveEventDescription, leaveEventSummary, statusForOfficer } from "@/lib/watch-logic";
import { applySeniority, normalizeZoneOrder, sortRoster } from "@/lib/types";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireCap, accessFor } from "@/lib/staff";
import { currentShiftFor, ensureShifts, loadShift } from "@/lib/shifts";
import {
  connectShiftGoogle,
  disconnectShiftGoogle,
  selectShiftGoogleCalendar,
  loadShiftCalendar,
  peekCalendarCache,
  readShiftCalendarCache,
  refreshShiftCalendarCache,
  removeApprovedLeave,
  writeApprovedLeave,
  type LeaveCalendarWrite,
} from "@/lib/calendar-sync";

type OfficerRow = {
  id: string;
  name: string;
  unit: string;
  rank_sort: number;
  role: string;
  hire_date: string | null;
  tmt: boolean;
  radio_num: number | null;
  rdo_days: string;
  default_zone: string | null;
  last_name: string;
};

type AssignmentRow = {
  id: number;
  date: string;
  officer_id: string;
  zone: string;
};

type RequestRow = {
  id: number;
  officer_id: string;
  start_date: string;
  end_date: string;
  kind: string;
  reason: string;
  status: string;
  created_at: string;
  calendar_event_id?: string | null;
  calendar_label?: string | null;
};

function mapOfficer(row: OfficerRow): Officer {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    rankSort: Number(row.rank_sort),
    role: row.role as OfficerRole,
    hireDate: row.hire_date,
    tmt: Boolean(row.tmt),
    radioNum: row.radio_num === null ? null : Number(row.radio_num),
    rdoDays: parseRdoDays(row.rdo_days),
    defaultZone: row.default_zone,
    lastName: row.last_name,
  };
}

function mapAssignment(row: AssignmentRow): ZoneAssignment {
  return {
    id: Number(row.id),
    date: row.date,
    officerId: row.officer_id,
    zone: row.zone,
  };
}

function mapRequest(row: RequestRow): TimeOffRequest {
  return {
    id: Number(row.id),
    officerId: row.officer_id,
    startDate: row.start_date,
    endDate: row.end_date,
    kind: row.kind as RequestKind,
    reason: row.reason ?? "",
    status: row.status as RequestStatus,
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : new Date(row.created_at).toISOString(),
    calendarEventId: row.calendar_event_id ?? null,
  };
}

async function loadOfficers(shiftId: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<OfficerRow>`
    select id, name, unit, rank_sort, role, hire_date, tmt, radio_num, rdo_days, default_zone, last_name
    from officers
    where shift_id = ${shiftId}
    order by rank_sort asc, unit asc
  `;
  return sortRoster(applySeniority(rows.map(mapOfficer)));
}

async function loadRequests(shiftId: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<RequestRow>`
    select r.id, r.officer_id, r.start_date, r.end_date, r.kind, r.reason, r.status,
           to_char(r.created_at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as created_at,
           r.calendar_event_id
    from time_off_requests r
    join officers o on o.id = r.officer_id
    where o.shift_id = ${shiftId}
    order by
      case r.status when 'pending' then 0 when 'approved' then 1 when 'denied' then 2 else 3 end,
      r.created_at asc,
      r.id asc
  `;
  return rows.map(mapRequest);
}

async function loadAssignments(date: string, shiftId: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<AssignmentRow>`
    select a.id, a.date, a.officer_id, a.zone
    from zone_assignments a
    join officers o on o.id = a.officer_id
    where a.date = ${date} and o.shift_id = ${shiftId}
    order by a.id asc
  `;
  return rows.map(mapAssignment);
}

async function fetchCalendar(
  officers: Officer[],
  timeMin: string,
  timeMax: string,
  shift: { id: string; calendarFeedUrl: string; googleCalendar?: boolean },
  canConnect: boolean,
): Promise<CalendarState> {
  return loadShiftCalendar({
    shift: {
      id: shift.id,
      calendarFeedUrl: shift.calendarFeedUrl,
      googleCalendar: Boolean(shift.googleCalendar),
    },
    officers,
    timeMin,
    timeMax,
    canConnect,
  });
}

const dateInput = z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) });

export const getWatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(dateInput)
  .handler(async ({ data, context }): Promise<WatchBoard> => {
    await ensureShifts();
    await requireCap(context.userId, "viewBoard");
    const shift = await currentShiftFor(context.userId);
    const date = data.date;
    const weekday = weekdayOf(date);
    const [officers, requests, existing, access] = await Promise.all([
      loadOfficers(shift.id),
      loadRequests(shift.id),
      loadAssignments(date, shift.id),
      accessFor(context.userId),
    ]);
    // Google shifts: calendar_cache only — Zones load and the post-Save refetch
    // must never wait on Google (token refresh / events.list). A stale cache is
    // refreshed in the background by the client via refreshWatchCalendar.
    const calendar: CalendarState = shift.googleCalendar
      ? await readShiftCalendarCache({ shiftId: shift.id, officers, timeMin: date, timeMax: date })
      : await fetchCalendar(officers, date, date, shift, access.caps.editWatch);
    let assignments = existing;
    let rows = buildRows(officers, weekday, date, requests, calendar.events, assignments);
    const statusById = new Map(rows.map((r) => [r.officer.id, r.status]));
    // Drop zones for officers who are off — but never on the strength of a
    // stale calendar cache alone (the event may already be gone in Google).
    const stale = assignments.filter((a) => {
      const status = statusById.get(a.officerId);
      if (status === "working") return false;
      if (status === "calendar" && calendar.stale) return false;
      return true;
    });
    if (stale.length) {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      await sql`
        delete from zone_assignments
        where date = ${date} and officer_id = any(${stale.map((a) => a.officerId)}::text[])
      `;
      const staleIds = new Set(stale.map((a) => a.officerId));
      assignments = assignments.filter((a) => !staleIds.has(a.officerId));
      rows = buildRows(officers, weekday, date, requests, calendar.events, assignments);
    }
    const workingCount = rows.filter((r) => r.status === "working").length;
    if (!access.caps.viewCalendar) {
      // No shift-calendar access (dispatch by default): keep who is on/off,
      // drop the calendar event list and titles.
      rows = rows.map((r) => (r.eventTitle ? { ...r, eventTitle: undefined } : r));
    }
    return {
      date,
      weekday,
      officers,
      rows,
      workingCount,
      rdoCount: rows.filter((r) => r.status === "rdo").length,
      leaveCount: rows.filter((r) => r.status === "leave").length,
      calendarOffCount: rows.filter((r) => r.status === "calendar").length,
      assignedCount: rows.filter((r) => r.status === "working" && r.zone).length,
      calendar: access.caps.viewCalendar ? calendar : { ...calendar, events: [] },
      effectiveDate: shift.effectiveDate,
      generated: true,
      zoneOrder: shift.zoneOrder,
      minWorking: shift.minWorking,
      shiftName: shift.name,
    };
  });

/**
 * Background Google refresh for the Zones board. The client calls this after
 * getWatch reports `calendar.stale`; it never blocks Zones load or Save.
 */
export const refreshWatchCalendar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(dateInput)
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "viewBoard");
    const shift = await currentShiftFor(context.userId);
    if (!shift.googleCalendar) return { refreshed: false };
    const [officers, access] = await Promise.all([
      loadOfficers(shift.id),
      accessFor(context.userId),
    ]);
    return refreshShiftCalendarCache({
      shift: {
        id: shift.id,
        calendarFeedUrl: shift.calendarFeedUrl,
        googleCalendar: true,
      },
      officers,
      timeMin: data.date,
      timeMax: data.date,
      canConnect: access.caps.editWatch,
    }).catch((e: unknown) => {
      console.error("[calendar] background refresh failed", {
        shiftId: shift.id,
        error: e instanceof Error ? e.message.slice(0, 200) : String(e),
      });
      return { refreshed: false };
    });
  });

export const rebuildWatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(dateInput)
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "editWatch");
    const shift = await currentShiftFor(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      delete from zone_assignments
      where date = ${data.date}
        and officer_id in (select id from officers where shift_id = ${shift.id})
    `;
    return { saved: 0 };
  });

export const getZoneOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireCap(context.userId, "viewBoard");
    const shift = await currentShiftFor(context.userId);
    return { order: shift.zoneOrder };
  });

export const setZoneOrder = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ order: z.array(z.string().min(1)).min(1) }))
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "editWatch");
    const order = normalizeZoneOrder(data.order);
    const shift = await currentShiftFor(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update shifts set zone_order = ${order.join(",")} where id = ${shift.id}
    `;
    return { order };
  });

export const upsertAssignment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      officerId: z.string().min(1),
      zone: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "editWatch");
    const shift = await currentShiftFor(context.userId);
    // Duty gate from DB only — Save must not wait on Google/ICS.
    const [officers, requests] = await Promise.all([
      loadOfficers(shift.id),
      loadRequests(shift.id),
    ]);
    const officer = officers.find((o) => o.id === data.officerId);
    if (!officer) throw new Error("That officer is not on this shift’s schedule.");
    const weekday = weekdayOf(data.date);
    const events = await peekCalendarCache(shift.id, officers);
    const duty = statusForOfficer(officer, weekday, data.date, requests, events);
    if (duty.status !== "working") {
      throw new Error("Zones only assign people working today on the schedule.");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into zone_assignments (date, officer_id, zone)
      values (${data.date}, ${data.officerId}, ${data.zone})
      on conflict (date, officer_id) do update set zone = excluded.zone
    `;
    return { ok: true };
  });

export const deleteAssignment = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      officerId: z.string().min(1),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "editWatch");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      delete from zone_assignments
      where date = ${data.date} and officer_id = ${data.officerId}
    `;
    return { ok: true };
  });

/** Other officers' reasons/notes are private to approvers. */
function hideOthersReasons(
  requests: TimeOffRequest[],
  access: { caps: { approveRequests: boolean }; officerId: string | null },
): TimeOffRequest[] {
  if (access.caps.approveRequests) return requests;
  return requests.map((r) => (r.officerId === access.officerId ? r : { ...r, reason: "" }));
}

export const listRequests = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    // Full list (with reasons) is the Requests page — approvers only.
    await requireCap(context.userId, "approveRequests");
    const shift = await currentShiftFor(context.userId);
    const [requests, officers] = await Promise.all([
      loadRequests(shift.id),
      loadOfficers(shift.id),
    ]);
    return { requests, officers, googleCalendar: Boolean(shift.googleCalendar) };
  });

export const getOfficerPortal = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ officerId: z.string().min(1).optional() }))
  .handler(async ({ data, context }) => {
    await ensureShifts();
    const access = await accessFor(context.userId);
    const shift = await currentShiftFor(context.userId);
    const officers = await loadOfficers(shift.id);
    const today = todayISO();
    const weekStart = startOfWeek(today);
    const officerId = access.officerId ?? data.officerId;
    const fullCalendar = await fetchCalendar(
      officers,
      weekStart,
      addDays(weekStart, 27),
      shift,
      access.caps.editWatch,
    );
    // Without shift-calendar access, only events about the viewer's own officer.
    const calendar = access.caps.viewCalendar
      ? fullCalendar
      : {
          ...fullCalendar,
          events: officerId
            ? fullCalendar.events.filter((e) => e.matchedOfficerIds.includes(officerId))
            : [],
        };
    if (!officerId) {
      return {
        officers,
        officer: null,
        requests: [],
        today,
        weekStart,
        todayRow: null,
        linked: false,
        calendar,
      };
    }
    const officer = officers.find((o) => o.id === officerId) ?? null;
    const requests = officer
      ? (await loadRequests(shift.id)).filter((r) => r.officerId === officer.id)
      : [];
    let todayRow = null;
    if (officer) {
      const assignments = await loadAssignments(today, shift.id);
      const mine = assignments.filter((a) => a.officerId === officer.id);
      const rows = buildRows(
        [officer],
        weekdayOf(today),
        today,
        requests,
        calendar.events,
        mine,
      );
      todayRow = rows[0] ?? null;
    }
    return {
      officers,
      officer,
      requests,
      today,
      weekStart,
      todayRow,
      linked: Boolean(access.officerId),
      calendar,
    };
  });

/**
 * Upcoming (today onward, Central) pending + approved requests from everyone on
 * the viewer's shift, read-only, so officers know who is already off. Name,
 * dates, type and status only — never another officer's reason/notes.
 */
export const listShiftLeave = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const access = await requireCap(context.userId, "viewShiftRequests");
    const shift = await currentShiftFor(context.userId);
    const today = todayISO();
    const officers = await loadOfficers(shift.id);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      officer_id: string;
      start_date: string;
      end_date: string;
      kind: string;
      status: string;
    }>`
      select r.id, r.officer_id, r.start_date, r.end_date, r.kind, r.status
      from time_off_requests r
      join officers o on o.id = r.officer_id
      where o.shift_id = ${shift.id}
        and r.status in ('pending', 'approved')
        and r.end_date >= ${today}
      order by r.start_date asc, r.end_date asc, r.id asc
      limit 300
    `;
    const nameById = new Map(officers.map((o) => [o.id, o.name]));
    return {
      today,
      requests: rows
        .filter((r) => nameById.has(r.officer_id))
        .map((r) => ({
          id: Number(r.id),
          officerId: r.officer_id,
          officerName: nameById.get(r.officer_id) ?? "",
          startDate: r.start_date,
          endDate: r.end_date,
          kind: r.kind as RequestKind,
          status: r.status as "pending" | "approved",
          mine: Boolean(access.officerId) && r.officer_id === access.officerId,
        })),
    };
  });

export const createRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      officerId: z.string().min(1),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      kind: z.enum(["vacation", "sick", "training", "court", "other"]),
      reason: z.string().max(280),
    }),
  )
  .handler(async ({ data, context }) => {
    const access = await accessFor(context.userId);
    if (!access.caps.approveRequests && !access.caps.submitRequests) {
      throw new Error("Your account can’t submit days-off requests. Ask the shift commander.");
    }
    if (!access.caps.approveRequests && access.officerId && data.officerId !== access.officerId) {
      throw new Error("You can only request days off for your own name.");
    }
    if (data.endDate < data.startDate) {
      throw new Error("End date must be on or after the start date.");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ id: number }>`
      insert into time_off_requests (officer_id, start_date, end_date, kind, reason, status)
      values (${data.officerId}, ${data.startDate}, ${data.endDate}, ${data.kind}, ${data.reason}, 'pending')
      returning id
    `;
    return { id: Number(rows[0]?.id) };
  });

type CalendarOutcome = {
  /** True when the leave is on Google Calendar (written now or earlier). */
  written: boolean;
  /** Why it is not — shown to the approver. Null when written or not connected. */
  message: string | null;
  reason: string | null;
};

function calendarOutcome(write: LeaveCalendarWrite): CalendarOutcome {
  if (write.status === "written") return { written: true, message: null, reason: null };
  // Shift never connected Google: nothing to warn about.
  if (write.status === "skipped") return { written: false, message: null, reason: write.reason };
  return { written: false, message: write.message, reason: write.reason };
}

export const setRequestStatus = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.number().int(),
      status: z.enum(["approved", "denied", "pending"]),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "approveRequests");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const existing = await sql<RequestRow>`
      select id, officer_id, start_date, end_date, kind, reason, status, created_at::text as created_at, calendar_event_id, calendar_label
      from time_off_requests
      where id = ${data.id}
      limit 1
    `;
    const row = existing[0];
    if (!row) throw new Error("Request not found.");
    // Use the requesting officer's shift (its Google connection + calendar),
    // not whatever shift the approver happens to have active.
    const ownerShift = await sql<{ shift_id: string | null }>`
      select shift_id from officers where id = ${row.officer_id} limit 1
    `;
    const shift =
      (ownerShift[0]?.shift_id ? await loadShift(ownerShift[0].shift_id) : null) ??
      (await currentShiftFor(context.userId));
    const officers = await loadOfficers(shift.id);
    const officer = officers.find((o) => o.id === row.officer_id);
    await sql`
      update time_off_requests set status = ${data.status} where id = ${data.id}
    `;
    let calendar: CalendarOutcome = { written: false, message: null, reason: null };
    if (data.status === "approved") {
      await sql`
        delete from zone_assignments
        where officer_id = ${row.officer_id}
          and date >= ${row.start_date}
          and date <= ${row.end_date}
      `;
      if (row.calendar_event_id) {
        // Already on Google Calendar — don't create a duplicate.
        calendar = { written: true, message: null, reason: null };
      } else {
        const write = await writeApprovedLeave({
          shiftId: shift.id,
          googleCalendar: Boolean(shift.googleCalendar),
          summary: officer
            ? leaveEventSummary(officer, officers, row.kind, row.calendar_label)
            : "LEAVE",
          startDate: row.start_date,
          endDate: row.end_date,
          reason: leaveEventDescription(row.kind, row.reason),
        }).catch((e: unknown) => ({
          status: "failed" as const,
          reason: "error" as const,
          message: e instanceof Error ? e.message : "unexpected error writing to Google Calendar",
        }));
        calendar = calendarOutcome(write);
        if (write.status === "written") {
          await sql`update time_off_requests set calendar_event_id = ${write.eventId} where id = ${data.id}`;
        }
      }
    } else if (row.calendar_event_id) {
      const removed = await removeApprovedLeave(shift.id, row.calendar_event_id);
      await sql`
        update time_off_requests set calendar_event_id = null where id = ${data.id}
      `;
      if (!removed.ok) {
        calendar = { written: false, message: removed.message, reason: "error" };
      }
    }
    return { ok: true, startDate: row.start_date, endDate: row.end_date, calendar };
  });

/** Retry writing an approved request to Google Calendar (no roster changes). */
export const retryLeaveCalendar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "approveRequests");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const existing = await sql<RequestRow>`
      select id, officer_id, start_date, end_date, kind, reason, status, created_at::text as created_at, calendar_event_id, calendar_label
      from time_off_requests
      where id = ${data.id}
      limit 1
    `;
    const row = existing[0];
    if (!row) throw new Error("Request not found.");
    if (row.status !== "approved") throw new Error("Only approved requests go on the calendar.");
    if (row.calendar_event_id) {
      return { calendar: { written: true, message: null, reason: null } satisfies CalendarOutcome };
    }
    const ownerShift = await sql<{ shift_id: string | null }>`
      select shift_id from officers where id = ${row.officer_id} limit 1
    `;
    const shift =
      (ownerShift[0]?.shift_id ? await loadShift(ownerShift[0].shift_id) : null) ??
      (await currentShiftFor(context.userId));
    const officers = await loadOfficers(shift.id);
    const officer = officers.find((o) => o.id === row.officer_id);
    const write = await writeApprovedLeave({
      shiftId: shift.id,
      googleCalendar: Boolean(shift.googleCalendar),
      summary: officer
            ? leaveEventSummary(officer, officers, row.kind, row.calendar_label)
            : "LEAVE",
      startDate: row.start_date,
      endDate: row.end_date,
      reason: leaveEventDescription(row.kind, row.reason),
    }).catch((e: unknown) => ({
      status: "failed" as const,
      reason: "error" as const,
      message: e instanceof Error ? e.message : "unexpected error writing to Google Calendar",
    }));
    if (write.status === "written") {
      await sql`update time_off_requests set calendar_event_id = ${write.eventId} where id = ${data.id}`;
    }
    const calendar = calendarOutcome(write);
    if (write.status === "skipped") {
      return { calendar: { ...calendar, message: write.message } };
    }
    return { calendar };
  });

export const cancelMyRequest = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int() }))
  .handler(async ({ data, context }) => {
    const access = await accessFor(context.userId);
    const isSupervisor = Boolean(access.caps.approveRequests);
    const isOwner = Boolean(access.officerId);
    if (!isSupervisor && !isOwner) {
      throw new Error("Link your deputy profile before cancelling a request.");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const existing = await sql<RequestRow>`
      select id, officer_id, start_date, end_date, kind, reason, status,
             created_at::text as created_at, calendar_event_id, calendar_label
      from time_off_requests
      where id = ${data.id}
      limit 1
    `;
    const row = existing[0];
    if (!row) throw new Error("Request not found.");
    if (!isSupervisor && row.officer_id !== access.officerId) {
      throw new Error("You can only cancel your own requests.");
    }
    if (row.status !== "pending") {
      throw new Error("Only pending requests can be cancelled.");
    }
    await sql`
      update time_off_requests set status = 'cancelled' where id = ${data.id}
    `;
    return { ok: true as const };
  });

export const callInLeave = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      officerId: z.string().min(1),
      startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      kind: z.enum(["vacation", "sick", "training", "court", "other"]),
      reason: z.string().max(280),
      calendarLabel: z.string().max(40).optional(),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "callIn");
    if (data.endDate < data.startDate) {
      throw new Error("End date must be on or after the start date.");
    }
    const shift = await currentShiftFor(context.userId);
    const officers = await loadOfficers(shift.id);
    const officer = officers.find((o) => o.id === data.officerId);
    if (!officer) throw new Error("Officer not found.");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const note = data.reason.trim() || "Called in";
    const rows = await sql<{ id: number }>`
      insert into time_off_requests (officer_id, start_date, end_date, kind, reason, status, calendar_label)
      values (${data.officerId}, ${data.startDate}, ${data.endDate}, ${data.kind}, ${note}, 'approved', ${data.calendarLabel?.trim() || null})
      returning id
    `;
    const id = Number(rows[0]?.id);
    await sql`
      delete from zone_assignments
      where officer_id = ${data.officerId}
        and date >= ${data.startDate}
        and date <= ${data.endDate}
    `;
    const write = await writeApprovedLeave({
      shiftId: shift.id,
      googleCalendar: Boolean(shift.googleCalendar),
      summary: leaveEventSummary(officer, officers, data.kind, data.calendarLabel),
      startDate: data.startDate,
      endDate: data.endDate,
      reason: leaveEventDescription(data.kind, note),
    }).catch((e: unknown) => ({
      status: "failed" as const,
      reason: "error" as const,
      message: e instanceof Error ? e.message : "unexpected error writing to Google Calendar",
    }));
    if (write.status === "written") {
      await sql`update time_off_requests set calendar_event_id = ${write.eventId} where id = ${id}`;
    }
    return { id, calendar: calendarOutcome(write) };
  });

export const toggleRdo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      officerId: z.string().min(1),
      weekday: z.number().int().min(0).max(6),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "manageRoster");
    const shift = await currentShiftFor(context.userId);
    const officers = await loadOfficers(shift.id);
    const officer = officers.find((o) => o.id === data.officerId);
    if (!officer) throw new Error("Officer not found.");
    const next = officer.rdoDays.includes(data.weekday)
      ? officer.rdoDays.filter((d) => d !== data.weekday)
      : [...officer.rdoDays, data.weekday];
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update officers set rdo_days = ${serializeRdoDays(next)} where id = ${data.officerId}
    `;
    return { rdoDays: next };
  });

export const setRdoDays = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      officerId: z.string().min(1),
      rdoDays: z.array(z.number().int().min(0).max(6)).max(7),
    }),
  )
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "manageRoster");
    const shift = await currentShiftFor(context.userId);
    const officers = await loadOfficers(shift.id);
    if (!officers.some((o) => o.id === data.officerId)) {
      throw new Error("Officer not found.");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update officers set rdo_days = ${serializeRdoDays(data.rdoDays)} where id = ${data.officerId}
    `;
    return { rdoDays: data.rdoDays };
  });

const officerInput = z.object({
  name: z.string().min(2).max(80),
  unit: z.string().min(1).max(8),
  role: z.enum(["lt", "sgt", "cpl", "fto", "deputy"]),
  hireDate: z.string(),
  tmt: z.boolean(),
  radioNum: z.number().int().min(0).max(9999).nullable(),
  rdoDays: z.array(z.number().int().min(0).max(6)).max(7),
  defaultZone: z.string().max(24).nullable(),
});

function slugOfficerId(name: string, unit: string, taken: Set<string>): string {
  const last = name
    .replace(/[.,]/g, " ")
    .trim()
    .split(/\s+/)
    .pop()
    ?.toLowerCase()
    .replace(/[^a-z0-9]/g, "") ?? "officer";
  const base = last || "officer";
  if (!taken.has(base)) return base;
  const withUnit = `${base}-${unit.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
  if (!taken.has(withUnit)) return withUnit;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function displayOfficerName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toUpperCase();
}

function rankSortFor(unit: string): number {
  const n = Number(unit);
  return Number.isFinite(n) ? n : 900;
}

export const createOfficer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(officerInput)
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "manageRoster");
    const shift = await currentShiftFor(context.userId);
    const officers = await loadOfficers(shift.id);
    const unit = data.unit.trim();
    if (officers.some((o) => o.unit === unit)) {
      throw new Error(`Unit ${unit} is already on the roster.`);
    }
    const name = displayOfficerName(data.name);
    const lastName = deriveLastName(name);
    const id = slugOfficerId(name, unit, new Set(officers.map((o) => o.id)));
    const hireDate = data.hireDate && /^\d{4}-\d{2}-\d{2}$/.test(data.hireDate) ? data.hireDate : null;
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into officers (id, name, unit, rank_sort, role, hire_date, tmt, radio_num, rdo_days, default_zone, last_name, shift_id)
      values (
        ${id},
        ${name},
        ${unit},
        ${rankSortFor(unit)},
        ${data.role},
        ${hireDate},
        ${data.tmt},
        ${data.radioNum},
        ${serializeRdoDays(data.rdoDays)},
        ${data.defaultZone},
        ${lastName},
        ${shift.id}
      )
    `;
    return { id };
  });

export const updateOfficer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(officerInput.extend({ id: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "manageRoster");
    const shift = await currentShiftFor(context.userId);
    const officers = await loadOfficers(shift.id);
    const current = officers.find((o) => o.id === data.id);
    if (!current) throw new Error("Officer not found.");
    const unit = data.unit.trim();
    if (officers.some((o) => o.unit === unit && o.id !== data.id)) {
      throw new Error(`Unit ${unit} is already on the roster.`);
    }
    const name = displayOfficerName(data.name);
    const lastName = deriveLastName(name);
    const hireDate = data.hireDate && /^\d{4}-\d{2}-\d{2}$/.test(data.hireDate) ? data.hireDate : null;
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update officers
      set
        name = ${name},
        unit = ${unit},
        rank_sort = ${rankSortFor(unit)},
        role = ${data.role},
        hire_date = ${hireDate},
        tmt = ${data.tmt},
        radio_num = ${data.radioNum},
        rdo_days = ${serializeRdoDays(data.rdoDays)},
        default_zone = ${data.defaultZone},
        last_name = ${lastName}
      where id = ${data.id}
    `;
    return { ok: true };
  });

export const deleteOfficer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "manageRoster");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`delete from zone_assignments where officer_id = ${data.id}`;
    await sql`delete from time_off_requests where officer_id = ${data.id}`;
    await sql`delete from officers where id = ${data.id}`;
    return { ok: true };
  });

export const getSchedule = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }))
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "viewBoard");
    const shift = await currentShiftFor(context.userId);
    const weekStart = startOfWeek(data.weekStart);
    const weekEnd = addDays(weekStart, 6);
    const [officers, requests] = await Promise.all([
      loadOfficers(shift.id),
      loadRequests(shift.id),
    ]);
    const access = await accessFor(context.userId);
    const fullCalendar = await fetchCalendar(officers, weekStart, weekEnd, shift, access.caps.editWatch);
    // Schedule editors need calendar leave for coverage; others need calendar access.
    const calendar =
      access.caps.viewCalendar || access.caps.manageRoster
        ? fullCalendar
        : { ...fullCalendar, events: [] };
    const { loadAgency } = await import("@/lib/agencies");
    const agency = shift.agencyId ? await loadAgency(shift.agencyId) : await loadAgency("home");
    return {
      weekStart,
      officers,
      requests: hideOthersReasons(requests, access),
      calendar,
      effectiveDate: shift.effectiveDate,
      minWorking: shift.minWorking,
      shift,
      agency,
    };
  });

export const setMinWorking = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ min: z.number().int().min(1).max(30) }))
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "manageRoster");
    const shift = await currentShiftFor(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update shifts set min_working = ${data.min} where id = ${shift.id}
    `;
    return { min: data.min };
  });

export const getCalendarMonth = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    }),
  )
  .handler(async ({ data, context }) => {
    const access = await requireCap(context.userId, "viewCalendar");
    const shift = await currentShiftFor(context.userId);
    const [officers, allRequests] = await Promise.all([
      loadOfficers(shift.id),
      loadRequests(shift.id),
    ]);
    const requests = access.caps.approveRequests
      ? allRequests
      : hideOthersReasons(
          allRequests.filter((r) => r.status === "approved"),
          access,
        );
    const calendar = await fetchCalendar(officers, data.from, data.to, shift, access.caps.editWatch);
    return { officers, requests, calendar };
  });

export const getCalendarFeed = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const access = await requireCap(context.userId, "viewCalendar");
    const shift = await currentShiftFor(context.userId);
    const url = shift.calendarFeedUrl;
    let googleCalendarId = "primary";
    if (access.caps.editWatch) {
      const { getSql } = await import("@/lib/db");
      const sql = await getSql();
      const rows = await sql<{ google_calendar_id: string | null }>`
        select google_calendar_id from shifts where id = ${shift.id}
      `;
      googleCalendarId = rows[0]?.google_calendar_id || "primary";
    }
    return {
      url: access.caps.editWatch ? url : "",
      connected: Boolean(url) || Boolean(shift.googleCalendar),
      ics: Boolean(url),
      google: Boolean(shift.googleCalendar),
      googleCalendarId: access.caps.editWatch ? googleCalendarId : "",
      canConnect: access.caps.editWatch,
    };
  });

export const setCalendarFeed = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ url: z.string().max(2000) }))
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "editWatch");
    const shift = await currentShiftFor(context.userId);
    const raw = data.url.trim();
    const url = raw ? normalizeFeedUrl(raw) : "";
    if (url) {
      const probe = await fetch(url, {
        headers: { Accept: "text/calendar, text/plain, */*" },
        redirect: "follow",
        signal: AbortSignal.timeout(8000),
      });
      if (!probe.ok) {
        throw new Error(`Could not read that feed (${probe.status}). Check the secret iCal link.`);
      }
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update shifts set calendar_feed_url = ${url} where id = ${shift.id}
    `;
    return { url };
  });

export const connectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireCap(context.userId, "editWatch");
    const shift = await currentShiftFor(context.userId);
    return connectShiftGoogle(shift.id, context.userId);
  });

export const setGoogleCalendarId = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ calendarId: z.string().max(2000) }))
  .handler(async ({ data, context }) => {
    await requireCap(context.userId, "editWatch");
    const shift = await currentShiftFor(context.userId);
    return selectShiftGoogleCalendar(shift.id, data.calendarId);
  });

export const disconnectGoogleCalendar = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireCap(context.userId, "editWatch");
    const shift = await currentShiftFor(context.userId);
    await disconnectShiftGoogle(shift.id);
    return { connected: false };
  });
