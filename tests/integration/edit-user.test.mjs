import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { COMMANDER_LOGIN, seedBoard, seedLogin, startApp } from "./harness.mjs";

let app;
let board;
let staff;
let fns;
let disabled;
let auth;

const officerId = async (name) => (await app.sql`select id from officers where name = ${name}`)[0].id;
const staffRow = async (userId) =>
  (await app.sql`
    select name, email, permission, agency_id, shift_id, officer_id, rank, disabled_at, cap_overrides
    from staff_accounts where user_id = ${userId}
  `)[0];
const audits = async (userId) =>
  app.sql`select actor_id, changes from staff_audit where target_id = ${userId} order by id`;

before(async () => {
  app = await startApp();
  board = await seedBoard(app);
  staff = board.staff;
  fns = await app.load("/src/lib/fns.ts");
  disabled = await app.load("/src/lib/auth/disabled.server.ts");
  ({ auth } = await app.load("/src/lib/auth/server.ts"));
  await app.sql`insert into agencies (id, name, short_name) values ('metro', 'Metro PD', 'MPD')`;
  await app.sql`insert into shifts (id, name, agency_id) values ('metro-days', 'Days', 'metro')`;
  await seedLogin(app.sql, { id: "leaderA", permission: "captain", agencyId: "home" });
  await seedLogin(app.sql, { id: "leaderB", permission: "captain", agencyId: "metro" });
  await seedLogin(app.sql, { id: "metro1", agencyId: "metro", shiftId: "metro-days" });
  await seedLogin(app.sql, {
    id: "mayfield",
    name: "L. Mayfield",
    agencyId: "home",
    shiftId: "second-shift",
    officerId: await officerId("L. MAYFIELD"),
  });
  await seedLogin(app.sql, { id: "dispatch1", permission: "dispatcher", agencyId: "home", shiftId: "second-shift" });
  await seedLogin(app.sql, { id: "cmd3", permission: "admin", agencyId: "home", shiftId: "third-shift" });
});
after(async () => {
  await app?.close();
});

describe("Edit user: name and email (acceptance 1-2)", () => {
  it("1. owner edits a name: user + staff_accounts change and survive ensureStaff", async () => {
    await staff.updateStaffUserFor(board.ownerId, { userId: "dispatch1", name: "  Dana Dispatch  " });
    const u = (await app.sql`select name from "user" where id = 'dispatch1'`)[0];
    assert.equal(u.name, "Dana Dispatch");
    assert.equal((await staffRow("dispatch1")).name, "Dana Dispatch");
    const reload = await staff.accessFor("dispatch1");
    assert.equal(reload.name, "Dana Dispatch");
  });

  it("2. email is stored lowercase and unique ignoring case; fixed logins are locked", async () => {
    await staff.updateStaffUserFor(board.ownerId, { userId: "dispatch1", email: "New@Agency.gov" });
    assert.equal((await app.sql`select email from "user" where id = 'dispatch1'`)[0].email, "new@agency.gov");
    assert.equal((await staffRow("dispatch1")).email, "new@agency.gov");
    await assert.rejects(
      () => staff.updateStaffUserFor(board.ownerId, { userId: "metro1", email: "NEW@agency.gov" }),
      /already on another login/,
    );
    const commanderId = (await app.sql`select id from "user" where email = ${COMMANDER_LOGIN}`)[0].id;
    await assert.rejects(
      () => staff.updateStaffUserFor(board.ownerId, { userId: commanderId, email: "other@wcso95.org" }),
      /fixed/,
    );
    await assert.rejects(
      () => staff.updateStaffUserFor(board.ownerId, { userId: board.ownerId, email: "x@y.gov" }),
      /fixed/,
    );
    await assert.rejects(
      () => staff.updateStaffUserFor(board.ownerId, { userId: "metro1", email: "CKEYES861@gmail.com" }),
      /reserved|already on another login/,
    );
  });
});

