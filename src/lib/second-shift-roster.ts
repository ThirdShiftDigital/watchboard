import { serializeRdoDays } from "@/lib/dates";
import { DEFAULT_ZONE_ORDER } from "@/lib/types";
import type { OfficerRole } from "@/lib/types";

type SheetOfficer = {
  name: string;
  unit: string;
  role: OfficerRole;
  hireDate: string;
  tmt: boolean;
  rdoDays: number[];
};

/** 2nd Shift RDO sheet. Vacant units 209, 216, 221 are omitted. */
export const SECOND_SHIFT_ROSTER: SheetOfficer[] = [
  { name: "LT. BRANDENBURG", unit: "205", role: "lt", hireDate: "2011-01-11", tmt: false, rdoDays: [5, 6] },
  { name: "SGT J. DENSON", unit: "206", role: "sgt", hireDate: "2008-07-21", tmt: false, rdoDays: [0, 1] },
  { name: "CPL. D. HUGGINS", unit: "207", role: "cpl", hireDate: "2018-10-22", tmt: false, rdoDays: [0, 1] },
  { name: "CPL/FTO. E. MYRICK", unit: "208", role: "cpl", hireDate: "2017-10-01", tmt: false, rdoDays: [5, 6] },
  { name: "L. MAYFIELD", unit: "210", role: "deputy", hireDate: "2024-01-17", tmt: false, rdoDays: [1, 2] },
  { name: "A. ALEXANDER", unit: "211", role: "deputy", hireDate: "2013-01-16", tmt: false, rdoDays: [0, 6] },
  { name: "M. CHRISTINA", unit: "212", role: "deputy", hireDate: "2022-11-27", tmt: false, rdoDays: [3, 4] },
  { name: "T. DAVENPORT", unit: "213", role: "deputy", hireDate: "2022-02-04", tmt: false, rdoDays: [4, 5] },
  { name: "C. BURNS", unit: "214", role: "deputy", hireDate: "2022-10-03", tmt: false, rdoDays: [1, 2] },
  { name: "G. MONTANA", unit: "215", role: "deputy", hireDate: "2024-06-24", tmt: false, rdoDays: [2, 3] },
  { name: "H. SCURLOCK", unit: "217", role: "deputy", hireDate: "2024-07-16", tmt: false, rdoDays: [3, 4] },
  { name: "J. ERIKSON", unit: "218", role: "deputy", hireDate: "2021-10-17", tmt: false, rdoDays: [0, 1] },
  { name: "B. SWAFFORD", unit: "219", role: "deputy", hireDate: "2023-07-16", tmt: false, rdoDays: [5, 6] },
  { name: "FTO D. MASSEY", unit: "220", role: "fto", hireDate: "2021-06-07", tmt: false, rdoDays: [0, 6] },
  { name: "M. BRADSHAW", unit: "222", role: "deputy", hireDate: "2025-04-21", tmt: false, rdoDays: [2, 3] },
  { name: "T. PAUL", unit: "223", role: "deputy", hireDate: "2025-06-09", tmt: true, rdoDays: [1, 2] },
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

export async function seedSecondShiftRoster() {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const first = await sql<{ id: string; agency_id: string | null; zone_order: string }>`
    select id, agency_id, zone_order from shifts
    where lower(regexp_replace(trim(name), '\\s+', ' ', 'g')) in ('first shift', '1st shift', '1st')
    order by created_at asc
    limit 1
  `;
  const agencyId = first[0]?.agency_id || "home";
  const zoneOrder = (first[0]?.zone_order || DEFAULT_ZONE_ORDER.join(",")).trim();

  let shift = (
    await sql<{ id: string }>`
      select id from shifts
      where lower(regexp_replace(trim(name), '\\s+', ' ', 'g')) in ('second shift', '2nd shift', '2nd')
        and (agency_id = ${agencyId} or agency_id is null)
      order by created_at asc
      limit 1
    `
  )[0];

  if (!shift) {
    await sql`
      insert into shifts (id, name, start_time, end_time, effective_date, min_working, zone_order, calendar_feed_url, agency_id)
      values (
        ${"second-shift"},
        ${"Second Shift"},
        ${"14:00"},
        ${"22:00"},
        ${"2026-09-14"},
        ${10},
        ${zoneOrder},
        ${""},
        ${agencyId}
      )
      on conflict (id) do update set
        name = ${"Second Shift"},
        agency_id = excluded.agency_id
    `;
    shift = { id: "second-shift" };
  } else {
    await sql`
      update shifts
      set name = ${"Second Shift"},
          agency_id = ${agencyId},
          min_working = ${10}
      where id = ${shift.id}
    `;
  }

  const shiftId = shift.id;
  const existing = await sql<{ id: string; unit: string }>`
    select id, unit from officers where shift_id = ${shiftId}
  `;
  const byUnit = new Map(existing.map((o) => [o.unit, o.id]));
  const taken = new Set(
    (await sql<{ id: string }>`select id from officers`).map((o) => o.id),
  );
  const keep = new Set<string>();

  for (const row of SECOND_SHIFT_ROSTER) {
    const lastName = lastNameOf(row.name);
    const rdo = serializeRdoDays(row.rdoDays);
    const rankSort = Number(row.unit);
    let id = byUnit.get(row.unit);
    if (!id) {
      const slug = lastName.toLowerCase().replace(/[^a-z0-9]/g, "") || `u${row.unit}`;
      id = taken.has(slug) ? `ss-${row.unit}` : slug;
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
}
