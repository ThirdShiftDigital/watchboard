/**
 * Off / leave audit trail (migrations/0016_off_audit.sql). Server only.
 *
 * Writes: every server path that marks someone off or changes/removes it calls
 * recordOffAudit. Reads: only the shift commander of the entry's shift (see
 * off-audit-rules.ts); everyone else gets no audit fields at all. The app's
 * DATABASE_URL role bypasses RLS, so these checks are the real gate.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import type { accessFor } from "@/lib/staff";

async function loadAccess(userId: string) {
  const { accessFor: f } = await import("@/lib/staff");
  return f(userId);
}
import { countTimeOff, periodRange, type PeriodUnit, type TimeOffTotals } from "@/lib/time-off-totals";
import { canSeeOffAudit, type AuditViewer, type OffAuditAction } from "@/lib/off-audit-rules";

export type OffAuditEntityType = "request" | "override";

export type OffAuditEntry = {
  id: number;
  action: string;
  actorName: string;
  at: string;
  summary: string;
  backfilled: boolean;
};

/** Attached to an entry only for its shift commander. */
export type OffAuditStamp = { markedBy: string; markedAt: string };

type Sql = Awaited<ReturnType<typeof import("@/lib/db").getSql>>;

async function sqlNow(): Promise<Sql> {
  const { getSql } = await import("@/lib/db");
  return getSql();
}

function isMissing(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return e?.code === "42P01" || /relation "?off_audit"? does not exist/i.test(String(e?.message ?? ""));
}

/**
 * Append one audit row. Never throws: an audit failure is logged loudly but
 * does not block putting someone on / off duty at shift change.
 */
export async function recordOffAudit(input: {
  entityType: OffAuditEntityType;
  entityId: string | number;
  officerId: string;
  shiftId?: string | null;
  action: OffAuditAction;
  actorUserId: string;
  before?: unknown;
  after?: unknown;
  summary?: string;
}): Promise<void> {
  try {
    const sql = await sqlNow();
    await sql.query(
      `insert into off_audit
         (entity_type, entity_id, officer_id, shift_id, action, actor_user_id, actor_name, before, after, summary)
       values ($1, $2, $3,
         coalesce($4, (select shift_id from officers where id = $3)),
         $5, $6::text,
         coalesce((select name from staff_accounts where user_id = $6::text limit 1), ''),
         $7::jsonb, $8::jsonb, $9)`,
      [
        input.entityType,
        String(input.entityId),
        input.officerId,
        input.shiftId ?? null,
        input.action,
        input.actorUserId,
        input.before === undefined ? null : JSON.stringify(input.before),
        input.after === undefined ? null : JSON.stringify(input.after),
        input.summary ?? "",
      ],
    );
  } catch (err) {
    console.error("[off-audit] write failed", {
      entity: `${input.entityType}:${input.entityId}`,
      action: input.action,
      error: err instanceof Error ? err.message.slice(0, 200) : String(err),
    });
  }
}

type Access = Awaited<ReturnType<typeof accessFor>>;

export function auditViewerFrom(access: Access): AuditViewer {
  return {
    permission: access.permission,
    isOwner: access.isOwner,
    agencyAdmin: access.agencyAdmin,
    unassigned: access.unassigned,
    agencyId: access.agencyId,
    homeShiftId: access.shiftId || access.activeShiftId || null,
  };
}

/** Agency of a shift (null when unknown). */
async function shiftAgency(shiftId: string): Promise<string | null> {
  const sql = await sqlNow();
  const rows = await sql<{ agency_id: string | null }>`select agency_id from shifts where id = ${shiftId}`;
  return rows[0]?.agency_id ?? null;
}

/**
 * True when this viewer may see audit data for entries on `shiftId` (the shift
 * a loader is serving). Loaders call this and attach nothing otherwise.
 */
export async function mayAuditShift(access: Access, shiftId: string | null | undefined): Promise<boolean> {
  const viewer = auditViewerFrom(access);
  if (!shiftId) return false;
  return canSeeOffAudit(viewer, { shiftId, agencyId: await shiftAgency(shiftId) });
}

/**
 * "Marked off by" stamps by entity id: the latest approval (the person who
 * actually put the deputy off), else who entered it (call-ins, OT / swaps).
 */
