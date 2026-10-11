import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { seedBoard, seedLogin, startApp } from "./harness.mjs";

// 2026-10-12 is a Monday; 2026-10-17 a Saturday.
const MON = "2026-10-12";
const SAT = "2026-10-17";

let app;
let ov; // overrides-fns
let fns;
let mayfield; // second shift, RDO MON–TUE
let alexander; // second shift, RDO SAT–SUN
let burns; // second shift, RDO MON–TUE
let thirdShiftOfficer;

before(async () => {
  app = await startApp();
  await seedBoard(app);
  ov = await app.load("/src/lib/overrides-fns.ts");
  fns = await app.load("/src/lib/fns.ts");
  const byName = async (like) =>
    (await app.sql`select id from officers where shift_id = 'second-shift' and name like ${like}`)[0].id;
  mayfield = await byName("%MAYFIELD%");
  alexander = await byName("%ALEXANDER%");
  burns = await byName("%BURNS%");
  thirdShiftOfficer = (await app.sql`select id from officers where shift_id = 'third-shift' limit 1`)[0].id;
  await seedLogin(app.sql, { id: "sup2", permission: "supervisor", agencyId: "home", shiftId: "second-shift" });
  await seedLogin(app.sql, { id: "disp2", permission: "dispatcher", agencyId: "home", shiftId: "second-shift" });
  await seedLogin(app.sql, { id: "sup3", permission: "supervisor", agencyId: "home", shiftId: "third-shift" });
  await seedLogin(app.sql, { id: "supoff", permission: "supervisor", agencyId: "home", shiftId: "second-shift" });
  await app.sql`update staff_accounts set cap_overrides = ${JSON.stringify({ overtimeSwaps: false })} where user_id = 'supoff'`;
});
after(async () => {
  await app?.close();
});

const rowsFor = (date) =>
  app.sql`select officer_id, status, kind, swap_group, is_payback from duty_overrides where date = ${date} order by status desc`;

describe("overtime", () => {
  it("puts an RDO officer on duty and lets Zones assign them", async () => {
    await assert.rejects(
      () => fns.assignZoneFor("sup2", { date: MON, officerId: mayfield, zone: "NE" }),
      /only assign people working/,
    );
    await ov.createOvertimeFor("sup2", { officerId: mayfield, date: MON });
    const rows = await rowsFor(MON);
    assert.deepEqual(rows.map((r) => [r.officer_id, r.status, r.kind]), [[mayfield, "working", "ot"]]);
    await fns.assignZoneFor("sup2", { date: MON, officerId: mayfield, zone: "NE" });
    const z = await app.sql`select zone from zone_assignments where date = ${MON} and officer_id = ${mayfield}`;
    assert.equal(z[0].zone, "NE");
  });

  it("refuses OT on a day the officer already works, and duplicates", async () => {
    await assert.rejects(() => ov.createOvertimeFor("sup2", { officerId: alexander, date: MON }), /already scheduled/);
    await assert.rejects(() => ov.createOvertimeFor("sup2", { officerId: mayfield, date: MON }), /already has/);
  });

  it("removing OT clears that day's zone and returns them to RDO", async () => {
    const id = (await app.sql`select id from duty_overrides where officer_id = ${mayfield} and date = ${MON}`)[0].id;
    await ov.removeOverrideFor("sup2", { id: Number(id) });
    assert.equal((await rowsFor(MON)).length, 0);
    const z = await app.sql`select 1 from zone_assignments where date = ${MON} and officer_id = ${mayfield}`;
    assert.equal(z.length, 0);
  });
});

