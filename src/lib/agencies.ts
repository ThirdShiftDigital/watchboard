import { createServerFn } from "@tanstack/react-start";
import { randomInt } from "node:crypto";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { ensureTables, requireCap, accessFor } from "@/lib/staff";
import { type Agency } from "@/lib/types";

export const DEFAULT_AGENCY_ID = "home";

type AgencyRow = {
  id: string;
  name: string;
  short_name: string;
  patch_data?: string | null;
};

export function mapAgency(row: AgencyRow): Agency {
  return {
    id: row.id,
    name: row.name,
    shortName: row.short_name || row.name,
    patchData: row.patch_data || null,
  };
}

function slugId(name: string, taken: Set<string>): string {
  const base =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 32) || "agency";
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function inviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i += 1) out += alphabet[randomInt(0, alphabet.length)];
  return out;
}

export async function ensureAgencies() {
  await ensureTables();
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql.query(`
    create table if not exists agencies (
      id          text primary key,
      name        text not null,
      short_name  text not null default '',
      created_by  text,
      created_at  timestamptz not null default now()
    )
  `);
  await sql.query(`
    create table if not exists agency_members (
      user_id     text not null,
      agency_id   text not null,
      permission  text not null default 'officer',
      officer_id  text,
      created_at  timestamptz not null default now(),
      primary key (user_id, agency_id)
    )
  `);
  await sql.query(`alter table agency_members add column if not exists agency_admin boolean not null default false`);
  await sql.query(`
    create table if not exists agency_invites (
      id          serial primary key,
      code        text not null unique,
      kind        text not null default 'agency',
      agency_id   text,
      created_by  text,
      expires_at  timestamptz not null,
      used        boolean not null default false,
      used_by     text,
      used_at     timestamptz,
      created_at  timestamptz not null default now()
    )
  `);
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
  await sql.query(`alter table shifts add column if not exists agency_id text`);
  await sql.query(`alter table agencies add column if not exists patch_data text`);
  await sql.query(`alter table staff_accounts add column if not exists agency_id text`);
  await sql.query(`alter table staff_accounts add column if not exists viewing_agency_id text`);
  const count = await sql<{ n: number }>`select count(*)::int as n from agencies`;
  if ((count[0]?.n ?? 0) === 0) {
    await sql`
      insert into agencies (id, name, short_name)
      values (${DEFAULT_AGENCY_ID}, ${"WatchBoard"}, ${"HOME"})
    `;
  }
  await sql`
    insert into agency_members (user_id, agency_id, permission, officer_id)
    select user_id, agency_id, permission, officer_id
    from staff_accounts
    where coalesce(is_owner, false) = false
      and agency_id is not null
      and agency_id <> ''
    on conflict (user_id, agency_id) do nothing
  `;
  await sql`delete from agency_members
    where user_id in (select user_id from staff_accounts where is_owner = true)`;
}

export async function loadAgency(id: string): Promise<Agency | null> {
  await ensureAgencies();
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<AgencyRow>`select id, name, short_name, patch_data from agencies where id = ${id}`;
  return rows[0] ? mapAgency(rows[0]) : null;
}

export async function currentAgencyIdFor(userId: string): Promise<string> {
  await ensureAgencies();
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{
    agency_id: string | null;
    viewing_agency_id: string | null;
    active_shift_id: string | null;
    is_owner: boolean | null;
  }>`
    select agency_id, viewing_agency_id, active_shift_id, is_owner
    from staff_accounts where user_id = ${userId}
  `;
  const staff = rows[0];
  if (staff?.is_owner) {
    const view = staff.viewing_agency_id;
    if (view) {
      const ok = await sql<{ id: string }>`select id from agencies where id = ${view}`;
      if (ok[0]) return ok[0].id;
    }
    if (staff.active_shift_id) {
      const fromShift = await sql<{ agency_id: string | null }>`
        select agency_id from shifts where id = ${staff.active_shift_id}
      `;
      if (fromShift[0]?.agency_id) return fromShift[0].agency_id;
    }
    const first = await sql<{ id: string }>`select id from agencies order by name limit 1`;
    return first[0]?.id ?? DEFAULT_AGENCY_ID;
  }
  const id = staff?.agency_id || DEFAULT_AGENCY_ID;
  const exists = await sql<{ id: string }>`select id from agencies where id = ${id}`;
  return exists[0]?.id ?? DEFAULT_AGENCY_ID;
}

