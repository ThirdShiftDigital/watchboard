import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { a as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { t as createServerFn } from "./ssr.mjs";
import { r as createSsrRpc } from "./fns-CtmihYHd.mjs";
import { n as CONNECTOR_TOKEN_READY_EVENT } from "./types-Bggxm7au.mjs";
import { f as todayISO } from "./dates-FrgnkczF.mjs";
import { n as Button } from "./hooks-Cn9UInH3.mjs";
import { i as redirectToLoginIfRequired, n as isFramed } from "./login-BxQ-E10E.mjs";
import { t as create } from "../_libs/zustand.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/store-BmYGDiCG.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var getConnectorReadiness = createServerFn({ method: "POST" }).handler(createSsrRpc("ac303419f3bd6f94ee837f95e91005a600278deed4876cb96a25aa0d69185951"));
var READINESS_PROBE_DELAYS_MS = [
	1e3,
	2e3,
	3e3,
	5e3
];
var READINESS_PROBE_MAX_TOTAL_MS = 18e4;
function readinessProbeDelayMs(attempt) {
	return READINESS_PROBE_DELAYS_MS[Math.min(Math.max(attempt, 0), READINESS_PROBE_DELAYS_MS.length - 1)];
}
function readinessProbeExhausted(startedAtMs, nowMs) {
	return nowMs - startedAtMs >= READINESS_PROBE_MAX_TOTAL_MS;
}
var READINESS_PROBE_TIMEOUT_MS = 1e4;
function withTimeout(promise, ms) {
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve(null), ms);
		const settle = (value) => {
			clearTimeout(timer);
			resolve(value);
		};
		promise.then(settle, () => settle(null));
	});
}
async function isConnectorReady() {
	return (await withTimeout(getConnectorReadiness(), READINESS_PROBE_TIMEOUT_MS))?.ready === true;
}
/**
* While `waiting` is true (a connector call returned `pending`), probes the
* server for the connector token and calls `refetch` once it is present. The
* probe is a header check on the app's own server — it never reaches the gate.
* A `connector-token-ready` bridge event from the Grok preview chrome triggers
* `refetch` immediately. A top-level page (download/export, local dev, the
* sandbox's own `npm run preview`) is not framed by any preview, so no token
* can ever arrive: the hook reports `not_embedded` without probing. Any framed
* page probes, even when the parent origin cannot be resolved (empty referrer,
* no `ancestorOrigins`): the token comes through the preview proxy, and the
* bridge event is only the faster signal.
*/
function useRefetchWhenConnectorReady(waiting, refetch) {
	const refetchRef = (0, import_react.useRef)(refetch);
	const [timedOut, setTimedOut] = (0, import_react.useState)(false);
	const [notEmbedded, setNotEmbedded] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		refetchRef.current = refetch;
	}, [refetch]);
	(0, import_react.useEffect)(() => {
		if (!waiting) return;
		if (!isFramed()) {
			setNotEmbedded(true);
			return () => setNotEmbedded(false);
		}
		let cancelled = false;
		let refetching = false;
		let attempt = 0;
		let timer;
		const startedAt = Date.now();
		const runRefetch = async () => {
			if (refetching) return;
			refetching = true;
			try {
				await refetchRef.current();
			} catch {} finally {
				refetching = false;
			}
		};
		const schedule = () => {
			timer = setTimeout(probe, readinessProbeDelayMs(attempt));
			attempt += 1;
		};
		const probe = async () => {
			if (cancelled || readinessProbeExhausted(startedAt, Date.now())) return;
			const ready = await isConnectorReady();
			if (cancelled) return;
			if (ready) await runRefetch();
			if (!cancelled) schedule();
		};
		const onTokenReady = () => {
			runRefetch();
		};
		const deadline = setTimeout(() => {
			if (!cancelled) setTimedOut(true);
		}, READINESS_PROBE_MAX_TOTAL_MS);
		window.addEventListener(CONNECTOR_TOKEN_READY_EVENT, onTokenReady);
		schedule();
		return () => {
			cancelled = true;
			clearTimeout(deadline);
			if (timer !== void 0) clearTimeout(timer);
			window.removeEventListener(CONNECTOR_TOKEN_READY_EVENT, onTokenReady);
			setTimedOut(false);
		};
	}, [waiting]);
	if (!waiting) return "idle";
	if (notEmbedded) return "not_embedded";
	return timedOut ? "timed_out" : "waiting";
}
function CalendarBanner({ calendar, compact = false }) {
	if (calendar.kind === "ok") {
		if (calendar.events.length === 0) return null;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
			className: "border-b border-border bg-card-2 px-4 py-2 text-xs text-muted",
			children: [
				calendar.events.length,
				" Google Calendar event",
				calendar.events.length === 1 ? "" : "s",
				" pulled into this watch."
			]
		});
	}
	if (calendar.kind === "pending") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "border-b border-border bg-card-2 px-4 py-2 text-xs text-muted",
		children: "Connecting to Google Calendar…"
	});
	if (calendar.kind === "login") return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center justify-between gap-3 border-b border-border bg-card-2 px-4 py-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "text-xs text-muted",
			children: "Continue with Grok to pull Calendar leave."
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			size: "sm",
			onClick: () => redirectToLoginIfRequired({
				ok: false,
				data: null,
				loginRequired: true,
				loginUrl: calendar.loginUrl
			}),
			children: "Continue"
		})]
	});
	if (calendar.kind === "not_connected") {
		if (compact) return null;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "border-b border-border bg-card-2 px-4 py-2 text-xs text-muted",
			children: "Connect Google Calendar in Grok to overlay leave on the watch list. RDO and in-app requests still apply."
		});
	}
	if (calendar.kind === "unavailable") {
		if (compact) return null;
		return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "border-b border-border bg-card-2 px-4 py-2 text-xs text-muted",
			children: calendar.message ?? "Calendar syncs from Grok. RDO and requests still apply."
		});
	}
	if (compact && calendar.kind === "error") return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
		className: "border-b border-border bg-card-2 px-4 py-2 text-xs text-muted",
		children: "Calendar unavailable. Using RDO and approved requests only."
	});
}
var useWatchDate = create((set) => ({
	date: todayISO(),
	setDate: (date) => set({ date })
}));
//#endregion
export { useRefetchWhenConnectorReady as n, useWatchDate as r, CalendarBanner as t };
