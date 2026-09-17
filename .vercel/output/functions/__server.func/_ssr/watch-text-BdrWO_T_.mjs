import { i as formatLong } from "./dates-FrgnkczF.mjs";
import { d as zoneHint, o as ZONES } from "./types-DAhVI_1U.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/watch-text-BdrWO_T_.js
function canNativeShare() {
	return typeof navigator !== "undefined" && typeof navigator.share === "function";
}
async function shareOrCopy(title, text) {
	if (canNativeShare()) try {
		await navigator.share({
			title,
			text
		});
		return "shared";
	} catch (err) {
		if (err instanceof DOMException && err.name === "AbortError") return "cancelled";
		if (err instanceof Error && err.name === "AbortError") return "cancelled";
	}
	await navigator.clipboard.writeText(text);
	return "copied";
}
async function copyText(text) {
	await navigator.clipboard.writeText(text);
}
function mailtoHref(subject, body) {
	return `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
function smsHref(body) {
	return `sms:?&body=${encodeURIComponent(body)}`;
}
function requestFormUrl(origin) {
	return `${origin ?? (typeof window !== "undefined" ? window.location.origin : "")}/ask`;
}
function pad(value, width) {
	const s = value.trim();
	if (s.length >= width) return s;
	return s + " ".repeat(width - s.length);
}
function workingRows(rows) {
	return rows.filter((r) => r.status === "working");
}
function offRows(rows) {
	return rows.filter((r) => r.status !== "working");
}
function officerLine(row) {
	const zone = row.zone ?? "—";
	const hint = row.zone ? zoneHint(row.zone) : "";
	const extra = hint && hint.toUpperCase() !== zone.toUpperCase() ? `  ${hint}` : "";
	return `${pad(row.officer.unit, 4)} ${pad(row.officer.name, 22)} ${pad(zone, 8)}${extra}`.trimEnd();
}
function offLine(row) {
	return `${pad(row.officer.unit, 4)} ${pad(row.officer.name, 22)} ${row.statusLabel}`;
}
function formatShiftList(date, rows) {
	const on = workingRows(rows);
	const off = offRows(rows);
	const lines = [
		`WATCH — ${formatLong(date).toUpperCase()}`,
		"For the shift",
		"",
		`ON DUTY  (${on.length})`,
		...on.map(officerLine)
	];
	if (off.length) lines.push("", `OFF  (${off.length})`, ...off.map(offLine));
	lines.push("", "Reply if your zone is wrong.");
	return lines.join("\n");
}
function formatDispatchList(date, rows) {
	const on = workingRows(rows);
	const off = offRows(rows);
	const byZone = /* @__PURE__ */ new Map();
	for (const z of ZONES) byZone.set(z.id, []);
	for (const row of on) {
		const key = row.zone && byZone.has(row.zone) ? row.zone : "ALL";
		byZone.get(key)?.push(row);
	}
	const lines = [
		`WATCH — ${formatLong(date).toUpperCase()}`,
		"Dispatch copy",
		"",
		"COVERAGE"
	];
	for (const z of ZONES) {
		const assigned = byZone.get(z.id) ?? [];
		const people = assigned.length === 0 ? "— OPEN" : assigned.map((r) => `${r.officer.name} ${r.officer.unit}`).join(", ");
		const hint = z.hint && z.hint.toUpperCase() !== z.label ? `  ${z.hint}` : "";
		lines.push(`${pad(z.label, 10)} ${people}${hint}`.trimEnd());
	}
	if (off.length) {
		lines.push("", "OFF DUTY");
		for (const row of off) lines.push(`${row.officer.name} ${row.officer.unit}  ${row.statusLabel}`);
	}
	return lines.join("\n");
}
function formatRequestInvite(url) {
	return [
		"Request days off",
		"",
		"Open this link, pick your name and dates, and submit.",
		"Once a supervisor approves it, you are filled on the calendar and dropped from the zone list.",
		"",
		url
	].join("\n");
}
function shiftShareTitle(date) {
	return `Watch — ${formatLong(date)}`;
}
function dispatchShareTitle(date) {
	return `Dispatch watch — ${formatLong(date)}`;
}
//#endregion
export { formatShiftList as a, shareOrCopy as c, formatRequestInvite as i, shiftShareTitle as l, dispatchShareTitle as n, mailtoHref as o, formatDispatchList as r, requestFormUrl as s, copyText as t, smsHref as u };
