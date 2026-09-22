import { createServerFn } from "@tanstack/react-start";
import { randomBytes, randomInt } from "node:crypto";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  assignablePermissions,
  capsFor,
  isPermission,
  type Caps,
  type Permission,
  type StaffAccount,
} from "@/lib/access";

type StaffRow = {
  user_id: string;
  email: string;
  name: string;
  permission: string;
  officer_id: string | null;
  shift_id: string | null;
  active_shift_id: string | null;
  agency_id: string | null;
  viewing_agency_id?: string | null;
  is_owner: boolean | null;
};

type ResetRow = {
  id: number;
  email: string;
  code: string;
  expires_at: string;
  used: boolean;
};

function mapStaff(row: StaffRow): StaffAccount {
  return {
    userId: row.user_id,
    email: row.email,
    name: row.name,
    permission: isPermission(row.permission) ? row.permission : "officer",
    officerId: row.officer_id,
    shiftId: row.shift_id,
    activeShiftId: row.active_shift_id,
    agencyId: row.agency_id,
    viewingAgencyId: row.viewing_agency_id ?? null,
    isOwner: Boolean(row.is_owner),
    agencyAdmin: false,
  };
}

const OWNER_LOGIN = "ckeyes861@gmail.com";
const COMMANDER_LOGIN = "ckeyes@wcso95.org";

function emailKey(value: string): string {
  return value.trim().toLowerCase();
}

async function hashPassword(password: string): Promise<string> {
  const { hashPassword: hash } = await import("better-auth/crypto");
  return hash(password);
}

async function findUserByEmail(email: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ id: string; email: string; name: string }>`
    select id, email, name from "user" where lower(email) = ${email}
  `;
  return rows[0] ?? null;
}

async function ensureUserForEmail(email: string, name?: string) {
  const existing = await findUserByEmail(email);
  if (existing) return existing;
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const id = newId();
  const display = (name ?? "").trim() || email.split("@")[0] || "User";
  const now = new Date().toISOString();
  await sql`
    insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    values (${id}, ${display}, ${email}, true, ${now}, ${now})
  `;
  await ensureStaff(id);
  return { id, email, name: display };
}

async function upsertCredentialPassword(userId: string, password: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const hash = await hashPassword(password);
  const now = new Date().toISOString();
  const updated = await sql<{ id: string }>`
    update "account"
    set password = ${hash}, "updatedAt" = ${now}
    where "userId" = ${userId} and "providerId" = 'credential'
    returning id
  `;
  if (!updated[0]) {
    await sql`
      insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      values (${newId()}, ${userId}, 'credential', ${userId}, ${hash}, ${now}, ${now})
    `;
  }
}


function newId(): string {
  return randomBytes(16).toString("hex");
}

function resetCode(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, "0");
}

let tablesReady = false;

export async function ensureTables() {
  if (tablesReady) return;
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql.query(`
    create table if not exists staff_accounts (
      user_id     text primary key,
      email       text not null,
      name        text not null,
      permission  text not null default 'officer',
      officer_id  text,
      created_at  timestamptz not null default now()
    )
  `);
  await sql.query(`
    create table if not exists password_resets (
      id          serial primary key,
      email       text not null,
      code        text not null,
      expires_at  timestamptz not null,
      used        boolean not null default false,
      created_at  timestamptz not null default now()
    )
  `);
  await sql.query(`
    alter table time_off_requests
      add column if not exists calendar_event_id text
  `);
  await sql.query(`alter table officers add column if not exists shift_id text`);
  await sql.query(`alter table staff_accounts add column if not exists shift_id text`);
  await sql.query(`alter table staff_accounts add column if not exists active_shift_id text`);
  await sql.query(`alter table staff_accounts add column if not exists agency_id text`);
  await sql.query(`alter table staff_accounts add column if not exists viewing_agency_id text`);
  await sql.query(`alter table staff_accounts add column if not exists is_owner boolean not null default false`);
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
  const cleared = await sql<{ value: string }>`
    select value from schedule_meta where key = 'demo_cleared'
  `;
  if ((cleared[0]?.value ?? "") !== "1") {
    await sql`delete from time_off_requests`;
    await sql`delete from schedule_meta where key = 'calendar_feed_url'`;
    await sql`
      insert into schedule_meta (key, value)
      values ('demo_cleared', '1')
      on conflict (key) do update set value = '1'
    `;
  }
  const zonesCleared = await sql<{ value: string }>`
    select value from schedule_meta where key = 'auto_zones_cleared'
  `;
  if ((zonesCleared[0]?.value ?? "") !== "1") {
    await sql`delete from zone_assignments`;
    await sql`
      insert into schedule_meta (key, value)
      values ('auto_zones_cleared', '1')
      on conflict (key) do update set value = '1'
    `;
  }
  tablesReady = true;
  await ensureOperatorLogins();
}

