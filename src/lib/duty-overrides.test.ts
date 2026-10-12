import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { defaultCapsFor, capsFor } from "./access.ts";
import { overrideBlock, planOvertime, planPayback, planSwap, summarizeSwaps } from "./duty-overrides.ts";
import type { CalendarEvent, DutyOverride, Officer, TimeOffRequest } from "./types.ts";
import { buildRows, statusForOfficer } from "./watch-logic.ts";

// 2026-10-12 is a Monday (weekday 1); 2026-10-14 a Wednesday (3).
const MON = "2026-10-12";
const WED = "2026-10-14";

function officer(id: string, rdoDays: number[]): Officer {
  return {
    id,
    name: id.toUpperCase(),
    unit: "1",
    rankSort: 1,
    role: "deputy",
    hireDate: "2020-01-01",
    tmt: false,
    radioNum: null,
    rdoDays,
    defaultZone: null,
    lastName: id.toUpperCase(),
  };
}
const smith = officer("smith", [0, 1]); // off SUN–MON
const jones = officer("jones", [2, 3]); // off TUE–WED

function ov(p: Partial<DutyOverride> & Pick<DutyOverride, "officerId" | "date" | "status" | "kind">): DutyOverride {
  return { id: 1, partnerOfficerId: null, swapGroup: null, isPayback: false, reason: "", ...p };
}
function leave(officerId: string, date: string): TimeOffRequest {
  return { id: 9, officerId, startDate: date, endDate: date, kind: "sick", reason: "", status: "approved", createdAt: "" };
}
const calHit = (officerId: string, date: string): CalendarEvent => ({
  id: "e",
  title: "SMITH",
  start: date,
  end: null,
  allDay: true,
  matchedOfficerIds: [officerId],
});

describe("statusForOfficer precedence with overtime & swaps", () => {
  it("OT on an RDO makes the officer working with an OT badge", () => {
    const s = statusForOfficer(smith, 1, MON, [], [], [ov({ officerId: "smith", date: MON, status: "working", kind: "ot" })]);
    assert.deepEqual([s.status, s.statusLabel, s.override], ["working", "OT", "ot"]);
  });
  it("no overrides keeps the old RDO result (RDOs only / RDO PDF)", () => {
    assert.equal(statusForOfficer(smith, 1, MON, [], []).status, "rdo");
  });
  it("approved leave beats an override", () => {
    const s = statusForOfficer(smith, 1, MON, [leave("smith", MON)], [], [ov({ officerId: "smith", date: MON, status: "working", kind: "ot" })]);
    assert.deepEqual([s.status, s.statusLabel], ["leave", "SICK"]);
  });
  it("swap off makes a scheduled officer off with a SWAP badge", () => {
    const s = statusForOfficer(jones, 1, MON, [], [], [ov({ officerId: "jones", date: MON, status: "off", kind: "swap" })]);
    assert.deepEqual([s.status, s.statusLabel, s.override], ["leave", "SWAP", "swap"]);
  });
  it("override working beats a calendar match", () => {
    const s = statusForOfficer(smith, 1, MON, [], [calHit("smith", MON)], [ov({ officerId: "smith", date: MON, status: "working", kind: "swap" })]);
    assert.deepEqual([s.status, s.statusLabel], ["working", "SWAP"]);
  });
  it("ignores Google events WatchBoard wrote for its own requests (any status)", () => {
    const ev = { ...calHit("jones", MON), id: "wb1" };
    const cancelled: TimeOffRequest = { ...leave("jones", MON), status: "cancelled", calendarEventId: "wb1" };
    assert.equal(statusForOfficer(jones, 1, MON, [cancelled], [ev]).status, "working");
    assert.equal(statusForOfficer(jones, 1, MON, [], [ev]).status, "calendar", "outside events still count");
  });
  it("leave rows carry the request id", () => {
    assert.equal(statusForOfficer(jones, 1, MON, [leave("jones", MON)], []).leaveId, 9);
  });
  it("an override on another date changes nothing", () => {
    const s = statusForOfficer(smith, 1, MON, [], [], [ov({ officerId: "smith", date: "2026-10-19", status: "working", kind: "ot" })]);
    assert.equal(s.status, "rdo");
  });
  it("buildRows keeps the zone for an OT officer and carries the badge", () => {
    const rows = buildRows([smith], 1, MON, [], [], [{ id: 1, date: MON, officerId: "smith", zone: "NE" }], [
      ov({ officerId: "smith", date: MON, status: "working", kind: "ot" }),
    ]);
    assert.equal(rows[0]!.zone, "NE");
    assert.equal(rows[0]!.override, "ot");
  });
});

