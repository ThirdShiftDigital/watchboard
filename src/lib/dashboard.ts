import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { accessFor, requireCap } from "@/lib/staff";
import { ensureAgencies, currentAgencyIdFor } from "@/lib/agencies";
import { ensureSetups } from "@/lib/setups";
import { loadShift } from "@/lib/shifts";
import { shiftHoursLabel } from "@/lib/types";

export const loadDashboard = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const access = await requireCap(context.userId, "manageAgency");
    await ensureAgencies();
    await ensureSetups();
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const owner = access.caps.managePlatform;
    const agencyId = access.agencyId || (await currentAgencyIdFor(context.userId));

    const agencies = owner
      ? await sql<{ id: string; name: string; short_name: string }>`
          select id, name, short_name from agencies order by name
        `
      : await sql<{ id: string; name: string; short_name: string }>`
          select id, name, short_name from agencies where id = ${agencyId}
        `;

    const shifts = owner
      ? await sql<{
          id: string;
          name: string;
          start_time: string;
          end_time: string;
          agency_id: string | null;
          min_working: number;
        }>`
          select id, name, start_time, end_time, agency_id, min_working from shifts
          order by name
        `
      : await sql<{
          id: string;
          name: string;
          start_time: string;
          end_time: string;
          agency_id: string | null;
          min_working: number;
        }>`
          select id, name, start_time, end_time, agency_id, min_working from shifts
          where agency_id = ${agencyId}
          order by name
        `;

    const officerCounts = await sql<{ shift_id: string; n: number }>`
      select shift_id, count(*)::int as n from officers group by shift_id
    `;
    const staffCounts = await sql<{ agency_id: string; n: number }>`
      select coalesce(agency_id, '') as agency_id, count(*)::int as n
      from staff_accounts group by agency_id
    `;
    const commanders = await sql<{ name: string; shift_id: string | null; agency_id: string | null }>`
      select name, shift_id, agency_id from staff_accounts
      where permission in ('admin', 'captain')
    `;
    const pending = owner
      ? await sql<{ n: number }>`select count(*)::int as n from setups where status = 'pending'`
      : await sql<{ n: number }>`
          select count(*)::int as n from setups
          where status = 'pending' and kind = 'shift' and agency_id = ${agencyId}
        `;

    const officerByShift = new Map(officerCounts.map((r) => [r.shift_id, r.n]));
    const staffByAgency = new Map(staffCounts.map((r) => [r.agency_id, r.n]));

    const shiftRows = shifts.map((s) => ({
      id: s.id,
      name: s.name,
      hours: shiftHoursLabel({ startTime: s.start_time, endTime: s.end_time }),
      startTime: s.start_time,
      endTime: s.end_time,
      agencyId: s.agency_id ?? "",
      minWorking: s.min_working,
      officers: officerByShift.get(s.id) ?? 0,
      commander:
        commanders.find((c) => c.shift_id === s.id)?.name ??
        commanders.find((c) => c.agency_id === s.agency_id)?.name ??
        "—",
    }));

    return {
      isOwner: owner,
      agencyAdmin: access.caps.manageAgency,
      currentAgencyId: agencyId,
      stats: {
        agencies: agencies.length,
        shifts: shifts.length,
        pending: pending[0]?.n ?? 0,
        people: owner
          ? staffCounts.reduce((n, r) => n + r.n, 0)
          : (staffByAgency.get(agencyId) ?? 0),
      },
      agencies: agencies.map((a) => ({
        id: a.id,
        name: a.name,
        shortName: a.short_name,
        shifts: shiftRows.filter((s) => s.agencyId === a.id).length,
        people: staffByAgency.get(a.id) ?? 0,
      })),
      shifts: shiftRows,
    };
  });

export const openShift = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ shiftId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const access = await accessFor(context.userId);
    const shift = await loadShift(data.shiftId);
    if (!shift) throw new Error("Shift not found.");
    if (
      !access.caps.managePlatform &&
      shift.agencyId &&
      shift.agencyId !== access.agencyId
    ) {
      throw new Error("That shift is not yours.");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    if (access.caps.managePlatform) {
      await sql`
        update staff_accounts
        set viewing_agency_id = ${shift.agencyId ?? null},
            active_shift_id = ${shift.id}
        where user_id = ${context.userId}
      `;
    } else {
      await sql`
        update staff_accounts
        set agency_id = ${shift.agencyId ?? access.agencyId},
            active_shift_id = ${shift.id}
        where user_id = ${context.userId}
      `;
    }
    return { shift };
  });

export const setAgencyAdmin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ userId: z.string().min(1), agencyId: z.string().min(1), on: z.boolean() }))
  .handler(async ({ context, data }) => {
    await requireCap(context.userId, "managePlatform");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      insert into agency_members (user_id, agency_id, permission, agency_admin)
      values (${data.userId}, ${data.agencyId}, ${"admin"}, ${data.on})
      on conflict (user_id, agency_id) do update set agency_admin = ${data.on}
    `;
    return { ok: true };
  });