async function copyCredential(fromUserId: string, toUserId: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ password: string | null }>`
    select password from "account"
    where "userId" = ${fromUserId} and "providerId" = 'credential' and password is not null
    limit 1
  `;
  const password = rows[0]?.password;
  if (!password) return;
  const now = new Date().toISOString();
  const updated = await sql<{ id: string }>`
    update "account"
    set password = ${password}, "updatedAt" = ${now}
    where "userId" = ${toUserId} and "providerId" = 'credential'
    returning id
  `;
  if (!updated[0]) {
    await sql`
      insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      values (${newId()}, ${toUserId}, 'credential', ${toUserId}, ${password}, ${now}, ${now})
    `;
  }
}

async function provisionLogin(email: string, source: StaffAccount | null) {
  const existing = await findUserByEmail(email);
  if (existing) {
    await ensureStaff(existing.id);
    return existing.id;
  }
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const id = newId();
  const display = source?.name?.trim() || "Christopher Keyes";
  const now = new Date().toISOString();
  await sql`
    insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    values (${id}, ${display}, ${email}, true, ${now}, ${now})
  `;
  const agencyId = source?.agencyId || "home";
  const shiftId = source?.activeShiftId || source?.shiftId || "default";
  const isOwner = emailKey(email) === OWNER_LOGIN;
  if (isOwner) {
    await sql`
      insert into staff_accounts (user_id, email, name, permission, officer_id, shift_id, active_shift_id, agency_id, is_owner)
      values (${id}, ${email}, ${display}, ${"admin"}, ${null}, ${null}, ${null}, ${null}, true)
      on conflict (user_id) do nothing
    `;
  } else {
    await sql`
      insert into staff_accounts (user_id, email, name, permission, officer_id, shift_id, active_shift_id, agency_id, is_owner)
      values (${id}, ${email}, ${display}, ${"admin"}, ${source?.officerId ?? null}, ${shiftId}, ${shiftId}, ${agencyId}, false)
      on conflict (user_id) do nothing
    `;
    await sql`
      insert into agency_members (user_id, agency_id, permission, officer_id, agency_admin)
      values (${id}, ${agencyId}, ${"admin"}, ${source?.officerId ?? null}, false)
      on conflict (user_id, agency_id) do update
        set permission = excluded.permission, agency_admin = excluded.agency_admin
    `;
  }
  if (source?.userId) await copyCredential(source.userId, id);
  return id;
}

export async function provisionShiftCommander(input: {
  name: string;
  email: string;
  password: string;
  shiftId: string;
  agencyId: string;
}): Promise<{ userId: string; email: string }> {
  const email = emailKey(input.email);
  if (!email.includes("@")) throw new Error("Shift commander email is required.");
  if (email === OWNER_LOGIN) throw new Error("That email is the operator login.");
  if (input.password.trim().length < 8) {
    throw new Error("Give the commander a temporary password of 8+ characters.");
  }
  const name = input.name.trim() || email.split("@")[0] || "Commander";
  let user = await findUserByEmail(email);
  if (!user) user = await ensureUserForEmail(email, name);
  const existing = await loadStaff(user.id);
  if (existing?.agencyId && existing.agencyId !== input.agencyId) {
    throw new Error("That email already belongs to another agency.");
  }
  await upsertCredentialPassword(user.id, input.password.trim());
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql`
    insert into staff_accounts (user_id, email, name, permission, shift_id, active_shift_id, agency_id, is_owner)
    values (${user.id}, ${email}, ${name}, ${"admin"}, ${input.shiftId}, ${input.shiftId}, ${input.agencyId}, false)
    on conflict (user_id) do update set
      email = excluded.email,
      name = excluded.name,
      permission = ${"admin"},
      shift_id = excluded.shift_id,
      active_shift_id = excluded.active_shift_id,
      agency_id = excluded.agency_id,
      is_owner = false
  `;
  await sql`
    insert into agency_members (user_id, agency_id, permission, officer_id, agency_admin)
    values (${user.id}, ${input.agencyId}, ${"admin"}, ${null}, false)
    on conflict (user_id, agency_id) do update
      set permission = ${"admin"}, agency_admin = false
  `;
  return { userId: user.id, email };
}

