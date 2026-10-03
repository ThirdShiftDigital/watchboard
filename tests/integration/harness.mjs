/**
 * Integration harness: loads the real server modules through Vite's SSR loader
 * (same transforms + `@/` aliases as `npm run dev`) against the in-memory
 * PGLite fallback. DATABASE_URL is removed first so these tests can never
 * touch a real database.
 */
import { createServer } from "vite";

export async function startApp() {
  delete process.env.DATABASE_URL;
  delete process.env.WATCHBOARD_DATABASE_URL;
  const server = await createServer({
    configFile: "vite.config.ts",
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: "custom",
    logLevel: "error",
  });
  const load = (path) => server.ssrLoadModule(path);
  const db = await load("/src/lib/db.ts");
  const sql = await db.getSql();
  return { server, load, sql, close: () => server.close() };
}

export const OWNER_LOGIN = "ckeyes861@gmail.com";
export const COMMANDER_LOGIN = "ckeyes@wcso95.org";

/** Insert a "user" row plus (optionally) its staff_accounts / agency_members rows. */
export async function seedLogin(sql, opts) {
  const {
    id,
    email = `${id}@example.gov`,
    name = id,
    permission = "officer",
    agencyId = null,
    shiftId = null,
    officerId = null,
    staff = true,
  } = opts;
  await sql`
    insert into "user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    values (${id}, ${name}, ${email}, true, now(), now())
  `;
  if (!staff) return id;
  await sql`
    insert into staff_accounts (user_id, email, name, permission, officer_id, shift_id, active_shift_id, agency_id)
    values (${id}, ${email}, ${name}, ${permission}, ${officerId}, ${shiftId}, ${shiftId}, ${agencyId})
  `;
  if (agencyId) {
    await sql`
      insert into agency_members (user_id, agency_id, permission, officer_id, agency_admin)
      values (${id}, ${agencyId}, ${permission}, ${officerId}, ${permission === "captain"})
      on conflict (user_id, agency_id) do nothing
    `;
  }
  return id;
}

/**
 * A board like production: agency `home` (WCSO) with the seeded shifts, a
 * shift commander, plus the operator + commander logins ensureOperatorLogins
 * maintains.
 */
export async function seedBoard(app) {
  const { sql, load } = app;
  const shifts = await load("/src/lib/shifts.ts");
  const staff = await load("/src/lib/staff.ts");
  // Seed before the first ensureTables(): ensureOperatorLogins only runs once
  // per process and copies the operator/commander logins from existing staff.
  await seedLogin(sql, {
    id: "cmd2",
    email: "cmd2@wcso95.org",
    name: "Second Shift Commander",
    permission: "admin",
    agencyId: "home",
    shiftId: "second-shift",
  });
  await shifts.ensureShifts();
  await staff.ensureTables();
  const ownerId = (await sql`select id from "user" where email = ${OWNER_LOGIN}`)[0].id;
  const officers = await sql`select id, shift_id from officers order by shift_id, rank_sort`;
  const onShift = (shiftId) => officers.filter((o) => o.shift_id === shiftId).map((o) => o.id);
  return { ownerId, onShift, shifts, staff };
}
