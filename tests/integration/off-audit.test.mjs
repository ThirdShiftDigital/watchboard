import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { seedBoard, seedLogin, startApp } from "./harness.mjs";

let app;
let fns;
let ov;
let audit;
let alexander;
let mayfield;
let burnsId;
const burns2 = () => burnsId;

before(async () => {
  app = await startApp();
  await seedBoard(app);
  fns = await app.load("/src/lib/fns.ts");
  ov = await app.load("/src/lib/overrides-fns.ts");
  audit = await app.load("/src/lib/off-audit.ts");
  const byName = async (like) =>
    (await app.sql`select id from officers where shift_id = 'second-shift' and name like ${like}`)[0].id;
  alexander = await byName("%ALEXANDER%");
  mayfield = await byName("%MAYFIELD%");
  burnsId = await byName("%BURNS%");
  await seedLogin(app.sql, { id: "oa_sup2", name: "Sgt Two", permission: "supervisor", agencyId: "home", shiftId: "second-shift" });
  await seedLogin(app.sql, { id: "oa_cmd2", name: "Lt Second", permission: "admin", agencyId: "home", shiftId: "second-shift" });
  await seedLogin(app.sql, { id: "oa_cmd3", name: "Lt Third", permission: "admin", agencyId: "home", shiftId: "third-shift" });
  await seedLogin(app.sql, { id: "oa_cap", name: "Capt", permission: "captain", agencyId: "home", shiftId: "second-shift" });
  await seedLogin(app.sql, { id: "oa_off2", name: "Dep", permission: "officer", agencyId: "home", shiftId: "second-shift" });
});
after(async () => app?.close());

const rows = (type, id) =>
  app.sql`select * from off_audit where entity_type = ${type} and entity_id = ${String(id)} order by id`;

async function pendingSick() {
  return Number(
    (
      await app.sql`
        insert into time_off_requests (officer_id, start_date, end_date, kind, reason, status)
        values (${alexander}, '2026-10-12', '2026-10-16', 'sick', 'flu', 'pending') returning id`
    )[0].id,
  );
}

describe("off audit trail", () => {
  it("approve and return-to-duty write audit rows with actor name", async () => {
    const id = await pendingSick();
    await fns.setRequestStatusFor("oa_sup2", { id, status: "approved" });
    await fns.returnToDutyFor("oa_sup2", { id, returnDate: "2026-10-14" });
    const r = await rows("request", id);
    assert.deepEqual(r.map((x) => x.action), ["approved", "ended_early"]);
    assert.equal(r[0].actor_user_id, "oa_sup2");
    assert.equal(r[0].actor_name, "Sgt Two");
    assert.equal(r[0].shift_id, "second-shift");
    assert.match(r[1].summary, /now ends 2026-10-13/);
  });

  it("swap create + remove are audited per row", async () => {
    const res = await ov.createSwapFor("oa_sup2", { officerId: alexander, partnerId: mayfield, date: "2026-10-17" });
    assert.ok(res.swapGroup);
    const group = await app.sql`select id from duty_overrides where swap_group = ${res.swapGroup}`;
    for (const g of group) assert.deepEqual((await rows("override", g.id)).map((x) => x.action), ["created"]);
    await ov.removeOverrideFor("oa_sup2", { id: Number(group[0].id) });
    for (const g of group) {
      assert.deepEqual((await rows("override", g.id)).map((x) => x.action), ["created", "removed"]);
    }
  });

  it("is append-only", async () => {
    await assert.rejects(() => app.sql`update off_audit set actor_name = 'x'`, /append-only/);
    await assert.rejects(() => app.sql`delete from off_audit`, /append-only/);
  });

  it("history: only the commander of the entry's shift", async () => {
    const id = await pendingSick();
    await fns.setRequestStatusFor("oa_sup2", { id, status: "approved" });
    const h = await audit.offHistoryFor("oa_cmd2", { entityType: "request", entityId: id });
    assert.equal(h.entries.length, 1);
    assert.equal(h.entries[0].actorName, "Sgt Two");
    for (const who of ["oa_sup2", "oa_cmd3", "oa_cap", "oa_off2"]) {
      await assert.rejects(
        () => audit.offHistoryFor(who, { entityType: "request", entityId: id }),
        /Only the shift commander/,
        who,
      );
    }
  });

  it("loaders attach stamps for the commander only", async () => {
    const staff = await app.load("/src/lib/staff.ts");
    const id = await pendingSick();
    await app.sql`insert into off_audit (entity_type, entity_id, officer_id, shift_id, action, actor_user_id, actor_name)
      values ('request', ${String(id)}, ${alexander}, 'second-shift', 'created', 'oa_off2', 'Dep')`;
    const entries = [{ id }];
    const forCmd = await audit.withAuditStamps(await staff.accessFor("oa_cmd2"), "second-shift", "request", entries);
    assert.equal(forCmd[0].audit.markedBy, "Dep");
    await fns.setRequestStatusFor("oa_sup2", { id, status: "approved" });
    const afterApprove = await audit.withAuditStamps(await staff.accessFor("oa_cmd2"), "second-shift", "request", entries);
    assert.equal(afterApprove[0].audit.markedBy, "Sgt Two");
    for (const who of ["oa_sup2", "oa_cmd3", "oa_cap", "oa_off2"]) {
      const out = await audit.withAuditStamps(await staff.accessFor(who), "second-shift", "request", entries);
      assert.equal("audit" in out[0], false, who);
    }
  });
});

describe("time-off totals + report (print / PDF / email)", () => {
  it("commander gets totals and report; everyone else is refused like history", async () => {
    await app.sql`
      insert into time_off_requests (officer_id, start_date, end_date, kind, reason, status)
      values (${burns2()}, '2026-09-06', '2026-09-08', 'vacation', '', 'approved')`;
    const officerId = burns2();
    const input = { officerId, unit: "week", anchor: "2026-09-09" };
    const t = await audit.officerTimeOffFor("oa_cmd2", input);
    assert.equal(t.from, "2026-09-06");
    assert.ok(t.total >= 1);
    const r = await audit.officerReportFor("oa_cmd2", input);
    assert.equal(r.totals.total, t.total);
    assert.ok(Array.isArray(r.history));
    for (const who of ["oa_sup2", "oa_cmd3", "oa_cap", "oa_off2"]) {
      await assert.rejects(() => audit.officerTimeOffFor(who, input), /Only the shift commander/, who);
      await assert.rejects(() => audit.officerReportFor(who, input), /Only the shift commander/, who);
    }
    await assert.rejects(() => audit.officerReportFor("oa_cmd2", { ...input, officerId: "nope" }), /Only the shift commander/);
  });

  it("portal field is present for the commander only", async () => {
    const staff = await app.load("/src/lib/staff.ts");
    const yes = await audit.portalTimeOff(await staff.accessFor("oa_cmd2"), burns2(), "2026-09-09");
    assert.ok(yes && yes.week && yes.month);
    for (const who of ["oa_sup2", "oa_cmd3", "oa_cap", "oa_off2"]) {
      assert.equal(await audit.portalTimeOff(await staff.accessFor(who), burns2(), "2026-09-09"), null, who);
    }
  });
});
