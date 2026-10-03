import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { seedBoard, seedLogin, startApp } from "./harness.mjs";

let app;
let board;
let staff;

before(async () => {
  app = await startApp();
  board = await seedBoard(app);
  staff = board.staff;
  await app.sql`insert into agencies (id, name, short_name) values ('metro', 'Metro PD', 'MPD')`;
  await app.sql`insert into shifts (id, name, agency_id) values ('metro-days', 'Days', 'metro')`;
  // jdenson self-signed up with no agency; mixed-case on purpose.
  await seedLogin(app.sql, { id: "jdenson", email: "JDenson@wcso95.org", name: "J Denson" });
  // A "user" row that never got a staff_accounts row.
  await seedLogin(app.sql, { id: "bare", email: "bare@example.gov", staff: false });
  await seedLogin(app.sql, {
    id: "metro1",
    email: "metro1@metro.gov",
    agencyId: "metro",
    shiftId: "metro-days",
  });
});
after(async () => {
  await app?.close();
});

const membership = async (userId) =>
  app.sql`select agency_id, permission from agency_members where user_id = ${userId}`;
const staffRow = async (userId) =>
  (await app.sql`
    select agency_id, shift_id, active_shift_id, permission, officer_id
    from staff_accounts where user_id = ${userId}
  `)[0];

describe("owner sees all agencies + an Unassigned list (spec 3.1)", () => {
  it("lists unassigned logins, including users with no staff row", async () => {
    const res = await staff.listStaffFor(board.ownerId, "unassigned");
    const ids = res.people.map((p) => p.userId).sort();
    assert.ok(ids.includes("jdenson"));
    assert.ok(ids.includes("bare"));
    assert.ok(!ids.includes("cmd2"), "assigned commander is not unassigned");
    assert.ok(!ids.includes(board.ownerId), "owner never listed");
    assert.ok(res.people.every((p) => p.unassigned));
    assert.ok((res.unassignedCount ?? 0) >= 2);
    const homeShifts = res.placement.find((a) => a.id === "home").shifts.map((s) => s.id);
    assert.ok(homeShifts.includes("second-shift"));
  });

  it("the all scope shows every agency with names", async () => {
    const res = await staff.listStaffFor(board.ownerId, "all");
    const metro = res.people.find((p) => p.userId === "metro1");
    assert.equal(metro.agencyName, "Metro PD");
    assert.equal(metro.shiftName, "Days");
    assert.equal(metro.unassigned, false);
  });

  it("a shift commander can't use the agency / all / unassigned lists", async () => {
    await assert.rejects(() => staff.listStaffFor("cmd2", "unassigned"), /operator/);
    await assert.rejects(() => staff.listStaffFor("cmd2", "all"), /operator/);
    await assert.rejects(() => staff.listStaffFor("cmd2", "agency"), /division leader/);
    const mine = await staff.listStaffFor("cmd2", "shift");
    assert.ok(mine.people.every((p) => p.agencyId === "home"));
    assert.equal(mine.unassignedCount, null);
    assert.equal(mine.placement, null);
  });

  it("assign refuses a shift from another agency", async () => {
    await assert.rejects(
      () =>
        staff.assignLoginFor(board.ownerId, {
          userId: "jdenson",
          agencyId: "home",
          shiftId: "metro-days",
          permission: "officer",
        }),
      /not in the selected agency/,
    );
    assert.equal((await staffRow("jdenson")).agency_id, null);
  });

  it("only the operator can assign", async () => {
    await assert.rejects(
      () =>
        staff.assignLoginFor("cmd2", {
          userId: "jdenson",
          agencyId: "home",
          shiftId: "second-shift",
        }),
      /not allowed|permission|operator|access/i,
    );
  });

  it("owner assigns jdenson to home / second-shift and access opens up", async () => {
    await staff.assignLoginFor(board.ownerId, {
      userId: "jdenson",
      agencyId: "home",
      shiftId: "second-shift",
      permission: "officer",
    });
    const row = await staffRow("jdenson");
    assert.equal(row.agency_id, "home");
    assert.equal(row.shift_id, "second-shift");
    assert.deepEqual(
      (await membership("jdenson")).map((m) => m.agency_id),
      ["home"],
    );
    const me = await staff.accessFor("jdenson");
    assert.equal(me.unassigned, false);
    assert.equal(me.caps.viewCalendar, true);
  });

  it("assigning a bare user creates its staff row", async () => {
    await staff.assignLoginFor(board.ownerId, {
      userId: "bare",
      agencyId: "metro",
      shiftId: "metro-days",
      permission: "officer",
    });
    assert.equal((await staffRow("bare")).agency_id, "metro");
  });
});

