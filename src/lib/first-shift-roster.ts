import { serializeRdoDays } from "@/lib/dates";
import type { OfficerRole } from "@/lib/types";

type SheetOfficer = {
  name: string;
  unit: string;
  role: OfficerRole;
  hireDate: string;
  tmt: boolean;
  rdoDays: number[];
};

/** First Shift RDO sheet dated 9-06-2026. */
export const FIRST_SHIFT_ROSTER: SheetOfficer[] = [
  { name: "LT. D. HARVEY", unit: "105", role: "lt", hireDate: "2010-10-04", tmt: false, rdoDays: [0, 6] },
  { name: "SGT. J. SMITH", unit: "106", role: "sgt", hireDate: "2008-12-28", tmt: false, rdoDays: [5, 6] },
  { name: "CPL B. KLAWITTER", unit: "107", role: "cpl", hireDate: "2024-07-29", tmt: false, rdoDays: [0, 1] },
  { name: "CPL/FTO C. BURT", unit: "121", role: "cpl", hireDate: "2016-05-19", tmt: true, rdoDays: [0, 1] },
  { name: "FTO B. CRUNK", unit: "110", role: "fto", hireDate: "2022-01-09", tmt: false, rdoDays: [1, 2] },
  { name: "FTO R. PIERCE", unit: "111", role: "fto", hireDate: "2016-01-25", tmt: true, rdoDays: [4, 5] },
  { name: "T. PARROTT", unit: "112", role: "deputy", hireDate: "2022-03-20", tmt: false, rdoDays: [1, 2] },
  { name: "M. BLAIR", unit: "113", role: "deputy", hireDate: "2016-03-14", tmt: false, rdoDays: [5, 6] },
  { name: "R. SEAY", unit: "114", role: "deputy", hireDate: "2007-04-24", tmt: false, rdoDays: [0, 6] },
  { name: "N. MONTOYA", unit: "115", role: "deputy", hireDate: "2009-07-07", tmt: false, rdoDays: [0, 6] },
  { name: "T. WOODS", unit: "116", role: "deputy", hireDate: "2020-03-21", tmt: false, rdoDays: [3, 4] },
  { name: "J. PARADIS", unit: "117", role: "deputy", hireDate: "2015-09-21", tmt: false, rdoDays: [2, 3] },
  { name: "C. HIRT", unit: "118", role: "deputy", hireDate: "2024-12-02", tmt: false, rdoDays: [3, 4] },
  { name: "C. BRUMMETT", unit: "119", role: "deputy", hireDate: "2015-12-28", tmt: false, rdoDays: [4, 5] },
  { name: "N. MORSE", unit: "120", role: "deputy", hireDate: "2016-03-21", tmt: false, rdoDays: [2, 3] },
  { name: "FTO S. BURTON", unit: "122", role: "fto", hireDate: "2019-10-20", tmt: false, rdoDays: [5, 6] },
  { name: "H. MATHIS", unit: "123", role: "deputy", hireDate: "2015-10-12", tmt: false, rdoDays: [0, 1] },
];

function lastNameOf(name: string): string {
  return (
    name
      .replace(/[.,]/g, " ")
      .trim()
      .split(/\s+/)
      .pop() ?? name
  ).toUpperCase();
}

export async function seedFirstShiftRoster() {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const shifts = await sql<{ id: string; name: string }>`
    select id, name from shifts
    where lower(regexp_replace(trim(name), '\\s+', ' ', 'g')) in ('first shift', '1st shift', '1st')
    order by created_at desc
  `;
  const named = shifts[0]?.id;
  const harveyShift = named
    ? null
    : (
        await sql<{ shift_id: string | null }>`
          select shift_id from staff_accounts
          where name ilike '%harvey%' and permission = 'admin'
          limit 1
        `
      )[0]?.shift_id;
  const shiftId = named || harveyShift;
  if (!shiftId) return;

  await sql`
    update shifts
    set name = ${"First Shift"},
        effective_date = ${"2026-09-06"},
        min_working = ${11}
    where id = ${shiftId}
  `;

  const existing = await sql<{ id: string; unit: string }>`
    select id, unit from officers where shift_id = ${shiftId}
  `;
  const byUnit = new Map(existing.map((o) => [o.unit, o.id]));
  const taken = new Set(
    (await sql<{ id: string }>`select id from officers`).map((o) => o.id),
  );
  const keep = new Set<string>();

  for (const row of FIRST_SHIFT_ROSTER) {
    const lastName = lastNameOf(row.name);
    const rdo = serializeRdoDays(row.rdoDays);
    const rankSort = Number(row.unit);
    let id = byUnit.get(row.unit);
    if (!id) {
      const slug = lastName.toLowerCase().replace(/[^a-z0-9]/g, "") || `u${row.unit}`;
      id = taken.has(slug) ? `fs-${row.unit}` : slug;
      taken.add(id);
      await sql`
        insert into officers (id, name, unit, rank_sort, role, hire_date, tmt, radio_num, rdo_days, default_zone, last_name, shift_id)
        values (
          ${id},
          ${row.name},
          ${row.unit},
          ${rankSort},
          ${row.role},
          ${row.hireDate},
          ${row.tmt},
          ${null},
          ${rdo},
          ${null},
          ${lastName},
          ${shiftId}
        )
      `;
    } else {
      await sql`
        update officers
        set name = ${row.name},
            unit = ${row.unit},
            rank_sort = ${rankSort},
            role = ${row.role},
            hire_date = ${row.hireDate},
            tmt = ${row.tmt},
            rdo_days = ${rdo},
            default_zone = ${null},
            last_name = ${lastName},
            shift_id = ${shiftId}
        where id = ${id}
      `;
    }
    keep.add(id);
  }

  const drop = existing.filter((o) => !keep.has(o.id)).map((o) => o.id);
  for (const id of drop) {
    await sql`delete from zone_assignments where officer_id = ${id}`;
    await sql`delete from time_off_requests where officer_id = ${id}`;
    await sql`update staff_accounts set officer_id = null where officer_id = ${id}`;
    await sql`delete from officers where id = ${id}`;
  }

  const harvey = FIRST_SHIFT_ROSTER.find((o) => o.unit === "105");
  if (harvey) {
    const harveyOfficer = await sql<{ id: string }>`
      select id from officers where shift_id = ${shiftId} and unit = ${"105"} limit 1
    `;
    if (harveyOfficer[0]) {
      await sql`
        update staff_accounts
        set name = ${harvey.name},
            permission = ${"admin"},
            shift_id = ${shiftId},
            active_shift_id = ${shiftId},
            officer_id = ${harveyOfficer[0].id}
        where name ilike '%harvey%' or email ilike '%harvey%'
      `;
    }
  }
}