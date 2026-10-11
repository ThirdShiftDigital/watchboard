/**
 * Reads duty_overrides (Overtime & swaps). DB only — never Google — so it is
 * safe on the Zones path.
 *
 * Migrations run only on Netlify production builds (b988ca5), and deploy
 * previews share the production database, so a preview can run before
 * 0014_duty_overrides.sql has been applied. A missing table reads as "no
 * overrides" instead of breaking Zones / Schedule; writes report it plainly.
 */
import type { DutyOverride } from "@/lib/types";

type OverrideRow = {
  id: number;
  officer_id: string;
  date: string;
  status: string;
  kind: string;
  partner_officer_id: string | null;
  swap_group: string | null;
  is_payback: boolean;
  reason: string | null;
};

export const OVERRIDES_NOT_READY =
  "Overtime & swaps aren’t set up on this database yet. They turn on with the next production deploy.";

export function isMissingTable(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  if (e?.code === "42P01") return true;
  return /relation "?duty_overrides"? does not exist/i.test(String(e?.message ?? ""));
}

export function mapOverride(row: OverrideRow): DutyOverride {
  return {
    id: Number(row.id),
    officerId: row.officer_id,
    date: row.date,
    status: row.status === "off" ? "off" : "working",
    kind: row.kind === "swap" ? "swap" : "ot",
    partnerOfficerId: row.partner_officer_id,
    swapGroup: row.swap_group,
    isPayback: Boolean(row.is_payback),
    reason: row.reason ?? "",
  };
}

/** Overrides for officers currently on `shiftId`, dates in [from, to] (inclusive). */
export async function loadOverrides(shiftId: string, from: string, to: string): Promise<DutyOverride[]> {
  if (!shiftId) return [];
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  try {
    const rows = await sql<OverrideRow>`
      select d.id, d.officer_id, d.date, d.status, d.kind, d.partner_officer_id,
             d.swap_group, d.is_payback, d.reason
      from duty_overrides d
      join officers o on o.id = d.officer_id
      where o.shift_id = ${shiftId} and d.date >= ${from} and d.date <= ${to}
      order by d.date asc, d.id asc
    `;
    return rows.map(mapOverride);
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}

/** Every swap row (any date) for the shift's Swaps list. */
export async function loadShiftSwaps(shiftId: string): Promise<DutyOverride[]> {
  if (!shiftId) return [];
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  try {
    const rows = await sql<OverrideRow>`
      select d.id, d.officer_id, d.date, d.status, d.kind, d.partner_officer_id,
             d.swap_group, d.is_payback, d.reason
      from duty_overrides d
      where d.kind = 'swap' and d.swap_group in (
        select d2.swap_group from duty_overrides d2
        join officers o on o.id = d2.officer_id
        where o.shift_id = ${shiftId} and d2.swap_group is not null
      )
      order by d.date asc, d.id asc
    `;
    return rows.map(mapOverride);
  } catch (err) {
    if (isMissingTable(err)) return [];
    throw err;
  }
}
