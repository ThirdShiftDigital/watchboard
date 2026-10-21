/**
 * Overtime & swaps server functions. Supervisors and up (cap `overtimeSwaps`)
 * enter them for officers on the shift they are working / viewing. Nothing is
 * written to Google Calendar, so calendar name-matching never sees these.
 *
 * The exported `*For(userId, …)` cores are what the server functions run; the
 * integration tests call them directly.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { addDays, todayISO } from "@/lib/dates";
import { authMiddleware } from "@/lib/auth/middleware";
import { requireCap, officerPlacement } from "@/lib/staff";
import { activeShiftIdFor, requireCurrentShift, currentShiftFor } from "@/lib/shifts";
import { recordOffAudit } from "@/lib/off-audit";
import { loadShiftOfficers, loadShiftRequests } from "@/lib/fns";
import {
  overrideBlock,
  planOvertime,
  planPayback,
  planSwap,
  summarizeSwaps,
  type OverrideRowSpec,
} from "@/lib/duty-overrides";
import {
  OVERRIDES_NOT_READY,
  isMissingTable,
  loadOverrides,
  loadShiftSwaps,
  mapOverride,
} from "@/lib/overrides-db";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

async function scopeFor(userId: string, officerIds: string[]) {
  const access = await requireCap(userId, "overtimeSwaps");
  const shift = await requireCurrentShift(userId);
  const actorShiftId = (await activeShiftIdFor(userId)) || null;
  for (const id of officerIds) {
    const block = overrideBlock({
      caps: access.caps,
      officer: await officerPlacement(id),
      actorAgencyId: access.agencyId,
      actorShiftId,
    });
    if (block) throw new Error(block);
  }
  const [officers, requests] = await Promise.all([
    loadShiftOfficers(shift.id),
    loadShiftRequests(shift.id),
  ]);
  for (const id of officerIds) {
    if (!officers.some((o) => o.id === id)) throw new Error("That officer is not on this shift’s schedule.");
  }
  return { access, shift, officers, requests };
}

async function insertRows(rows: OverrideRowSpec[], shiftId: string, userId: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  // One statement, so a swap pair (and its payback) lands all-or-nothing.
  const params: unknown[] = [];
  const tuples = rows.map((r) => {
    const base = params.length;
    params.push(shiftId, r.officerId, r.date, r.status, r.kind, r.partnerOfficerId, r.swapGroup, r.isPayback, r.reason, userId);
    return `(${Array.from({ length: 10 }, (_, i) => `$${base + i + 1}`).join(", ")})`;
  });
  let inserted: Array<{ id: number; officer_id: string; date: string; status: string; kind: string; is_payback: boolean }> = [];
  try {
    inserted = (await sql.query(
      `insert into duty_overrides
         (shift_id, officer_id, date, status, kind, partner_officer_id, swap_group, is_payback, reason, created_by)
       values ${tuples.join(", ")}
       returning id, officer_id, date, status, kind, is_payback`,
      params,
    )) as typeof inserted;
  } catch (err) {
    if (isMissingTable(err)) throw new Error(OVERRIDES_NOT_READY);
    const e = err as { code?: string };
    if (e?.code === "23505") throw new Error("Someone already has an overtime or swap entry on that date.");
    throw err;
  }
  for (const r of inserted) {
    await recordOffAudit({
      entityType: "override",
      entityId: r.id,
      officerId: r.officer_id,
      shiftId,
      action: "created",
      actorUserId: userId,
      after: { date: r.date, status: r.status, kind: r.kind, payback: Boolean(r.is_payback) },
      summary: `${r.kind === "ot" ? "Overtime" : r.is_payback ? "Swap payback" : "Swap"}: ${r.status === "off" ? "off" : "working"} ${r.date}`,
    });
  }
  // Anyone now off loses a posted zone for that date.
  for (const r of rows.filter((x) => x.status === "off")) {
    await sql`delete from zone_assignments where officer_id = ${r.officerId} and date = ${r.date}`;
  }
}

/** Overrides near the dates being changed — enough to catch conflicts. */
async function nearby(shiftId: string, dates: string[]) {
  const sorted = [...dates].sort();
  return loadOverrides(shiftId, sorted[0]!, sorted[sorted.length - 1]!);
}

