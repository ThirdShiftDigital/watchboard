import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  agencyDayOf,
  endOfMonth,
  eventDayRange,
  eventOverlapsRange,
  eventTouchesDate,
  inclusiveAllDayEnd,
  todayISO,
  toAgencyLocal,
} from "./dates.ts";

describe("agency 'today' (America/Chicago)", () => {
  it("Tue 6:43 PM CDT (23:43 UTC) is still Tuesday", () => {
    assert.equal(todayISO(new Date("2026-09-29T23:43:00Z")), "2026-09-29");
  });
  it("Tue 7:30 PM CDT (00:30 UTC Wed) is still Tuesday", () => {
    assert.equal(todayISO(new Date("2026-09-30T00:30:00Z")), "2026-09-29");
  });
  it("rolls over at Central midnight, not UTC midnight", () => {
    assert.equal(todayISO(new Date("2026-09-30T04:59:00Z")), "2026-09-29");
    assert.equal(todayISO(new Date("2026-09-30T05:00:00Z")), "2026-09-30");
  });
  it("uses CST (UTC-6) in winter", () => {
    assert.equal(todayISO(new Date("2026-12-02T05:30:00Z")), "2026-12-01");
    assert.equal(todayISO(new Date("2026-12-02T06:00:00Z")), "2026-12-02");
  });
});

describe("date-only strings are calendar dates, not UTC midnight", () => {
  it("keeps YYYY-MM-DD as-is", () => {
    assert.equal(agencyDayOf("2026-09-29"), "2026-09-29");
    assert.equal(toAgencyLocal("2026-09-29"), "2026-09-29");
  });
  it("converts zoned date-times to Central", () => {
    assert.equal(agencyDayOf("2026-09-30T01:30:00Z"), "2026-09-29");
    assert.equal(toAgencyLocal("2026-09-30T01:30:00Z"), "2026-09-29T20:30:00");
    assert.equal(agencyDayOf("2026-09-29T19:00:00-05:00"), "2026-09-29");
  });
});

describe("all-day events (Google exclusive end)", () => {
  it("one-day event on Mon Sep 28 only shows on the 28th", () => {
    const end = inclusiveAllDayEnd("2026-09-28", "2026-09-29");
    assert.equal(end, "2026-09-28");
    assert.equal(eventTouchesDate("2026-09-28", end, "2026-09-28"), true);
    assert.equal(eventTouchesDate("2026-09-28", end, "2026-09-29"), false);
  });
  it("multi-day event keeps its real last day", () => {
    assert.equal(inclusiveAllDayEnd("2026-09-28", "2026-10-01"), "2026-09-30");
  });
  it("missing or bad end collapses to start", () => {
    assert.equal(inclusiveAllDayEnd("2026-09-28", null), "2026-09-28");
    assert.equal(inclusiveAllDayEnd("2026-09-28", "2026-09-28"), "2026-09-28");
  });
});

describe("timed events", () => {
  it("Mon 8 PM CDT event (Tue 01:00 UTC) is Monday, not Tuesday", () => {
    const r = eventDayRange("2026-09-29T01:00:00Z", "2026-09-29T02:00:00Z");
    assert.deepEqual(r, { start: "2026-09-28", end: "2026-09-28" });
    assert.equal(eventTouchesDate("2026-09-29T01:00:00Z", "2026-09-29T02:00:00Z", "2026-09-29"), false);
  });
  it("event ending exactly at local midnight does not spill into the next day", () => {
    const r = eventDayRange("2026-09-28T22:00:00-05:00", "2026-09-29T00:00:00-05:00");
    assert.deepEqual(r, { start: "2026-09-28", end: "2026-09-28" });
  });
  it("overnight shift event spans both days", () => {
    const r = eventDayRange("2026-09-28T22:00:00-05:00", "2026-09-29T06:00:00-05:00");
    assert.deepEqual(r, { start: "2026-09-28", end: "2026-09-29" });
  });
  it("range overlap uses agency-local days", () => {
    assert.equal(eventOverlapsRange("2026-09-29T01:00:00Z", null, "2026-09-29", "2026-09-29"), false);
    assert.equal(eventOverlapsRange("2026-09-29T01:00:00Z", null, "2026-09-28", "2026-09-28"), true);
  });
});

describe("month helpers", () => {
  it("endOfMonth", () => {
    assert.equal(endOfMonth("2026-09-15"), "2026-09-30");
    assert.equal(endOfMonth("2026-02-03"), "2026-02-28");
    assert.equal(endOfMonth("2026-12-31"), "2026-12-31");
  });
});