export async function provisionDivisionLeader(input: {
  name: string;
  email: string;
  password: string;
  agencyId: string;
}): Promise<{ userId: string; email: string }> {
  const email = emailKey(input.email);
  if (!email.includes("@")) throw new Error("Division leader email is required.");
  if (email === OWNER_LOGIN) throw new Error("That email is the operator login.");
  if (input.password.trim().length < 8) {
    throw new Error("Give the division leader a temporary password of 8+ characters.");
  }
  const name = input.name.trim() || email.split("@")[0] || "Division leader";
  let user = await findUserByEmail(email);
  if (!user) user = await ensureUserForEmail(email, name);
  const existing = await loadStaff(user.id);
  if (existing?.agencyId && existing.agencyId !== input.agencyId) {
    throw new Error("That email already belongs to another agency.");
  }
  await upsertCredentialPassword(user.id, input.password.trim());
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql`
    insert into staff_accounts (user_id, email, name, permission, shift_id, active_shift_id, agency_id, is_owner)
    values (${user.id}, ${email}, ${name}, ${"captain"}, ${null}, ${null}, ${input.agencyId}, false)
    on conflict (user_id) do update set
      email = excluded.email,
      name = excluded.name,
      permission = ${"captain"},
      agency_id = excluded.agency_id,
      is_owner = false
  `;
  await sql`
    insert into agency_members (user_id, agency_id, permission, officer_id, agency_admin)
    values (${user.id}, ${input.agencyId}, ${"captain"}, ${null}, true)
    on conflict (user_id, agency_id) do update
      set permission = ${"captain"}, agency_admin = true
  `;
  return { userId: user.id, email };
}

async function ensureOperatorLogins() {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const people = await sql<StaffRow>`
    select user_id, email, name, permission, officer_id, shift_id, active_shift_id, agency_id, viewing_agency_id, is_owner
    from staff_accounts
  `;
  if (people.length === 0) return;
  const owner = people.find((p) => emailKey(p.email) === OWNER_LOGIN);
  const commander = people.find((p) => emailKey(p.email) === COMMANDER_LOGIN);
  const source = commander
    ? mapStaff(commander)
    : owner
      ? mapStaff(owner)
      : people.find((p) => p.is_owner)
        ? mapStaff(people.find((p) => p.is_owner)!)
        : mapStaff(people[0]!);

  const ownerId = await provisionLogin(OWNER_LOGIN, source);
  const commanderId = await provisionLogin(COMMANDER_LOGIN, source);

  await sql`update staff_accounts set is_owner = false where user_id <> ${ownerId}`;
  await sql`
    update staff_accounts
    set is_owner = true,
        permission = 'admin',
        email = ${OWNER_LOGIN},
        agency_id = null,
        shift_id = null,
        officer_id = null
    where user_id = ${ownerId}
  `;
  await sql`delete from agency_members where user_id = ${ownerId}`;
  await sql`
    update staff_accounts
    set is_owner = false, permission = 'admin', email = ${COMMANDER_LOGIN}
    where user_id = ${commanderId}
  `;
  await sql`update "user" set email = ${OWNER_LOGIN} where id = ${ownerId}`;
  await sql`update "user" set email = ${COMMANDER_LOGIN} where id = ${commanderId}`;
  await bindGrokGateToOwner(ownerId);
  await sql`delete from agency_members where user_id = ${ownerId}`;
  const commanderAgency = await sql<{ agency_id: string | null }>`
    select agency_id from staff_accounts where user_id = ${commanderId}
  `;
  const homeAgency = commanderAgency[0]?.agency_id;
  if (homeAgency) {
    await sql`
      delete from agency_members
      where user_id = ${commanderId} and agency_id <> ${homeAgency}
    `;
    await sql`
      insert into agency_members (user_id, agency_id, permission, officer_id, agency_admin)
      values (${commanderId}, ${homeAgency}, ${"admin"}, ${null}, false)
      on conflict (user_id, agency_id) do update
        set permission = ${"admin"}, agency_admin = false
    `;
  }
  await sql`
    update agency_members set agency_admin = false
    where user_id = ${commanderId}
  `;
}

