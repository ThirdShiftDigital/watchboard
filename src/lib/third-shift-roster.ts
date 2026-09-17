import { serializeRdoDays } from "@/lib/dates";
import { DEFAULT_ZONE_ORDER } from "@/lib/types";
import type { OfficerRole } from "@/lib/types";

type SheetOfficer = {
  name: string;
  unit: string;
  role: OfficerRole;
  hireDate: string;
  tmt: boolean;
  radioNum: number | null;
  rdoDays: number[];
};

/** 3rd Shift RDO sheet effective 08/30/2026 (updated 9/16/2026). */
export const THIRD_SHIFT_ROSTER: SheetOfficer[] = [
  { name: "LT. C. KEYES", unit: "305", role: "lt", hireDate: "2007-05-14", tmt: false, radioNum: null, rdoDays: [5, 6] },
  { name: "SGT. R. JOHNSON", unit: "306", role: "sgt", hireDate: "1997-04-17", tmt: false, radioNum: null, rdoDays: [0, 6] },
  { name: "CPL. S. HENRY", unit: "307", role: "cpl", hireDate: "2022-06-05", tmt: true, radioNum: null, rdoDays: [4, 5] },
  { name: "CPL/FTO J. GARMON", unit: "308", role: "cpl", hireDate: "2017-02-01", tmt: false, radioNum: null, rdoDays: [0, 1] },
  { name: "R. MEANS", unit: "309", role: "deputy", hireDate: "2024-12-01", tmt: false, radioNum: 8, rdoDays: [1, 2] },
  { name: "FTO. A. GRIESE", unit: "310", role: "fto", hireDate: "2021-02-07", tmt: false, radioNum: 1, rdoDays: [5, 6] },
  { name: "D. HILL", unit: "311", role: "deputy", hireDate: "2025-02-03", tmt: false, radioNum: 9, rdoDays: [2, 3] },
  { name: "J. GAINEY", unit: "312", role: "deputy", hireDate: "2025-03-31", tmt: false, radioNum: 10, rdoDays: [1, 2] },
  { name: "J. HUDGENS", unit: "313", role: "deputy", hireDate: "2021-04-25", tmt: false, radioNum: 3, rdoDays: [0, 6] },
  { name: "J. SCOTT", unit: "314", role: "deputy", hireDate: "2024-05-07", tmt: false, radioNum: 7, rdoDays: [3, 4] },
  { name: "T. BRAZELTON", unit: "315", role: "deputy", hireDate: "2022-10-10", tmt: true, radioNum: 5, rdoDays: [3, 4] },
  { name: "A. ANDERSON", unit: "316", role: "deputy", hireDate: "2023-04-09", tmt: false, radioNum: 6, rdoDays: [1, 2] },
  { name: "S. METCALF", unit: "317", role: "deputy", hireDate: "2021-02-07", tmt: false, radioNum: 2, rdoDays: [0, 6] },
  { name: "D. HARRIS", unit: "318", role: "deputy", hireDate: "2022-08-07", tmt: false, radioNum: 4, rdoDays: [0, 1] },
  { name: "R. LADD", unit: "319", role: "deputy", hireDate: "2022-06-12", tmt: true, radioNum: 3, rdoDays: [4, 5] },
  { name: "B. DODSON", unit: "320", role: "deputy", hireDate: "2026-08-03", tmt: false, radioNum: 11, rdoDays: [2, 3] },
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

/** Ensure Third Shift (22:00–06:00) exists and sync the RDO sheet roster. */
export async function seedThirdShiftRoster() {
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
      where lower(regexp_replace(trim(name), '\\s+', ' ', 'g')) in ('third shift', '3rd shift', '3rd')
        and (agency_id = ${agencyId} or agency_id is null)
      order by created_at asc
      limit 1
    `
  )[0];

  if (!shift) {
    await sql`
      insert into shifts (id, name, start_time, end_time, effective_date, min_working, zone_order, calendar_feed_url, agency_id)
      values (
        ${"third-shift"},
        ${"Third Shift"},
        ${"22:00"},
        ${"06:00"},
        ${"2026-08-30"},
        ${10},
        ${zoneOrder},
        ${""},
        ${agencyId}
      )
      on conflict (id) do update set
        name = ${"Third Shift"},
        start_time = ${"22:00"},
        end_time = ${"06:00"},
        agency_id = excluded.agency_id,
        zone_order = excluded.zone_order
    `;
    shift = { id: "third-shift" };
  } else {
    await sql`
      update shifts
      set name = ${"Third Shift"},
          start_time = ${"22:00"},
          end_time = ${"06:00"},
          agency_id = ${agencyId},
          min_working = ${10},
          effective_date = coalesce(nullif(trim(effective_date), ''), ${"2026-08-30"}),
          zone_order = case
            when coalesce(trim(zone_order), '') = '' then ${zoneOrder}
            else zone_order
          end
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

  for (const row of THIRD_SHIFT_ROSTER) {
    const lastName = lastNameOf(row.name);
    const rdo = serializeRdoDays(row.rdoDays);
    const rankSort = Number(row.unit);
    let id = byUnit.get(row.unit);
    if (!id) {
      const slug = lastName.toLowerCase().replace(/[^a-z0-9]/g, "") || `u${row.unit}`;
      id = taken.has(slug) ? `ts-${row.unit}` : slug;
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
          ${row.radioNum},
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
            radio_num = ${row.radioNum},
            rdo_days = ${rdo},
            default_zone = ${null},
            last_name = ${lastName},
            shift_id = ${shiftId}
        where id = ${id}
      `;
    }
    keep.add(id);
  }

  // Link LT Keyes staff account to this shift when present
  const keyes = await sql<{ id: string }>`
    select id from officers where shift_id = ${shiftId} and unit = ${"305"} limit 1
  `;
  if (keyes[0]) {
    await sql`
      update staff_accounts
      set name = ${"LT. C. KEYES"},
          officer_id = ${keyes[0].id},
          shift_id = coalesce(nullif(shift_id, ''), ${shiftId}),
          active_shift_id = coalesce(nullif(active_shift_id, ''), ${shiftId})
      where (name ilike 'LT.%KEYES%' or name ilike 'LT. C. KEYES') and email not ilike 'ckeyes%'
    `;
  }

  const drop = existing.filter((o) => !keep.has(o.id)).map((o) => o.id);
  for (const id of drop) {
    await sql`delete from zone_assignments where officer_id = ${id}`;
    await sql`delete from time_off_requests where officer_id = ${id}`;
    await sql`update staff_accounts set officer_id = null where officer_id = ${id}`;
    await sql`delete from officers where id = ${id}`;
  }
}
