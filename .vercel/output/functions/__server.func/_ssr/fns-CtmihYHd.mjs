import { n as TSS_SERVER_FUNCTION, r as getServerFnById, t as createServerFn } from "./ssr.mjs";
import { a as number, n as array, o as object, r as boolean, s as string, t as _enum } from "../_libs/zod.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/fns-CtmihYHd.js
var createSsrRpc = (functionId) => {
	const url = "/_serverFn/" + functionId;
	const serverFnMeta = { id: functionId };
	const fn = async (...args) => {
		return (await getServerFnById(functionId, { origin: "server" }))(...args);
	};
	return Object.assign(fn, {
		url,
		serverFnMeta,
		[TSS_SERVER_FUNCTION]: true
	});
};
var dateInput = object({ date: string().regex(/^\d{4}-\d{2}-\d{2}$/) });
var getWatch = createServerFn({ method: "POST" }).validator(dateInput).handler(createSsrRpc("52eb4330ee24b7fdea90e785ab4c9dc7c303b679876a51db0fdf88a8653b716e"));
var rebuildWatch = createServerFn({ method: "POST" }).validator(dateInput).handler(createSsrRpc("20e5a7b8409c31e9bdcdcfa60196762a5bf7f067635572f4af7eb6ae489ab8cd"));
var upsertAssignment = createServerFn({ method: "POST" }).validator(object({
	date: string().regex(/^\d{4}-\d{2}-\d{2}$/),
	officerId: string().min(1),
	zone: string().min(1)
})).handler(createSsrRpc("892d3c0e42a7dba3b6610639af936abd754a1ed28b0f11afde9e5f1abc5e8ac8"));
var deleteAssignment = createServerFn({ method: "POST" }).validator(object({
	date: string().regex(/^\d{4}-\d{2}-\d{2}$/),
	officerId: string().min(1)
})).handler(createSsrRpc("eefb28e40bf0e3237b899a697c9b86773456530eebd96bc02672fc2141c72c4a"));
var listRequests = createServerFn({ method: "GET" }).handler(createSsrRpc("746f9a908a803565ef732078c04568f0929e0ad3d2bf222b308281ce54110eaa"));
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
})).handler(createSsrRpc("2cd5712e38b4b4659c14066c8eae61bdb209fc1d7fb579f9b4c84c96239df143"));
var setRequestStatus = createServerFn({ method: "POST" }).validator(object({
	id: number().int(),
	status: _enum([
		"approved",
		"denied",
		"pending"
	])
})).handler(createSsrRpc("36962d701c3409c4d8c2b63a9008cddbfc042d57f5bf2e71c83f943c592c9f37"));
var toggleRdo = createServerFn({ method: "POST" }).validator(object({
	officerId: string().min(1),
	weekday: number().int().min(0).max(6)
})).handler(createSsrRpc("140f984da2482500a09e3e296722451765390bf235d87c7ba82619bdd816f1cc"));
createServerFn({ method: "POST" }).validator(object({
	officerId: string().min(1),
	rdoDays: array(number().int().min(0).max(6)).max(7)
})).handler(createSsrRpc("cca50e11305d002da3491d4b1102c00b7f7d1ab7bb2d4a23dfcc0c225f8fb77f"));
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
var createOfficer = createServerFn({ method: "POST" }).validator(officerInput).handler(createSsrRpc("a0de0a8a0b9bedc20d21d03c776203b0a2bd555078277acf2be7442e15995eb3"));
var updateOfficer = createServerFn({ method: "POST" }).validator(officerInput.extend({ id: string().min(1) })).handler(createSsrRpc("4e8679b599af4ced0b5d14941fd1e6d453b22d686b4ed208a4e16186c5f55cb2"));
var deleteOfficer = createServerFn({ method: "POST" }).validator(object({ id: string().min(1) })).handler(createSsrRpc("4d203eab5b7b85187ddbda9b6e0285ceb89953a715fb3371739233cbd18ca96c"));
var getSchedule = createServerFn({ method: "POST" }).validator(object({ weekStart: string().regex(/^\d{4}-\d{2}-\d{2}$/) })).handler(createSsrRpc("57fb1a254d60094d59d92780738e058272671d6ddd53c9af9ee2519b385541d3"));
var getCalendarMonth = createServerFn({ method: "POST" }).validator(object({
	from: string().regex(/^\d{4}-\d{2}-\d{2}$/),
	to: string().regex(/^\d{4}-\d{2}-\d{2}$/)
})).handler(createSsrRpc("64fe8e31f771d080b0fabb2dbebc1a6920ace747b4231012a9216f8f827b906c"));
//#endregion
export { deleteOfficer as a, getWatch as c, setRequestStatus as d, toggleRdo as f, deleteAssignment as i, listRequests as l, upsertAssignment as m, createRequest as n, getCalendarMonth as o, updateOfficer as p, createSsrRpc as r, getSchedule as s, createOfficer as t, rebuildWatch as u };