describe("add user attaches an existing login (spec 3.2) + case-insensitive email", () => {
  it("adding an unassigned login's email (any case) offers attach, not an error", async () => {
    await seedLogin(app.sql, { id: "selfsign", email: "Self.Sign@WCSO95.org", name: "Self Sign" });
    const before = (await app.sql`select count(*)::int as n from "user"`)[0].n;
    const res = await staff.createStaffUserFor("cmd2", {
      name: "Self Sign",
      email: "self.sign@wcso95.org",
      password: "temporary-pass",
      permission: "officer",
    });
    assert.ok(res.conflict, "returns a conflict to attach");
    assert.equal(res.conflict.userId, "selfsign");
    assert.equal(res.conflict.unassigned, true);
    assert.equal((await app.sql`select count(*)::int as n from "user"`)[0].n, before, "no duplicate user");

    await staff.attachExistingLoginFor("cmd2", { userId: "selfsign", permission: "officer" });
    const row = await staffRow("selfsign");
    assert.equal(row.agency_id, "home");
    assert.equal(row.shift_id, "second-shift");
    assert.equal(row.permission, "officer");
    assert.equal((await staff.accessFor("selfsign")).unassigned, false);
  });

  it("a commander can't take a login from another agency", async () => {
    await assert.rejects(
      () =>
        staff.createStaffUserFor("cmd2", {
          name: "Metro",
          email: "METRO1@metro.gov",
          password: "temporary-pass",
          permission: "officer",
        }),
      /another agency/,
    );
    await assert.rejects(
      () => staff.attachExistingLoginFor("cmd2", { userId: "metro1", permission: "officer" }),
      /another agency/,
    );
    assert.equal((await staffRow("metro1")).agency_id, "metro");
  });

  it("an email already on this agency says so", async () => {
    await assert.rejects(
      () =>
        staff.createStaffUserFor("cmd2", {
          name: "x",
          email: "SELF.SIGN@wcso95.org",
          password: "temporary-pass",
          permission: "officer",
        }),
      /already has a login on this agency/,
    );
  });

  it("the owner's login can never be attached", async () => {
    await assert.rejects(
      () =>
        staff.createStaffUserFor("cmd2", {
          name: "x",
          email: "CKEYES861@gmail.com",
          password: "temporary-pass",
          permission: "officer",
        }),
      /already has an account/,
    );
    await assert.rejects(
      () => staff.attachExistingLoginFor("cmd2", { userId: board.ownerId, permission: "officer" }),
    );
  });

  it("attach can reset the password and signs the login out", async () => {
    await seedLogin(app.sql, { id: "reset-me", email: "reset-me@wcso95.org" });
    await app.sql`
      insert into "session" (id, token, "userId", "expiresAt", "createdAt", "updatedAt")
      values ('s1', 'tok-reset-me', 'reset-me', now() + interval '1 day', now(), now())
    `;
    await staff.attachExistingLoginFor("cmd2", {
      userId: "reset-me",
      permission: "officer",
      password: "brand-new-pass",
    });
    const sessions = await app.sql`select id from "session" where "userId" = 'reset-me'`;
    assert.equal(sessions.length, 0);
    const cred = await app.sql`
      select password from "account" where "userId" = 'reset-me' and "providerId" = 'credential'
    `;
    assert.equal(cred.length, 1);
  });

  it("new logins are stored lowercase and land on the caller's validated shift", async () => {
    const res = await staff.createStaffUserFor("cmd2", {
      name: "New Deputy",
      email: "New.Deputy@WCSO95.org",
      password: "temporary-pass",
      permission: "officer",
    });
    assert.ok(res.userId);
    const u = (await app.sql`select email from "user" where id = ${res.userId}`)[0];
    assert.equal(u.email, "new.deputy@wcso95.org");
    const row = await staffRow(res.userId);
    assert.equal(row.agency_id, "home");
    assert.equal(row.shift_id, "second-shift");
  });
});

describe("createStaffUser validates the shift belongs to the agency (spec 3.3)", () => {
  it("refuses when the caller's shift isn't in their agency (no 'default' fallback)", async () => {
    await seedLogin(app.sql, {
      id: "cmd-bad",
      permission: "admin",
      agencyId: "home",
      shiftId: "metro-days",
    });
    await assert.rejects(
      () =>
        staff.createStaffUserFor("cmd-bad", {
          name: "x",
          email: "x-bad@wcso95.org",
          password: "temporary-pass",
          permission: "officer",
        }),
      /awaiting assignment|Pick a shift/,
    );
    const made = await app.sql`select id from "user" where email = 'x-bad@wcso95.org'`;
    assert.equal(made.length, 0);
  });

  it("refuses an officer from another shift", async () => {
    const other = board.onShift("third-shift")[0];
    await assert.rejects(
      () =>
        staff.createStaffUserFor("cmd2", {
          name: "Linked",
          email: "linked@wcso95.org",
          password: "temporary-pass",
          permission: "officer",
          officerId: other,
        }),
      /shift|agency/i,
    );
  });

  it("no staff row is ever written with the deleted 'default' shift", async () => {
    const rows = await app.sql`
      select user_id from staff_accounts where shift_id = 'default' or active_shift_id = 'default'
    `;
    assert.deepEqual(rows, []);
  });
});