function newGroup(): string {
  return `swp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function createOvertimeFor(
  userId: string,
  data: { officerId: string; date: string; reason?: string },
) {
  const { shift, officers, requests } = await scopeFor(userId, [data.officerId]);
  const officer = officers.find((o) => o.id === data.officerId)!;
  const overrides = await nearby(shift.id, [data.date]);
  const plan = planOvertime({ officer, date: data.date, reason: data.reason, requests, overrides });
  if ("error" in plan) throw new Error(plan.error);
  await insertRows(plan.rows, shift.id, userId);
  return { ok: true as const };
}

export async function createSwapFor(
  userId: string,
  data: { officerId: string; partnerId: string; date: string; paybackDate?: string | null; reason?: string },
) {
  const { shift, officers, requests } = await scopeFor(userId, [data.officerId, data.partnerId]);
  const worker = officers.find((o) => o.id === data.officerId)!;
  const partner = officers.find((o) => o.id === data.partnerId)!;
  const overrides = await nearby(shift.id, [data.date, ...(data.paybackDate ? [data.paybackDate] : [])]);
  const swapGroup = newGroup();
  const plan = planSwap({
    worker,
    partner,
    date: data.date,
    paybackDate: data.paybackDate,
    reason: data.reason,
    swapGroup,
    requests,
    overrides,
  });
  if ("error" in plan) throw new Error(plan.error);
  await insertRows(plan.rows, shift.id, userId);
  return { ok: true as const, swapGroup };
}

async function loadGroup(swapGroup: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  try {
    const rows = await sql<Parameters<typeof mapOverride>[0]>`
      select id, officer_id, date, status, kind, partner_officer_id, swap_group, is_payback, reason
      from duty_overrides where swap_group = ${swapGroup} order by date asc, id asc
    `;
    return rows.map(mapOverride);
  } catch (err) {
    if (isMissingTable(err)) throw new Error(OVERRIDES_NOT_READY);
    throw err;
  }
}

export async function addSwapPaybackFor(userId: string, data: { swapGroup: string; paybackDate: string }) {
  const group = await loadGroup(data.swapGroup);
  if (!group.length) throw new Error("Swap not found.");
  const ids = [...new Set(group.map((g) => g.officerId))];
  const { shift, officers, requests } = await scopeFor(userId, ids);
  const overrides = await nearby(shift.id, [data.paybackDate]);
  const plan = planPayback({ group, officers, paybackDate: data.paybackDate, requests, overrides });
  if ("error" in plan) throw new Error(plan.error);
  await insertRows(plan.rows, shift.id, userId);
  return { ok: true as const };
}

/** Removes one OT entry, or a whole swap group (both sides + payback). */
export async function removeOverrideFor(userId: string, data: { id: number }) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  let target: ReturnType<typeof mapOverride> | undefined;
  try {
    const rows = await sql<Parameters<typeof mapOverride>[0]>`
      select id, officer_id, date, status, kind, partner_officer_id, swap_group, is_payback, reason
      from duty_overrides where id = ${data.id}
    `;
    target = rows[0] ? mapOverride(rows[0]) : undefined;
  } catch (err) {
    if (isMissingTable(err)) throw new Error(OVERRIDES_NOT_READY);
    throw err;
  }
  if (!target) throw new Error("That entry is already gone.");
  const group = target.swapGroup ? await loadGroup(target.swapGroup) : [target];
  await scopeFor(userId, [...new Set(group.map((g) => g.officerId))]);
  // Officers who were on duty only because of these rows lose that day's zone.
  for (const g of group.filter((x) => x.status === "working")) {
    await sql`delete from zone_assignments where officer_id = ${g.officerId} and date = ${g.date}`;
  }
  for (const g of group) {
    await recordOffAudit({
      entityType: "override",
      entityId: g.id,
      officerId: g.officerId,
      action: "removed",
      actorUserId: userId,
      before: { date: g.date, status: g.status, kind: g.kind },
      summary: `Removed ${g.kind === "ot" ? "overtime" : "swap"} (${g.status} ${g.date})`,
    });
  }
  if (target.swapGroup) {
    await sql`delete from duty_overrides where swap_group = ${target.swapGroup}`;
  } else {
    await sql`delete from duty_overrides where id = ${target.id}`;
  }
  return { removed: group.length };
}

export async function listSwapsFor(userId: string) {
  await requireCap(userId, "overtimeSwaps");
  const shift = await currentShiftFor(userId);
  const [officers, rows] = await Promise.all([loadShiftOfficers(shift.id), loadShiftSwaps(shift.id)]);
  const today = todayISO();
  // Keep the list out of the way: everything still owed or upcoming, plus the last 60 days.
  const since = addDays(today, -60);
  const swaps = summarizeSwaps(rows, officers, today).filter(
    (s) => s.state !== "done" || (s.payback?.date ?? s.date) >= since,
  );
  const groupIds = new Map(rows.filter((r) => !r.isPayback && r.status === "working").map((r) => [r.swapGroup, r.id]));
  return { swaps: swaps.map((s) => ({ ...s, removeId: groupIds.get(s.swapGroup) ?? null })) };
}

export const createOvertime = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ officerId: z.string().min(1), date: isoDate, reason: z.string().max(140).optional() }))
  .handler(({ data, context }) => createOvertimeFor(context.userId, data));

export const createSwap = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      officerId: z.string().min(1),
      partnerId: z.string().min(1),
      date: isoDate,
      paybackDate: isoDate.nullable().optional(),
      reason: z.string().max(140).optional(),
    }),
  )
  .handler(({ data, context }) => createSwapFor(context.userId, data));

export const addSwapPayback = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ swapGroup: z.string().min(1).max(64), paybackDate: isoDate }))
  .handler(({ data, context }) => addSwapPaybackFor(context.userId, data));

export const removeOverride = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.number().int().positive() }))
  .handler(({ data, context }) => removeOverrideFor(context.userId, data));

export const listSwaps = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(({ context }) => listSwapsFor(context.userId));