async function bindGrokGateToOwner(ownerId: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const ownerHasGate = await sql<{ id: string }>`
    select id from "account"
    where "providerId" = ${"grok-gate"} and "userId" = ${ownerId}
    limit 1
  `;
  const gates = await sql<{ userId: string }>`
    select "userId" as "userId" from "account" where "providerId" = ${"grok-gate"}
  `;
  for (const row of gates) {
    if (row.userId === ownerId) continue;
    if (ownerHasGate[0]) {
      await sql`
        delete from "account"
        where "providerId" = ${"grok-gate"} and "userId" = ${row.userId}
      `;
    } else {
      await sql`
        update "account"
        set "userId" = ${ownerId}
        where "providerId" = ${"grok-gate"} and "userId" = ${row.userId}
      `;
    }
    await sql`
      update "session" set "userId" = ${ownerId} where "userId" = ${row.userId}
    `;
  }
  await sql`
    update "user"
    set email = ${OWNER_LOGIN}, name = ${"Christopher Keyes"}
    where id = ${ownerId}
  `;
}

async function loadStaff(userId: string): Promise<StaffAccount | null> {
  await ensureTables();
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<StaffRow>`
    select user_id, email, name, permission, officer_id, shift_id, active_shift_id, agency_id, viewing_agency_id, is_owner
    from staff_accounts
    where user_id = ${userId}
  `;
  return rows[0] ? mapStaff(rows[0]) : null;
}

async function purgeUser(userId: string, email: string) {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  await sql`delete from staff_accounts where user_id = ${userId}`;
  await sql`delete from password_resets where lower(email) = ${email.toLowerCase()}`;
  await sql`delete from "session" where "userId" = ${userId}`;
  await sql`delete from "account" where "userId" = ${userId}`;
  await sql`delete from "user" where id = ${userId}`;
}

async function adminCount(): Promise<number> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ n: number }>`
    select count(*)::int as n from staff_accounts where permission = 'admin'
  `;
  return rows[0]?.n ?? 0;
}

async function isGateAccount(userId: string): Promise<boolean> {
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const rows = await sql<{ n: number }>`
    select count(*)::int as n
    from "account"
    where "userId" = ${userId} and "providerId" = 'grok-gate'
  `;
  return (rows[0]?.n ?? 0) > 0;
}

async function ensureStaff(userId: string): Promise<StaffAccount> {
  const existing = await loadStaff(userId);
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  const users = await sql<{ id: string; name: string; email: string }>`
    select id, name, email from "user" where id = ${userId}
  `;
  const user = users[0];
  const email = user?.email ?? `${userId}@watchboard.local`;
  const name = user?.name?.trim() || email.split("@")[0] || "User";
  const gate = await isGateAccount(userId);
  const admins = await adminCount();
  const staffEmail = gate ? OWNER_LOGIN : email;
  const staffKey = emailKey(staffEmail);
  const designatedOwner = staffKey === OWNER_LOGIN || gate;
  const designatedCommander = !gate && staffKey === COMMANDER_LOGIN;
  let permission: Permission =
    existing?.permission === "admin" || admins === 0 || gate || designatedOwner || designatedCommander
      ? "admin"
      : (existing?.permission ?? "officer");
  if (designatedOwner || designatedCommander) permission = "admin";

  const owners = await sql<{ n: number }>`
    select count(*)::int as n from staff_accounts where is_owner = true
  `;
  const makeOwner = designatedOwner || ((owners[0]?.n ?? 0) === 0 && !designatedCommander && (permission === "admin" || gate));

  if (existing) {
    let next = existing.permission;
    if (admins === 0 || gate || designatedOwner || designatedCommander) next = "admin";
    const isOwner = designatedCommander ? false : Boolean(designatedOwner || existing.isOwner || makeOwner);
    if (
      next !== existing.permission ||
      isOwner !== existing.isOwner ||
      emailKey(existing.email) !== staffKey
    ) {
      await sql`
        update staff_accounts
        set permission = ${next}, name = ${name}, email = ${staffEmail}, is_owner = ${isOwner},
            agency_id = case when ${isOwner} then null else agency_id end
        where user_id = ${userId}
      `;
      return { ...existing, permission: next, name, email: staffEmail, isOwner, agencyId: isOwner ? null : existing.agencyId };
    }
    return { ...existing, isOwner };
  }

  await sql`
    insert into staff_accounts (user_id, email, name, permission, is_owner)
    values (${userId}, ${staffEmail}, ${name}, ${permission}, ${makeOwner})
    on conflict (user_id) do nothing
  `;
  return (await loadStaff(userId)) ?? {
    userId,
    email: staffEmail,
    name,
    permission,
    officerId: null,
    shiftId: null,
    activeShiftId: null,
    agencyId: null,
    viewingAgencyId: null,
    isOwner: makeOwner,
    agencyAdmin: false,
  };
}

