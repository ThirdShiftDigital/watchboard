import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  RESET_MAX_ATTEMPTS,
  RESET_MAX_PER_EMAIL,
  RESET_MAX_PER_IP,
  RESET_REQUEST_MESSAGE,
  RESET_TTL_MINUTES,
  checkResetAttempt,
  codesMatch,
  resetExpiry,
  resetRequestLimited,
  type StoredReset,
} from "./reset-codes.ts";
import { staffManageBlock, type StaffActor, type StaffTarget } from "./access.ts";

const now = new Date("2026-09-30T04:30:00Z");
const pending = (over: Partial<StoredReset> = {}): StoredReset => ({
  code: "042917",
  used: false,
  attempts: 0,
  expiresAt: new Date(now.getTime() + 10 * 60_000),
  ...over,
});

describe("codesMatch", () => {
  it("matches only the exact code", () => {
    assert.equal(codesMatch("042917", "042917"), true);
    assert.equal(codesMatch("042917", " 042 917 "), true);
    assert.equal(codesMatch("042917", "042918"), false);
    assert.equal(codesMatch("042917", "42917"), false);
    assert.equal(codesMatch("042917", "0429170"), false);
    assert.equal(codesMatch("042917", ""), false);
    assert.equal(codesMatch("", ""), false);
  });
});

describe("checkResetAttempt", () => {
  it("accepts the right code once and burns it", () => {
    assert.deepEqual(checkResetAttempt(pending(), "042917", now), {
      ok: true,
      burn: true,
      attempts: 0,
    });
  });

  it("rejects missing, used and expired codes", () => {
    assert.equal(checkResetAttempt(null, "042917", now).ok, false);
    assert.equal(checkResetAttempt(pending({ used: true }), "042917", now).ok, false);
    assert.equal(checkResetAttempt(pending({ expiresAt: now }), "042917", now).ok, false);
  });

  it("counts wrong guesses and burns the code at the limit", () => {
    let row = pending();
    for (let i = 1; i < RESET_MAX_ATTEMPTS; i += 1) {
      const v = checkResetAttempt(row, "111111", now);
      assert.deepEqual(v, { ok: false, burn: false, attempts: i });
      row = { ...row, attempts: v.attempts };
    }
    const last = checkResetAttempt(row, "111111", now);
    assert.deepEqual(last, { ok: false, burn: true, attempts: RESET_MAX_ATTEMPTS });
    // Even the right code is refused once the guesses are used up.
    const after = checkResetAttempt({ ...row, attempts: RESET_MAX_ATTEMPTS }, "042917", now);
    assert.equal(after.ok, false);
    assert.equal(after.burn, true);
  });
});

describe("reset limits and copy", () => {
  it("expires codes within an hour", () => {
    assert.ok(RESET_TTL_MINUTES >= 30 && RESET_TTL_MINUTES <= 60);
    assert.equal(resetExpiry(now).getTime() - now.getTime(), RESET_TTL_MINUTES * 60_000);
  });

  it("rate-limits per email and per IP", () => {
    assert.equal(resetRequestLimited({ email: 0, ip: 0 }), false);
    assert.equal(resetRequestLimited({ email: RESET_MAX_PER_EMAIL - 1, ip: 0 }), false);
    assert.equal(resetRequestLimited({ email: RESET_MAX_PER_EMAIL, ip: 0 }), true);
    assert.equal(resetRequestLimited({ email: 0, ip: RESET_MAX_PER_IP }), true);
  });

  it("never mentions a code in the requester's message", () => {
    assert.equal(
      RESET_REQUEST_MESSAGE,
      "If that account exists, a reset request was created. Get your reset code from your shift commander.",
    );
    assert.doesNotMatch(RESET_REQUEST_MESSAGE, /\d/);
  });
});

describe("who can read a reset code (staffManageBlock)", () => {
  const commander: StaffActor = {
    userId: "cmd",
    permission: "admin",
    isOwner: false,
    manageAgency: false,
    managePlatform: false,
    agencyId: "wcso",
    shiftId: "first",
  };
  const leader: StaffActor = {
    ...commander,
    userId: "cpt",
    permission: "captain",
    manageAgency: true,
  };
  const target = (over: Partial<StaffTarget> = {}): StaffTarget => ({
    userId: "p",
    permission: "officer",
    isOwner: false,
    agencyAdmin: false,
    agencyId: "wcso",
    shiftId: "first",
    ...over,
  });

  it("commander: people below them on their shift only", () => {
    assert.equal(staffManageBlock(commander, target()), null);
    assert.ok(staffManageBlock(commander, target({ shiftId: "second" })));
    assert.ok(staffManageBlock(commander, target({ permission: "admin" })));
  });

  it("division leader: commanders and anyone in the agency", () => {
    assert.equal(staffManageBlock(leader, target({ permission: "admin", shiftId: "third" })), null);
    assert.equal(staffManageBlock(leader, target({ permission: "captain", shiftId: null })), null);
    assert.ok(staffManageBlock(leader, target({ agencyId: "other" })));
  });
});