describe("Edit user: rank (acceptance 3-4)", () => {
  it("3. linked login: rank writes officers.role; roster re-sorts and S-number goes away", async () => {
    const id = await officerId("L. MAYFIELD");
    const before = await fns.loadOfficers("second-shift");
    const was = before.find((o) => o.id === id);
    assert.equal(was.role, "deputy");
    assert.ok(was.radioNum !== null, "deputies carry an S number");
    const res = await staff.updateStaffUserFor(board.ownerId, { userId: "mayfield", rank: "sgt" });
    assert.deepEqual(res.changed, ["rank"]);
    assert.equal((await app.sql`select role from officers where id = ${id}`)[0].role, "sgt");
    assert.equal((await staffRow("mayfield")).rank, null, "roster is the source of truth");
    const after = await fns.loadOfficers("second-shift");
    const now = after.find((o) => o.id === id);
    assert.equal(now.radioNum, null, "S number removed");
    const idx = after.findIndex((o) => o.id === id);
    const firstCpl = after.findIndex((o) => o.role === "cpl");
    assert.ok(firstCpl === -1 || idx < firstCpl, "a Sergeant sorts before Corporals");
  });

  it("3. unlinked login writes staff_accounts.rank; bad ranks are rejected by zod and the CHECK", async () => {
    await staff.updateStaffUserFor(board.ownerId, { userId: "dispatch1", rank: "cpl" });
    assert.equal((await staffRow("dispatch1")).rank, "cpl");
    assert.equal(staff.updateStaffInput.safeParse({ userId: "dispatch1", rank: "captain" }).success, false);
    await assert.rejects(() => app.sql`update staff_accounts set rank = 'captain' where user_id = 'dispatch1'`);
  });

  it("4. rank never changes permission or caps, and vice versa", async () => {
    const capsBefore = (await staff.accessFor("dispatch1")).caps;
    await staff.updateStaffUserFor(board.ownerId, { userId: "dispatch1", rank: "lt" });
    const row = await staffRow("dispatch1");
    assert.equal(row.permission, "dispatcher");
    assert.deepEqual((await staff.accessFor("dispatch1")).caps, capsBefore);
    await staff.updateStaffUserFor(board.ownerId, { userId: "dispatch1", permission: "supervisor" });
    assert.equal((await staffRow("dispatch1")).rank, "lt");
  });
});

describe("Edit user: agency, shift, officer link (acceptance 5-7)", () => {
  it("5. owner moves a login to agency B + shift B1; link cleared; A1 with B rejected", async () => {
    await assert.rejects(
      () =>
        staff.updateStaffUserFor(board.ownerId, {
          userId: "mayfield",
          agencyId: "metro",
          shiftId: "second-shift",
        }),
      /not in the selected agency/,
    );
    assert.equal((await staffRow("mayfield")).agency_id, "home", "nothing written on failure");
    await staff.updateStaffUserFor(board.ownerId, {
      userId: "mayfield",
      agencyId: "metro",
      shiftId: "metro-days",
    });
    const row = await staffRow("mayfield");
    assert.equal(row.agency_id, "metro");
    assert.equal(row.shift_id, "metro-days");
    assert.equal(row.officer_id, null, "home officer isn't on metro-days");
    const members = await app.sql`select agency_id from agency_members where user_id = 'mayfield'`;
    assert.deepEqual(members.map((m) => m.agency_id), ["metro"]);
  });

  it("5. owner can set a login back to Unassigned", async () => {
    await staff.updateStaffUserFor(board.ownerId, { userId: "mayfield", agencyId: null });
    const row = await staffRow("mayfield");
    assert.equal(row.agency_id, null);
    assert.equal(row.shift_id, null);
    assert.equal((await app.sql`select 1 from agency_members where user_id = 'mayfield'`).length, 0);
    assert.equal((await staff.accessFor("mayfield")).unassigned, true);
  });

  it("6. division leader edits own agency, not B's, and can't move agencies; commanders can't edit", async () => {
    await staff.updateStaffUserFor("leaderA", { userId: "dispatch1", name: "Dana D." });
    await assert.rejects(
      () => staff.updateStaffUserFor("leaderA", { userId: "metro1", name: "x" }),
      /belongs to another agency/,
    );
    await assert.rejects(
      () => staff.updateStaffUserFor("leaderA", { userId: "dispatch1", agencyId: "metro", shiftId: "metro-days" }),
      /Only the operator/,
    );
    await assert.rejects(
      () => staff.updateStaffUserFor("cmd2", { userId: "dispatch1", name: "y" }),
      /division leader or the operator/,
    );
    const list = await staff.listStaffFor("cmd2", "shift");
    assert.ok(list.people.every((p) => p.editable === false), "no Edit details for commanders");
    const leaderList = await staff.listStaffFor("leaderA", "agency");
    assert.ok(leaderList.people.find((p) => p.userId === "dispatch1").editable);
  });

  it("7. an officer already linked to one login can't be linked to a second", async () => {
    const huggins = await officerId("CPL. D. HUGGINS");
    await staff.updateStaffUserFor(board.ownerId, { userId: "dispatch1", officerId: huggins });
    assert.equal((await staffRow("dispatch1")).officer_id, huggins);
    assert.equal((await staffRow("dispatch1")).rank, null, "the roster rank replaced the login rank");
    await seedLogin(app.sql, { id: "dup", agencyId: "home", shiftId: "second-shift" });
    await assert.rejects(
      () => staff.updateStaffUserFor(board.ownerId, { userId: "dup", officerId: huggins }),
      /already linked/,
    );
  });
});

