import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { actionLabel, canSeeOffAudit, formatCT, isShiftCommander, type AuditViewer } from "./off-audit-rules.ts";

const cmd: AuditViewer = {
  permission: "admin",
  isOwner: false,
  agencyAdmin: false,
  unassigned: false,
  agencyId: "home",
  homeShiftId: "second-shift",
};
const entry = { shiftId: "second-shift", agencyId: "home" };

describe("off audit visibility", () => {
  it("the shift commander of the entry's shift sees it", () => {
    assert.equal(canSeeOffAudit(cmd, entry), true);
  });
  it("not another shift's commander, nor another agency", () => {
    assert.equal(canSeeOffAudit({ ...cmd, homeShiftId: "third-shift" }, entry), false);
    assert.equal(canSeeOffAudit(cmd, { ...entry, agencyId: "other" }), false);
  });
  it("nobody below commander, and (for now) not division leaders or the operator", () => {
    for (const permission of ["supervisor", "dispatcher", "officer", "captain"] as const) {
      assert.equal(canSeeOffAudit({ ...cmd, permission }, entry), false, permission);
    }
    assert.equal(canSeeOffAudit({ ...cmd, isOwner: true }, entry), false);
    assert.equal(canSeeOffAudit({ ...cmd, agencyAdmin: true }, entry), false);
    assert.equal(canSeeOffAudit({ ...cmd, unassigned: true }, entry), false);
    assert.equal(isShiftCommander({ ...cmd, homeShiftId: null }), false);
  });
  it("fails closed on unknown shift", () => {
    assert.equal(canSeeOffAudit(cmd, { shiftId: null, agencyId: "home" }), false);
  });
  it("formats Central time and labels", () => {
    assert.equal(formatCT("2026-10-20T23:52:00Z"), "Oct 20, 6:52 PM CT");
    assert.equal(actionLabel("ended_early"), "Ended early");
  });
});

describe("audience switch", () => {
  const cap: AuditViewer = { ...cmd, permission: "captain", homeShiftId: null };
  const owner: AuditViewer = { ...cmd, isOwner: true, agencyId: null, homeShiftId: null };
  it("B adds division leaders, C adds the operator", () => {
    assert.equal(canSeeOffAudit(cap, entry, "A"), false);
    assert.equal(canSeeOffAudit(cap, entry, "B"), true);
    assert.equal(canSeeOffAudit(owner, entry, "B"), false);
    assert.equal(canSeeOffAudit(owner, entry, "C"), true);
    assert.equal(canSeeOffAudit({ ...cmd, homeShiftId: "third-shift" }, entry, "C"), false);
  });
});
