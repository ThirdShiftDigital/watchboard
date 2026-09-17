import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { d as setRequestStatus, l as listRequests, n as createRequest } from "./fns-CtmihYHd.mjs";
import { a as formatShort } from "./dates-FrgnkczF.mjs";
import { i as Share2, o as Plus } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { n as Button, t as AppShell, u as usePendingCount } from "./hooks-Cn9UInH3.mjs";
import { s as kindLabel } from "./types-DAhVI_1U.mjs";
import { t as RequestForm } from "./request-form-BO4pyIgO.mjs";
import { t as Badge } from "./badge-CKMga1kt.mjs";
import { c as shareOrCopy, i as formatRequestInvite, s as requestFormUrl } from "./watch-text-BdrWO_T_.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/requests-Ba_A3g4p.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function RequestsPage() {
	const pendingCount = usePendingCount();
	const queryClient = useQueryClient();
	const [open, setOpen] = (0, import_react.useState)(false);
	const q = useQuery({
		queryKey: ["requests"],
		queryFn: () => listRequests()
	});
	const setStatus = useMutation({
		mutationFn: (input) => setRequestStatus({ data: input }),
		onSuccess: async (_data, vars) => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["requests"] }),
				queryClient.invalidateQueries({ queryKey: ["watch"] }),
				queryClient.invalidateQueries({ queryKey: ["schedule"] }),
				queryClient.invalidateQueries({ queryKey: ["calendar"] })
			]);
			if (vars.status === "approved") toast.success("Approved — filled on the calendar and dropped from the watch");
			else if (vars.status === "denied") toast.success("Request denied");
		},
		onError: (err) => toast.error(err.message)
	});
	const officers = q.data?.officers ?? [];
	const requests = q.data?.requests ?? [];
	const pending = requests.filter((r) => r.status === "pending");
	const decided = requests.filter((r) => r.status !== "pending");
	async function sendFormToShift() {
		const url = requestFormUrl();
		const result = await shareOrCopy("Request days off", formatRequestInvite(url));
		if (result === "shared") toast.success("Request form sent to the shift");
		if (result === "copied") toast.success("Link copied — send it to the shift");
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Requests",
		pendingCount,
		fab: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": "New days-off request",
			onClick: () => setOpen(true),
			className: "fab-dock fixed right-5 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-panel",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
				className: "size-7",
				strokeWidth: 2.25
			})
		}),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b border-border px-4 py-4",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Officers submit leave from the request form. Approve it here and it fills the calendar — they drop off the zone list for those dates."
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "mt-3 flex flex-wrap gap-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						onClick: () => void sendFormToShift(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, { className: "size-4" }), "Send form to shift"]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "secondary",
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/ask",
							children: "Open officer form"
						})
					})]
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				title: `Pending · ${pending.length}`,
				children: [
					q.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-4 py-6 text-sm text-muted",
						children: "Loading…"
					}) : null,
					pending.length === 0 && !q.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "px-4 py-6 text-sm text-muted",
						children: "No open requests."
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: pending.map((req) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RequestCard, {
						req,
						officerName: officers.find((o) => o.id === req.officerId)?.name ?? req.officerId,
						actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
							className: "flex gap-2",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								variant: "secondary",
								onClick: () => setStatus.mutate({
									id: req.id,
									status: "denied"
								}),
								children: "Deny"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
								size: "sm",
								onClick: () => setStatus.mutate({
									id: req.id,
									status: "approved"
								}),
								children: "Approve"
							})]
						})
					}, req.id)) })
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Section, {
				title: "History",
				children: [decided.length === 0 && !q.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "px-4 py-6 text-sm text-muted",
					children: "Nothing decided yet."
				}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: decided.map((req) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RequestCard, {
					req,
					officerName: officers.find((o) => o.id === req.officerId)?.name ?? req.officerId
				}, req.id)) })]
			}),
			open ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RequestForm, {
				officers,
				onCancel: () => setOpen(false),
				onSubmit: async (payload) => {
					await createRequest({ data: payload });
					await queryClient.invalidateQueries({ queryKey: ["requests"] });
					setOpen(false);
					toast.success("Request submitted — waiting on approval");
				}
			}) : null
		]
	});
}
function Section({ title, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
		className: "bg-card-2 px-4 py-2 text-2xs font-medium uppercase tracking-wide-plus text-muted",
		children: title
	}), children] });
}
function RequestCard({ req, officerName, actions }) {
	const range = req.startDate === req.endDate ? formatShort(req.startDate) : `${formatShort(req.startDate)} – ${formatShort(req.endDate)}`;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "border-b border-border px-4 py-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-start justify-between gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "min-w-0",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "truncate text-sm font-medium tracking-wide",
						children: officerName
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-sm text-muted",
						children: [
							range,
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "mx-2 text-subtle",
								children: "·"
							}),
							kindLabel(req.kind)
						]
					}),
					req.reason ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-subtle",
						children: req.reason
					}) : null
				]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
				tone: req.status === "approved" ? "success" : req.status === "denied" ? "danger" : "warning",
				children: req.status
			})]
		}), actions ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3",
			children: actions
		}) : null]
	});
}
//#endregion
export { RequestsPage as component };