describe("Edit user: Disabled (acceptance 8)", () => {
  let userId;
  const email = "disable.me@wcso95.org";
  const password = "disable-me-pass";

  it("disabling kills sessions, refuses the next server call and new sign-in; re-enable restores", async () => {
    ({ userId } = await staff.createStaffUserFor("cmd2", {
      name: "Disable Me",
      email,
      password,
      permission: "officer",
    }));
    const first = await auth.api.signInEmail({ body: { email, password } });
    assert.ok(first?.token, "signs in while active");
    await staff.updateStaffUserFor("leaderA", { userId, disabled: true });
    assert.ok((await staffRow(userId)).disabled_at);
    assert.equal((await app.sql`select 1 from "session" where "userId" = ${userId}`).length, 0);
    assert.equal(await disabled.isLoginDisabled(userId), true, "authMiddleware refuses it");
    await assert.rejects(() => auth.api.signInEmail({ body: { email, password } }), /disabled/i);
    await staff.updateStaffUserFor("leaderA", { userId, disabled: false });
    assert.equal(await disabled.isLoginDisabled(userId), false);
    const again = await auth.api.signInEmail({ body: { email, password } });
    assert.ok(again?.token, "signs in again after re-enable");
  });

  it("can't disable yourself, the owner, or the last commander of a shift", async () => {
    await assert.rejects(
      () => staff.updateStaffUserFor("leaderA", { userId: "leaderA", disabled: true }),
      /your own/,
    );
    await assert.rejects(
      () => staff.updateStaffUserFor(board.ownerId, { userId: board.ownerId, disabled: true }),
      /your own/,
    );
    await assert.rejects(
      () => staff.updateStaffUserFor("leaderA", { userId: board.ownerId, disabled: true }),
    );
    await assert.rejects(
      () => staff.updateStaffUserFor("leaderA", { userId: "cmd3", disabled: true }),
      /at least one active commander/,
    );
  });
});

describe("Edit user: audit (acceptance 9)", () => {
  it("each save writes one staff_audit row with only the changed fields", async () => {
    await seedLogin(app.sql, { id: "audited", agencyId: "home", shiftId: "second-shift" });
    await staff.updateStaffUserFor(board.ownerId, {
      userId: "audited",
      name: "Audited Person",
      email: "audited@example.gov", // unchanged
      permission: "officer", // unchanged
    });
    let rows = await audits("audited");
    assert.equal(rows.length, 1);
    assert.equal(rows[0].actor_id, board.ownerId);
    assert.deepEqual(JSON.parse(rows[0].changes), { name: ["audited", "Audited Person"] });
    await staff.updateStaffUserFor("leaderA", { userId: "audited", permission: "supervisor", rank: "fto" });
    rows = await audits("audited");
    assert.equal(rows.length, 2);
    assert.deepEqual(JSON.parse(rows[1].changes), {
      rank: [null, "fto"],
      permission: ["officer", "supervisor"],
    });
    // A save with no changes writes nothing.
    await staff.updateStaffUserFor("leaderA", { userId: "audited", name: "Audited Person" });
    assert.equal((await audits("audited")).length, 2);
    const listed = await staff.staffAuditFor("leaderA", "audited");
    assert.equal(listed.length, 2);
  });

  it("a failed save writes no audit row and changes nothing", async () => {
    const n = (await audits("metro1")).length;
    await assert.rejects(() =>
      staff.updateStaffUserFor("leaderA", { userId: "metro1", name: "nope" }),
    );
    assert.equal((await audits("metro1")).length, n);
  });
});
