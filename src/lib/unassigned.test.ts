import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  NO_CAPS,
  UNASSIGNED_MESSAGE,
  defaultCapsFor,
  isUnassignedLogin,
  officerLinkBlock,
  requestForBlock,
  type LoginAssignment,
} from "./access.ts";

const login = (over: Partial<LoginAssignment> = {}): LoginAssignment => ({
  isOwner: false,
  permission: "officer",
  agencyAdmin: false,
  agencyId: "home",
  agencyExists: true,
  shiftInAgency: true,
  ...over,
});

describe("isUnassignedLogin", () => {
  it("treats a self-signup with no agency as unassigned (the jdenson case)", () => {
    assert.equal(isUnassignedLogin(login({ agencyId: null, agencyExists: false, shiftInAgency: false })), true);
  });
  it("treats an agency that no longer exists as unassigned", () => {
    assert.equal(isUnassignedLogin(login({ agencyExists: false })), true);
  });
  it("requires a valid shift in the agency below division leader", () => {
    assert.equal(isUnassignedLogin(login({ shiftInAgency: false })), true);
    assert.equal(isUnassignedLogin(login({ permission: "admin", shiftInAgency: false })), true);
    assert.equal(isUnassignedLogin(login()), false);
  });
  it("lets division leaders / agency admins sit on an agency with no shift", () => {
    assert.equal(isUnassignedLogin(login({ permission: "captain", shiftInAgency: false })), false);
    assert.equal(isUnassignedLogin(login({ agencyAdmin: true, shiftInAgency: false })), false);
    assert.equal(isUnassignedLogin(login({ permission: "captain", agencyId: null })), true);
  });
  it("never treats the operator as unassigned", () => {
    assert.equal(isUnassignedLogin(login({ isOwner: true, agencyId: null, agencyExists: false })), false);
  });
});

describe("NO_CAPS", () => {
  it("turns off every capability the role defaults can grant", () => {
    const keys = Object.keys(defaultCapsFor("captain", { isOwner: true }));
    assert.deepEqual(Object.keys(NO_CAPS).sort(), keys.sort());
    assert.ok(Object.values(NO_CAPS).every((v) => v === false));
  });
});

describe("officerLinkBlock", () => {
  const officer = { shiftId: "second-shift", agencyId: "home" };
  const base = {
    officer,
    agencyId: "home",
    shiftId: "second-shift",
    agencyWide: false,
    linkedToOther: false,
  };
  it("allows an officer on the login's own shift", () => {
    assert.equal(officerLinkBlock(base), null);
  });
  it("refuses unassigned logins", () => {
    assert.equal(officerLinkBlock({ ...base, agencyId: null }), UNASSIGNED_MESSAGE);
  });
  it("refuses an officer from another agency, even agency-wide", () => {
    const other = { shiftId: "day", agencyId: "metro" };
    assert.match(officerLinkBlock({ ...base, officer: other }) ?? "", /another agency/);
    assert.match(officerLinkBlock({ ...base, officer: other, agencyWide: true }) ?? "", /another agency/);
  });
  it("refuses an officer on another shift unless agency-wide", () => {
    const first = { shiftId: "first-shift", agencyId: "home" };
    assert.match(officerLinkBlock({ ...base, officer: first }) ?? "", /another shift/);
    assert.equal(officerLinkBlock({ ...base, officer: first, agencyWide: true }), null);
    assert.match(officerLinkBlock({ ...base, shiftId: null }) ?? "", /another shift/);
  });
  it("refuses an officer already tied to another login", () => {
    assert.match(officerLinkBlock({ ...base, linkedToOther: true }) ?? "", /already linked/);
  });
  it("refuses a missing officer", () => {
    assert.equal(officerLinkBlock({ ...base, officer: null }), "Officer not found.");
  });
});

describe("requestForBlock", () => {
  const officerCaps = defaultCapsFor("officer");
  const supervisorCaps = defaultCapsFor("supervisor");
  const onSecond = { shiftId: "second-shift", agencyId: "home" };
  const base = {
    caps: officerCaps,
    linkedOfficerId: "denson",
    officerId: "denson",
    officer: onSecond,
    actorAgencyId: "home",
    actorShiftId: "second-shift",
  };
  it("lets an officer request for their own linked name", () => {
    assert.equal(requestForBlock(base), null);
  });
  it("refuses an officer requesting for someone else", () => {
    assert.match(requestForBlock({ ...base, officerId: "smith" }) ?? "", /your own name/);
  });
  it("refuses an unlinked officer (no more 'any officer id')", () => {
    assert.match(requestForBlock({ ...base, linkedOfficerId: null }) ?? "", /Link your roster name/);
  });
  it("refuses unassigned logins (no caps)", () => {
    assert.match(requestForBlock({ ...base, caps: NO_CAPS }) ?? "", /can’t submit/);
  });
  it("lets an approver request for others on their shift only", () => {
    const sup = { ...base, caps: supervisorCaps, linkedOfficerId: null, officerId: "smith" };
    assert.equal(requestForBlock(sup), null);
    assert.match(
      requestForBlock({ ...sup, officer: { shiftId: "first-shift", agencyId: "home" } }) ?? "",
      /another shift/,
    );
    assert.match(
      requestForBlock({ ...sup, officer: { shiftId: "days", agencyId: "metro" } }) ?? "",
      /another agency/,
    );
  });
  it("lets a division leader request anywhere in their agency", () => {
    const caps = defaultCapsFor("captain");
    const req = { ...base, caps, linkedOfficerId: null, officerId: "x", officer: { shiftId: "first-shift", agencyId: "home" } };
    assert.equal(requestForBlock(req), null);
    assert.match(requestForBlock({ ...req, officer: { shiftId: "d", agencyId: "metro" } }) ?? "", /another agency/);
  });
  it("refuses a missing officer", () => {
    assert.equal(requestForBlock({ ...base, officer: null }), "Officer not found.");
  });
});