export async function loadAuditStamps(
  entityType: OffAuditEntityType,
  ids: Array<string | number>,
): Promise<Map<string, OffAuditStamp>> {
  const out = new Map<string, OffAuditStamp>();
  if (!ids.length) return out;
  try {
    const sql = await sqlNow();
    const rows = await sql.query(
      `select distinct on (entity_id) entity_id, actor_name,
              to_char(at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at
       from off_audit
       where entity_type = $1 and action in ('approved', 'created') and entity_id = any($2::text[])
       order by entity_id,
                case action when 'approved' then 0 else 1 end,
                case when action = 'approved' then at end desc nulls last,
                at asc, id asc`,
      [entityType, ids.map(String)],
    ) as Array<{ entity_id: string; actor_name: string; at: string }>;
    for (const r of rows) out.set(r.entity_id, { markedBy: r.actor_name || "Not recorded", markedAt: r.at });
  } catch (err) {
    if (!isMissing(err)) throw err;
  }
  return out;
}

/** Attach `audit` stamps to entries when (and only when) the viewer may see them. */
export async function withAuditStamps<T extends { id: number }>(
  access: Access,
  shiftId: string | null | undefined,
  entityType: OffAuditEntityType,
  entries: T[],
): Promise<Array<T & { audit?: OffAuditStamp }>> {
  if (!entries.length || !(await mayAuditShift(access, shiftId))) return entries;
  const stamps = await loadAuditStamps(entityType, entries.map((e) => e.id));
  return entries.map((e) => {
    const s = stamps.get(String(e.id));
    return s ? { ...e, audit: s } : e;
  });
}

/** Full history of one entry — shift commander of the entry's shift only. */
export async function offHistoryFor(
  userId: string,
  data: { entityType: OffAuditEntityType; entityId: number },
): Promise<{ entries: OffAuditEntry[] }> {
  const access = await loadAccess(userId);
  const sql = await sqlNow();
  // Scope by where the entry's officer is now; fall back to the shift recorded
  // on the audit rows if the entry itself was deleted.
  const table = data.entityType === "request" ? "time_off_requests" : "duty_overrides";
  let shiftId: string | null = null;
  try {
    const live = await sql.query(
      `select o.shift_id from ${table} t join officers o on o.id = t.officer_id where t.id = $1`,
      [data.entityId],
    ) as Array<{ shift_id: string | null }>;
    shiftId = live[0]?.shift_id ?? null;
    if (!shiftId) {
      const hist = await sql.query(
        `select shift_id from off_audit where entity_type = $1 and entity_id = $2 order by id desc limit 1`,
        [data.entityType, String(data.entityId)],
      ) as Array<{ shift_id: string | null }>;
      shiftId = hist[0]?.shift_id ?? null;
    }
  } catch (err) {
    if (!isMissing(err)) throw err;
  }
  // Same message whether the entry is missing or out of scope.
  if (!(await mayAuditShift(access, shiftId))) {
    throw new Error(AUDIT_REFUSED);
  }
  try {
    const rows = await sql.query(
      `select id, action, actor_name, summary, backfilled,
              to_char(at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at
       from off_audit where entity_type = $1 and entity_id = $2
       order by at asc, id asc limit 100`,
      [data.entityType, String(data.entityId)],
    ) as Array<{ id: number; action: string; actor_name: string; summary: string; backfilled: boolean; at: string }>;
    return {
      entries: rows.map((r) => ({
        id: Number(r.id),
        action: r.action,
        actorName: r.actor_name || "Not recorded",
        at: r.at,
        summary: r.summary,
        backfilled: Boolean(r.backfilled),
      })),
    };
  } catch (err) {
    if (isMissing(err)) return { entries: [] };
    throw err;
  }
}

export const getOffHistory = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ entityType: z.enum(["request", "override"]), entityId: z.number().int().positive() }))
  .handler(({ data, context }) => offHistoryFor(context.userId, data));

// ---------------------------------------------------------------------------
// Time-off totals + exportable report (print / PDF / mailto). Same gate.


export const AUDIT_REFUSED = "Only the shift commander can see this history.";

type OfficerFacts = { id: string; name: string; shiftId: string | null; shiftName: string; rdoDays: number[] };

