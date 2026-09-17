import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { f as useRouterState, l as require_react_dom, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { l as listRequests } from "./fns-CtmihYHd.mjs";
import { d as ClipboardList, g as CalendarDays, h as Check, l as List, r as Table2 } from "../_libs/lucide-react.mjs";
import { n as clsx, t as cva } from "../_libs/class-variance-authority+clsx.mjs";
import { t as twMerge } from "../_libs/tailwind-merge.mjs";
import { t as Slot } from "../_libs/radix-ui__react-slot.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/hooks-Cn9UInH3.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
var import_react_dom = /* @__PURE__ */ __toESM(require_react_dom());
function cn(...inputs) {
	return twMerge(clsx(inputs));
}
function SheriffMark({ className = "size-9" }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", {
		viewBox: "0 0 48 48",
		className,
		"aria-hidden": "true",
		role: "img",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "24",
				cy: "24",
				r: "23",
				fill: "#1a1c16",
				stroke: "#8a845c",
				strokeWidth: "1.5"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "24",
				cy: "24",
				r: "18.5",
				fill: "none",
				stroke: "#6e6948",
				strokeWidth: "0.75"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("polygon", {
				points: "24,6 27.2,16.6 38.4,16.6 29.4,23.2 32.8,34 24,27.2 15.2,34 18.6,23.2 9.6,16.6 20.8,16.6",
				fill: "#c9c3a8"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", {
				cx: "24",
				cy: "23.5",
				r: "4.2",
				fill: "#1a1c16"
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", {
				d: "M24 8.2 L25.9 14.4 H32.6 L27.3 18.4 L29.3 24.8 L24 20.7 L18.7 24.8 L20.7 18.4 L15.4 14.4 H22.1 Z",
				fill: "none"
			})
		]
	});
}
var NAV = [
	{
		to: "/",
		label: "Zones",
		icon: List
	},
	{
		to: "/schedule",
		label: "Shift Schedule",
		icon: Table2
	},
	{
		to: "/requests",
		label: "Requests",
		icon: ClipboardList
	},
	{
		to: "/calendar",
		label: "Calendar",
		icon: CalendarDays
	}
];
function AppShell({ title, actions, children, fab, pendingCount = 0 }) {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex min-h-dvh bg-background text-foreground",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
			className: "hidden w-56 shrink-0 flex-col border-r border-border bg-header md:flex",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center gap-3 px-4 py-5",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheriffMark, { className: "size-10" }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-display text-lg font-semibold uppercase tracking-label leading-none",
					children: "Watch Board"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-1 text-2xs uppercase tracking-wide-plus text-muted",
					children: "Patrol operations"
				})] })]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
				className: "flex flex-1 flex-col gap-1 px-3 py-2",
				children: NAV.map((item) => {
					const active = pathname === item.to;
					const Icon = item.icon;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
						to: item.to,
						className: cn("flex items-center gap-3 rounded-md px-3 py-2.5 text-sm transition-colors", active ? "bg-primary text-primary-foreground" : "text-muted hover:bg-card-2 hover:text-foreground"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
								className: "size-4",
								strokeWidth: 1.75
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: item.label }),
							item.to === "/requests" && pendingCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: cn("ml-auto tabular rounded-full px-1.5 text-2xs font-semibold", active ? "bg-primary-foreground/20" : "bg-primary text-primary-foreground"),
								children: pendingCount
							}) : null
						]
					}, item.to);
				})
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex min-w-0 flex-1 flex-col",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
					className: "sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-header px-3 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))]",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "md:hidden",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheriffMark, { className: "size-9" })
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
							className: "min-w-0 flex-1 truncate font-display text-2xl font-semibold uppercase tracking-wider",
							children: title
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
							className: "flex items-center gap-0.5",
							children: actions
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("main", {
					className: "relative min-h-0 flex-1 pb-32 md:pb-6",
					children
				}),
				fab,
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
					className: "fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 border-t border-border bg-header pb-[env(safe-area-inset-bottom)] md:hidden",
					children: NAV.map((item) => {
						const active = pathname === item.to;
						const Icon = item.icon;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
							to: item.to,
							className: cn("relative flex flex-col items-center gap-1 px-1 py-2.5 text-2xs tracking-wide", active ? "bg-primary text-primary-foreground" : "text-muted"),
							children: [
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Icon, {
									className: "size-5",
									strokeWidth: 1.75
								}),
								/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "leading-none",
									children: item.label
								}),
								item.to === "/requests" && pendingCount > 0 && !active ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "absolute right-4 top-1.5 size-2 rounded-full bg-primary" }) : null
							]
						}, item.to);
					})
				})
			]
		})]
	});
}
function HeaderIconButton({ label, onClick, children, disabled }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		"aria-label": label,
		onClick,
		disabled,
		className: "flex size-11 items-center justify-center rounded-md text-foreground hover:bg-card-2 disabled:opacity-40",
		children
	});
}
function Overlay({ children }) {
	const [mounted, setMounted] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => setMounted(true), []);
	if (!mounted || typeof document === "undefined") return null;
	return (0, import_react_dom.createPortal)(children, document.body);
}
var buttonVariants = cva("inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background select-none", {
	variants: {
		variant: {
			default: "bg-primary text-primary-foreground hover:bg-primary-hover",
			secondary: "bg-card-2 text-foreground border border-border hover:bg-border",
			ghost: "text-foreground hover:bg-card-2",
			outline: "border border-border-strong text-foreground hover:bg-card-2",
			destructive: "bg-destructive text-primary-foreground hover:opacity-90",
			link: "text-primary underline-offset-4 hover:underline"
		},
		size: {
			default: "h-11 rounded-md px-4 text-sm",
			sm: "h-9 rounded-sm px-3 text-sm",
			lg: "h-12 rounded-md px-5 text-base",
			icon: "size-11 rounded-md",
			"icon-sm": "size-9 rounded-sm"
		}
	},
	defaultVariants: {
		variant: "default",
		size: "default"
	}
});
var Button = (0, import_react.forwardRef)(({ className, variant, size, asChild = false, ...props }, ref) => {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(asChild ? Slot : "button", {
		className: cn(buttonVariants({
			variant,
			size
		}), className),
		ref,
		...props
	});
});
Button.displayName = "Button";
var Input = (0, import_react.forwardRef)(({ className, ...props }, ref) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
	ref,
	className: cn("flex h-11 w-full rounded-md border border-border-strong bg-background px-3 text-sm text-foreground placeholder:text-subtle", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70", "disabled:opacity-40", className),
	...props
}));
Input.displayName = "Input";
function PickerSheet({ title, options, value, onChange, onClose, searchable = true, searchPlaceholder = "Search" }) {
	const [q, setQ] = (0, import_react.useState)("");
	const filtered = (0, import_react.useMemo)(() => {
		const needle = q.trim().toLowerCase();
		if (!needle) return options;
		return options.filter((o) => o.label.toLowerCase().includes(needle) || o.hint?.toLowerCase().includes(needle) || o.id.toLowerCase().includes(needle));
	}, [options, q]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 flex items-end justify-center bg-background/70 p-0 sm:items-center sm:p-6",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			className: "absolute inset-0 cursor-default",
			"aria-label": "Close picker",
			onClick: onClose
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "relative flex max-h-dvh w-full max-w-lg flex-col overflow-hidden rounded-t-xl border border-border bg-card shadow-panel sm:rounded-xl",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("header", {
					className: "border-b border-border px-5 py-4",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-xl font-semibold uppercase tracking-wide",
						children: title
					})
				}),
				searchable ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "px-4 pt-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
						autoFocus: true,
						value: q,
						onChange: (e) => setQ(e.target.value),
						placeholder: searchPlaceholder,
						"aria-label": searchPlaceholder
					})
				}) : null,
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("ul", {
					className: "min-h-0 flex-1 overflow-y-auto px-2 py-2",
					children: [filtered.map((opt) => {
						const selected = opt.id === value;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => onChange(opt.id),
							className: cn("flex w-full items-center gap-3 rounded-md px-3 py-3 text-left transition-colors", selected ? "bg-primary/10" : "hover:bg-card-2"),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: cn("flex size-5 shrink-0 items-center justify-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-border-strong"),
								children: selected ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, {
									className: "size-3",
									strokeWidth: 3
								}) : null
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex min-w-0 flex-col",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "truncate text-sm font-medium tracking-wide",
									children: opt.label
								}), opt.hint ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "text-xs text-muted",
									children: opt.hint
								}) : null]
							})]
						}) }, opt.id);
					}), filtered.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
						className: "px-4 py-8 text-center text-sm text-muted",
						children: "No matches"
					}) : null]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("footer", {
					className: "flex justify-end border-t border-border px-4 py-3",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						variant: "ghost",
						onClick: onClose,
						className: "text-primary",
						children: "Done"
					})
				})
			]
		})]
	}) });
}
function Label({ className, ...props }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", {
		className: cn("text-2xs font-medium uppercase tracking-label text-muted", className),
		...props
	});
}
function usePendingCount() {
	return useQuery({
		queryKey: ["requests"],
		queryFn: () => listRequests()
	}).data?.requests.filter((r) => r.status === "pending").length ?? 0;
}
//#endregion
export { Label as a, SheriffMark as c, Input as i, cn as l, Button as n, Overlay as o, HeaderIconButton as r, PickerSheet as s, AppShell as t, usePendingCount as u };
