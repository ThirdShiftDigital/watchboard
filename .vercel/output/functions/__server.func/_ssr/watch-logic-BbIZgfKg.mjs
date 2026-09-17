import { r as eventTouchesDate } from "./dates-FrgnkczF.mjs";
import { c as kindShort, o as ZONES } from "./types-DAhVI_1U.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/watch-logic-BbIZgfKg.js
var GEO_ZONES = ZONES.filter((z) => z.id !== "ALL").map((z) => z.id);
function statusForOfficer(officer, weekday, date, requests, events) {
	if (officer.rdoDays.includes(weekday)) return {
		status: "rdo",
		statusLabel: "RDO"
	};
	const leave = requests.find((r) => r.status === "approved" && r.officerId === officer.id && date >= r.startDate && date <= r.endDate);
	if (leave) return {
		status: "leave",
		statusLabel: kindShort(leave.kind)
	};
	const hit = events.find((e) => e.matchedOfficerIds.includes(officer.id) && eventTouchesDate(e.start, e.end, date));
	if (hit) return {
		status: "calendar",
		statusLabel: "CAL",
		eventTitle: hit.title
	};
	return {
		status: "working",
		statusLabel: "ON"
	};
}
function buildRows(officers, weekday, date, requests, events, assignments) {
	const zoneByOfficer = new Map(assignments.map((a) => [a.officerId, a.zone]));
	return officers.map((officer) => {
		const s = statusForOfficer(officer, weekday, date, requests, events);
		return {
			officer,
			status: s.status,
			statusLabel: s.statusLabel,
			zone: s.status === "working" ? zoneByOfficer.get(officer.id) ?? null : null,
			eventTitle: s.eventTitle
		};
	});
}
function autoAssign(working) {
	const usedZones = /* @__PURE__ */ new Set();
	const assigned = /* @__PURE__ */ new Set();
	const result = [];
	const push = (officer, zone) => {
		if (assigned.has(officer.id)) return;
		result.push({
			officerId: officer.id,
			zone
		});
		assigned.add(officer.id);
		if (zone !== "ALL") usedZones.add(zone);
	};
	const supervisors = working.filter((o) => o.role === "lt" || o.role === "sgt" || o.role === "cpl");
	for (const s of supervisors) push(s, "ALL");
	const line = working.filter((o) => !assigned.has(o.id));
	for (const o of line) {
		const preferred = o.defaultZone;
		if (preferred && preferred !== "ALL" && !usedZones.has(preferred)) push(o, preferred);
	}
	const leftover = working.filter((o) => !assigned.has(o.id));
	const freeZones = GEO_ZONES.filter((z) => !usedZones.has(z));
	leftover.forEach((o, i) => {
		push(o, freeZones[i] ?? "ALL");
	});
	return result;
}
function matchOfficersToEvent(title, officers) {
	const hay = ` ${title.toUpperCase().replace(/[^A-Z0-9 ]/g, " ")} `;
	const hits = [];
	for (const o of officers) {
		const last = o.lastName.toUpperCase();
		if (last.length < 3) continue;
		if (hay.includes(` ${last} `) || hay.includes(` ${last}'S `)) hits.push(o.id);
	}
	return hits;
}
function approvedLeaveOnDate(date, requests, officers) {
	const byId = new Map(officers.map((o) => [o.id, o]));
	const chips = [];
	for (const r of requests) {
		if (r.status !== "approved" || date < r.startDate || date > r.endDate) continue;
		const officer = byId.get(r.officerId);
		if (!officer) continue;
		chips.push({
			officerId: officer.id,
			lastName: officer.lastName,
			name: officer.name,
			kind: r.kind,
			kindShort: kindShort(r.kind),
			startDate: r.startDate,
			endDate: r.endDate
		});
	}
	return chips;
}
function approvedLeaveInRange(from, to, requests, officers) {
	const byId = new Map(officers.map((o) => [o.id, o]));
	const rows = [];
	for (const r of requests) {
		if (r.status !== "approved" || r.startDate > to || r.endDate < from) continue;
		const officer = byId.get(r.officerId);
		if (!officer) continue;
		rows.push({
			...r,
			name: officer.name,
			lastName: officer.lastName
		});
	}
	return rows.sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
}
//#endregion
export { matchOfficersToEvent as a, buildRows as i, approvedLeaveOnDate as n, statusForOfficer as o, autoAssign as r, approvedLeaveInRange as t };
