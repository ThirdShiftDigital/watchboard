import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureTables, requireCap, accessFor } from "@/lib/staff";
import { currentAgencyIdFor, ensureAgencies } from "@/lib/agencies";
import {
  DEFAULT_ZONE_ORDER,
  STARTER_ZONES,
  normalizeZoneOrder,
  type Shift,
} from "@/lib/types";

export const DEFAULT_SHIFT_ID = "first-shift";

type ShiftRow = {
  id: string;
  name: string;
  start_time: string;
  end_time: string;
  effective_date: string | null;
  min_working: number;
  zone_order: string;
  calendar_feed_url: string;
  agency_id: string | null;
  google_calendar?: boolean | null;
};

export function mapShift(row: ShiftRow): Shift {
  const raw = (row.zone_order ?? "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  return {
    id: row.id,
    name: row.name,
    startTime: row.start_time || "14:00",
    endTime: row.end_time || "02:00",
    effectiveDate: row.effective_date ?? "",
    minWorking: Number.isFinite(Number(row.min_working)) ? Number(row.min_working) : 10,
    zoneOrder: (() => {
      const order = normalizeZoneOrder(raw);
      if (order.length) return order;
      return row.id === DEFAULT_SHIFT_ID ? [...DEFAULT_ZONE_ORDER] : [];
    })(),
    calendarFeedUrl: row.calendar_feed_url ?? "",
    googleCalendar: Boolean(row.google_calendar),
    agencyId: row.agency_id ?? undefined,
  };
}

export async function ensureShifts() {
  await ensureTables();
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql.query(`
    create table if not exists shifts (
      id                 text primary key,
      name               text not null,
      start_time         text not null default '14:00',
      end_time           text not null default '02:00',
      effective_date     text,
      min_working        integer not null default 10,
      zone_order         text not null default '',
      calendar_feed_url  text not null default '',
      created_at         timestamptz not null default now()
    )
  `);
  await sql.query(`alter table officers add column if not exists shift_id text`);
  await sql.query(`alter table staff_accounts add column if not exists shift_id text`);
  await sql.query(`alter table staff_accounts add column if not exists active_shift_id text`);
  await sql.query(`alter table shifts add column if not exists agency_id text`);
  await sql.query(`alter table shifts add column if not exists google_calendar boolean not null default false`);
  await sql.query(`alter table shifts add column if not exists google_access_token text`);
  await sql.query(`alter table shifts add column if not exists google_refresh_token text`);
  await sql.query(`alter table shifts add column if not exists google_token_expiry text`);
  await sql.query(`alter table shifts add column if not exists google_calendar_id text`);
  await sql.query(`alter table shifts add column if not exists google_connected_by text`);
  await sql.query(`
    create table if not exists calendar_cache (
      shift_id   text not null,
      event_id   text not null,
      title      text not null,
      start_at   text not null,
      end_at     text,
      all_day    boolean not null default true,
      primary key (shift_id, event_id)
    )
  `);
  await ensureAgencies();
  const existing = await sql<{ n: number }>`select count(*)::int as n from shifts`;
  if ((existing[0]?.n ?? 0) === 0) {
    const meta = await sql<{ key: string; value: string }>`select key, value from schedule_meta`;
    const get = (k: string) => meta.find((r) => r.key === k)?.value ?? "";
    const min = Number.parseInt(get("min_working") || "10", 10);
    await sql`
      insert into shifts (id, name, start_time, end_time, effective_date, min_working, zone_order, calendar_feed_url, agency_id)
      values (
        ${DEFAULT_SHIFT_ID},
        ${"Watch"},
        ${"14:00"},
        ${"02:00"},
        ${get("effective_date") || "2026-08-30"},
        ${Number.isFinite(min) ? min : 10},
        ${get("zone_order")},
        ${get("calendar_feed_url")},
        ${"home"}
      )
    `;
  }
  await sql`
    update shifts
    set name = ${"First Shift"}
    where lower(regexp_replace(trim(name), '\\s+', ' ', 'g')) in ('1st shift', '1st', 'first shift')
  `;
  await sql`
    update staff_accounts
    set shift_id = null
    where permission = ${"captain"}
      and coalesce(is_owner, false) = false
  `;
  await sql`
    update staff_accounts
    set active_shift_id = shift_id
    where (active_shift_id is null or active_shift_id = '')
      and shift_id is not null
      and shift_id <> ''
      and coalesce(is_owner, false) = false
      and permission <> ${"captain"}
  `;
  const { seedFirstShiftRoster } = await import("@/lib/first-shift-roster");
  await seedFirstShiftRoster();
  const { seedSecondShiftRoster } = await import("@/lib/second-shift-roster");
  await seedSecondShiftRoster();
  try {
    const { seedThirdShiftRoster } = await import("@/lib/third-shift-roster");
    await seedThirdShiftRoster();
  } catch (err) {
    console.error("[ensureShifts] third-shift roster seed failed", err);
  }
}

