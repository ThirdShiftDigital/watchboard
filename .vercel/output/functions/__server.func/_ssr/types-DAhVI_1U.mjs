//#region node_modules/.nitro/vite/services/ssr/assets/types-DAhVI_1U.js
var WEEKDAYS = [
	"SUN",
	"MON",
	"TUES",
	"WEDS",
	"THURS",
	"FRI",
	"SAT"
];
var WEEKDAY_SHORT = [
	"SUN",
	"MON",
	"TUE",
	"WED",
	"THU",
	"FRI",
	"SAT"
];
var ZONES = [
	{
		id: "ALL",
		label: "ALL",
		hint: "Supervisor / countywide"
	},
	{
		id: "RE",
		label: "RE",
		hint: "Roving East"
	},
	{
		id: "NE",
		label: "NE",
		hint: "Northeast"
	},
	{
		id: "SE",
		label: "SE",
		hint: "Southeast"
	},
	{
		id: "CENTRAL",
		label: "CENTRAL",
		hint: "Central"
	},
	{
		id: "RW",
		label: "RW",
		hint: "Roving West"
	},
	{
		id: "NW",
		label: "NW",
		hint: "Northwest"
	},
	{
		id: "SW",
		label: "SW",
		hint: "Southwest"
	},
	{
		id: "VANDY ER",
		label: "VANDY ER",
		hint: "Vanderbilt ER"
	}
];
var ROLES = [
	{
		id: "lt",
		label: "Lieutenant",
		short: "LT"
	},
	{
		id: "sgt",
		label: "Sergeant",
		short: "SGT"
	},
	{
		id: "cpl",
		label: "Corporal",
		short: "CPL"
	},
	{
		id: "fto",
		label: "FTO",
		short: "FTO"
	},
	{
		id: "deputy",
		label: "Deputy",
		short: "DEP"
	}
];
var RDO_PAIRS = [
	{
		days: [5, 6],
		label: "FRI–SAT"
	},
	{
		days: [6, 0],
		label: "SAT–SUN"
	},
	{
		days: [0, 1],
		label: "SUN–MON"
	},
	{
		days: [1, 2],
		label: "MON–TUE"
	},
	{
		days: [2, 3],
		label: "TUE–WED"
	},
	{
		days: [3, 4],
		label: "WED–THU"
	},
	{
		days: [4, 5],
		label: "THU–FRI"
	}
];
var REQUEST_KINDS = [
	{
		id: "vacation",
		label: "Vacation"
	},
	{
		id: "sick",
		label: "Sick"
	},
	{
		id: "training",
		label: "Training"
	},
	{
		id: "court",
		label: "Court"
	},
	{
		id: "other",
		label: "Other"
	}
];
function zoneHint(id) {
	return ZONES.find((z) => z.id === id)?.hint ?? "";
}
function kindLabel(id) {
	return REQUEST_KINDS.find((k) => k.id === id)?.label ?? id;
}
function kindShort(id) {
	switch (id) {
		case "vacation": return "VAC";
		case "sick": return "SICK";
		case "training": return "TRN";
		case "court": return "CRT";
		default: return "OFF";
	}
}
function roleLabel(id) {
	return ROLES.find((r) => r.id === id)?.label ?? id;
}
function rdoLabel(days) {
	if (days.length === 0) return "No RDO";
	const set = new Set(days);
	for (const pair of RDO_PAIRS) if (pair.days.length === set.size && pair.days.every((d) => set.has(d))) return pair.label;
	return [...set].sort((a, b) => a - b).map((d) => WEEKDAY_SHORT[d]).join(" · ");
}
//#endregion
export { WEEKDAY_SHORT as a, kindShort as c, zoneHint as d, WEEKDAYS as i, rdoLabel as l, REQUEST_KINDS as n, ZONES as o, ROLES as r, kindLabel as s, RDO_PAIRS as t, roleLabel as u };
