import { t as createServerFn } from "./ssr.mjs";
import { a as number, n as array, o as object, r as boolean, s as string, t as _enum } from "../_libs/zod.mjs";
import { i as GoogleCalendarTools, r as ConnectorType } from "./types-Bggxm7au.mjs";
import { c as parseRdoDays, d as startOfWeek, l as serializeRdoDays, p as weekdayOf, t as addDays } from "./dates-FrgnkczF.mjs";
import { r as isLoginRequired, t as isConnectorPending } from "./login-BxQ-E10E.mjs";
import { a as matchOfficersToEvent, i as buildRows, r as autoAssign } from "./watch-logic-BbIZgfKg.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/fns-0lDoY9Rc.js
var MESSAGE_RULES = [
	{
		needles: ["not_connected", "failed_precondition"],
		kind: "not_connected",
		message: "Connect this connector in Grok to load your data."
	},
	{
		needles: ["scope_denied"],
		kind: "scope_denied",
		message: "This view isn't available — the app requested a tool outside its grant."
	},
	{
		needles: ["access_denied"],
		kind: "access_denied",
		message: "You don't have access to this data."
	}
];
function matchMessageRule(raw) {
	return MESSAGE_RULES.find((rule) => rule.needles.some((needle) => raw.includes(needle)));
}
function classifyCallToolError(result) {
	if (result.ok) return null;
	const detail = result.errorMessage || void 0;
	const raw = (result.errorMessage ?? "").toLowerCase();
	if (isConnectorPending(result)) return {
		kind: "pending",
		message: "Connecting to your data…",
		detail
	};
	if (raw.includes("missing_connector_token")) return {
		kind: "error",
		message: "Open this app from Grok to load your data.",
		detail
	};
	if (isLoginRequired(result)) return {
		kind: "login",
		message: "Continue with Grok to load your data.",
		detail
	};
	const rule = matchMessageRule(raw);
	if (rule) return {
		kind: rule.kind,
		message: rule.message,
		detail
	};
	return {
		kind: "error",
		message: detail ?? "Something went wrong. Try again.",
		detail
	};
}
function mapOfficer(row) {
	return {
		id: row.id,
		name: row.name,
		unit: row.unit,
		rankSort: Number(row.rank_sort),
		role: row.role,
		hireDate: row.hire_date,
		tmt: Boolean(row.tmt),
		radioNum: row.radio_num === null ? null : Number(row.radio_num),
		rdoDays: parseRdoDays(row.rdo_days),
		defaultZone: row.default_zone,
		lastName: row.last_name
	};
}
function mapAssignment(row) {
	return {
		id: Number(row.id),
		date: row.date,
		officerId: row.officer_id,
		zone: row.zone
	};
}
function mapRequest(row) {
	return {
		id: Number(row.id),
		officerId: row.officer_id,
		startDate: row.start_date,
		endDate: row.end_date,
		kind: row.kind,
		reason: row.reason ?? "",
		status: row.status,
		createdAt: typeof row.created_at === "string" ? row.created_at : new Date(row.created_at).toISOString()
	};
}
async function loadOfficers() {
	const { getSql } = await import("./db-Q6crUSgl.mjs");
	return (await (await getSql())`
    select id, name, unit, rank_sort, role, hire_date, tmt, radio_num, rdo_days, default_zone, last_name
    from officers
    order by rank_sort asc, unit asc
  `).map(mapOfficer);
}
async function loadRequests() {
	const { getSql } = await import("./db-Q6crUSgl.mjs");
	return (await (await getSql())`
    select id, officer_id, start_date, end_date, kind, reason, status, created_at::text as created_at
    from time_off_requests
    order by
      case status when 'pending' then 0 when 'approved' then 1 else 2 end,
      start_date asc,
      id desc
  `).map(mapRequest);
}
async function loadAssignments(date) {
	const { getSql } = await import("./db-Q6crUSgl.mjs");
	return (await (await getSql())`
    select id, date, officer_id, zone
    from zone_assignments
    where date = ${date}
    order by id asc
  `).map(mapAssignment);
}
async function loadEffectiveDate() {
	const { getSql } = await import("./db-Q6crUSgl.mjs");
	return (await (await getSql())`
    select value from schedule_meta where key = 'effective_date'
  `)[0]?.value ?? "2026-08-30";
}
function asRecord(value) {
	if (value && typeof value === "object" && !Array.isArray(value)) return value;
	return null;
}
function asArray(value) {
	if (Array.isArray(value)) return value;
	const rec = asRecord(value);
	if (!rec) return [];
	for (const key of [
		"events",
		"items",
		"data",
		"result",
		"calendars"
	]) if (Array.isArray(rec[key])) return rec[key];
	return [];
}
function pickString(rec, keys) {
	for (const key of keys) {
		const v = rec[key];
		if (typeof v === "string" && v.trim()) return v;
	}
	return "";
}
function dateFromUnknown(value) {
	if (typeof value === "string") return value;
	const rec = asRecord(value);
	if (!rec) return "";
	return pickString(rec, [
		"dateTime",
		"date",
		"date_time"
	]);
}
function parseCalendarEvents(data, officers) {
	return asArray(data).map((item, index) => {
		const rec = asRecord(item);
		if (!rec) return null;
		const title = pickString(rec, [
			"summary",
			"title",
			"name",
			"subject"
		]) || "Untitled event";
		const start = dateFromUnknown(rec.start) || pickString(rec, ["start", "startTime"]);
		const end = dateFromUnknown(rec.end) || pickString(rec, ["end", "endTime"]) || null;
		if (!start) return null;
		return {
			id: pickString(rec, [
				"id",
				"eventId",
				"iCalUID"
			]) || `evt-${index}`,
			title,
			start,
			end,
			allDay: rec.allDay === true || typeof rec.start === "string" && rec.start.length === 10,
			matchedOfficerIds: matchOfficersToEvent(title, officers)
		};
	}).filter((e) => e !== null);
}
async function fetchCalendar(officers, timeMin, timeMax) {
	const { callTool } = await import("./client.server-CM-WkBbE.mjs");
	const result = await callTool(GoogleCalendarTools.search, {
		query: "",
		timeMin: `${timeMin}T00:00:00`,
		timeMax: `${timeMax}T23:59:59`,
		maxResults: 80
	}, { connectorType: ConnectorType.GoogleCalendar });
	if (result.ok) return {
		kind: "ok",
		events: parseCalendarEvents(result.data, officers)
	};
	const classified = classifyCallToolError(result);
	if (classified?.kind === "pending") return {
		kind: "pending",
		message: classified.message,
		events: []
	};
	if (classified?.kind === "login") return {
		kind: "login",
		message: classified.message,
		loginUrl: result.loginUrl,
		events: []
	};
	if (classified?.kind === "not_connected") return {
		kind: "not_connected",
		message: classified.message,
		events: []
	};
	const raw = (result.errorMessage ?? "").toLowerCase();
	if (raw.includes("cannot resolve gate host") || raw.includes("missing_connector_token")) return {
		kind: "unavailable",
		message: "Google Calendar syncs when this app is opened from Grok with Calendar connected.",
		events: []
	};
	return {
		kind: "error",
		message: classified?.message ?? result.errorMessage ?? "Could not load calendar.",
		events: []
	};
}
var dateInput = object({ date: string().regex(/^\d{4}-\d{2}-\d{2}$/) });
var getWatch_createServerFn_handler = createServerRpc({
	id: "52eb4330ee24b7fdea90e785ab4c9dc7c303b679876a51db0fdf88a8653b716e",
	name: "getWatch",
	filename: "src/lib/fns.ts"
}, (opts) => getWatch.__executeServer(opts));
var getWatch = createServerFn({ method: "POST" }).validator(dateInput).handler(getWatch_createServerFn_handler, async ({ data }) => {
	const date = data.date;
	const weekday = weekdayOf(date);
	const [officers, requests, existing, effectiveDate] = await Promise.all([
		loadOfficers(),
		loadRequests(),
		loadAssignments(date),
		loadEffectiveDate()
	]);
	const calendar = await fetchCalendar(officers, date, date);
	let assignments = existing;
	if (assignments.length === 0) {
		const working = officers.filter((o) => {
			return buildRows([o], weekday, date, requests, calendar.events, [])[0]?.status === "working";
		});
		const suggested = autoAssign(working);
		if (suggested.length > 0) {
			const { getSql } = await import("./db-Q6crUSgl.mjs");
			const sql = await getSql();
			for (const item of suggested) await sql`
            insert into zone_assignments (date, officer_id, zone)
            values (${date}, ${item.officerId}, ${item.zone})
            on conflict (date, officer_id) do update set zone = excluded.zone
          `;
			assignments = await loadAssignments(date);
		}
	}
	const rows = buildRows(officers, weekday, date, requests, calendar.events, assignments);
	return {
		date,
		weekday,
		officers,
		rows,
		workingCount: rows.filter((r) => r.status === "working").length,
		rdoCount: rows.filter((r) => r.status === "rdo").length,
		leaveCount: rows.filter((r) => r.status === "leave").length,
		calendarOffCount: rows.filter((r) => r.status === "calendar").length,
		assignedCount: rows.filter((r) => r.status === "working" && r.zone).length,
		calendar,
		effectiveDate,
		generated: assignments.length > 0
	};
});
var rebuildWatch_createServerFn_handler = createServerRpc({
	id: "20e5a7b8409c31e9bdcdcfa60196762a5bf7f067635572f4af7eb6ae489ab8cd",
	name: "rebuildWatch",
	filename: "src/lib/fns.ts"
}, (opts) => rebuildWatch.__executeServer(opts));
var rebuildWatch = createServerFn({ method: "POST" }).validator(dateInput).handler(rebuildWatch_createServerFn_handler, async ({ data }) => {
	const date = data.date;
	const weekday = weekdayOf(date);
	const [officers, requests] = await Promise.all([loadOfficers(), loadRequests()]);
	const calendar = await fetchCalendar(officers, date, date);
	const working = officers.filter((o) => {
		return buildRows([o], weekday, date, requests, calendar.events, [])[0]?.status === "working";
	});
	const suggested = autoAssign(working);
	const { getSql } = await import("./db-Q6crUSgl.mjs");
	const sql = await getSql();
	await sql`delete from zone_assignments where date = ${date}`;
	for (const item of suggested) await sql`
        insert into zone_assignments (date, officer_id, zone)
        values (${date}, ${item.officerId}, ${item.zone})
      `;
	return { saved: suggested.length };
});
var upsertAssignment_createServerFn_handler = createServerRpc({
	id: "892d3c0e42a7dba3b6610639af936abd754a1ed28b0f11afde9e5f1abc5e8ac8",
	name: "upsertAssignment",
	filename: "src/lib/fns.ts"
}, (opts) => upsertAssignment.__executeServer(opts));
var upsertAssignment = createServerFn({ method: "POST" }).validator(object({
	date: string().regex(/^\d{4}-\d{2}-\d{2}$/),
	officerId: string().min(1),
	zone: string().min(1)
})).handler(upsertAssignment_createServerFn_handler, async ({ data }) => {
	const { getSql } = await import("./db-Q6crUSgl.mjs");
	await (await getSql())`
      insert into zone_assignments (date, officer_id, zone)
      values (${data.date}, ${data.officerId}, ${data.zone})
      on conflict (date, officer_id) do update set zone = excluded.zone
    `;
	return { ok: true };
});
var deleteAssignment_createServerFn_handler = createServerRpc({
	id: "eefb28e40bf0e3237b899a697c9b86773456530eebd96bc02672fc2141c72c4a",
	name: "deleteAssignment",
	filename: "src/lib/fns.ts"
}, (opts) => deleteAssignment.__executeServer(opts));
var deleteAssignment = createServerFn({ method: "POST" }).validator(object({
	date: string().regex(/^\d{4}-\d{2}-\d{2}$/),
	officerId: string().min(1)
})).handler(deleteAssignment_createServerFn_handler, async ({ data }) => {
	const { getSql } = await import("./db-Q6crUSgl.mjs");
	await (await getSql())`
      delete from zone_assignments
      where date = ${data.date} and officer_id = ${data.officerId}
    `;
	return { ok: true };
});
var listRequests_createServerFn_handler = createServerRpc({
	id: "746f9a908a803565ef732078c04568f0929e0ad3d2bf222b308281ce54110eaa",
	name: "listRequests",
	filename: "src/lib/fns.ts"
}, (opts) => listRequests.__executeServer(opts));
var listRequests = createServerFn({ method: "GET" }).handler(listRequests_createServerFn_handler, async () => {
	const [requests, officers] = await Promise.all([loadRequests(), loadOfficers()]);
	return {
		requests,
		officers
	};
});
var createRequest_createServerFn_handler = createServerRpc({
	id: "2cd5712e38b4b4659c14066c8eae61bdb209fc1d7fb579f9b4c84c96239df143",
	name: "createRequest",
	filename: "src/lib/fns.ts"
}, (opts) => createRequest.__executeServer(opts));
var createRequest = createServerFn({ method: "POST" }).validator(object({
	officerId: string().min(1),
	startDate: string().regex(/^\d{4}-\d{2}-\d{2}$/),
	endDate: string().regex(/^\d{4}-\d{2}-\d{2}$/),
	kind: _enum([
		"vacation",
		"sick",
		"training",
		"court",
		"other"
	]),
	reason: string().max(280)
})).handler(createRequest_createServerFn_handler, async ({ data }) => {
	if (data.endDate < data.startDate) throw new Error("End date must be on or after the start date.");
	const { getSql } = await import("./db-Q6crUSgl.mjs");
	const rows = await (await getSql())`
      insert into time_off_requests (officer_id, start_date, end_date, kind, reason, status)
      values (${data.officerId}, ${data.startDate}, ${data.endDate}, ${data.kind}, ${data.reason}, 'pending')
      returning id
    `;
	return { id: Number(rows[0]?.id) };
});
var setRequestStatus_createServerFn_handler = createServerRpc({
	id: "36962d701c3409c4d8c2b63a9008cddbfc042d57f5bf2e71c83f943c592c9f37",
	name: "setRequestStatus",
	filename: "src/lib/fns.ts"
}, (opts) => setRequestStatus.__executeServer(opts));
var setRequestStatus = createServerFn({ method: "POST" }).validator(object({
	id: number().int(),
	status: _enum([
		"approved",
		"denied",
		"pending"
	])
})).handler(setRequestStatus_createServerFn_handler, async ({ data }) => {
	const { getSql } = await import("./db-Q6crUSgl.mjs");
	const sql = await getSql();
	const row = (await sql`
      select id, officer_id, start_date, end_date, kind, reason, status, created_at::text as created_at
      from time_off_requests
      where id = ${data.id}
      limit 1
    `)[0];
	if (!row) throw new Error("Request not found.");
	await sql`
      update time_off_requests set status = ${data.status} where id = ${data.id}
    `;
	if (data.status === "approved") await sql`
        delete from zone_assignments
        where officer_id = ${row.officer_id}
          and date >= ${row.start_date}
          and date <= ${row.end_date}
      `;
	return {
		ok: true,
		startDate: row.start_date,
		endDate: row.end_date
	};
});
var toggleRdo_createServerFn_handler = createServerRpc({
	id: "140f984da2482500a09e3e296722451765390bf235d87c7ba82619bdd816f1cc",
	name: "toggleRdo",
	filename: "src/lib/fns.ts"
}, (opts) => toggleRdo.__executeServer(opts));
var toggleRdo = createServerFn({ method: "POST" }).validator(object({
	officerId: string().min(1),
	weekday: number().int().min(0).max(6)
})).handler(toggleRdo_createServerFn_handler, async ({ data }) => {
	const officer = (await loadOfficers()).find((o) => o.id === data.officerId);
	if (!officer) throw new Error("Officer not found.");
	const next = officer.rdoDays.includes(data.weekday) ? officer.rdoDays.filter((d) => d !== data.weekday) : [...officer.rdoDays, data.weekday];
	const { getSql } = await import("./db-Q6crUSgl.mjs");
	await (await getSql())`
      update officers set rdo_days = ${serializeRdoDays(next)} where id = ${data.officerId}
    `;
	return { rdoDays: next };
});
var setRdoDays_createServerFn_handler = createServerRpc({
	id: "cca50e11305d002da3491d4b1102c00b7f7d1ab7bb2d4a23dfcc0c225f8fb77f",
	name: "setRdoDays",
	filename: "src/lib/fns.ts"
}, (opts) => setRdoDays.__executeServer(opts));
var setRdoDays = createServerFn({ method: "POST" }).validator(object({
	officerId: string().min(1),
	rdoDays: array(number().int().min(0).max(6)).max(7)
})).handler(setRdoDays_createServerFn_handler, async ({ data }) => {
	if (!(await loadOfficers()).some((o) => o.id === data.officerId)) throw new Error("Officer not found.");
	const { getSql } = await import("./db-Q6crUSgl.mjs");
	await (await getSql())`
      update officers set rdo_days = ${serializeRdoDays(data.rdoDays)} where id = ${data.officerId}
    `;
	return { rdoDays: data.rdoDays };
});
var officerInput = object({
	name: string().min(2).max(80),
	unit: string().min(1).max(8),
	role: _enum([
		"lt",
		"sgt",
		"cpl",
		"fto",
		"deputy"
	]),
	hireDate: string(),
	tmt: boolean(),
	radioNum: number().int().min(0).max(9999).nullable(),
	rdoDays: array(number().int().min(0).max(6)).max(7),
	defaultZone: string().max(24).nullable()
});
function slugOfficerId(name, unit, taken) {
	const base = (name.replace(/[.,]/g, " ").trim().split(/\s+/).pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") ?? "officer") || "officer";
	if (!taken.has(base)) return base;
	const withUnit = `${base}-${unit.toLowerCase().replace(/[^a-z0-9]/g, "")}`;
	if (!taken.has(withUnit)) return withUnit;
	let n = 2;
	while (taken.has(`${base}-${n}`)) n += 1;
	return `${base}-${n}`;
}
function displayOfficerName(name) {
	return name.trim().replace(/\s+/g, " ").toUpperCase();
}
function rankSortFor(unit) {
	const n = Number(unit);
	return Number.isFinite(n) ? n : 900;
}
var createOfficer_createServerFn_handler = createServerRpc({
	id: "a0de0a8a0b9bedc20d21d03c776203b0a2bd555078277acf2be7442e15995eb3",
	name: "createOfficer",
	filename: "src/lib/fns.ts"
}, (opts) => createOfficer.__executeServer(opts));
var createOfficer = createServerFn({ method: "POST" }).validator(officerInput).handler(createOfficer_createServerFn_handler, async ({ data }) => {
	const officers = await loadOfficers();
	const unit = data.unit.trim();
	if (officers.some((o) => o.unit === unit)) throw new Error(`Unit ${unit} is already on the roster.`);
	const name = displayOfficerName(data.name);
	const lastName = name.replace(/[.,]/g, " ").trim().split(/\s+/).pop() ?? name;
	const id = slugOfficerId(name, unit, new Set(officers.map((o) => o.id)));
	const hireDate = data.hireDate && /^\d{4}-\d{2}-\d{2}$/.test(data.hireDate) ? data.hireDate : null;
	const { getSql } = await import("./db-Q6crUSgl.mjs");
	await (await getSql())`
      insert into officers (id, name, unit, rank_sort, role, hire_date, tmt, radio_num, rdo_days, default_zone, last_name)
      values (
        ${id},
        ${name},
        ${unit},
        ${rankSortFor(unit)},
        ${data.role},
        ${hireDate},
        ${data.tmt},
        ${data.radioNum},
        ${serializeRdoDays(data.rdoDays)},
        ${data.defaultZone},
        ${lastName}
      )
    `;
	return { id };
});
var updateOfficer_createServerFn_handler = createServerRpc({
	id: "4e8679b599af4ced0b5d14941fd1e6d453b22d686b4ed208a4e16186c5f55cb2",
	name: "updateOfficer",
	filename: "src/lib/fns.ts"
}, (opts) => updateOfficer.__executeServer(opts));
var updateOfficer = createServerFn({ method: "POST" }).validator(officerInput.extend({ id: string().min(1) })).handler(updateOfficer_createServerFn_handler, async ({ data }) => {
	const officers = await loadOfficers();
	if (!officers.find((o) => o.id === data.id)) throw new Error("Officer not found.");
	const unit = data.unit.trim();
	if (officers.some((o) => o.unit === unit && o.id !== data.id)) throw new Error(`Unit ${unit} is already on the roster.`);
	const name = displayOfficerName(data.name);
	const lastName = name.replace(/[.,]/g, " ").trim().split(/\s+/).pop() ?? name;
	const hireDate = data.hireDate && /^\d{4}-\d{2}-\d{2}$/.test(data.hireDate) ? data.hireDate : null;
	const { getSql } = await import("./db-Q6crUSgl.mjs");
	await (await getSql())`
      update officers
      set
        name = ${name},
        unit = ${unit},
        rank_sort = ${rankSortFor(unit)},
        role = ${data.role},
        hire_date = ${hireDate},
        tmt = ${data.tmt},
        radio_num = ${data.radioNum},
        rdo_days = ${serializeRdoDays(data.rdoDays)},
        default_zone = ${data.defaultZone},
        last_name = ${lastName}
      where id = ${data.id}
    `;
	return { ok: true };
});
var deleteOfficer_createServerFn_handler = createServerRpc({
	id: "4d203eab5b7b85187ddbda9b6e0285ceb89953a715fb3371739233cbd18ca96c",
	name: "deleteOfficer",
	filename: "src/lib/fns.ts"
}, (opts) => deleteOfficer.__executeServer(opts));
var deleteOfficer = createServerFn({ method: "POST" }).validator(object({ id: string().min(1) })).handler(deleteOfficer_createServerFn_handler, async ({ data }) => {
	const { getSql } = await import("./db-Q6crUSgl.mjs");
	const sql = await getSql();
	await sql`delete from zone_assignments where officer_id = ${data.id}`;
	await sql`delete from time_off_requests where officer_id = ${data.id}`;
	await sql`delete from officers where id = ${data.id}`;
	return { ok: true };
});
var getSchedule_createServerFn_handler = createServerRpc({
	id: "57fb1a254d60094d59d92780738e058272671d6ddd53c9af9ee2519b385541d3",
	name: "getSchedule",
	filename: "src/lib/fns.ts"
}, (opts) => getSchedule.__executeServer(opts));
var getSchedule = createServerFn({ method: "POST" }).validator(object({ weekStart: string().regex(/^\d{4}-\d{2}-\d{2}$/) })).handler(getSchedule_createServerFn_handler, async ({ data }) => {
	const weekStart = startOfWeek(data.weekStart);
	const weekEnd = addDays(weekStart, 6);
	const [officers, requests, effectiveDate] = await Promise.all([
		loadOfficers(),
		loadRequests(),
		loadEffectiveDate()
	]);
	return {
		weekStart,
		officers,
		requests,
		calendar: await fetchCalendar(officers, weekStart, weekEnd),
		effectiveDate
	};
});
var getCalendarMonth_createServerFn_handler = createServerRpc({
	id: "64fe8e31f771d080b0fabb2dbebc1a6920ace747b4231012a9216f8f827b906c",
	name: "getCalendarMonth",
	filename: "src/lib/fns.ts"
}, (opts) => getCalendarMonth.__executeServer(opts));
var getCalendarMonth = createServerFn({ method: "POST" }).validator(object({
	from: string().regex(/^\d{4}-\d{2}-\d{2}$/),
	to: string().regex(/^\d{4}-\d{2}-\d{2}$/)
})).handler(getCalendarMonth_createServerFn_handler, async ({ data }) => {
	const [officers, requests] = await Promise.all([loadOfficers(), loadRequests()]);
	return {
		officers,
		requests,
		calendar: await fetchCalendar(officers, data.from, data.to)
	};
});
//#endregion
export { createOfficer_createServerFn_handler, createRequest_createServerFn_handler, deleteAssignment_createServerFn_handler, deleteOfficer_createServerFn_handler, getCalendarMonth_createServerFn_handler, getSchedule_createServerFn_handler, getWatch_createServerFn_handler, listRequests_createServerFn_handler, rebuildWatch_createServerFn_handler, setRdoDays_createServerFn_handler, setRequestStatus_createServerFn_handler, toggleRdo_createServerFn_handler, updateOfficer_createServerFn_handler, upsertAssignment_createServerFn_handler };