describe("planning overtime and swaps", () => {
  const ctx = { requests: [] as TimeOffRequest[], overrides: [] as DutyOverride[] };
  it("overtime only on an RDO", () => {
    assert.ok("rows" in planOvertime({ officer: smith, date: MON, ...ctx }));
    const bad = planOvertime({ officer: smith, date: WED, ...ctx });
    assert.ok("error" in bad && /already scheduled/.test(bad.error));
  });
  it("overtime refused over approved leave or an existing entry", () => {
    assert.ok("error" in planOvertime({ officer: smith, date: MON, requests: [leave("smith", MON)], overrides: [] }));
    assert.ok(
      "error" in
        planOvertime({ officer: smith, date: MON, requests: [], overrides: [ov({ officerId: "smith", date: MON, status: "working", kind: "ot" })] }),
    );
  });
  it("a swap is a working/off pair in one group", () => {
    const plan = planSwap({ worker: smith, partner: jones, date: MON, swapGroup: "g1", ...ctx });
    assert.ok("rows" in plan);
    assert.deepEqual(
      plan.rows.map((r) => [r.officerId, r.date, r.status, r.swapGroup, r.isPayback]),
      [
        ["smith", MON, "working", "g1", false],
        ["jones", MON, "off", "g1", false],
      ],
    );
  });
  it("payback reverses the pair on the payback date, same group", () => {
    const plan = planSwap({ worker: smith, partner: jones, date: MON, paybackDate: WED, swapGroup: "g1", ...ctx });
    assert.ok("rows" in plan);
    assert.deepEqual(
      plan.rows.slice(2).map((r) => [r.officerId, r.date, r.status, r.swapGroup, r.isPayback]),
      [
        ["jones", WED, "working", "g1", true],
        ["smith", WED, "off", "g1", true],
      ],
    );
  });
  it("refuses a swap with someone already off, with yourself, or a bad payback", () => {
    assert.ok("error" in planSwap({ worker: smith, partner: smith, date: MON, swapGroup: "g", ...ctx }));
    const offPartner = officer("lee", [1]);
    assert.ok("error" in planSwap({ worker: smith, partner: offPartner, date: MON, swapGroup: "g", ...ctx }));
    // Payback on a day the partner normally works is not "their RDO".
    const bad = planSwap({ worker: smith, partner: jones, date: MON, paybackDate: "2026-10-16", swapGroup: "g", ...ctx });
    assert.ok("error" in bad && /^Payback:/.test(bad.error));
  });
  it("adds a payback later to an owed swap, once", () => {
    const first = planSwap({ worker: smith, partner: jones, date: MON, swapGroup: "g1", ...ctx });
    assert.ok("rows" in first);
    const group = first.rows.map((r, i) => ({ ...r, id: i + 1 }));
    const pb = planPayback({ group, officers: [smith, jones], paybackDate: WED, ...ctx });
    assert.ok("rows" in pb);
    assert.deepEqual(pb.rows.map((r) => [r.officerId, r.status]), [["jones", "working"], ["smith", "off"]]);
    const again = planPayback({ group: [...group, ...pb.rows.map((r, i) => ({ ...r, id: 10 + i }))], officers: [smith, jones], paybackDate: "2026-10-21", ...ctx });
    assert.ok("error" in again);
  });
  it("summarizes owed / scheduled / done", () => {
    const mk = (date: string, group: string, payback?: string): DutyOverride[] => {
      const p = planSwap({ worker: smith, partner: jones, date, paybackDate: payback, swapGroup: group, ...ctx });
      assert.ok("rows" in p);
      return p.rows.map((r, i) => ({ ...r, id: i + 1 }));
    };
    const rows = [...mk(MON, "a"), ...mk("2026-10-05", "b", "2026-10-07"), ...mk("2026-10-19", "c", "2026-10-21")];
    const out = summarizeSwaps(rows, [smith, jones], "2026-10-11");
    const byGroup = Object.fromEntries(out.map((s) => [s.swapGroup, s.state]));
    assert.deepEqual(byGroup, { a: "owed", b: "done", c: "scheduled" });
    assert.equal(out[0]!.workerName, "SMITH");
    assert.equal(out[0]!.partnerName, "JONES");
  });
});

describe("who may enter overtime & swaps", () => {
  const officerOn = (shiftId: string, agencyId = "wcso") => ({ shiftId, agencyId });
  it("defaults: supervisor and up on, dispatch and officer off", () => {
    assert.equal(defaultCapsFor("supervisor").overtimeSwaps, true);
    assert.equal(defaultCapsFor("admin").overtimeSwaps, true);
    assert.equal(defaultCapsFor("captain").overtimeSwaps, true);
    assert.equal(defaultCapsFor("dispatcher").overtimeSwaps, false);
    assert.equal(defaultCapsFor("officer").overtimeSwaps, false);
  });
  it("saved overrides without the new key follow the role default; it can be turned off", () => {
    assert.equal(capsFor("supervisor", undefined, { callIn: false }).overtimeSwaps, true);
    assert.equal(capsFor("supervisor", undefined, { overtimeSwaps: false }).overtimeSwaps, false);
    assert.equal(capsFor("officer", undefined, { overtimeSwaps: true }).overtimeSwaps, false, "needs the Zones board");
  });
  it("own shift only for supervisors / commanders", () => {
    const caps = defaultCapsFor("admin");
    assert.equal(overrideBlock({ caps, officer: officerOn("first"), actorAgencyId: "wcso", actorShiftId: "first" }), null);
    assert.match(
      overrideBlock({ caps, officer: officerOn("second"), actorAgencyId: "wcso", actorShiftId: "first" }) ?? "",
      /another shift/,
    );
    assert.match(
      overrideBlock({ caps, officer: officerOn("first", "metro"), actorAgencyId: "wcso", actorShiftId: "first" }) ?? "",
      /another agency/,
    );
  });
  it("division leaders across their agency; no cap means no access", () => {
    const leader = defaultCapsFor("captain");
    assert.equal(overrideBlock({ caps: leader, officer: officerOn("second"), actorAgencyId: "wcso", actorShiftId: "first" }), null);
    assert.match(
      overrideBlock({ caps: defaultCapsFor("officer"), officer: officerOn("first"), actorAgencyId: "wcso", actorShiftId: "first" }) ?? "",
      /permission/,
    );
  });
});
