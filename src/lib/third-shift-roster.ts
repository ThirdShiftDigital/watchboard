import { DEFAULT_ZONE_ORDER } from "@/lib/types";

/** Ensure Third Shift (overnight 22:00–06:00) exists for the home agency. */
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
        ${"2026-09-14"},
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
    return;
  }

  await sql`
    update shifts
    set name = ${"Third Shift"},
        start_time = ${"22:00"},
        end_time = ${"06:00"},
        agency_id = ${agencyId},
        min_working = ${10},
        zone_order = case
          when coalesce(trim(zone_order), '') = '' then ${zoneOrder}
          else zone_order
        end
    where id = ${shift.id}
  `;
}