export async function accessFor(userId: string): Promise<StaffAccount & { caps: Caps; canClaimCommand: boolean }> {
  const staff = await ensureStaff(userId);
  const { getSql } = await import("@/lib/db");
  const sql = await getSql();
  let agencyAdmin = staff.isOwner || staff.permission === "captain";
  if (!agencyAdmin && staff.permission !== "admin" && staff.agencyId) {
    const rows = await sql<{ agency_admin: boolean | null }>`
      select agency_admin from agency_members
      where user_id = ${userId} and agency_id = ${staff.agencyId}
    `;
    agencyAdmin = Boolean(rows[0]?.agency_admin);
  }
  const full = { ...staff, agencyAdmin };
  let canClaimCommand = false;
  if (full.permission !== "admin" && !full.isOwner && !agencyAdmin) {
    const admins = full.agencyId
      ? await sql<{ n: number }>`
          select count(*)::int as n from staff_accounts
          where permission = 'admin' and agency_id = ${full.agencyId}
        `
      : await sql<{ n: number }>`
          select count(*)::int as n from staff_accounts where permission = 'admin'
        `;
    canClaimCommand = (admins[0]?.n ?? 0) === 0;
  }
  return {
    ...full,
    caps: capsFor(full.permission, { isOwner: full.isOwner, agencyAdmin }),
    canClaimCommand,
  };
}

export async function requireCap(userId: string, cap: keyof Caps) {
  const access = await accessFor(userId);
  if (!access.caps[cap]) {
    throw new Error("You do not have permission for that.");
  }
  return access;
}

export const getSignupOpen = createServerFn({ method: "GET" }).handler(async () => {
  await ensureTables();
  return { open: true };
});

export const getMyAccess = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => accessFor(context.userId));

export const claimShiftCommand = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await accessFor(context.userId);
    if (me.permission === "admin" || me.caps.manageAccounts || me.isOwner || me.agencyAdmin) {
      return me;
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    // Bootstrap only when this agency (or the whole board) has no commander yet.
    const admins = me.agencyId
      ? await sql<{ n: number }>`
          select count(*)::int as n from staff_accounts
          where permission = 'admin' and agency_id = ${me.agencyId}
        `
      : await sql<{ n: number }>`
          select count(*)::int as n from staff_accounts where permission = 'admin'
        `;
    if ((admins[0]?.n ?? 0) > 0) {
      throw new Error(
        "Ask an existing shift commander or agency admin to promote you on Accounts.",
      );
    }
    await sql`
      update staff_accounts
      set permission = 'admin'
      where user_id = ${context.userId}
    `;
    return {
      ...me,
      permission: "admin" as const,
      caps: capsFor("admin", { isOwner: me.isOwner, agencyAdmin: me.agencyAdmin }),
    };
  });