export async function listShiftRows(agencyId?: string): Promise<Shift[]> {
  await ensureShifts();
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = agencyId
    ? await sql<ShiftRow>`
        select id, name, start_time, end_time, effective_date, min_working, zone_order, calendar_feed_url, agency_id, google_calendar
        from shifts
        where agency_id = ${agencyId} or agency_id is null
        order by start_time asc, name asc
      `
    : await sql<ShiftRow>`
        select id, name, start_time, end_time, effective_date, min_working, zone_order, calendar_feed_url, agency_id, google_calendar
        from shifts
        order by start_time asc, name asc
      `;
  return rows.map(mapShift);
}

export async function loadShift(id: string): Promise<Shift | null> {
  await ensureShifts();
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<ShiftRow>`
    select id, name, start_time, end_time, effective_date, min_working, zone_order, calendar_feed_url, agency_id, google_calendar
    from shifts
    where id = ${id}
  `;
  return rows[0] ? mapShift(rows[0]) : null;
}

export async function activeShiftIdFor(userId: string): Promise<string> {
  await ensureShifts();
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{
    active_shift_id: string | null;
    shift_id: string | null;
    agency_id: string | null;
    viewing_agency_id: string | null;
    is_owner: boolean | null;
  }>`
    select active_shift_id, shift_id, agency_id, viewing_agency_id, is_owner
    from staff_accounts where user_id = ${userId}
  `;
  const agencyId = rows[0]?.is_owner
    ? rows[0]?.viewing_agency_id
    : rows[0]?.agency_id;
  const preferred = rows[0]?.active_shift_id || rows[0]?.shift_id;
  if (preferred) {
    const exists = agencyId
      ? await sql<{ id: string }>`
          select id from shifts where id = ${preferred} and agency_id = ${agencyId}
        `
      : await sql<{ id: string }>`select id from shifts where id = ${preferred}`;
    if (exists[0]) return exists[0].id;
  }
  if (agencyId) {
    const first = await sql<{ id: string }>`
      select id from shifts where agency_id = ${agencyId} order by created_at asc limit 1
    `;
    return first[0]?.id ?? "";
  }
  const fallback = await sql<{ id: string }>`select id from shifts order by created_at asc limit 1`;
  return fallback[0]?.id ?? DEFAULT_SHIFT_ID;
}

export async function currentShiftFor(userId: string): Promise<Shift> {
  const id = await activeShiftIdFor(userId);
  if (id) {
    const loaded = await loadShift(id);
    if (loaded) return loaded;
  }
  return {
    id: DEFAULT_SHIFT_ID,
    name: "No shift yet",
    startTime: "06:00",
    endTime: "18:00",
    effectiveDate: "",
    minWorking: 10,
    zoneOrder: [...STARTER_ZONES],
    calendarFeedUrl: "",
  };
}