describe("swaps", () => {
  it("creates the pair (and payback pair) in one group; swapped-off officer can't get a zone", async () => {
    await fns.assignZoneFor("sup2", { date: MON, officerId: alexander, zone: "SW" });
    const { swapGroup } = await ov.createSwapFor("sup2", {
      officerId: mayfield,
      partnerId: alexander,
      date: MON,
      paybackDate: SAT,
      reason: "family",
    });
    assert.deepEqual(
      (await rowsFor(MON)).map((r) => [r.officer_id, r.status, r.swap_group, r.is_payback]),
      [
        [mayfield, "working", swapGroup, false],
        [alexander, "off", swapGroup, false],
      ],
    );
    assert.deepEqual(
      (await rowsFor(SAT)).map((r) => [r.officer_id, r.status, r.swap_group, r.is_payback]),
      [
        [alexander, "working", swapGroup, true],
        [mayfield, "off", swapGroup, true],
      ],
    );
    // Alexander's posted zone for MON was dropped when he went off.
    assert.equal((await app.sql`select 1 from zone_assignments where date = ${MON} and officer_id = ${alexander}`).length, 0);
    await assert.rejects(
      () => fns.assignZoneFor("sup2", { date: MON, officerId: alexander, zone: "SW" }),
      /only assign people working/,
    );
    await fns.assignZoneFor("sup2", { date: MON, officerId: mayfield, zone: "SW" });
    await fns.assignZoneFor("sup2", { date: SAT, officerId: alexander, zone: "NE" });

    const { swaps } = await ov.listSwapsFor("sup2");
    const mine = swaps.find((s) => s.swapGroup === swapGroup);
    assert.equal(mine.state, "scheduled");
    assert.equal(mine.payback.date, SAT);
  });

  it("deleting one side deletes the whole group", async () => {
    const off = (await app.sql`select id from duty_overrides where officer_id = ${mayfield} and date = ${SAT}`)[0].id;
    const res = await ov.removeOverrideFor("sup2", { id: Number(off) });
    assert.equal(res.removed, 4);
    assert.equal((await rowsFor(MON)).length + (await rowsFor(SAT)).length, 0);
    assert.equal((await app.sql`select 1 from zone_assignments where date = ${SAT} and officer_id = ${alexander}`).length, 0);
  });

  it("an owed swap gets its payback later", async () => {
    const { swapGroup } = await ov.createSwapFor("sup2", { officerId: burns, partnerId: alexander, date: MON });
    let s = (await ov.listSwapsFor("sup2")).swaps.find((x) => x.swapGroup === swapGroup);
    assert.equal(s.state, "owed");
    await ov.addSwapPaybackFor("sup2", { swapGroup, paybackDate: SAT });
    s = (await ov.listSwapsFor("sup2")).swaps.find((x) => x.swapGroup === swapGroup);
    assert.equal(s.state, "scheduled");
    await assert.rejects(() => ov.addSwapPaybackFor("sup2", { swapGroup, paybackDate: "2026-10-24" }), /already has a payback/);
  });
});

describe("permission and scope", () => {
  it("dispatch and a supervisor with the cap turned off are refused", async () => {
    await assert.rejects(() => ov.createOvertimeFor("disp2", { officerId: mayfield, date: "2026-10-13" }), /permission/);
    await assert.rejects(() => ov.createOvertimeFor("supoff", { officerId: mayfield, date: "2026-10-13" }), /permission/);
    await assert.rejects(() => ov.listSwapsFor("disp2"), /permission/);
  });

  it("a supervisor on another shift can't touch this shift's officers or entries", async () => {
    await assert.rejects(() => ov.createOvertimeFor("sup3", { officerId: mayfield, date: "2026-10-13" }), /another shift/);
    const id = (await app.sql`select id from duty_overrides limit 1`)[0].id;
    await assert.rejects(() => ov.removeOverrideFor("sup3", { id: Number(id) }), /another shift/);
    // …and a second-shift supervisor can't reach a third-shift officer.
    await assert.rejects(
      () => ov.createOvertimeFor("sup2", { officerId: thirdShiftOfficer, date: "2026-10-13" }),
      /another shift/,
    );
  });

  it("can't swap across shifts", async () => {
    await assert.rejects(
      () => ov.createSwapFor("sup2", { officerId: mayfield, partnerId: thirdShiftOfficer, date: "2026-10-13" }),
      /another shift/,
    );
  });
});

describe("missing table (deploy preview before the migration)", () => {
  it("reads as no overrides; writes explain why", async () => {
    await app.sql`alter table duty_overrides rename to duty_overrides_hidden`;
    try {
      const db = await app.load("/src/lib/overrides-db.ts");
      assert.deepEqual(await db.loadOverrides("second-shift", MON, SAT), []);
      await fns.assignZoneFor("sup2", { date: "2026-10-15", officerId: alexander, zone: "NE" });
      await assert.rejects(() => ov.createOvertimeFor("sup2", { officerId: mayfield, date: "2026-10-13" }), /aren’t set up/);
    } finally {
      await app.sql`alter table duty_overrides_hidden rename to duty_overrides`;
    }
  });
});