export const linkMyOfficer = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ officerId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const me = await accessFor(context.userId);
    if (me.officerId && me.officerId !== data.officerId && !me.caps.manageAccounts) {
      throw new Error("Your login is already tied to an officer. Ask the shift commander to change it.");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const officers = await sql<{ id: string }>`select id from officers where id = ${data.officerId}`;
    if (!officers[0]) throw new Error("Officer not found.");
    await sql`
      update staff_accounts
      set officer_id = ${data.officerId}
      where user_id = ${context.userId}
    `;
    return { officerId: data.officerId };
  });



export const listStaff = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const me = await requireCap(context.userId, "manageAccounts");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const { currentAgencyIdFor } = await import("@/lib/agencies");
    const { activeShiftIdFor, loadShift, listShiftRows } = await import("@/lib/shifts");
    const agencyId = await currentAgencyIdFor(context.userId);
    const shiftId = await activeShiftIdFor(context.userId);
    const shift = shiftId ? await loadShift(shiftId) : null;
    const people = await sql<StaffRow>`
      select user_id, email, name, permission, officer_id, shift_id, active_shift_id, agency_id, viewing_agency_id, is_owner
      from staff_accounts
      where coalesce(is_owner, false) = false
        and agency_id = ${agencyId}
        and permission <> ${"captain"}
        and (
          shift_id = ${shiftId}
          or (
            (shift_id is null or shift_id = '')
            and active_shift_id = ${shiftId}
          )
        )
      order by permission, name
    `;
    const emails = people.map((p) => p.email.toLowerCase());
    const resets = emails.length
      ? await sql<ResetRow>`
          select id, email, code, expires_at::text as expires_at, used
          from password_resets
          where used = false
          order by created_at desc
        `
      : [];
    const officers = shiftId
      ? await sql<{ id: string; name: string }>`
          select id, name from officers where shift_id = ${shiftId} order by rank_sort, name
        `
      : [];
    const shifts = await listShiftRows(agencyId);
    const userIds = people.map((p) => p.user_id);
    const loginRows =
      userIds.length > 0
        ? await sql.query<{ user_id: string; last_login: string | null }>(
            `select "userId" as user_id,
                    to_char(max("createdAt") at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as last_login
             from "session"
             where "userId" = any($1::text[])
             group by "userId"`,
            [userIds],
          )
        : [];
    const lastLoginByUser = new Map(
      loginRows.map((r) => [r.user_id, r.last_login] as const),
    );
    return {
      people: people.map((p) => ({
        ...mapStaff(p),
        lastLoginAt: lastLoginByUser.get(p.user_id) ?? null,
      })),
      resets: resets
        .filter((r) => emails.includes(r.email.toLowerCase()))
        .map((r) => ({
          id: r.id,
          email: r.email,
          code: r.code,
          expiresAt: r.expires_at,
        })),
      officers,
      shift: shift ? { id: shift.id, name: shift.name } : null,
      shifts: shifts.map((s) => ({ id: s.id, name: s.name })),
    };
  });

export const createStaffUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      name: z.string().min(1).max(80),
      email: z.string().email(),
      password: z.string().min(8).max(72),
      permission: z.enum(["captain", "admin", "supervisor", "dispatcher", "officer"]),
      officerId: z.string().min(1).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const me = await requireCap(context.userId, "manageAccounts");
    if (!assignablePermissions(me.caps).includes(data.permission)) {
      throw new Error("Ask a division leader to add a shift commander.");
    }
    const shiftId = me.activeShiftId || me.shiftId || "default";
    const { currentAgencyIdFor } = await import("@/lib/agencies");
    const agencyId = await currentAgencyIdFor(context.userId);
    const email = data.email.trim().toLowerCase();
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const taken = await sql<{ id: string }>`select id from "user" where email = ${email}`;
    if (taken[0]) throw new Error("That email already has an account.");
    const userId = newId();
    const now = new Date().toISOString();
    const password = await hashPassword(data.password);
    await sql`
      insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
      values (${userId}, ${data.name.trim()}, ${email}, true, ${now}, ${now})
    `;
    await sql`
      insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
      values (${newId()}, ${userId}, 'credential', ${userId}, ${password}, ${now}, ${now})
    `;
    await sql`
      insert into staff_accounts (user_id, email, name, permission, officer_id, shift_id, active_shift_id, agency_id)
      values (
        ${userId},
        ${email},
        ${data.name.trim()},
        ${data.permission},
        ${data.officerId ?? null},
        ${shiftId},
        ${shiftId},
        ${agencyId}
      )
    `;
    await sql`
      insert into agency_members (user_id, agency_id, permission, officer_id, agency_admin)
      values (
        ${userId},
        ${agencyId},
        ${data.permission},
        ${data.officerId ?? null},
        ${data.permission === "captain"}
      )
      on conflict (user_id, agency_id) do update
        set permission = excluded.permission, agency_admin = excluded.agency_admin
    `;
    return { userId };
  });