function slugShift(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "shift";
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

const timeRe = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export function normalizeClock(value: string): string {
  const m = value.trim().match(/^(\d{1,2}):([0-5]\d)/);
  if (!m) return value.slice(0, 5);
  return `${m[1]!.padStart(2, "0")}:${m[2]}`;
}

export const listShifts = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const access = await accessFor(context.userId);
    const shifts = await listShiftRows(await currentAgencyIdFor(context.userId));
    const currentId = await activeShiftIdFor(context.userId);
    const home = access.shiftId || access.activeShiftId || currentId;
    const visible =
      access.caps.manageAgency || access.caps.managePlatform
        ? shifts
        : shifts.filter((s) => s.id === home || s.id === currentId);
    return { shifts: visible, currentId };
  });

export const switchShift = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ shiftId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    await requireCap(context.userId, "viewBoard");
    const access = await accessFor(context.userId);
    const shift = await loadShift(data.shiftId);
    if (!shift) throw new Error("Shift not found.");
    const agencyId = await currentAgencyIdFor(context.userId);
    if (!access.caps.managePlatform && shift.agencyId && shift.agencyId !== agencyId) {
      throw new Error("That shift belongs to another agency.");
    }
    if (!access.caps.manageAgency && !access.caps.managePlatform) {
      const home = access.shiftId || access.activeShiftId;
      if (home && shift.id !== home && shift.id !== access.activeShiftId) {
        throw new Error("You can only work your own shift.");
      }
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    if (access.caps.managePlatform) {
      await sql`
        update staff_accounts
        set active_shift_id = ${shift.id},
            viewing_agency_id = ${shift.agencyId ?? null}
        where user_id = ${context.userId}
      `;
    } else {
      await sql`
        update staff_accounts
        set active_shift_id = ${shift.id}
        where user_id = ${context.userId}
      `;
    }
    return { shift };
  });

export async function commitNewShift(
  userId: string,
  data: {
    name: string;
    startTime: string;
    endTime: string;
    effectiveDate: string;
    minWorking: number;
    zoneOrder: string[];
    copyRoster: boolean;
    agencyId?: string;
  },
) {
  await ensureShifts();
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const agencyId = data.agencyId?.trim();
  if (!agencyId) throw new Error("Pick the agency this shift belongs to.");
  const existing = await sql<{ id: string }>`select id from shifts`;
  const id = slugShift(data.name, new Set(existing.map((r) => r.id)));
  const zoneOrder = normalizeZoneOrder(data.zoneOrder).join(",");
  await sql`
    insert into shifts (id, name, start_time, end_time, effective_date, min_working, zone_order, calendar_feed_url, agency_id)
    values (
      ${id},
      ${data.name.trim()},
      ${data.startTime},
      ${data.endTime},
      ${data.effectiveDate},
      ${data.minWorking},
      ${zoneOrder},
      ${""},
      ${agencyId}
    )
  `;
  if (data.copyRoster) {
    const fromId = await activeShiftIdFor(userId);
    const officers = await sql<OfficerCopy>`
      select id, name, unit, rank_sort, role, hire_date, tmt, radio_num, rdo_days, default_zone, last_name
      from officers
      where shift_id = ${fromId}
      order by rank_sort
    `;
    const taken = new Set(officers.map((o) => o.id));
    for (const o of officers) {
      let newId = `${o.id}__${id}`;
      if (taken.has(newId)) newId = `${o.id}-${Date.now().toString(36)}`;
      taken.add(newId);
      await sql`
        insert into officers (id, name, unit, rank_sort, role, hire_date, tmt, radio_num, rdo_days, default_zone, last_name, shift_id)
        values (
          ${newId},
          ${o.name},
          ${o.unit},
          ${o.rank_sort},
          ${o.role},
          ${o.hire_date},
          ${o.tmt},
          ${o.radio_num},
          ${o.rdo_days},
          ${o.default_zone},
          ${o.last_name},
          ${id}
        )
      `;
    }
  }
  return { id, agencyId };
}

