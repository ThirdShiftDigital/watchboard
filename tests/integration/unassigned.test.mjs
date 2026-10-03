import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { seedBoard, seedLogin, startApp } from "./harness.mjs";

let app;
let board;
let staff;
let shifts;
let agencies;

before(async () => {
  app = await startApp();
  board = await seedBoard(app);
  staff = board.staff;
  shifts = board.shifts;
  agencies = await app.load("/src/lib/agencies.ts");
});
after(async () => {
  await app?.close();
});

const userCount = async () => (await app.sql`select count(*)::int as n from "user"`)[0].n;

async function invite(code, { used = false, expired = false } = {}) {
  await app.sql`
    insert into agency_invites (code, kind, agency_id, expires_at, used)
    values (${code}, 'join', 'home', ${expired ? "2000-01-01T00:00:00Z" : "2099-01-01T00:00:00Z"}, ${used})
  `;
}

describe("unassigned logins fail closed (spec 3.5)", () => {
  it("a self-signup with no agency gets no caps, no agency, no shift", async () => {
    await seedLogin(app.sql, { id: "jdenson", email: "jdenson@wcso95.org" });
    const me = await staff.accessFor("jdenson");
    assert.equal(me.unassigned, true);
    assert.ok(Object.values(me.caps).every((v) => v === false), "every cap off");
    assert.equal(me.canClaimCommand, false);
    assert.equal(await agencies.currentAgencyIdFor("jdenson"), "");
    assert.equal(await shifts.activeShiftIdFor("jdenson"), "");
    const shift = await shifts.currentShiftFor("jdenson");
    assert.equal(shift.id, "", "placeholder, never a real shift");
    await assert.rejects(() => shifts.requireCurrentShift("jdenson"), /Pick a shift/);
    await assert.rejects(() => staff.requireCap("jdenson", "viewCalendar"), /awaiting assignment/);
  });

  it("cannot link itself to any officer", async () => {
    const officer = board.onShift("second-shift")[0];
    await assert.rejects(() => staff.linkOfficerToSelf("jdenson", officer), /awaiting assignment/);
    const row = (await app.sql`select officer_id from staff_accounts where user_id = 'jdenson'`)[0];
    assert.equal(row.officer_id, null);
  });

  it("a login whose shift is missing or in another agency is unassigned too", async () => {
    await seedLogin(app.sql, { id: "stale", agencyId: "home", shiftId: "deleted-shift" });
    assert.equal((await staff.accessFor("stale")).unassigned, true);
    assert.equal(await shifts.activeShiftIdFor("stale"), "", "no oldest-shift fallback");
    await app.sql`insert into agencies (id, name, short_name) values ('metro', 'Metro PD', 'MPD')`;
    await app.sql`
      insert into shifts (id, name, agency_id) values ('metro-days', 'Days', 'metro')
    `;
    await seedLogin(app.sql, { id: "crossed", agencyId: "home", shiftId: "metro-days" });
    assert.equal((await staff.accessFor("crossed")).unassigned, true);
  });

  it("the hand-fixed jdenson row (home + second-shift) works normally", async () => {
    await app.sql`
      update staff_accounts set agency_id = 'home', shift_id = 'second-shift', active_shift_id = 'second-shift'
      where user_id = 'jdenson'
    `;
    const me = await staff.accessFor("jdenson");
    assert.equal(me.unassigned, false);
    assert.equal(me.caps.submitRequests, true);
    assert.equal(me.caps.viewCalendar, true);
    assert.equal(await shifts.activeShiftIdFor("jdenson"), "second-shift");
  });
});

describe("officer linking checks agency, shift and one-login-per-officer", () => {
  it("refuses an officer on another shift for a non-admin", async () => {
    const other = board.onShift("third-shift")[0];
    await assert.rejects(() => staff.linkOfficerToSelf("jdenson", other), /another shift/);
  });
  it("links an officer on the caller's own shift", async () => {
    const mine = board.onShift("second-shift")[1];
    const res = await staff.linkOfficerToSelf("jdenson", mine);
    assert.equal(res.officerId, mine);
    const m = (await app.sql`select officer_id from agency_members where user_id = 'jdenson' and agency_id = 'home'`)[0];
    assert.equal(m.officer_id, mine);
  });
  it("refuses an officer already tied to another login", async () => {
    await seedLogin(app.sql, { id: "dep2", agencyId: "home", shiftId: "second-shift" });
    const taken = board.onShift("second-shift")[1];
    await assert.rejects(() => staff.linkOfficerToSelf("dep2", taken), /already linked/);
  });
  it("refuses a missing officer", async () => {
    await assert.rejects(() => staff.linkOfficerToSelf("dep2", "no-such-officer"), /Officer not found/);
  });
});

