import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, i as useQueryClient, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { l as listRequests, n as createRequest } from "./fns-CtmihYHd.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as Route$3 } from "./router--1-ZVzCT.mjs";
import { n as Button, t as AppShell, u as usePendingCount } from "./hooks-Cn9UInH3.mjs";
import { t as RequestForm } from "./request-form-BO4pyIgO.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/ask-BMGD0P-G.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function AskPage() {
	const pendingCount = usePendingCount();
	const queryClient = useQueryClient();
	const search = Route$3.useSearch();
	const [done, setDone] = (0, import_react.useState)(false);
	const q = useQuery({
		queryKey: ["requests"],
		queryFn: () => listRequests()
	});
	const officers = q.data?.officers ?? [];
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(AppShell, {
		title: "Days Off",
		pendingCount,
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mx-auto w-full max-w-lg px-4 py-6",
			children: done ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "rounded-lg border border-border bg-card px-5 py-8 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-2xl font-semibold uppercase tracking-wide",
						children: "Request in"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-3 text-sm text-muted",
						children: "A supervisor will approve it. Once they do, those dates fill the calendar and you are off the zone list."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mt-6 flex flex-col gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							onClick: () => setDone(false),
							children: "Submit another"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							variant: "secondary",
							asChild: true,
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/calendar",
								children: "View calendar"
							})
						})]
					})
				]
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "mb-6 text-sm text-muted",
				children: "Pick your name and dates. Nothing hits the calendar until a supervisor approves it."
			}), q.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-sm text-muted",
				children: "Loading roster…"
			}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RequestForm, {
				embedded: true,
				officers,
				initialStart: search.start,
				initialEnd: search.end ?? search.start,
				onSubmit: async (payload) => {
					await createRequest({ data: payload });
					await queryClient.invalidateQueries({ queryKey: ["requests"] });
					setDone(true);
					toast.success("Request submitted");
				}
			})] })
		})
	});
}
//#endregion
export { AskPage as component };
