import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { roleAssignBlock, staffManageBlock, type StaffActor, type StaffTarget } from "./access.ts";

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
  shiftId: "first",
};
const owner: StaffActor = {
  ...commander,
  userId: "own",
  isOwner: true,
  managePlatform: true,
  manageAgency: true,
};

const person = (over: Partial<StaffTarget> = {}): StaffTarget => ({
  userId: "p1",
  permission: "officer",
  isOwner: false,
  agencyAdmin: false,
  agencyId: "wcso",
  shiftId: "first",
  ...over,
});

describe("staffManageBlock", () => {
  it("lets a commander manage people below them on their shift", () => {
    for (const permission of ["officer", "dispatcher", "supervisor"] as const) {
      assert.equal(staffManageBlock(commander, person({ permission })), null);
    }
  });

  it("stops a commander at other shifts and other agencies", () => {
    assert.match(staffManageBlock(commander, person({ shiftId: "second" })) ?? "", /own shift/);
    assert.match(staffManageBlock(commander, person({ shiftId: null })) ?? "", /own shift/);
    assert.match(
      staffManageBlock(commander, person({ agencyId: "other" })) ?? "",
      /another agency/,
    );
    assert.match(staffManageBlock({ ...commander, shiftId: null }, person()) ?? "", /own shift/);
  });

  it("stops a commander at their level or above", () => {
    assert.match(staffManageBlock(commander, person({ permission: "admin" })) ?? "", /at or above/);
    assert.match(
      staffManageBlock(commander, person({ permission: "captain" })) ?? "",
      /at or above/,
    );
    assert.match(
      staffManageBlock(commander, person({ permission: "supervisor", agencyAdmin: true })) ?? "",
      /at or above/,
    );
  });

  it("never allows acting on yourself", () => {
    for (const actor of [commander, leader, owner]) {
      assert.ok(
        staffManageBlock(actor, person({ userId: actor.userId, permission: actor.permission })),
      );
    }
  });

  it("keeps division leaders agency-wide, including other shifts and commanders", () => {
    assert.equal(staffManageBlock(leader, person({ shiftId: "second" })), null);
    assert.equal(staffManageBlock(leader, person({ permission: "admin", shiftId: "third" })), null);
    assert.equal(staffManageBlock(leader, person({ permission: "captain", shiftId: null })), null);
    assert.match(staffManageBlock(leader, person({ agencyId: "other" })) ?? "", /another agency/);
    assert.ok(staffManageBlock(leader, person({ isOwner: true })));
  });

  it("lets the operator act on anyone else", () => {
    assert.equal(
      staffManageBlock(owner, person({ agencyId: "other", permission: "captain" })),
      null,
    );
  });
});

describe("roleAssignBlock", () => {
  it("limits commanders to roles below their own", () => {
    assert.equal(roleAssignBlock(commander, "supervisor"), null);
    assert.equal(roleAssignBlock(commander, "dispatcher"), null);
    assert.equal(roleAssignBlock(commander, "officer"), null);
    assert.ok(roleAssignBlock(commander, "admin"));
    assert.ok(roleAssignBlock(commander, "captain"));
  });

  it("leaves division leaders and the operator unchanged", () => {
    for (const role of ["captain", "admin", "supervisor", "dispatcher", "officer"] as const) {
      assert.equal(roleAssignBlock(leader, role), null);
      assert.equal(roleAssignBlock(owner, role), null);
    }
  });
});
