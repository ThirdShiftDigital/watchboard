import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { a as require_jsx_runtime } from "../_libs/react+tanstack__react-query.mjs";
import { m as ChevronDown, t as X } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as Label, c as SheriffMark, i as Input, n as Button, o as Overlay, s as PickerSheet } from "./hooks-Cn9UInH3.mjs";
import { n as REQUEST_KINDS } from "./types-DAhVI_1U.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/request-form-BO4pyIgO.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function RequestForm({ officers, onCancel, onSubmit, embedded = false, initialStart = "", initialEnd = "" }) {
	const [officerId, setOfficerId] = (0, import_react.useState)("");
	const [kind, setKind] = (0, import_react.useState)("vacation");
	const [startDate, setStartDate] = (0, import_react.useState)(initialStart);
	const [endDate, setEndDate] = (0, import_react.useState)(initialEnd || initialStart);
	const [reason, setReason] = (0, import_react.useState)("");
	const [picking, setPicking] = (0, import_react.useState)(null);
	const [saving, setSaving] = (0, import_react.useState)(false);
	const officer = officers.find((o) => o.id === officerId);
	const kindOpt = REQUEST_KINDS.find((k) => k.id === kind);
	const canSave = Boolean(officerId && startDate && endDate);
	const endMin = (0, import_react.useMemo)(() => startDate, [startDate]);
	async function submit() {
		if (!canSave) return;
		setSaving(true);
		try {
			await onSubmit({
				officerId,
				startDate,
				endDate: endDate < startDate ? startDate : endDate,
				kind,
				reason
			});
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not submit");
		} finally {
			setSaving(false);
		}
	}
	const fields = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
			label: "Deputy",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setPicking("officer"),
				className: "flex h-12 w-full items-center justify-between rounded-md border border-border-strong px-3 text-left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: officer ? "text-foreground" : "text-subtle",
					children: officer?.name ?? "Select your name"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4 text-muted" })]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
			label: "Type",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
				type: "button",
				onClick: () => setPicking("kind"),
				className: "flex h-12 w-full items-center justify-between rounded-md border border-border-strong px-3 text-left",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: kindOpt?.label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4 text-muted" })]
			})
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "grid grid-cols-2 gap-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "Start",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					type: "date",
					value: startDate,
					onChange: (e) => {
						setStartDate(e.target.value);
						if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
					},
					required: true
				})
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
				label: "End",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
					type: "date",
					min: endMin || void 0,
					value: endDate,
					onChange: (e) => setEndDate(e.target.value),
					required: true
				})
			})]
		}),
		/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
			label: "Notes",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
				value: reason,
				onChange: (e) => setReason(e.target.value),
				placeholder: "Optional",
				maxLength: 280
			})
		})
	] });
	const pickers = /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [picking === "officer" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PickerSheet, {
		title: "Deputy",
		options: officers.map((o) => ({
			id: o.id,
			label: o.name,
			hint: `Unit ${o.unit}`
		})),
		value: officerId,
		onChange: (id) => {
			setOfficerId(id);
			setPicking(null);
		},
		onClose: () => setPicking(null)
	}) : null, picking === "kind" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PickerSheet, {
		title: "Type",
		searchable: false,
		options: REQUEST_KINDS.map((k) => ({
			id: k.id,
			label: k.label
		})),
		value: kind,
		onChange: (id) => {
			setKind(id);
			setPicking(null);
		},
		onClose: () => setPicking(null)
	}) : null] });
	if (embedded) return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
		className: "space-y-5",
		onSubmit: (e) => {
			e.preventDefault();
			submit();
		},
		children: [fields, /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
			className: "w-full",
			disabled: !canSave || saving,
			type: "submit",
			children: saving ? "Submitting…" : "Submit request"
		})]
	}), pickers] });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 flex flex-col bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center gap-3 border-b border-border bg-header px-2 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": "Close",
						onClick: onCancel,
						className: "flex size-11 items-center justify-center",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheriffMark, { className: "size-8" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "flex-1 font-display text-2xl font-semibold uppercase tracking-wider",
						children: "Days Off"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "flex-1 space-y-5 overflow-y-auto px-5 py-6",
				onSubmit: (e) => {
					e.preventDefault();
					submit();
				},
				children: [fields, /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-16" })]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("footer", {
				className: "grid grid-cols-2 border-t border-border",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					className: "h-14 rounded-none text-base text-muted",
					onClick: onCancel,
					children: "Cancel"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					className: "h-14 rounded-none text-base text-primary",
					disabled: !canSave || saving,
					onClick: () => void submit(),
					children: "Submit"
				})]
			}),
			pickers
		]
	}) });
}
function Field({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, { children: [
			label,
			" ",
			label !== "Notes" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "text-primary",
				children: "*"
			}) : null
		] }), children]
	});
}
//#endregion
export { RequestForm as t };
