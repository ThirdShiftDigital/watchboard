import { i as getRequest } from "./ssr.mjs";
import { r as ConnectorType, t as CONNECTOR_TOKEN_PENDING_CODE } from "./types-Bggxm7au.mjs";
import { createHash } from "node:crypto";
//#region node_modules/.nitro/vite/services/ssr/assets/client.server-CM-WkBbE.js
/**
* Fetch-Metadata sibling isolation — **server-only** (`.server.ts` suffix).
*
* MUST keep the `.server` suffix: this file imports `@tanstack/react-start/server`
* (`getRequest` → Node `AsyncLocalStorage`). If it is imported from a dual
* client/server module under a non-`.server` name, Vite ships it to the browser
* and the app dies with: `AsyncLocalStorage is not a constructor`.
*
* Apps deployed on `*.grok.me` are "same-site" to each other but MUTUALLY
* UNTRUSTED, and a `SameSite=Lax` session cookie IS sent on same-site
* subrequests — so without this, a malicious sibling could make a SCRIPTED
* (fetch/XHR/form-POST) request to this app's server functions and ride this
* app's session cookie.
*
* We allow only: same-origin requests (this app's own client), non-browser
* requests (SSR / server-to-server, which send no `Sec-Fetch-Site`), and
* top-level GET navigations (how the OAuth callback and normal page loads
* arrive). Every cross-site / same-site *scripted* request is rejected.
* Together with `__Host-` cookies and Better Auth's `trustedOrigins`, this
* closes the sibling-tenant attack surface. Enforced at the `authMiddleware`
* chokepoint (see `middleware.ts`).
*/
var CrossSiteRequestError = class extends Error {
	status = 403;
	constructor() {
		super("Forbidden: cross-site request blocked");
		this.name = "CrossSiteRequestError";
	}
};
/** Throw `CrossSiteRequestError` for a scripted cross-site/sibling request. */
function assertSameSiteRequest() {
	const request = getRequest();
	if (!request) return;
	const h = request.headers;
	const site = h.get("sec-fetch-site");
	if (!site || site === "same-origin" || site === "none") return;
	const dest = h.get("sec-fetch-dest");
	if (h.get("sec-fetch-mode") === "navigate" && request.method === "GET" && dest !== "object" && dest !== "embed") return;
	throw new CrossSiteRequestError();
}
function env(key) {
	return process.env[key]?.trim() || void 0;
}
/**
* Workspace preview vs deployed app. The deployer writes GROK_PROJECT_ID on
* every publish; the sandbox preview never has it. Single source of truth for
* the split — gate audience, gate endpoints and connector-token semantics all
* key off this predicate.
*/
function isWorkspacePreview() {
	return !env("GROK_PROJECT_ID");
}
function assertAppDataServerOnly(context = "app-data/client.server") {
	if (typeof window !== "undefined") throw new Error(`@/lib/${context} is server-only. Call connector tools from a createServerFn handler (dynamic import of @/lib/app-data/client.server), never from a React component, useEffect, or browser fetch. Types and login helpers are client-safe via @/lib/app-data.`);
}
assertAppDataServerOnly("app-data/client.server");
assertAppDataServerOnly("app-data/client.server");
var CONNECTORS_HOST_STAGING = "connectors.app-builder-testing.com";
var CONNECTORS_HOST_PROD = "connectors.grok.me";
function isLoopbackHost(host) {
	return host === "localhost" || host === "127.0.0.1" || host === "[::1]";
}
function connectorsBaseFor(publicHost) {
	const explicit = env("GROK_CONNECTORS_URL");
	if (explicit) return explicit.replace(/\/+$/, "");
	const host = publicHost?.toLowerCase();
	if (!host || isLoopbackHost(host)) return null;
	if (host === "app-builder-testing.com" || host.endsWith(".app-builder-testing.com")) return `https://${CONNECTORS_HOST_STAGING}`;
	if (host === "grok.me" || host.endsWith(".grok.me")) return `https://${CONNECTORS_HOST_PROD}`;
	return null;
}
function tryGetRequest() {
	try {
		return getRequest() ?? null;
	} catch {
		return null;
	}
}
function inboundContext() {
	const req = tryGetRequest();
	const publicHost = (req?.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || req?.headers.get("host") || "").split(":")[0]?.trim() || null;
	return {
		token: (req?.headers.get("x-connector-access-token")?.trim() || null) ?? null,
		publicHost,
		connectorsBase: connectorsBaseFor(publicHost)
	};
}
var rejectedTokenDigest = null;
function tokenDigest(token) {
	return createHash("sha256").update(token).digest("base64url");
}
function noteTokenRejected(token) {
	rejectedTokenDigest = tokenDigest(token);
}
function noteTokenAccepted(token) {
	if (rejectedTokenDigest === tokenDigest(token)) rejectedTokenDigest = null;
}
/**
* True when the inbound request carries a connector token the gate has not
* rejected. This is what the preview readiness probe reports; it never calls
* the gate.
*/
function isConnectorTokenReady() {
	const token = inboundContext().token;
	return token !== null && tokenDigest(token) !== rejectedTokenDigest;
}
async function gatePost(ctx, body, token) {
	const base = ctx.connectorsBase;
	if (!base) throw new Error("cannot resolve gate host (missing x-forwarded-host/host on the server request); open the app through the gated public URL so the gate can proxy and inject credentials");
	if (!/^https?:\/\//i.test(base)) throw new Error(`gate base must be absolute http(s) URL (got ${base}); refusing relative fetch`);
	const headers = {
		"content-type": "application/json",
		accept: "application/json",
		authorization: `Bearer ${token}`
	};
	if (ctx.publicHost) headers["x-forwarded-host"] = ctx.publicHost;
	const res = await fetch(`${base}/call-tool`, {
		method: "POST",
		headers,
		body: JSON.stringify(body),
		redirect: "manual"
	});
	let json = {};
	const text = await res.text();
	if (text) try {
		json = JSON.parse(text);
	} catch {
		json = {
			ok: false,
			errorMessage: `gate non-JSON response (HTTP ${res.status}): ${text.slice(0, 200)}`
		};
	}
	return {
		status: res.status,
		json
	};
}
function gateSigninUrl(ctx) {
	const base = ctx.connectorsBase;
	if (!base) return void 0;
	try {
		const connectorsHost = new URL(base).host.toLowerCase();
		const gateHost = connectorsHost.replace(/^connectors\./, "gate.");
		if (gateHost === connectorsHost) return void 0;
		const publicHost = ctx.publicHost?.toLowerCase();
		const gated = publicHost && !isLoopbackHost(publicHost) ? `https://${publicHost}` : void 0;
		const signin = `https://${gateHost}/__gate/signin`;
		return gated ? `${signin}?return_to=${encodeURIComponent(gated)}` : signin;
	} catch {
		return;
	}
}
var PENDING_TOKEN_MISSING = "the preview has not received the connector token yet; it arrives once the connector grant is approved";
var PENDING_TOKEN_REJECTED = "the gate rejected the current preview token; the preview panel pushes a fresh one on its own schedule";
function pendingTokenResult(reason) {
	return {
		ok: false,
		data: null,
		pending: true,
		errorMessage: `${CONNECTOR_TOKEN_PENDING_CODE}: ${reason}`
	};
}
function missingAuthResult() {
	if (isWorkspacePreview()) return pendingTokenResult(PENDING_TOKEN_MISSING);
	return {
		ok: false,
		data: null,
		errorMessage: "missing_connector_token: open this app through the edge gate (the server must receive x-connector-access-token on the inbound request)"
	};
}
function unauthorizedResult(ctx, json, token) {
	if (isWorkspacePreview()) {
		noteTokenRejected(token);
		return pendingTokenResult(PENDING_TOKEN_REJECTED);
	}
	const loginUrl = gateSigninUrl(ctx) ?? (typeof json.loginUrl === "string" && json.loginUrl ? json.loginUrl : void 0);
	return {
		ok: false,
		data: null,
		loginRequired: true,
		errorMessage: json.errorMessage ?? "login required",
		...loginUrl ? { loginUrl } : {}
	};
}
function crossSiteBlockedResult() {
	try {
		assertSameSiteRequest();
		return null;
	} catch (e) {
		if (e instanceof CrossSiteRequestError) return {
			ok: false,
			data: null,
			errorMessage: e.message
		};
		return null;
	}
}
var FAILURE_MEMO_TTL_MS = 5e3;
var failureMemo = /* @__PURE__ */ new Map();
function tokenIdentityKey(token) {
	const payload = token.split(".")[1];
	if (payload) try {
		const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
		if (claims && typeof claims === "object" && !Array.isArray(claims)) {
			const { sub, team_id: teamId } = claims;
			if (typeof sub === "string" && sub) return createHash("sha256").update(JSON.stringify([sub, typeof teamId === "string" ? teamId : null])).digest("base64url");
		}
	} catch {}
	return createHash("sha256").update(token).digest("base64url");
}
function memoizedFailure(key) {
	if (!key) return null;
	const hit = failureMemo.get(key);
	if (!hit) return null;
	if (Date.now() - hit.at > FAILURE_MEMO_TTL_MS) {
		failureMemo.delete(key);
		return null;
	}
	return hit.result;
}
function memoizeFailure(key, result) {
	if (!key) return result;
	const now = Date.now();
	for (const [staleKey, entry] of failureMemo) if (now - entry.at > FAILURE_MEMO_TTL_MS) failureMemo.delete(staleKey);
	failureMemo.set(key, {
		at: now,
		result
	});
	return result;
}
function safeMemoKey(parts) {
	try {
		return JSON.stringify(parts);
	} catch {
		return null;
	}
}
function nonPostBlockedResult() {
	const req = tryGetRequest();
	if (!req || req.method === "POST") return null;
	return {
		ok: false,
		data: null,
		errorMessage: `blocked ${req.method} inbound request: connector calls must run inside a createServerFn({ method: "POST" }) handler`
	};
}
async function callTool(toolName, args, options) {
	const blocked = crossSiteBlockedResult() ?? nonPostBlockedResult();
	if (blocked) return blocked;
	const ctx = inboundContext();
	const token = options.token ?? ctx.token;
	if (!token) return missingAuthResult();
	const connectorType = options.connectorType;
	if (!connectorType) return {
		ok: false,
		data: null,
		errorMessage: "connectorType is required: pass the connector type granted to this app (e.g. { connectorType: ConnectorType.GoogleDrive })"
	};
	const memoKey = safeMemoKey([
		toolName,
		args,
		connectorType,
		options?.connectorCatalogId ?? null,
		tokenIdentityKey(token)
	]);
	const memoized = memoizedFailure(memoKey);
	if (memoized) return memoized;
	const fail = (errorMessage) => memoizeFailure(memoKey, {
		ok: false,
		data: null,
		errorMessage
	});
	if (connectorType === ConnectorType.Mcp && !options?.connectorCatalogId) return {
		ok: false,
		data: null,
		errorMessage: "connectorCatalogId is required when connectorType is Mcp"
	};
	try {
		const { status, json } = await gatePost(ctx, {
			host: ctx.publicHost ?? void 0,
			connector_type: connectorType,
			tool_name: toolName,
			arguments: args,
			connector_catalog_id: options.connectorCatalogId
		}, token);
		if (status === 401) return unauthorizedResult(ctx, json, token);
		noteTokenAccepted(token);
		if (status === 403) return fail(json.errorMessage ?? "access_denied");
		if (json.errorMessage && json.ok === false) return fail(json.errorMessage);
		if (status >= 400 && json.ok !== true) return fail(json.errorMessage ?? `HTTP ${status}`);
		if (json.ok === false) return fail(json.errorMessage ?? "tool error");
		return {
			ok: true,
			data: json.data ?? null
		};
	} catch (e) {
		return fail(e instanceof Error ? e.message : String(e));
	}
}
//#endregion
export { callTool, isConnectorTokenReady };
