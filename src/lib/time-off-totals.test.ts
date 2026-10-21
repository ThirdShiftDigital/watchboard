import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { countTimeOff, mailtoHref, periodRange, shiftPeriod, textPdf } from "./time-off-totals.ts";
import { offOnDate } from "./watch-logic.ts";
import type { DutyOverride, Officer, TimeOffRequest } from "./types.ts";

describe("time-off periods", () => {
  it("weeks start Sunday; months are calendar months", () => {
    assert.deepEqual(periodRange("week", "2026-10-21"), { from: "2026-10-18", to: "2026-10-24" });
    assert.deepEqual(periodRange("week", "2026-10-18"), { from: "2026-10-18", to: "2026-10-24" });
    assert.deepEqual(periodRange("month", "2026-02-10"), { from: "2026-02-01", to: "2026-02-28" });
  });
  it("prev / next", () => {
    assert.equal(shiftPeriod("week", "2026-10-21", -1), "2026-10-11");
    assert.equal(shiftPeriod("month", "2026-10-21", 1), "2026-11-01");
    assert.equal(shiftPeriod("month", "2026-01-15", -1), "2025-12-01");
  });
});

describe("countTimeOff", () => {
  const reqs = [
    { status: "approved", kind: "sick", startDate: "2026-10-15", endDate: "2026-10-20" },
    { status: "pending", kind: "vacation", startDate: "2026-10-21", endDate: "2026-10-22" },
    { status: "denied", kind: "vacation", startDate: "2026-10-23", endDate: "2026-10-23" },
    { status: "approved", kind: "court", startDate: "2026-10-22", endDate: "2026-10-22" },
  ];
  it("approved only, clipped to the week, RDOs skipped, by type", () => {
    // RDO Sat (6) — 10-17 skipped
    const t = countTimeOff("week", "2026-10-20", reqs, [6]);
    assert.equal(t.from, "2026-10-18");
    assert.deepEqual(t.byKind, { sick: 3, court: 1 }); // 18,19,20 + 22
    assert.equal(t.total, 4);
  });
  it("month", () => {
    const t = countTimeOff("month", "2026-10-01", reqs, [6]);
    assert.equal(t.total, 6); // 15,16,18,19,20 sick + 22 court
  });
});

const off = (id: string, rdo: number[]): Officer =>
  ({ id, name: id.toUpperCase(), unit: "1", rankSort: 1, role: "deputy", hireDate: null, tmt: false, radioNum: null, rdoDays: rdo, defaultZone: null, lastName: id }) as Officer;

describe("calendar day list (offOnDate)", () => {
  it("only people off: leave, RDO, swap off side; not on-duty or overtime", () => {
    const officers = [off("work", []), off("sick", []), off("rdo", [2]), off("ot", [2]), off("swapoff", [])];
    const date = "2026-10-20"; // Tuesday
    const requests = [
      { id: 1, officerId: "sick", startDate: date, endDate: date, kind: "sick", reason: "", status: "approved", createdAt: "" },
    ] as TimeOffRequest[];
    const overrides = [
      { id: 7, officerId: "ot", date, status: "working", kind: "ot", partnerOfficerId: null, swapGroup: null, isPayback: false, reason: "" },
      { id: 8, officerId: "swapoff", date, status: "off", kind: "swap", partnerOfficerId: "x", swapGroup: "g", isPayback: false, reason: "" },
    ] as DutyOverride[];
    const list = offOnDate(date, officers, requests, [], overrides);
    assert.deepEqual(list.map((e) => e.officer.id), ["sick", "swapoff", "rdo"]);
    assert.equal(list[0].leaveId, 1);
    assert.equal(list[1].overrideKind, "swap");
  });
});

describe("export", () => {
  it("mailto is encoded and never sends anything itself", () => {
    const href = mailtoHref("lt@x.gov", "Time off: A & B", ["line 1", "line 2"]);
    assert.equal(href, "mailto:lt%40x.gov?subject=Time%20off%3A%20A%20%26%20B&body=line%201%0Aline%202");
  });
  it("PDF is well-formed", () => {
    const pdf = textPdf(["Title (x)", "Café – note"]);
    assert.ok(pdf.startsWith("%PDF-1.4"));
    assert.ok(pdf.trimEnd().endsWith("%%EOF"));
    assert.match(pdf, /\(Title \\\(x\\\)\) Tj/);
  });
});