export async function setViewingAgency(userId: string, agencyId: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const shift = await sql<{ id: string }>`
    select id from shifts where agency_id = ${agencyId} order by created_at asc limit 1
  `;
  if (shift[0]) {
    await sql`
      update staff_accounts
      set viewing_agency_id = ${agencyId}, active_shift_id = ${shift[0].id}
      where user_id = ${userId}
    `;
  } else {
    await sql`
      update staff_accounts
      set viewing_agency_id = ${agencyId}
      where user_id = ${userId}
    `;
  }
}

async function applyMembership(
  userId: string,
  agencyId: string,
  permission: "captain" | "admin" | "supervisor" | "dispatcher" | "officer",
  shiftId: string | null,
  agencyAdmin = false,
) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql`
    insert into agency_members (user_id, agency_id, permission, agency_admin)
    values (${userId}, ${agencyId}, ${permission}, ${agencyAdmin})
    on conflict (user_id, agency_id) do update
      set permission = excluded.permission,
          agency_admin = excluded.agency_admin
  `;
  await sql`
    update staff_accounts
    set agency_id = ${agencyId},
        permission = ${permission},
        officer_id = case when ${agencyId} = agency_id then officer_id else null end,
        shift_id = ${shiftId},
        active_shift_id = ${shiftId}
    where user_id = ${userId}
  `;
}

export async function commitNewAgency(
  userId: string,
  data: {
    agencyName: string;
    shortName?: string;
    commanderName: string;
    commanderEmail: string;
    commanderPassword: string;
  },
) {
  await ensureAgencies();
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const existing = await sql<{ id: string }>`select id from agencies`;
  const id = slugId(data.shortName || data.agencyName, new Set(existing.map((r) => r.id)));
  const short = (data.shortName || data.agencyName).trim().toUpperCase().slice(0, 12);
  await sql`
    insert into agencies (id, name, short_name, created_by)
    values (${id}, ${data.agencyName.trim()}, ${short}, ${userId})
  `;
  const access = await accessFor(userId);
  if (!access.isOwner && !access.caps.managePlatform) {
    await applyMembership(userId, id, "captain", null, true);
  } else {
    await setViewingAgency(userId, id);
  }
  const { provisionDivisionLeader } = await import("@/lib/staff");
  const commander = await provisionDivisionLeader({
    name: data.commanderName,
    email: data.commanderEmail,
    password: data.commanderPassword,
    agencyId: id,
  });
  return { agencyId: id, commander };
}

export async function saveLiveAgency(
  userId: string,
  data: {
    agencyName: string;
    shortName?: string;
    commanderName: string;
    commanderEmail: string;
    commanderPassword: string;
  },
) {
  const access = await accessFor(userId);
  if (!access.caps.managePlatform) {
    throw new Error("Only the operator can stand up a new agency.");
  }
  return commitNewAgency(userId, data);
}

export const listAgencies = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await ensureAgencies();
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const access = await accessFor(context.userId);
    const currentId = await currentAgencyIdFor(context.userId);
    const rows = access.caps.managePlatform
      ? await sql<AgencyRow & { permission: string }>`
          select a.id, a.name, a.short_name, a.patch_data, ${"admin"} as permission
          from agencies a
          order by a.name
        `
      : await sql<AgencyRow & { permission: string }>`
          select a.id, a.name, a.short_name, a.patch_data, m.permission
          from agency_members m
          join agencies a on a.id = m.agency_id
          where m.user_id = ${context.userId}
          order by a.name
        `;
    const current = await loadAgency(currentId);
    return {
      agencies: rows.map((r) => ({ ...mapAgency(r), permission: r.permission })),
      currentId,
      current,
    };
  });

export const switchAgency = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ agencyId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    await ensureAgencies();
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const access = await accessFor(context.userId);
    const agency = await loadAgency(data.agencyId);
    if (!agency) throw new Error("Agency not found.");
    if (access.caps.managePlatform) {
      await setViewingAgency(context.userId, data.agencyId);
      return { agency };
    }
    const member = await sql<{ permission: string; agency_admin: boolean | null }>`
      select permission, agency_admin from agency_members
      where user_id = ${context.userId} and agency_id = ${data.agencyId}
    `;
    if (!member[0]) throw new Error("You are not on that agency.");
    const shift = await sql<{ id: string }>`
      select id from shifts where agency_id = ${data.agencyId} order by created_at asc limit 1
    `;
    await applyMembership(
      context.userId,
      data.agencyId,
      member[0].permission as "captain" | "admin" | "supervisor" | "dispatcher" | "officer",
      shift[0]?.id ?? null,
      Boolean(member[0].agency_admin),
    );
    return { agency };
  });

