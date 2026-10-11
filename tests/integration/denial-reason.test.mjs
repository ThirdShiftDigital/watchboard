import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { seedBoard, seedLogin, startApp } from "./harness.mjs";

let app;
let fns;
let officerId;

before(async () => {
  app = await startApp();
  await seedBoard(app);
  fns = await app.load("/src/lib/fns.ts");
  officerId = (await app.sql`select id from officers where shift_id = 'second-shift' and name like '%MAYFIELD%'`)[0].id;
  await seedLogin(app.sql, { id: "sup2", permission: "supervisor", agencyId: "home", shiftId: "second-shift" });
  await seedLogin(app.sql, { id: "sup3", permission: "supervisor", agencyId: "home", shiftId: "third-shift" });
  await seedLogin(app.sql, { id: "disp2", permission: "dispatcher", agencyId: "home", shiftId: "second-shift" });
});
after(async () => {
  await app?.close();
});

async function newRequest() {
  const rows = await app.sql`
    insert into time_off_requests (officer_id, start_date, end_date, kind, reason, status)
    values (${officerId}, '2026-11-02', '2026-11-03', 'vacation', 'family trip', 'pending')
    returning id
  `;
  return Number(rows[0].id);
}
const mine = async (id) => (await fns.loadShiftRequests("second-shift")).find((r) => r.id === id);

describe("deny with a reason", () => {
  it("stores the trimmed reason and who/when decided; the officer's list shows it", async () => {
    const id = await newRequest();
    await fns.setRequestStatusFor("sup2", { id, status: "denied", denialReason: `  Minimum staffing ${"x".repeat(400)}` });
    const row = (await app.sql`select status, denial_reason, decided_by, decided_at from time_off_requests where id = ${id}`)[0];
    assert.equal(row.status, "denied");
    assert.equal(row.denial_reason.length, 300);
    assert.ok(row.denial_reason.startsWith("Minimum staffing"));
    assert.equal(row.decided_by, "sup2");
    assert.ok(row.decided_at);
    const r = await mine(id);
    assert.ok(r.denialReason.startsWith("Minimum staffing"));
    assert.ok(r.decidedAt);
  });

  it("deny without a reason is fine", async () => {
    const id = await newRequest();
    await fns.setRequestStatusFor("sup2", { id, status: "denied" });
    assert.equal((await mine(id)).denialReason, null);
  });

  it("restore keeps the reason as history but stops showing it", async () => {
    const id = await newRequest();
    await fns.setRequestStatusFor("sup2", { id, status: "denied", denialReason: "Short staffed" });
    await fns.setRequestStatusFor("sup2", { id, status: "approved" });
    assert.equal((await mine(id)).denialReason, null);
    const row = (await app.sql`select denial_reason from time_off_requests where id = ${id}`)[0];
    assert.equal(row.denial_reason, "Short staffed");
  });

  it("dispatch and another shift's supervisor can't deny", async () => {
    const id = await newRequest();
    await assert.rejects(() => fns.setRequestStatusFor("disp2", { id, status: "denied", denialReason: "no" }), /permission/);
    await assert.rejects(() => fns.setRequestStatusFor("sup3", { id, status: "denied", denialReason: "no" }), /another shift/);
    const row = (await app.sql`select status, denial_reason from time_off_requests where id = ${id}`)[0];
    assert.deepEqual([row.status, row.denial_reason], ["pending", null]);
  });
});

describe("startup ensure", () => {
  it("recreates duty_overrides and the decision columns when missing", async () => {
    await app.sql`drop table duty_overrides`;
    await app.sql`alter table time_off_requests drop column denial_reason`;
    const { ensureLateSchema } = await app.load("/src/lib/schema-ensure.ts");
    await ensureLateSchema(app.sql);
    await ensureLateSchema(app.sql); // idempotent
    const t = await app.sql`select to_regclass('duty_overrides')::text as t`;
    assert.equal(t[0].t, "duty_overrides");
    const c = await app.sql`
      select column_name from information_schema.columns
      where table_name = 'time_off_requests' and column_name in ('denial_reason', 'decided_by', 'decided_at')
      order by column_name
    `;
    assert.deepEqual(c.map((x) => x.column_name), ["decided_at", "decided_by", "denial_reason"]);
  });
});