export const setStaffPermission = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      userId: z.string().min(1),
      permission: z.enum(["captain", "admin", "supervisor", "dispatcher", "officer"]),
      officerId: z.string().min(1).nullable().optional(),
      shiftId: z.string().min(1).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    const me = await requireCap(context.userId, "manageAccounts");
    if (!assignablePermissions(me.caps).includes(data.permission)) {
      throw new Error("Ask a division leader to change that role.");
    }
    if (data.userId === me.userId && me.caps.manageAgency && data.permission !== "captain" && !me.isOwner) {
      throw new Error("You cannot remove your own division access.");
    }
    if (data.userId === me.userId && data.permission !== "admin" && data.permission !== "captain" && me.permission === "admin") {
      throw new Error("You cannot remove your own commander access.");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const target = await loadStaff(data.userId);
    if (!target) throw new Error("Account not found.");
    if (data.permission !== "admin") {
      const admins = await sql<{ n: number }>`
        select count(*)::int as n from staff_accounts where permission = 'admin'
      `;
      if (target.permission === "admin" && (admins[0]?.n ?? 0) <= 1) {
        throw new Error("Keep at least one admin on the shift.");
      }
    }
    const officerId = data.officerId === undefined ? target.officerId : data.officerId;
    const nextShift = data.shiftId || target.shiftId;
    if (data.shiftId && !me.caps.manageAgency && !me.isOwner) {
      throw new Error("Only a division leader can move a login to another shift.");
    }
    await sql`
      update staff_accounts
      set permission = ${data.permission},
          officer_id = ${officerId},
          shift_id = ${nextShift},
          active_shift_id = ${nextShift}
      where user_id = ${data.userId}
    `;
    if (target.agencyId) {
      await sql`
        update agency_members
        set permission = ${data.permission},
            officer_id = ${officerId},
            agency_admin = ${data.permission === "captain"}
        where user_id = ${data.userId} and agency_id = ${target.agencyId}
      `;
    }
    return { ok: true };
  });

export const setStaffPassword = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      userId: z.string().min(1),
      password: z.string().min(8).max(72),
    }),
  )
  .handler(async ({ context, data }) => {
    await requireCap(context.userId, "manageAccounts");
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const password = await hashPassword(data.password);
    const now = new Date().toISOString();
    const updated = await sql<{ id: string }>`
      update "account"
      set password = ${password}, "updatedAt" = ${now}
      where "userId" = ${data.userId} and "providerId" = 'credential'
      returning id
    `;
    if (!updated[0]) {
      await sql`
        insert into "account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
        values (${newId()}, ${data.userId}, 'credential', ${data.userId}, ${password}, ${now}, ${now})
      `;
    }
    return { ok: true };
  });

export const deleteStaffUser = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ userId: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const me = await requireCap(context.userId, "manageAccounts");
    if (data.userId === me.userId) {
      throw new Error("Use Delete my account to remove your own login.");
    }
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const target = await loadStaff(data.userId);
    if (!target) throw new Error("Account not found.");
    if (target.permission === "admin") {
      const admins = await sql<{ n: number }>`
        select count(*)::int as n from staff_accounts where permission = 'admin'
      `;
      if ((admins[0]?.n ?? 0) <= 1) {
        throw new Error("Keep at least one admin on the shift.");
      }
    }
    await purgeUser(target.userId, target.email);
    return { ok: true };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ password: z.string().min(1) }))
  .handler(async ({ context, data }) => {
    const me = await ensureStaff(context.userId);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    if (me.permission === "admin") {
      const admins = await sql<{ n: number }>`
        select count(*)::int as n from staff_accounts where permission = 'admin'
      `;
      if ((admins[0]?.n ?? 0) <= 1) {
        throw new Error("Promote someone else to shift commander before deleting this login.");
      }
    }
    const rows = await sql<{ password: string | null }>`
      select password from "account"
      where "userId" = ${context.userId} and "providerId" = 'credential'
    `;
    const hash = rows[0]?.password;
    if (!hash) throw new Error("Enter your password to delete this account.");
    const { verifyPassword } = await import("better-auth/crypto");
    const ok = await verifyPassword({ hash, password: data.password });
    if (!ok) throw new Error("Password is wrong.");
    await purgeUser(me.userId, me.email);
    return { ok: true };
  });

