import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { seedBoard, seedLogin, startApp } from "./harness.mjs";

// Mon 2026-10-12 … Fri 2026-10-16. ALEXANDER (second shift) has SAT–SUN RDOs.
let app;
let fns;
let officerId;
let googleCalls = [];
let googleStatus = 200;
const realFetch = globalThis.fetch;

before(async () => {
  app = await startApp();
  await seedBoard(app);
  fns = await app.load("/src/lib/fns.ts");
  officerId = (await app.sql`select id from officers where shift_id = 'second-shift' and name like '%ALEXANDER%'`)[0].id;
  await seedLogin(app.sql, { id: "sup2", permission: "supervisor", agencyId: "home", shiftId: "second-shift" });
  await seedLogin(app.sql, { id: "sup3", permission: "supervisor", agencyId: "home", shiftId: "third-shift" });
  await seedLogin(app.sql, { id: "disp2", permission: "dispatcher", agencyId: "home", shiftId: "second-shift" });
  // A connected Google shift with a valid (fake) token; Google itself is stubbed.
  await app.sql`
    update shifts set google_calendar = true, google_access_token = 'tok', google_refresh_token = 'r',
      google_token_expiry = ${new Date(Date.now() + 3600_000).toISOString()}, google_calendar_id = 'cal'
    where id = 'second-shift'
  `;
  globalThis.fetch = async (url, init = {}) => {
    if (String(url).startsWith("https://www.googleapis.com/calendar/")) {
      googleCalls.push({ url: String(url), method: init.method, body: init.body ? JSON.parse(init.body) : null });
      return new Response(googleStatus < 300 ? "{}" : JSON.stringify({ error: { message: "Forbidden" } }), {
        status: googleStatus,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(url, init);
  };
});
after(async () => {
  globalThis.fetch = realFetch;
  await app?.close();
});
beforeEach(() => {
  googleCalls = [];
  googleStatus = 200;
});

let n = 0;
/** Approved sick week with a WatchBoard-written Google event, also in the Zones cache. */
async function sickWeek() {
  n += 1;
  const eventId = `evt${n}`;
  await app.sql`delete from time_off_requests where officer_id = ${officerId}`;
  await app.sql`delete from calendar_cache where shift_id = 'second-shift'`;
  const id = Number(
    (
      await app.sql`
        insert into time_off_requests (officer_id, start_date, end_date, kind, reason, status, calendar_event_id)
        values (${officerId}, '2026-10-12', '2026-10-16', 'sick', 'Called in', 'approved', ${eventId})
        returning id
      `
    )[0].id,
  );
  await cacheEvent(eventId);
  return { id, eventId };
}
const cacheEvent = (eventId) => app.sql`
  insert into calendar_cache (shift_id, event_id, title, start_at, end_at, all_day)
  values ('second-shift', ${eventId}, 'ALEXANDER - SICK', '2026-10-12', '2026-10-16', true)
  on conflict (shift_id, event_id) do nothing
`;
const cached = async (eventId) =>
  (await app.sql`select 1 from calendar_cache where shift_id = 'second-shift' and event_id = ${eventId}`).length;
const assign = (date) => fns.assignZoneFor("sup2", { date, officerId, zone: "NE" });
const req = async (id) => (await app.sql`select * from time_off_requests where id = ${id}`)[0];

describe("Return to duty", () => {
  it("shortens the leave, patches Google, purges the cache; Zones can assign them", async () => {
    const { id, eventId } = await sickWeek();
    await assert.rejects(() => assign("2026-10-14"), /only assign people working/);
    const res = await fns.returnToDutyFor("sup2", { id, returnDate: "2026-10-14" });
    assert.deepEqual([res.removed, res.endDate, res.calendar.message], [false, "2026-10-13", null]);
    const row = await req(id);
    assert.deepEqual([row.status, row.end_date, row.decided_by], ["approved", "2026-10-13", "sup2"]);
    assert.ok(row.decided_at);
    assert.equal(googleCalls.length, 1);
    assert.equal(googleCalls[0].method, "PATCH");
    assert.deepEqual(googleCalls[0].body, { end: { date: "2026-10-14" } }, "Google's end is exclusive");
    assert.equal(await cached(eventId), 0, "cached copy dropped immediately");
    await assign("2026-10-14");
    await assert.rejects(() => assign("2026-10-13"), /only assign/, "still off before the return date");
  });

  it("a stale cached copy of WatchBoard's own event never keeps them off", async () => {
    const { id, eventId } = await sickWeek();
    await fns.returnToDutyFor("sup2", { id, returnDate: "2026-10-14" });
    await cacheEvent(eventId); // e.g. a refresh that raced the PATCH
    await assign("2026-10-15");
  });

  it("if Google refuses, the leave is still shortened and the reason comes back", async () => {
    const { id } = await sickWeek();
    googleStatus = 403;
    const res = await fns.returnToDutyFor("sup2", { id, returnDate: "2026-10-15" });
    assert.ok(res.calendar.message);
    assert.equal((await req(id)).end_date, "2026-10-14");
    assert.equal((await req(id)).calendar_event_id !== null, true, "id kept for a later retry");
    await assign("2026-10-15");
  });

  it("a return on/before the first day cancels the leave and deletes the event", async () => {
    const { id, eventId } = await sickWeek();
    const res = await fns.returnToDutyFor("sup2", { id, returnDate: "2026-10-12" });
    assert.equal(res.removed, true);
    const row = await req(id);
    assert.deepEqual([row.status, row.calendar_event_id], ["cancelled", null]);
    assert.equal(googleCalls[0].method, "DELETE");
    assert.equal(await cached(eventId), 0);
    await assign("2026-10-12");
  });

  it("refuses a return after the leave ends, non-approved leave, dispatch and other shifts", async () => {
    const { id } = await sickWeek();
    await assert.rejects(() => fns.returnToDutyFor("sup2", { id, returnDate: "2026-10-20" }), /already ends/);
    await assert.rejects(() => fns.returnToDutyFor("disp2", { id, returnDate: "2026-10-14" }), /permission/);
    await assert.rejects(() => fns.returnToDutyFor("sup3", { id, returnDate: "2026-10-14" }), /another shift/);
    await app.sql`update time_off_requests set status = 'pending' where id = ${id}`;
    await assert.rejects(() => fns.returnToDutyFor("sup2", { id, returnDate: "2026-10-14" }), /Only approved/);
    assert.equal((await req(id)).end_date, "2026-10-16");
  });
});

describe("Removing leave", () => {
  it("purges the cached event right away when Google deletes it", async () => {
    const { id, eventId } = await sickWeek();
    await fns.setRequestStatusFor("sup2", { id, status: "denied" });
    assert.equal((await req(id)).calendar_event_id, null);
    assert.equal(await cached(eventId), 0);
    await assign("2026-10-13");
  });

  it("if Google can't delete it, keeps the id and still frees the officer", async () => {
    const { id, eventId } = await sickWeek();
    googleStatus = 403;
    const res = await fns.setRequestStatusFor("sup2", { id, status: "denied" });
    assert.ok(res.calendar.message);
    assert.equal((await req(id)).calendar_event_id, eventId);
    assert.equal(await cached(eventId), 1);
    await assign("2026-10-13");
  });
});
