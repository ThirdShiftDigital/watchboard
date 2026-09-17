//#region node_modules/.nitro/vite/services/ssr/assets/dates-FrgnkczF.js
function todayISO() {
	const d = /* @__PURE__ */ new Date();
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function parseISODate(iso) {
	const [y, m, d] = iso.split("-").map(Number);
	return new Date(y, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}
function toISODate(d) {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function weekdayOf(iso) {
	return parseISODate(iso).getDay();
}
function addDays(iso, n) {
	const d = parseISODate(iso);
	d.setDate(d.getDate() + n);
	return toISODate(d);
}
function startOfWeek(iso) {
	return addDays(iso, -weekdayOf(iso));
}
function startOfMonth(iso) {
	const d = parseISODate(iso);
	d.setDate(1);
	return toISODate(d);
}
function formatLong(iso) {
	return parseISODate(iso).toLocaleDateString("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		year: "numeric"
	});
}
function formatShort(iso) {
	return parseISODate(iso).toLocaleDateString("en-US", {
		month: "short",
		day: "numeric"
	});
}
function monthTitle(iso) {
	return parseISODate(iso).toLocaleDateString("en-US", {
		month: "long",
		year: "numeric"
	});
}
function daysInMonth(iso) {
	const start = parseISODate(startOfMonth(iso));
	const year = start.getFullYear();
	const month = start.getMonth();
	const last = new Date(year, month + 1, 0).getDate();
	const out = [];
	for (let d = 1; d <= last; d += 1) out.push(toISODate(new Date(year, month, d, 12)));
	return out;
}
function isValidISODate(value) {
	return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(parseISODate(value).getTime());
}
function parseRdoDays(raw) {
	if (!raw) return [];
	return raw.split(",").map((p) => Number(p.trim())).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
}
function serializeRdoDays(days) {
	return [...new Set(days)].sort((a, b) => a - b).join(",");
}
function eventTouchesDate(startIso, endIso, date) {
	const start = startIso.slice(0, 10);
	const end = (endIso ?? startIso).slice(0, 10);
	if (end < start) return start === date;
	return date >= start && date <= end;
}
//#endregion
export { formatShort as a, parseRdoDays as c, startOfWeek as d, todayISO as f, formatLong as i, serializeRdoDays as l, daysInMonth as n, isValidISODate as o, weekdayOf as p, eventTouchesDate as r, monthTitle as s, addDays as t, startOfMonth as u };