export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      current: z.string().min(1),
      next: z.string().min(8).max(72),
    }),
  )
  .handler(async ({ context, data }) => {
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ password: string | null }>`
      select password from "account"
      where "userId" = ${context.userId} and "providerId" = 'credential'
    `;
    const hash = rows[0]?.password;
    if (!hash) throw new Error("This account signs in another way — ask an admin to set a password.");
    const { verifyPassword } = await import("better-auth/crypto");
    const ok = await verifyPassword({ hash, password: data.current });
    if (!ok) throw new Error("Current password is wrong.");
    const next = await hashPassword(data.next);
    await sql`
      update "account"
      set password = ${next}, "updatedAt" = ${new Date().toISOString()}
      where "userId" = ${context.userId} and "providerId" = 'credential'
    `;
    return { ok: true };
  });

export const requestPasswordReset = createServerFn({ method: "POST" })
  .validator(z.object({ email: z.string().email() }))
  .handler(async ({ data }) => {
    await ensureTables();
    const email = data.email.trim().toLowerCase();
    await ensureUserForEmail(email);
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const code = resetCode();
    const expires = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
    await sql`update password_resets set used = true where lower(email) = ${email} and used = false`;
    await sql`
      insert into password_resets (email, code, expires_at)
      values (${email}, ${code}, ${expires})
    `;
    return { ok: true, code };
  });

export const completePasswordReset = createServerFn({ method: "POST" })
  .validator(
    z.object({
      email: z.string().email(),
      code: z.string().min(4).max(12),
      password: z.string().min(8).max(72),
    }),
  )
  .handler(async ({ data }) => {
    await ensureTables();
    const email = data.email.trim().toLowerCase();
    const code = data.code.trim();
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const rows = await sql<{ id: number; user_id: string | null }>`
      select r.id, u.id as user_id
      from password_resets r
      join "user" u on lower(u.email) = lower(r.email)
      where lower(r.email) = ${email}
        and r.code = ${code}
        and r.used = false
        and r.expires_at > now()
      order by r.created_at desc
      limit 1
    `;
    const row = rows[0];
    if (!row?.user_id) throw new Error("That code is invalid or expired.");
    await upsertCredentialPassword(row.user_id, data.password);
    await sql`update password_resets set used = true where id = ${row.id}`;
    await ensureStaff(row.user_id);
    return { ok: true };
  });

export const attachMyLogin = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      email: z.string().email(),
      password: z.string().min(8).max(72),
      name: z.string().max(80).optional(),
    }),
  )
  .handler(async ({ context, data }) => {
    await ensureTables();
    const email = data.email.trim().toLowerCase();
    const { getSql } = await import("@/lib/db");
    const sql = await getSql();
    const taken = await sql<{ id: string }>`
      select id from "user" where lower(email) = ${email} and id <> ${context.userId}
    `;
    if (taken[0]) throw new Error("That email is already on another account.");
    const name = (data.name ?? "").trim();
    const now = new Date().toISOString();
    if (name) {
      await sql`
        update "user"
        set email = ${email}, name = ${name}, "emailVerified" = true, "updatedAt" = ${now}
        where id = ${context.userId}
      `;
    } else {
      await sql`
        update "user"
        set email = ${email}, "emailVerified" = true, "updatedAt" = ${now}
        where id = ${context.userId}
      `;
    }
    await upsertCredentialPassword(context.userId, data.password);
    await sql`
      update staff_accounts
      set email = ${email}, name = coalesce(nullif(${name}, ''), name)
      where user_id = ${context.userId}
    `;
    return { ok: true };
  });
