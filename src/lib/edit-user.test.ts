import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { editUserBlock, type StaffActor, type StaffTarget } from "./access.ts";

const owner: StaffActor = {
  userId: "owner",
  permission: "admin",
  isOwner: true,
  manageAgency: true,
  managePlatform: true,
  agencyId: "home",
  shiftId: null,
};
const leaderA: StaffActor = {
  userId: "leaderA",
  permission: "captain",
  isOwner: false,
  manageAgency: true,
  managePlatform: false,
  agencyId: "A",
  shiftId: null,
};
const commanderA: StaffActor = {
  userId: "cmdA",
  permission: "admin",
  isOwner: false,
  manageAgency: false,
  managePlatform: false,
  agencyId: "A",
  shiftId: "A1",
};
const target = (over: Partial<StaffTarget> = {}): StaffTarget => ({
  userId: "t",
  permission: "officer",
  isOwner: false,
  agencyAdmin: false,
  agencyId: "A",
  shiftId: "A1",
  ...over,
});

describe("editUserBlock (spec §1 who can use it)", () => {
  it("shift commanders get no Edit user panel", () => {
    assert.match(editUserBlock(commanderA, target(), { name: true }) ?? "", /division leader or the operator/);
  });
  it("division leader edits their agency's logins", () => {
    assert.equal(editUserBlock(leaderA, target(), { name: true, email: true, rank: true, shift: true }), null);
    assert.equal(editUserBlock(leaderA, target(), { permission: "supervisor", disabled: true }), null);
  });
  it("division leader: another agency's login says so", () => {
    assert.match(editUserBlock(leaderA, target({ agencyId: "B" }), { name: true }) ?? "", /another agency/);
  });
  it("division leader can't move agencies or touch the owner", () => {
    assert.match(editUserBlock(leaderA, target(), { agency: true }) ?? "", /Only the operator/);
    assert.ok(editUserBlock(leaderA, target({ isOwner: true, agencyId: null }), { name: true }));
  });
  it("division leader can't change another division leader's role", () => {
    const other = target({ permission: "captain", shiftId: null, agencyAdmin: true });
    assert.match(editUserBlock(leaderA, other, { permission: "admin" }) ?? "", /division leader’s role/);
    assert.equal(editUserBlock(leaderA, other, { name: true }), null);
  });
  it("owner edits anyone, including agency moves", () => {
    assert.equal(editUserBlock(owner, target({ agencyId: "B" }), { agency: true, permission: "captain" }), null);
  });
  it("nobody changes their own role, placement or Disabled; name/rank are fine", () => {
    const me = target({ userId: "owner", isOwner: true, permission: "admin", agencyId: null, shiftId: null });
    assert.equal(editUserBlock(owner, me, { name: true, rank: true }), null);
    assert.match(editUserBlock(owner, me, { disabled: true }) ?? "", /disable your own/);
    assert.match(editUserBlock(owner, me, { permission: "officer" }) ?? "", /own role/);
    assert.match(editUserBlock(owner, me, { agency: true }) ?? "", /own login/);
  });
  it("rank changes never require role rights (rank and permission are separate)", () => {
    assert.equal(editUserBlock(leaderA, target({ permission: "admin" }), { rank: true }), null);
  });
});
