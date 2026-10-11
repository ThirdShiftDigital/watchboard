import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defaultCapsFor } from "./access.ts";
import { DENIAL_REASON_MAX, cleanDenialReason, decisionBlock, visibleDenialReason } from "./request-decision.ts";

describe("denial reason", () => {
  it("trims, drops empties, strips control characters, caps length", () => {
    assert.equal(cleanDenialReason("  "), null);
    assert.equal(cleanDenialReason(undefined), null);
    assert.equal(cleanDenialReason("  Min staffing\u0007 "), "Min staffing");
    assert.equal(cleanDenialReason("x".repeat(500))!.length, DENIAL_REASON_MAX);
  });
  it("only shows while denied", () => {
    assert.equal(visibleDenialReason("denied", "Short"), "Short");
    assert.equal(visibleDenialReason("approved", "Short"), null);
    assert.equal(visibleDenialReason("pending", "Short"), null);
    assert.equal(visibleDenialReason("denied", null), null);
  });
});

describe("who may approve / deny", () => {
  const on = (shiftId: string, agencyId = "wcso") => ({ shiftId, agencyId });
  it("approvers on their own shift only", () => {
    const sup = defaultCapsFor("supervisor");
    assert.equal(decisionBlock({ caps: sup, officer: on("first"), actorAgencyId: "wcso", actorShiftId: "first" }), null);
    assert.match(decisionBlock({ caps: sup, officer: on("second"), actorAgencyId: "wcso", actorShiftId: "first" }) ?? "", /another shift/);
    assert.match(decisionBlock({ caps: sup, officer: on("first", "mpd"), actorAgencyId: "wcso", actorShiftId: "first" }) ?? "", /another agency/);
  });
  it("division leaders agency-wide; officers and dispatch never", () => {
    assert.equal(
      decisionBlock({ caps: defaultCapsFor("captain"), officer: on("second"), actorAgencyId: "wcso", actorShiftId: "first" }),
      null,
    );
    for (const p of ["officer", "dispatcher"] as const) {
      assert.match(
        decisionBlock({ caps: defaultCapsFor(p), officer: on("first"), actorAgencyId: "wcso", actorShiftId: "first" }) ?? "",
        /permission/,
      );
    }
  });
});