export const renameAgency = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().min(2).max(80),
      shortName: z.string().max(12).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireCap(context.userId, "manageAccounts");
    const agencyId = await currentAgencyIdFor(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const short = (data.shortName ?? "").trim().toUpperCase().slice(0, 12);
    await sql`
      update agencies
      set name = ${data.name.trim()}, short_name = ${short}
      where id = ${agencyId}
    `;
    return { ok: true };
  });

export const setAgencyPatch = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      dataUrl: z.string().max(500_000),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireCap(context.userId, "manageAgency");
    const agencyId = await currentAgencyIdFor(context.userId);
    const raw = data.dataUrl.trim();
    if (raw && !raw.startsWith("data:image/")) {
      throw new Error("Upload a PNG or JPEG patch.");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    await sql`update agencies set patch_data = ${raw || null} where id = ${agencyId}`;
    return { ok: true };
  });

export const createAgencyInvite = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ kind: z.enum(["agency", "join"]) }))
  .handler(async ({ context, data }) => {
    const cap = data.kind === "agency" ? "managePlatform" : "manageAgency";
    await requireCap(context.userId, cap);
    await ensureAgencies();
    const agencyId = await currentAgencyIdFor(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const code = inviteCode();
    const expires = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
    await sql`
      insert into agency_invites (code, kind, agency_id, created_by, expires_at)
      values (
        ${code},
        ${data.kind},
        ${data.kind === "join" ? agencyId : null},
        ${context.userId},
        ${expires}
      )
    `;
    return { code, kind: data.kind, expiresAt: expires };
  });

export const listAgencyInvites = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requireCap(context.userId, "manageAgency");
    const agencyId = await currentAgencyIdFor(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{
      id: number;
      code: string;
      kind: string;
      expires_at: string;
    }>`
      select id, code, kind, expires_at::text as expires_at
      from agency_invites
      where used = false and expires_at > now()
        and (created_by = ${context.userId} or agency_id = ${agencyId})
      order by created_at desc
    `;
    return {
      invites: rows.map((r) => ({
        id: r.id,
        code: r.code,
        kind: r.kind as "agency" | "join",
        expiresAt: r.expires_at,
      })),
    };
  });

export const peekInvite = createServerFn({ method: "POST" })
  .validator(z.object({ code: z.string().min(4).max(12) }))
  .handler(async ({ data }) => {
    await ensureAgencies();
    const code = data.code.trim().toUpperCase();
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{
      kind: string;
      agency_id: string | null;
      used: boolean;
      expires_at: string;
    }>`
      select kind, agency_id, used, expires_at::text as expires_at
      from agency_invites
      where code = ${code}
      limit 1
    `;
    const row = rows[0];
    if (!row) throw new Error("That invite code is not valid.");
    if (row.used) throw new Error("That invite was already used.");
    if (new Date(row.expires_at).getTime() < Date.now()) throw new Error("That invite expired.");
    let agencyName: string | null = null;
    if (row.agency_id) {
      const agency = await loadAgency(row.agency_id);
      agencyName = agency?.name ?? null;
    }
    return { kind: row.kind as "agency" | "join", agencyName };
  });

export const startAgency = createServerFn({ method: "POST" })
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
      return saveLiveAgency(context.userId, data);
    }
    const { insertAgencySetup } = await import("@/lib/setups");
    return insertAgencySetup(context.userId, data);
  });

export const joinAgency = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ code: z.string().min(4).max(12) }))
  .handler(async ({ context, data }) => {
    await ensureAgencies();
    const code = data.code.trim().toUpperCase();
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const invite = await sql<{
      id: number;
      kind: string;
      agency_id: string | null;
    }>`
      select id, kind, agency_id from agency_invites
      where code = ${code} and used = false and expires_at > now()
      limit 1
    `;
    const row = invite[0];
    if (!row || row.kind !== "join" || !row.agency_id) {
      throw new Error("That invite cannot add you to an agency.");
    }
    const shift = await sql<{ id: string }>`
      select id from shifts where agency_id = ${row.agency_id} order by created_at asc limit 1
    `;
    await applyMembership(context.userId, row.agency_id, "supervisor", shift[0]?.id ?? null);
    await sql`
      update agency_invites
      set used = true, used_by = ${context.userId}, used_at = ${new Date().toISOString()}
      where id = ${row.id}
    `;
    return { agencyId: row.agency_id };
  });
