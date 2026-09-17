import { a as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { l as cn } from "./hooks-Cn9UInH3.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/badge-CKMga1kt.js
var import_jsx_runtime = require_jsx_runtime();
function Badge({ className, tone = "neutral", ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
		className: cn("inline-flex items-center rounded-xs px-1.5 py-0.5 text-2xs font-medium tracking-wide uppercase", tone === "neutral" && "bg-card-2 text-muted border border-border", tone === "primary" && "bg-primary/15 text-primary", tone === "success" && "bg-success/15 text-success", tone === "warning" && "bg-warning/15 text-warning", tone === "danger" && "bg-destructive/15 text-destructive", tone === "rdo" && "bg-rdo text-rdo-fg", className),
		...props
	});
}
//#endregion
export { Badge as t };