describe("existing users keep working", () => {
  it("the operator keeps platform access with no agency", async () => {
    const me = await staff.accessFor(board.ownerId);
    assert.equal(me.isOwner, true);
    assert.equal(me.unassigned, false);
    assert.equal(me.caps.managePlatform, true);
    assert.equal(me.caps.manageAccounts, true);
  });
  it("a shift commander keeps account management on their shift", async () => {
    const me = await staff.accessFor("cmd2");
    assert.equal(me.unassigned, false);
    assert.equal(me.caps.manageAccounts, true);
    assert.equal(await shifts.activeShiftIdFor("cmd2"), "second-shift");
  });
  it("a division leader with no shift keeps agency access", async () => {
    await seedLogin(app.sql, { id: "cpt", permission: "captain", agencyId: "home" });
    const me = await staff.accessFor("cpt");
    assert.equal(me.unassigned, false);
    assert.equal(me.caps.manageAgency, true);
    assert.ok((await shifts.activeShiftIdFor("cpt")) !== "", "browses the agency's shifts");
  });
});

describe("no silent account creation (spec 3.4)", () => {
  it("Better Auth email sign-up is disabled", async () => {
    const { auth } = await app.load("/src/lib/auth/server.ts");
    const before = await userCount();
    await assert.rejects(
      () => auth.api.signUpEmail({ body: { email: "stranger@x.gov", password: "password123", name: "S" } }),
      /not enabled/,
    );
    assert.equal(await userCount(), before);
  });
  it("a failed sign-in errors and creates nothing", async () => {
    const { auth } = await app.load("/src/lib/auth/server.ts");
    const before = await userCount();
    await assert.rejects(
      () => auth.api.signInEmail({ body: { email: "nobody@x.gov", password: "password123" } }),
      /Invalid email or password/,
    );
    await assert.rejects(
      () => auth.api.signInEmail({ body: { email: "cmd2@wcso95.org", password: "wrong-password" } }),
      /Invalid email or password/,
    );
    assert.equal(await userCount(), before);
  });
  it("any other Better Auth user creation is refused by the database hook", async () => {
    const { auth } = await app.load("/src/lib/auth/server.ts");
    const ctx = await auth.$context;
    const before = await userCount();
    await assert.rejects(() =>
      ctx.internalAdapter.createUser({ email: "oauth@x.gov", name: "O", emailVerified: true }),
    );
    assert.equal(await userCount(), before);
  });
});

describe("invite sign-up lands unassigned", () => {
  it("refuses sign-up without a valid, unused, unexpired invite", async () => {
    const before = await userCount();
    const data = { name: "N", email: "new@x.gov", password: "password123" };
    await assert.rejects(() => staff.createInvitedLogin(data), /invite code/);
    await assert.rejects(() => staff.createInvitedLogin({ ...data, code: "NOPE42" }), /invite code/);
    await invite("USED42", { used: true });
    await assert.rejects(() => staff.createInvitedLogin({ ...data, code: "USED42" }), /invite code/);
    await invite("OLD042", { expired: true });
    await assert.rejects(() => staff.createInvitedLogin({ ...data, code: "OLD042" }), /invite code/);
    assert.equal(await userCount(), before);
  });
  it("creates an unassigned login with a valid invite; email is stored lowercase", async () => {
    await invite("GOOD42");
    const res = await staff.createInvitedLogin({
      code: "good42",
      name: "New Deputy",
      email: "New.Deputy@WCSO95.org",
      password: "password123",
    });
    const user = (await app.sql`select email from "user" where id = ${res.userId}`)[0];
    assert.equal(user.email, "new.deputy@wcso95.org");
    const me = await staff.accessFor(res.userId);
    assert.equal(me.unassigned, true);
    assert.equal(me.agencyId, null);
  });
  it("refuses an email that already has a login, ignoring case", async () => {
    await assert.rejects(
      () =>
        staff.createInvitedLogin({ code: "GOOD42", name: "Dup", email: "NEW.deputy@wcso95.org", password: "password123" }),
      /already has a login/,
    );
  });
});
