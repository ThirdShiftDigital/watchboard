import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { a as require_jsx_runtime, i as useQueryClient, n as useQuery } from "../_libs/react+tanstack__react-query.mjs";
import { n as createRequest, o as getCalendarMonth } from "./fns-CtmihYHd.mjs";
import { a as formatShort, d as startOfWeek, f as todayISO, i as formatLong, n as daysInMonth, p as weekdayOf, s as monthTitle, t as addDays, u as startOfMonth } from "./dates-FrgnkczF.mjs";
import { f as ChevronRight, p as ChevronLeft } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { l as cn, n as Button, r as HeaderIconButton, t as AppShell, u as usePendingCount } from "./hooks-Cn9UInH3.mjs";
import { i as WEEKDAYS, s as kindLabel } from "./types-DAhVI_1U.mjs";
import { t as RequestForm } from "./request-form-BO4pyIgO.mjs";
import { n as useRefetchWhenConnectorReady, r as useWatchDate, t as CalendarBanner } from "./store-BmYGDiCG.mjs";
import { n as approvedLeaveOnDate, o as statusForOfficer, t as approvedLeaveInRange } from "./watch-logic-BbIZgfKg.mjs";
import { t as Badge } from "./badge-CKMga1kt.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/calendar-C2WREyFN.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function CalendarPage() {
	const { date, setDate } = useWatchDate();
	const pendingCount = usePendingCount();
	const queryClient = useQueryClient();
	const [requesting, setRequesting] = (0, import_react.useState)(false);
	const monthStart = startOfMonth(date);
	const monthDays = daysInMonth(date);
	const gridStart = startOfWeek(monthStart);
	const last = monthDays[monthDays.length - 1] ?? monthStart;
	const cells = (0, import_react.useMemo)(() => {
		const out = [];
		for (let i = 0; i < 42; i += 1) out.push(addDays(gridStart, i));
		return out;
	}, [gridStart]);
	const q = useQuery({
		queryKey: ["calendar", monthStart],
		queryFn: () => getCalendarMonth({ data: {
			from: monthStart,
			to: last
		} })
	});
	useRefetchWhenConnectorReady(q.data?.calendar.kind === "pending", () => q.refetch());
	const officers = q.data?.officers ?? [];
	const requests = q.data?.requests ?? [];
	const events = q.data?.calendar.events ?? [];
	const today = todayISO();
	const selectedLeave = (0, import_react.useMemo)(() => approvedLeaveOnDate(date, requests, officers), [
		date,
		requests,
		officers
	]);
	const monthLeave = (0, import_react.useMemo)(() => approvedLeaveInRange(monthStart, last, requests, officers), [
		monthStart,
		last,
		requests,
		officers
	]);
	const selectedSummary = (0, import_react.useMemo)(() => {
		if (!officers.length) return null;
		const weekday = weekdayOf(date);
		const working = officers.filter((o) => statusForOfficer(o, weekday, date, requests, events).status === "working").length;
		return {
			working,
			off: officers.length - working
		};
	}, [
		officers,
		date,
		requests,
		events
	]);
	const dayEvents = events.filter((e) => {
		const start = e.start.slice(0, 10);
		const end = (e.end ?? e.start).slice(0, 10);
		return date >= start && date <= end;
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Calendar",
		pendingCount,
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between border-b border-border bg-card px-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeaderIconButton, {
						label: "Previous month",
						onClick: () => setDate(addDays(monthStart, -1)),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-lg font-semibold uppercase tracking-wide",
						children: monthTitle(date)
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeaderIconButton, {
						label: "Next month",
						onClick: () => setDate(addDays(last, 1)),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-5" })
					})
				]
			}),
			q.data ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalendarBanner, { calendar: q.data.calendar }) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-7 border-b border-border bg-card-2 text-center text-2xs uppercase tracking-wide text-muted",
				children: WEEKDAYS.map((d) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "py-2",
					children: d.slice(0, 3)
				}, d))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-7",
				children: cells.map((iso) => {
					const inMonth = iso.slice(0, 7) === monthStart.slice(0, 7);
					const weekday = weekdayOf(iso);
					const working = officers.filter((o) => statusForOfficer(o, weekday, iso, requests, events).status === "working").length;
					const selected = iso === date;
					const isToday = iso === today;
					const leave = approvedLeaveOnDate(iso, requests, officers);
					const shown = leave.slice(0, 2);
					const extra = leave.length - shown.length;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setDate(iso),
						className: cn("relative flex min-h-20 flex-col items-stretch gap-0.5 border-b border-r border-border px-1 py-1.5 text-left", !inMonth && "text-subtle", selected && "bg-primary/15"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "flex items-center justify-between",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: cn("flex size-6 items-center justify-center rounded-full text-sm tabular", isToday && "bg-primary text-primary-foreground"),
									children: Number(iso.slice(8))
								}), inMonth && officers.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "tabular text-micro text-muted",
									children: working
								}) : null]
							}),
							inMonth ? shown.map((chip) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "truncate rounded-xs bg-destructive/15 px-1 text-micro font-medium uppercase leading-4 text-destructive",
								children: [
									chip.lastName,
									" ",
									chip.kindShort
								]
							}, chip.officerId)) : null,
							inMonth && extra > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
								className: "text-micro text-muted",
								children: ["+", extra]
							}) : null
						]
					}, iso);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				className: "px-4 py-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "font-display text-lg font-semibold uppercase tracking-wide",
						children: formatLong(date)
					}),
					selectedSummary ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-1 text-sm text-muted",
						children: [
							selectedSummary.working,
							" working · ",
							selectedSummary.off,
							" off"
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-1 text-sm text-muted",
						children: "Loading coverage…"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "mt-4",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
							className: "w-full",
							onClick: () => setRequesting(true),
							children: "Request this day off"
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mt-6 text-2xs uppercase tracking-wide-plus text-muted",
						children: "Filled on calendar"
					}),
					selectedLeave.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "No approved leave on this date yet."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 divide-y divide-border",
						children: selectedLeave.map((chip) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "flex items-start justify-between gap-3 py-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
								className: "min-w-0",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
									className: "text-sm font-medium",
									children: chip.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
									className: "mt-0.5 text-xs text-muted",
									children: [
										chip.startDate === chip.endDate ? formatShort(chip.startDate) : `${formatShort(chip.startDate)} – ${formatShort(chip.endDate)}`,
										/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
											className: "mx-1.5 text-subtle",
											children: "·"
										}),
										"All day"
									]
								})]
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: "danger",
								children: kindLabel(chip.kind)
							})]
						}, chip.officerId))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mt-6 text-2xs uppercase tracking-wide-plus text-muted",
						children: "Calendar events"
					}),
					dayEvents.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "No Google Calendar events matched this day."
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 divide-y divide-border",
						children: dayEvents.map((e) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
							className: "py-3",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "text-sm font-medium",
								children: e.title
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-1 text-xs text-muted",
								children: e.matchedOfficerIds.length ? `Matched ${e.matchedOfficerIds.map((id) => officers.find((o) => o.id === id)?.name ?? id).join(", ")}` : "No deputy name matched"
							})]
						}, e.id))
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
						className: "mt-6 text-2xs uppercase tracking-wide-plus text-muted",
						children: "Approved this month"
					}),
					monthLeave.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
						className: "mt-2 text-sm text-muted",
						children: [
							"Nothing approved yet.",
							" ",
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/ask",
								className: "text-primary",
								children: "Officers can request days off"
							}),
							"."
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
						className: "mt-2 divide-y divide-border",
						children: monthLeave.map((r) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
							className: "py-3 text-sm",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								className: "w-full text-left",
								onClick: () => setDate(r.startDate),
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
									className: "font-medium",
									children: r.name
								}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
									className: "text-muted",
									children: [
										" ",
										"· ",
										kindLabel(r.kind),
										" ·",
										" ",
										r.startDate === r.endDate ? formatShort(r.startDate) : `${formatShort(r.startDate)} – ${formatShort(r.endDate)}`
									]
								})]
							})
						}, r.id))
					})
				]
			}),
			requesting ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RequestForm, {
				officers,
				initialStart: date,
				initialEnd: date,
				onCancel: () => setRequesting(false),
				onSubmit: async (payload) => {
					await createRequest({ data: payload });
					await queryClient.invalidateQueries({ queryKey: ["requests"] });
					await queryClient.invalidateQueries({ queryKey: ["calendar"] });
					setRequesting(false);
					toast.success("Request submitted — it fills the calendar after approval");
				}
			}) : null
		]
	});
}
//#endregion
export { CalendarPage as component };
