import { createServerFn } from "@tanstack/react-start";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { accessFor, requireCap } from "@/lib/staff";
import { commitNewAgency, currentAgencyIdFor, ensureAgencies } from "@/lib/agencies";
import { commitNewShift } from "@/lib/shifts";
import { todayISO } from "@/lib/dates";
import { DEFAULT_ZONE_ORDER, STARTER_ZONES, normalizeZoneOrder } from "@/lib/types";

export type SetupKind = "agency" | "shift";
export type SetupStatus = "pending" | "verified" | "rejected";

export type SetupPayload = {
  agencyName?: string;
  shortName?: string;
  shiftName?: string;
  name?: string;
  startTime?: string;
  endTime?: string;
  minWorking?: number;
  effectiveDate?: string;
  copyRoster?: boolean;
  zoneOrder?: string[];
  commanderName?: string;
  commanderEmail?: string;
  commanderPassword?: string;
};

export type SetupRecord = {
  id: string;
  kind: SetupKind;
  status: SetupStatus;
  payload: SetupPayload;
  agencyId: string | null;
  inviteCode: string | null;
  submittedBy: string | null;
  submittedName: string;
  submittedAt: string;
  liveId: string | null;
  rejectedReason: string | null;
};

type SetupRow = {
  id: string;
  kind: string;
  status: string;
  payload: string;
  agency_id: string | null;
  invite_code: string | null;
  submitted_by: string | null;
  submitted_at: string;
  live_id: string | null;
  rejected_reason: string | null;
  submitted_name?: string | null;
};

function parsePayload(raw: string): SetupPayload {
  try {
    return JSON.parse(raw) as SetupPayload;
  } catch {
    return {};
  }
}

function mapSetup(row: SetupRow): SetupRecord {
  return {
    id: row.id,
    kind: row.kind === "shift" ? "shift" : "agency",
    status: (row.status as SetupStatus) || "pending",
    payload: parsePayload(row.payload ?? "{}"),
    agencyId: row.agency_id,
    inviteCode: row.invite_code,
    submittedBy: row.submitted_by,
    submittedName: row.submitted_name?.trim() || "Unknown",
    submittedAt: row.submitted_at,
    liveId: row.live_id,
    rejectedReason: row.rejected_reason,
  };
}

export async function ensureSetups() {
  await ensureAgencies();
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql.query(`
    create table if not exists setups (
      id               text primary key,
      kind             text not null,
      status           text not null default 'pending',
      payload          text not null default '{}',
      agency_id        text,
      invite_code      text,
      submitted_by     text,
      submitted_at     timestamptz not null default now(),
      verified_by      text,
      verified_at      timestamptz,
      rejected_reason  text,
      live_id          text
    )
  `);
}

const timeRe = /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/;

export async function insertAgencySetup(
  userId: string,
  data: {
    code?: string;
    agencyName: string;
    shortName?: string;
    commanderName: string;
    commanderEmail: string;
    commanderPassword: string;
  },
) {
  await ensureSetups();
  const access = await accessFor(userId);
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const code = data.code?.trim().toUpperCase() ?? "";
  if (code) {
    const invite = await sql<{ id: number; kind: string }>`
      select id, kind from agency_invites
      where code = ${code} and used = false and expires_at > now()
      limit 1
    `;
    if (!invite[0] || invite[0].kind !== "agency") {
      throw new Error("That invite cannot start a new agency.");
    }
    const held = await sql<{ n: number }>`
      select count(*)::int as n from setups
      where invite_code = ${code} and status = 'pending'
    `;
    if ((held[0]?.n ?? 0) > 0) throw new Error("That invite is already in a pending setup.");
  } else if (!access.caps.managePlatform) {
    throw new Error("Ask the operator for an agency invite, or verify from the dashboard.");
  }

  const id = randomBytes(12).toString("hex");
  const payload = JSON.stringify({
    agencyName: data.agencyName.trim(),
    shortName: (data.shortName ?? "").trim().toUpperCase().slice(0, 12),
    commanderName: data.commanderName.trim(),
    commanderEmail: data.commanderEmail.trim().toLowerCase(),
    commanderPassword: data.commanderPassword,
  });
  await sql`
    insert into setups (id, kind, status, payload, invite_code, submitted_by)
    values (${id}, ${"agency"}, ${"pending"}, ${payload}, ${code || null}, ${userId})
  `;
  return { setupId: id, status: "pending" as const };
}

export async function insertShiftSetup(
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
  await ensureSetups();
  const access = await accessFor(userId);
  if (!access.caps.manageAgency) {
    throw new Error("Only the agency can add a shift. Shift commanders manage people.");
  }
  const agencyId = data.agencyId || (await currentAgencyIdFor(userId));
  if (!access.caps.managePlatform && access.agencyId && agencyId !== access.agencyId) {
    throw new Error("That agency is not yours.");
  }
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const zones = normalizeZoneOrder(data.zoneOrder ?? []);
  if (!zones.length) throw new Error("Add at least one zone for assignments.");
  const id = randomBytes(12).toString("hex");
  const payload = JSON.stringify({
    name: data.name.trim(),
    startTime: data.startTime,
    endTime: data.endTime,
    effectiveDate: data.effectiveDate,
    minWorking: data.minWorking,
    zoneOrder: zones,
    copyRoster: data.copyRoster,
  });
  await sql`
    insert into setups (id, kind, status, payload, agency_id, submitted_by)
    values (${id}, ${"shift"}, ${"pending"}, ${payload}, ${agencyId}, ${userId})
  `;
  return { setupId: id, status: "pending" as const };
}

