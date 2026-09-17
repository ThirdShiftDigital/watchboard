import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { a as require_jsx_runtime, i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { a as deleteOfficer, f as toggleRdo, p as updateOfficer, s as getSchedule, t as createOfficer } from "./fns-CtmihYHd.mjs";
import { a as formatShort, d as startOfWeek, f as todayISO, t as addDays } from "./dates-FrgnkczF.mjs";
import { a as RefreshCw, f as ChevronRight, m as ChevronDown, o as Plus, p as ChevronLeft, t as X } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { a as Label, c as SheriffMark, i as Input, l as cn, n as Button, o as Overlay, r as HeaderIconButton, s as PickerSheet, t as AppShell, u as usePendingCount } from "./hooks-Cn9UInH3.mjs";
import { a as WEEKDAY_SHORT, l as rdoLabel, o as ZONES, r as ROLES, t as RDO_PAIRS, u as roleLabel } from "./types-DAhVI_1U.mjs";
import { n as useRefetchWhenConnectorReady, r as useWatchDate, t as CalendarBanner } from "./store-BmYGDiCG.mjs";
import { o as statusForOfficer } from "./watch-logic-BbIZgfKg.mjs";
import { t as Badge } from "./badge-CKMga1kt.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/schedule-bQv-2Ibd.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function RdoPicker({ value, onChange }) {
	const selected = new Set(value);
	function toggle(day) {
		if (selected.has(day)) onChange(value.filter((d) => d !== day));
		else onChange([...value, day].sort((a, b) => a - b));
	}
	function applyPair(days) {
		onChange(days.length === selected.size && days.every((d) => selected.has(d)) ? [] : [...days]);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-3",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "flex flex-wrap gap-1.5",
				children: RDO_PAIRS.map((pair) => {
					const active = pair.days.length === selected.size && pair.days.every((d) => selected.has(d));
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => applyPair(pair.days),
						className: cn("h-8 rounded-sm px-2.5 text-2xs font-medium tracking-wide", active ? "bg-primary text-primary-foreground" : "bg-card-2 text-muted hover:text-foreground"),
						children: pair.label
					}, pair.label);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-7 gap-1",
				children: WEEKDAY_SHORT.map((label, day) => {
					const on = selected.has(day);
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						"aria-pressed": on,
						onClick: () => toggle(day),
						className: cn("flex h-12 flex-col items-center justify-center rounded-sm text-2xs font-medium tracking-wide", on ? "bg-rdo text-rdo-fg" : "border border-border-strong text-muted hover:text-foreground"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: label }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mt-0.5 text-micro",
							children: on ? "RDO" : "ON"
						})]
					}, label);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "text-xs text-muted",
				children: "Most deputies run two consecutive days. Tap a pair or toggle individual days."
			})
		]
	});
}
function OfficerForm({ initial, onCancel, onSave, onRemove }) {
	const [name, setName] = (0, import_react.useState)(initial?.name ?? "");
	const [unit, setUnit] = (0, import_react.useState)(initial?.unit ?? "");
	const [role, setRole] = (0, import_react.useState)(initial?.role ?? "deputy");
	const [hireDate, setHireDate] = (0, import_react.useState)(initial?.hireDate ?? "");
	const [tmt, setTmt] = (0, import_react.useState)(initial?.tmt ?? false);
	const [radio, setRadio] = (0, import_react.useState)(initial?.radioNum != null ? String(initial.radioNum) : "");
	const [rdoDays, setRdoDays] = (0, import_react.useState)(initial?.rdoDays ?? []);
	const [defaultZone, setDefaultZone] = (0, import_react.useState)(initial?.defaultZone ?? "");
	const [picking, setPicking] = (0, import_react.useState)(null);
	const [saving, setSaving] = (0, import_react.useState)(false);
	const canSave = name.trim().length >= 2 && unit.trim().length >= 1;
	async function submit() {
		if (!canSave) return;
		const radioNum = radio.trim() === "" ? null : Number(radio);
		if (radioNum != null && (!Number.isInteger(radioNum) || radioNum < 0)) {
			toast.error("Radio number must be a whole number.");
			return;
		}
		setSaving(true);
		try {
			await onSave({
				name: name.trim(),
				unit: unit.trim(),
				role,
				hireDate,
				tmt,
				radioNum,
				rdoDays,
				defaultZone: defaultZone || null
			});
		} catch (err) {
			toast.error(err instanceof Error ? err.message : "Could not save officer");
		} finally {
			setSaving(false);
		}
	}
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
						children: initial ? "Edit officer" : "Onboard officer"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("form", {
				className: "flex-1 space-y-5 overflow-y-auto px-5 py-6",
				onSubmit: (e) => {
					e.preventDefault();
					submit();
				},
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Name",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
							value: name,
							onChange: (e) => setName(e.target.value),
							placeholder: "J. SMITH",
							autoCapitalize: "characters",
							required: true
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Rank",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
								type: "button",
								onClick: () => setPicking("role"),
								className: "flex h-12 w-full items-center justify-between rounded-md border border-border-strong px-3 text-left",
								children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: roleLabel(role) }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4 text-muted" })]
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Unit",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: unit,
								onChange: (e) => setUnit(e.target.value),
								placeholder: "321",
								inputMode: "numeric",
								required: true
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: `Regular days off · ${rdoLabel(rdoDays)}`,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RdoPicker, {
							value: rdoDays,
							onChange: setRdoDays
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
						label: "Home zone",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
							type: "button",
							onClick: () => setPicking("zone"),
							className: "flex h-12 w-full items-center justify-between rounded-md border border-border-strong px-3 text-left",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: defaultZone ? "text-foreground" : "text-subtle",
								children: defaultZone || "None"
							}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4 text-muted" })]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "grid grid-cols-2 gap-3",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Hire date",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								type: "date",
								value: hireDate,
								onChange: (e) => setHireDate(e.target.value)
							})
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Field, {
							label: "Radio #",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Input, {
								value: radio,
								onChange: (e) => setRadio(e.target.value),
								inputMode: "numeric",
								placeholder: "Optional"
							})
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setTmt((v) => !v),
						className: cn("flex h-12 w-full items-center justify-between rounded-md border px-3 text-left", tmt ? "border-warning bg-warning/10" : "border-border-strong"),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm",
							children: "Tactical medic (TMT)"
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("text-2xs uppercase tracking-wide", tmt ? "text-warning" : "text-muted"),
							children: tmt ? "Yes" : "No"
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-16" })
				]
			}),
			onRemove ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-5 pb-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					className: "w-full text-destructive",
					onClick: () => void onRemove(),
					children: "Remove from roster"
				})
			}) : null,
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
					children: initial ? "Save" : "Onboard"
				})]
			}),
			picking === "role" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PickerSheet, {
				title: "Rank",
				searchable: false,
				options: ROLES.map((r) => ({
					id: r.id,
					label: r.label,
					hint: r.short
				})),
				value: role,
				onChange: (id) => {
					setRole(id);
					setPicking(null);
				},
				onClose: () => setPicking(null)
			}) : null,
			picking === "zone" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PickerSheet, {
				title: "Home zone",
				options: [{
					id: "",
					label: "None",
					hint: "Assign on the watch"
				}, ...ZONES.map((z) => ({
					id: z.id,
					label: z.label,
					hint: z.hint
				}))],
				value: defaultZone,
				onChange: (id) => {
					setDefaultZone(id);
					setPicking(null);
				},
				onClose: () => setPicking(null)
			}) : null
		]
	}) });
}
function Field({ label, children }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "space-y-2",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Label, { children: label }), children]
	});
}
async function invalidateRoster(queryClient) {
	await Promise.all([
		queryClient.invalidateQueries({ queryKey: ["schedule"] }),
		queryClient.invalidateQueries({ queryKey: ["watch"] }),
		queryClient.invalidateQueries({ queryKey: ["calendar"] }),
		queryClient.invalidateQueries({ queryKey: ["requests"] })
	]);
}
function SchedulePage() {
	const { date, setDate } = useWatchDate();
	const weekStart = startOfWeek(date);
	const pendingCount = usePendingCount();
	const queryClient = useQueryClient();
	const [form, setForm] = (0, import_react.useState)(null);
	const today = todayISO();
	const scheduleQuery = useQuery({
		queryKey: ["schedule", weekStart],
		queryFn: () => getSchedule({ data: { weekStart } })
	});
	useRefetchWhenConnectorReady(scheduleQuery.data?.calendar.kind === "pending", () => scheduleQuery.refetch());
	const toggle = useMutation({
		mutationFn: (input) => toggleRdo({ data: input }),
		onSuccess: async () => {
			await invalidateRoster(queryClient);
		},
		onError: (err) => toast.error(err.message)
	});
	const data = scheduleQuery.data;
	const officers = data?.officers ?? [];
	const requests = data?.requests ?? [];
	const events = data?.calendar.events ?? [];
	const counts = WEEKDAY_SHORT.map((_, weekday) => {
		const iso = addDays(weekStart, weekday);
		return officers.filter((o) => {
			return statusForOfficer(o, weekday, iso, requests, events).status === "working";
		}).length;
	});
	async function saveOfficer(payload) {
		if (form && form !== "new") {
			await updateOfficer({ data: {
				id: form.id,
				...payload
			} });
			toast.success("Officer updated");
		} else {
			await createOfficer({ data: payload });
			toast.success("Officer onboarded");
		}
		await invalidateRoster(queryClient);
		setForm(null);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Shift Schedule",
		pendingCount,
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeaderIconButton, {
			label: "Reload",
			onClick: () => scheduleQuery.refetch(),
			disabled: scheduleQuery.isFetching,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: cn("size-5", scheduleQuery.isFetching && "animate-spin") })
		}),
		fab: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": "Onboard officer",
			onClick: () => setForm("new"),
			className: "fab-dock fixed right-5 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-panel",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
				className: "size-7",
				strokeWidth: 2.25
			})
		}),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between border-b border-border bg-card px-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeaderIconButton, {
						label: "Previous week",
						onClick: () => setDate(addDays(weekStart, -7)),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "py-2 text-center",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "font-display text-lg font-semibold uppercase tracking-wide",
							children: [
								formatShort(weekStart),
								" – ",
								formatShort(addDays(weekStart, 6))
							]
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
							className: "text-2xs uppercase tracking-label text-muted",
							children: [officers.length, " on roster · tap a name to edit"]
						})]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeaderIconButton, {
						label: "Next week",
						onClick: () => setDate(addDays(weekStart, 7)),
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-5" })
					})
				]
			}),
			data ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalendarBanner, { calendar: data.calendar }) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "grid grid-cols-7 border-b border-border bg-card-2 px-2 py-2 md:px-3",
				children: WEEKDAY_SHORT.map((label, i) => {
					const iso = addDays(weekStart, i);
					const isToday = iso === today;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: cn("flex flex-col items-center rounded-sm py-1", isToday && "bg-primary/15"),
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-2xs font-medium uppercase tracking-wide text-muted",
								children: label
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: cn("tabular text-sm", isToday && "font-semibold text-primary"),
								children: Number(iso.slice(8))
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: cn("mt-0.5 tabular text-micro", counts[i] < 10 ? "text-warning" : "text-muted"),
								children: scheduleQuery.isLoading ? "—" : `${counts[i]} on`
							})
						]
					}, label);
				})
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex flex-wrap items-center gap-3 border-b border-border px-4 py-2 text-micro uppercase tracking-wide text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2.5 rounded-xs bg-rdo" }), " RDO"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2.5 rounded-xs bg-destructive/40" }), " Leave"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "inline-flex items-center gap-1.5",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "size-2.5 rounded-xs bg-card-2 ring-1 ring-border" }), " On duty"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "ml-auto hidden text-subtle md:inline",
						children: ["Effective ", data?.effectiveDate ?? "—"]
					})
				]
			}),
			scheduleQuery.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-0",
				children: Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-16 border-b border-border bg-card/40" }, i))
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", {
				className: "pb-8 md:hidden",
				children: officers.map((officer) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OfficerCard, {
					officer,
					weekStart,
					today,
					requests,
					events,
					onEdit: () => setForm(officer),
					onToggle: (weekday) => toggle.mutate({
						officerId: officer.id,
						weekday
					})
				}, officer.id))
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "hidden md:block",
				children: [officers.map((officer) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OfficerRow, {
					officer,
					weekStart,
					today,
					requests,
					events,
					onEdit: () => setForm(officer),
					onToggle: (weekday) => toggle.mutate({
						officerId: officer.id,
						weekday
					})
				}, officer.id)), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "sched-grid border-t border-border bg-header px-0 text-xs",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "px-4 py-3 font-medium uppercase tracking-wide text-muted",
						children: "On duty"
					}), counts.map((n, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: cn("flex items-center justify-center py-3 tabular font-medium", n < 10 && "text-warning"),
						children: n
					}, i))]
				})]
			}),
			form ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(OfficerForm, {
				initial: form === "new" ? void 0 : form,
				onCancel: () => setForm(null),
				onSave: saveOfficer,
				onRemove: form === "new" ? void 0 : async () => {
					await deleteOfficer({ data: { id: form.id } });
					await invalidateRoster(queryClient);
					setForm(null);
					toast.success("Removed from roster");
				}
			}) : null
		]
	});
}
function OfficerCard({ officer, weekStart, today, requests, events, onEdit, onToggle }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("li", {
		className: "border-b border-border px-3 py-3",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: onEdit,
			className: "flex w-full items-start justify-between gap-3 text-left",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "block text-sm font-medium tracking-wide",
				children: officer.name
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "mt-0.5 block text-xs text-muted",
				children: [
					"Unit ",
					officer.unit,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mx-1.5 text-subtle",
						children: "·"
					}),
					rdoLabel(officer.rdoDays)
				]
			})] }), officer.tmt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
				tone: "warning",
				children: "TMT"
			}) : null]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "mt-3 grid grid-cols-7 gap-1",
			children: WEEKDAY_SHORT.map((_, weekday) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DayCell, {
				officer,
				weekday,
				iso: addDays(weekStart, weekday),
				today,
				requests,
				events,
				onToggle
			}, weekday))
		})]
	});
}
function OfficerRow({ officer, weekStart, today, requests, events, onEdit, onToggle }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "sched-grid border-b border-border",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: onEdit,
			className: "flex items-center justify-between gap-2 px-4 py-2.5 text-left hover:bg-card-2",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "min-w-0",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "block truncate text-sm font-medium tracking-wide",
					children: officer.name
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "block text-xs text-muted",
					children: [
						officer.unit,
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "mx-1.5 text-subtle",
							children: "·"
						}),
						rdoLabel(officer.rdoDays)
					]
				})]
			}), officer.tmt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
				tone: "warning",
				children: "TMT"
			}) : null]
		}), WEEKDAY_SHORT.map((_, weekday) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "p-1",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(DayCell, {
				officer,
				weekday,
				iso: addDays(weekStart, weekday),
				today,
				requests,
				events,
				onToggle
			})
		}, weekday))]
	});
}
function DayCell({ officer, weekday, iso, today, requests, events, onToggle }) {
	const s = statusForOfficer(officer, weekday, iso, requests, events);
	const isToday = iso === today;
	const isRdo = s.status === "rdo";
	const isLeave = s.status === "leave" || s.status === "calendar";
	const label = isRdo ? "RDO" : s.status === "calendar" ? "CAL" : s.status === "leave" ? s.statusLabel : "ON";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
		type: "button",
		onClick: () => {
			if (isLeave) {
				toast.message(`${officer.name} is off — ${s.statusLabel}`);
				return;
			}
			onToggle(weekday);
		},
		"aria-label": `${officer.name} ${WEEKDAY_SHORT[weekday]} ${label}`,
		className: cn("flex h-12 w-full flex-col items-center justify-center rounded-sm text-2xs font-medium tracking-wide", isRdo && "bg-rdo text-rdo-fg", isLeave && "bg-destructive/20 text-destructive", s.status === "working" && "bg-card-2 text-muted hover:text-foreground", isToday && "ring-1 ring-primary/70"),
		children: label
	});
}
//#endregion
export { SchedulePage as component };