async function officerFacts(officerId: string): Promise<OfficerFacts | null> {
  const sql = await sqlNow();
  const rows = await sql<{ id: string; name: string; shift_id: string | null; shift_name: string | null; rdo_days: string }>`
    select o.id, o.name, o.shift_id, s.name as shift_name, o.rdo_days
    from officers o left join shifts s on s.id = o.shift_id where o.id = ${officerId}
  `;
  const r = rows[0];
  if (!r) return null;
  const { parseRdoDays } = await import("@/lib/dates");
  return { id: r.id, name: r.name, shiftId: r.shift_id, shiftName: r.shift_name ?? "", rdoDays: parseRdoDays(r.rdo_days) };
}

/** Throws AUDIT_REFUSED unless the viewer passes the shared rule for this officer's shift. */
async function gateOfficer(userId: string, officerId: string): Promise<OfficerFacts> {
  const access = await loadAccess(userId);
  const facts = await officerFacts(officerId);
  if (!facts || !(await mayAuditShift(access, facts.shiftId))) throw new Error(AUDIT_REFUSED);
  return facts;
}

async function totalsFor(facts: OfficerFacts, unit: PeriodUnit, anchor: string): Promise<TimeOffTotals> {
  const { from, to } = periodRange(unit, anchor);
  const sql = await sqlNow();
  const reqs = await sql<{ status: string; kind: string; start_date: string; end_date: string }>`
    select status, kind, start_date, end_date from time_off_requests
    where officer_id = ${facts.id} and status = 'approved' and start_date <= ${to} and end_date >= ${from}
  `;
  return countTimeOff(
    unit,
    anchor,
    reqs.map((r) => ({ status: r.status, kind: r.kind, startDate: r.start_date, endDate: r.end_date })),
    facts.rdoDays,
  );
}

/** Week + month totals for the officer portal — or null (field omitted) for everyone else. */
export async function portalTimeOff(
  access: Access,
  officerId: string,
  anchor: string,
): Promise<{ week: TimeOffTotals; month: TimeOffTotals } | null> {
  const facts = await officerFacts(officerId);
  if (!facts || !(await mayAuditShift(access, facts.shiftId))) return null;
  return { week: await totalsFor(facts, "week", anchor), month: await totalsFor(facts, "month", anchor) };
}

export async function officerTimeOffFor(
  userId: string,
  data: { officerId: string; unit: PeriodUnit; anchor: string },
): Promise<TimeOffTotals & { officerName: string }> {
  const facts = await gateOfficer(userId, data.officerId);
  return { ...(await totalsFor(facts, data.unit, data.anchor)), officerName: facts.name };
}

/** Everything the print view / PDF / email summary needs. */
export async function officerReportFor(
  userId: string,
  data: { officerId: string; unit: PeriodUnit; anchor: string },
) {
  const facts = await gateOfficer(userId, data.officerId);
  const totals = await totalsFor(facts, data.unit, data.anchor);
  const sql = await sqlNow();
  let history: Array<{ id: number; action: string; actorName: string; at: string; summary: string }> = [];
  try {
    // Audit rows for this officer's entries that touch the period, or that were
    // written during it.
    const rows = (await sql.query(
      `select a.id, a.action, a.actor_name, a.summary,
              to_char(a.at at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at
       from off_audit a
       where a.officer_id = $1 and (
         (a.at at time zone 'America/Chicago')::date between $2::date and $3::date
         or (a.entity_type = 'request' and a.entity_id in (
              select id::text from time_off_requests
              where officer_id = $1 and start_date <= $3::text and end_date >= $2::text))
         or (a.after->>'date' between $2::text and $3::text) or (a.before->>'date' between $2::text and $3::text)
       )
       order by a.at asc, a.id asc limit 300`,
      [facts.id, totals.from, totals.to],
    )) as Array<{ id: number; action: string; actor_name: string; summary: string; at: string }>;
    history = rows.map((r) => ({
      id: Number(r.id),
      action: r.action,
      actorName: r.actor_name || "Not recorded",
      at: r.at,
      summary: r.summary,
    }));
  } catch (err) {
    if (!isMissing(err)) throw err;
  }
  return { officerId: facts.id, officerName: facts.name, shiftName: facts.shiftName, totals, history };
}

const reportInput = z.object({
  officerId: z.string().min(1),
  unit: z.enum(["week", "month"]),
  anchor: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const getOfficerTimeOff = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(reportInput)
  .handler(({ data, context }) => officerTimeOffFor(context.userId, data));

export const getOfficerReport = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(reportInput)
  .handler(({ data, context }) => officerReportFor(context.userId, data));
