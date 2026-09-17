import { t as createServerFn } from "./ssr.mjs";
import { t as createServerRpc } from "./createServerRpc-A6pJPYTF.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/readiness-CUcROSFm.js
var getConnectorReadiness_createServerFn_handler = createServerRpc({
	id: "ac303419f3bd6f94ee837f95e91005a600278deed4876cb96a25aa0d69185951",
	name: "getConnectorReadiness",
	filename: "src/lib/app-data/readiness.ts"
}, (opts) => getConnectorReadiness.__executeServer(opts));
var getConnectorReadiness = createServerFn({ method: "POST" }).handler(getConnectorReadiness_createServerFn_handler, async () => {
	const { isConnectorTokenReady } = await import("./client.server-CM-WkBbE.mjs");
	return { ready: isConnectorTokenReady() };
});
//#endregion
export { getConnectorReadiness_createServerFn_handler };