const shiftCreateInput = z.object({
  name: z.string().min(2).max(60),
  startTime: z.string().min(4),
  endTime: z.string().min(4),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  minWorking: z.number().int().min(1).max(30),
  zoneOrder: z.array(z.string().min(1)).min(1).optional(),
  copyRoster: z.boolean(),
  agencyId: z.string().min(1).optional(),
  commanderName: z.string().min(2).max(80),
  commanderEmail: z.string().email(),
  commanderPassword: z.string().min(8).max(72),
});

export async function saveLiveShift(
  userId: string,
  data: z.infer<typeof shiftCreateInput>,
) {
  const access = await accessFor(userId);
  if (!access.caps.manageAgency) {
    throw new Error("Only a division leader or the operator can add a shift.");
  }
  const agencyId = data.agencyId || (await currentAgencyIdFor(userId));
  if (!agencyId) throw new Error("Pick the agency this shift belongs to.");
  if (!access.caps.managePlatform && access.agencyId && agencyId !== access.agencyId) {
    throw new Error("That agency is not yours.");
  }
  const created = await commitNewShift(userId, {
    name: data.name,
    startTime: normalizeClock(data.startTime),
    endTime: normalizeClock(data.endTime),
    effectiveDate: data.effectiveDate,
    minWorking: data.minWorking,
    zoneOrder: data.zoneOrder?.length ? data.zoneOrder : [...STARTER_ZONES],
    copyRoster: data.copyRoster,
    agencyId,
  });
  const { provisionShiftCommander } = await import("@/lib/staff");
  const commander = await provisionShiftCommander({
    name: data.commanderName,
    email: data.commanderEmail,
    password: data.commanderPassword,
    shiftId: created.id,
    agencyId: created.agencyId,
  });
  return { id: created.id, agencyId: created.agencyId, commander };
}

export const createShift = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(shiftCreateInput)
  .handler(async ({ context, data }) => saveLiveShift(context.userId, data));

type OfficerCopy = {
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

export const updateShiftSettings = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      shiftId: z.string().min(1).optional(),
      name: z.string().min(2).max(60).optional(),
      startTime: z.string().regex(timeRe).optional(),
      endTime: z.string().regex(timeRe).optional(),
      effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      minWorking: z.number().int().min(1).max(30).optional(),
      zoneOrder: z.array(z.string().min(1)).optional(),
      calendarFeedUrl: z.string().max(2000).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const access = await accessFor(context.userId);
    const shift = data.shiftId
      ? await loadShift(data.shiftId)
      : await currentShiftFor(context.userId);
    if (!shift) throw new Error("Shift not found.");
    const currentId = await activeShiftIdFor(context.userId);
    const sameAgency = Boolean(shift.agencyId && access.agencyId && shift.agencyId === access.agencyId);
    const canEdit =
      access.caps.managePlatform ||
      (access.caps.manageAgency && sameAgency) ||
      (access.caps.manageRoster && shift.id === currentId);
    if (!canEdit) throw new Error("You cannot change this shift’s hours.");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const name = data.name?.trim() || shift.name;
    const startTime = data.startTime ? normalizeClock(data.startTime) : shift.startTime;
    const endTime = data.endTime ? normalizeClock(data.endTime) : shift.endTime;
    const effectiveDate = data.effectiveDate ?? shift.effectiveDate;
    const minWorking = data.minWorking ?? shift.minWorking;
    const zoneOrder = data.zoneOrder
      ? normalizeZoneOrder(data.zoneOrder).join(",")
      : shift.zoneOrder.join(",");
    const calendarFeedUrl =
      data.calendarFeedUrl === undefined ? shift.calendarFeedUrl : data.calendarFeedUrl;
    await sql`
      update shifts
      set name = ${name},
          start_time = ${startTime},
          end_time = ${endTime},
          effective_date = ${effectiveDate},
          min_working = ${minWorking},
          zone_order = ${zoneOrder},
          calendar_feed_url = ${calendarFeedUrl}
      where id = ${shift.id}
    `;
    return { ok: true, id: shift.id, startTime, endTime, name };
  });