export const submitAgencySetup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      code: z.string().max(12).optional(),
      agencyName: z.string().min(2).max(80),
      shortName: z.string().max(12).optional(),
      commanderName: z.string().min(2).max(80),
      commanderEmail: z.string().email(),
      commanderPassword: z.string().min(8).max(72),
    }),
  )
  .handler(async ({ context, data }) => {
    const access = await accessFor(context.userId);
    if (access.caps.managePlatform && !data.code) {
      const { saveLiveAgency } = await import("@/lib/agencies");
      return saveLiveAgency(context.userId, data);
    }
    return insertAgencySetup(context.userId, data);
  });

export const submitShiftSetup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
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
    }),
  )
  .handler(async ({ context, data }) => {
    const { saveLiveShift } = await import("@/lib/shifts");
    return saveLiveShift(context.userId, {
      ...data,
      zoneOrder: data.zoneOrder ?? [...STARTER_ZONES],
    });
  });

async function loadSetup(id: string): Promise<SetupRow | null> {
  await ensureSetups();
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<SetupRow>`
    select id, kind, status, payload, agency_id, invite_code, submitted_by,
           submitted_at::text as submitted_at, live_id, rejected_reason
    from setups where id = ${id}
  `;
  return rows[0] ?? null;
}

export const listPendingSetups = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const access = await requireCap(context.userId, "manageAgency");
    await ensureSetups();
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = access.caps.managePlatform
      ? await sql<SetupRow>`
          select s.id, s.kind, s.status, s.payload, s.agency_id, s.invite_code, s.submitted_by,
                 s.submitted_at::text as submitted_at, s.live_id, s.rejected_reason,
                 a.name as submitted_name
          from setups s
          left join staff_accounts a on a.user_id = s.submitted_by
          where s.status = 'pending'
          order by s.submitted_at asc
        `
      : await sql<SetupRow>`
          select s.id, s.kind, s.status, s.payload, s.agency_id, s.invite_code, s.submitted_by,
                 s.submitted_at::text as submitted_at, s.live_id, s.rejected_reason,
                 a.name as submitted_name
          from setups s
          left join staff_accounts a on a.user_id = s.submitted_by
          where s.status = 'pending' and s.kind = 'shift' and s.agency_id = ${access.agencyId}
          order by s.submitted_at asc
        `;
    return { setups: rows.map(mapSetup) };
  });

export const verifySetup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(4) }))
  .handler(async ({ context, data }) => {
    const access = await requireCap(context.userId, "manageAgency");
    const row = await loadSetup(data.id);
    if (!row || row.status !== "pending") throw new Error("That setup is not waiting.");
    if (row.kind === "agency" && !access.caps.managePlatform) {
      throw new Error("Only the operator can verify a new agency.");
    }
    if (
      row.kind === "shift" &&
      !access.caps.managePlatform &&
      row.agency_id &&
      row.agency_id !== access.agencyId
    ) {
      throw new Error("That shift setup is not yours to verify.");
    }

    const payload = parsePayload(row.payload);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const actor = row.submitted_by || context.userId;
    let liveId = "";

    if (row.kind === "agency") {
      const created = await commitNewAgency(actor, {
        agencyName: String(payload.agencyName ?? ""),
        shortName: String(payload.shortName ?? ""),
        commanderName: String(payload.commanderName ?? ""),
        commanderEmail: String(payload.commanderEmail ?? ""),
        commanderPassword: String(payload.commanderPassword ?? ""),
      });
      liveId = created.agencyId;
      if (row.invite_code) {
        await sql`
          update agency_invites
          set used = true, used_by = ${actor}, used_at = ${new Date().toISOString()}
          where code = ${row.invite_code} and used = false
        `;
      }
    } else {
      const zones =
        payload.zoneOrder && payload.zoneOrder.length
          ? payload.zoneOrder
          : [...STARTER_ZONES];
      const created = await commitNewShift(actor, {
        name: String(payload.name ?? "Watch"),
        startTime: String(payload.startTime ?? "14:00"),
        endTime: String(payload.endTime ?? "02:00"),
        effectiveDate: String(payload.effectiveDate ?? todayISO()),
        minWorking: Number(payload.minWorking) || 10,
        zoneOrder: zones,
        copyRoster: Boolean(payload.copyRoster),
        agencyId: row.agency_id ?? undefined,
      });
      liveId = created.id;
    }

    await sql`
      update setups
      set status = ${"verified"},
          verified_by = ${context.userId},
          verified_at = ${new Date().toISOString()},
          live_id = ${liveId}
      where id = ${row.id}
    `;
    return { liveId, kind: row.kind };
  });

export const rejectSetup = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(4), reason: z.string().max(200).optional() }))
  .handler(async ({ context, data }) => {
    const access = await requireCap(context.userId, "manageAgency");
    const row = await loadSetup(data.id);
    if (!row || row.status !== "pending") throw new Error("That setup is not waiting.");
    if (row.kind === "agency" && !access.caps.managePlatform) {
      throw new Error("Only the operator can reject a new agency.");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`
      update setups
      set status = ${"rejected"},
          verified_by = ${context.userId},
          verified_at = ${new Date().toISOString()},
          rejected_reason = ${data.reason?.trim() || "Rejected"}
      where id = ${row.id}
    `;
    return { ok: true };
  });
