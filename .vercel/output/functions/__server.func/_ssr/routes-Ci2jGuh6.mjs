import { o as __toESM } from "../_runtime.mjs";
import { n as require_react } from "../_libs/@radix-ui/react-compose-refs+[...].mjs";
import { a as require_jsx_runtime, i as useQueryClient, n as useQuery, t as useMutation } from "../_libs/react+tanstack__react-query.mjs";
import { c as getWatch, i as deleteAssignment, m as upsertAssignment, u as rebuildWatch } from "./fns-CtmihYHd.mjs";
import { i as formatLong, t as addDays } from "./dates-FrgnkczF.mjs";
import { a as RefreshCw, c as Mail, f as ChevronRight, h as Check, i as Share2, m as ChevronDown, o as Plus, p as ChevronLeft, s as MessageSquare, t as X, u as Copy } from "../_libs/lucide-react.mjs";
import { n as toast } from "../_libs/sonner.mjs";
import { r as Route$4 } from "./router--1-ZVzCT.mjs";
import { a as Label, c as SheriffMark, l as cn, n as Button, o as Overlay, r as HeaderIconButton, s as PickerSheet, t as AppShell, u as usePendingCount } from "./hooks-Cn9UInH3.mjs";
import { d as zoneHint, o as ZONES } from "./types-DAhVI_1U.mjs";
import { n as useRefetchWhenConnectorReady, r as useWatchDate, t as CalendarBanner } from "./store-BmYGDiCG.mjs";
import { t as Badge } from "./badge-CKMga1kt.mjs";
import { a as formatShiftList, c as shareOrCopy, l as shiftShareTitle, n as dispatchShareTitle, o as mailtoHref, r as formatDispatchList, t as copyText, u as smsHref } from "./watch-text-BdrWO_T_.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/routes-Ci2jGuh6.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function DateBar({ date, onChange, extra }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "flex items-center gap-1 border-b border-border bg-card px-1",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeaderIconButton, {
				label: "Previous day",
				onClick: () => onChange(addDays(date, -1)),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, { className: "size-5" })
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", {
				className: "relative flex min-w-0 flex-1 cursor-pointer flex-col items-center py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "font-display text-lg font-semibold uppercase tracking-wide",
						children: formatLong(date)
					}),
					extra ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-2xs uppercase tracking-label text-muted",
						children: extra
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", {
						type: "date",
						value: date,
						onChange: (e) => {
							if (e.target.value) onChange(e.target.value);
						},
						className: "absolute inset-0 cursor-pointer opacity-0",
						"aria-label": "Choose date"
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeaderIconButton, {
				label: "Next day",
				onClick: () => onChange(addDays(date, 1)),
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-5" })
			})
		]
	});
}
function SendSheet({ date, rows, onClose }) {
	const shiftText = (0, import_react.useMemo)(() => formatShiftList(date, rows), [date, rows]);
	const dispatchText = (0, import_react.useMemo)(() => formatDispatchList(date, rows), [date, rows]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 flex flex-col bg-background",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
			className: "flex items-center gap-3 border-b border-border bg-header px-2 py-2",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					"aria-label": "Close",
					onClick: onClose,
					className: "flex size-11 items-center justify-center",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheriffMark, { className: "size-8" }),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "flex-1 font-display text-2xl font-semibold uppercase tracking-wider",
					children: "Send Watch"
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex-1 space-y-8 overflow-y-auto px-4 py-5",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-sm text-muted",
					children: "Post the list to the shift, then send the dispatch copy so radio knows who is covering RE (Roving East), RW (Roving West), and the rest of the county."
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AudienceCard, {
					title: "Shift",
					description: "Deputy-first list with unit and zone.",
					shareTitle: shiftShareTitle(date),
					text: shiftText
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AudienceCard, {
					title: "Dispatch",
					description: "Zone-first coverage, open areas marked.",
					shareTitle: dispatchShareTitle(date),
					text: dispatchText
				})
			]
		})]
	}) });
}
function AudienceCard({ title, description, shareTitle, text }) {
	const [copied, setCopied] = (0, import_react.useState)(false);
	async function share() {
		const result = await shareOrCopy(shareTitle, text);
		if (result === "shared") toast.success(`Sent to ${title.toLowerCase()}`);
		if (result === "copied") {
			setCopied(true);
			toast.success("Copied — paste into the shift chat or CAD");
			window.setTimeout(() => setCopied(false), 1600);
		}
	}
	async function copy() {
		await copyText(text);
		setCopied(true);
		toast.success("List copied");
		window.setTimeout(() => setCopied(false), 1600);
	}
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
		className: "overflow-hidden rounded-lg border border-border bg-card",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "border-b border-border px-4 py-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h3", {
					className: "font-display text-lg font-semibold uppercase tracking-wide",
					children: title
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-0.5 text-xs text-muted",
					children: description
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", {
				className: "max-h-56 overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-2xs leading-relaxed text-foreground",
				children: text
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "grid grid-cols-2 gap-2 border-t border-border p-3 sm:grid-cols-4",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						onClick: () => void share(),
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, { className: "size-4" }), "Send"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
						size: "sm",
						variant: "secondary",
						onClick: () => void copy(),
						children: [copied ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-4" }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Copy, { className: "size-4" }), "Copy"]
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "secondary",
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: smsHref(text),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(MessageSquare, { className: "size-4" }), "Text"]
						})
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						size: "sm",
						variant: "secondary",
						asChild: true,
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("a", {
							href: mailtoHref(shareTitle, text),
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Mail, { className: "size-4" }), "Email"]
						})
					})
				]
			})
		]
	});
}
function ZoneForm({ officers, initialOfficerId, initialZone, onSave, onCancel, onRemove }) {
	const [officerId, setOfficerId] = (0, import_react.useState)(initialOfficerId ?? "");
	const [zone, setZone] = (0, import_react.useState)(initialZone ?? "");
	const [picking, setPicking] = (0, import_react.useState)(null);
	const officer = officers.find((o) => o.id === officerId);
	const canSave = Boolean(officerId && zone);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Overlay, { children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "fixed inset-0 z-50 flex flex-col bg-background",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "flex items-center gap-3 border-b border-border bg-header px-2 py-2",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						"aria-label": "Back",
						onClick: onCancel,
						className: "flex size-11 items-center justify-center text-foreground",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, { className: "size-5" })
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(SheriffMark, { className: "size-8" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
						className: "flex-1 font-display text-2xl font-semibold uppercase tracking-wider",
						children: "Zones Form"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "flex size-11 items-center justify-center text-muted",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: "size-5" })
					})
				]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex-1 space-y-6 px-5 py-6",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, { children: ["Deputy ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-primary",
						children: "*"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setPicking("officer"),
						className: "flex h-12 w-full items-center justify-between rounded-md border border-border-strong bg-transparent px-3 text-left",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: officer ? "text-foreground" : "text-subtle",
							children: officer?.name ?? ""
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4 text-muted" })]
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "space-y-2",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Label, { children: ["Zone ", /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "text-primary",
						children: "*"
					})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
						type: "button",
						onClick: () => setPicking("zone"),
						className: "flex h-12 w-full items-center justify-between rounded-md border border-border-strong bg-transparent px-3 text-left",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: zone ? "text-foreground" : "text-subtle",
							children: zone ? zoneHint(zone) ? `${zone} · ${zoneHint(zone)}` : zone : ""
						}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronDown, { className: "size-4 text-muted" })]
					})]
				})]
			}),
			onRemove ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "px-5 pb-2",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "ghost",
					className: "w-full text-destructive",
					onClick: onRemove,
					children: "Remove from this watch"
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
					className: "h-14 rounded-none text-base text-primary disabled:text-subtle",
					disabled: !canSave,
					onClick: () => {
						if (canSave) onSave(officerId, zone);
					},
					children: "Save"
				})]
			}),
			picking === "officer" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PickerSheet, {
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
			}) : null,
			picking === "zone" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(PickerSheet, {
				title: "Zone",
				searchPlaceholder: "Add or search",
				options: ZONES.map((z) => ({
					id: z.id,
					label: z.label,
					hint: z.hint
				})),
				value: zone,
				onChange: (id) => {
					setZone(id);
					setPicking(null);
				},
				onClose: () => setPicking(null)
			}) : null
		]
	}) });
}
function ZonesPage() {
	const { date, setDate } = useWatchDate();
	const pendingCount = usePendingCount();
	const queryClient = useQueryClient();
	const [showOffDuty, setShowOffDuty] = (0, import_react.useState)(false);
	const [form, setForm] = (0, import_react.useState)(null);
	const [sending, setSending] = (0, import_react.useState)(false);
	const seeded = Route$4.useLoaderData();
	const watchQuery = useQuery({
		queryKey: ["watch", date],
		queryFn: () => getWatch({ data: { date } }),
		initialData: date === seeded.date ? seeded : void 0
	});
	useRefetchWhenConnectorReady(watchQuery.data?.calendar.kind === "pending", () => watchQuery.refetch());
	const rebuild = useMutation({
		mutationFn: () => rebuildWatch({ data: { date } }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["watch", date] });
		},
		onError: (err) => toast.error(err.message)
	});
	const save = useMutation({
		mutationFn: (input) => upsertAssignment({ data: {
			date,
			...input
		} }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["watch", date] });
			setForm(null);
			toast.success("Zone saved");
		},
		onError: (err) => toast.error(err.message)
	});
	const remove = useMutation({
		mutationFn: (officerId) => deleteAssignment({ data: {
			date,
			officerId
		} }),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["watch", date] });
			setForm(null);
			toast.success("Assignment cleared");
		},
		onError: (err) => toast.error(err.message)
	});
	const data = watchQuery.data;
	const working = (0, import_react.useMemo)(() => data?.rows.filter((r) => r.status === "working") ?? [], [data]);
	const visible = showOffDuty ? data?.rows ?? [] : working;
	const extra = data ? `${data.workingCount} working · ${data.rdoCount + data.leaveCount + data.calendarOffCount} off` : void 0;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(AppShell, {
		title: "Zones",
		pendingCount,
		actions: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeaderIconButton, {
			label: "Rebuild watch from RDO and Calendar",
			onClick: () => {
				rebuild.mutate(void 0, { onSuccess: async () => {
					await queryClient.invalidateQueries({ queryKey: ["watch", date] });
					toast.success("Watch rebuilt from RDO, requests, and Calendar");
				} });
			},
			disabled: rebuild.isPending,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshCw, { className: cn("size-5", rebuild.isPending && "animate-spin") })
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(HeaderIconButton, {
			label: "Post and send watch",
			onClick: () => setSending(true),
			disabled: !data,
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Check, { className: "size-5" })
		})] }),
		fab: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
			type: "button",
			"aria-label": "Add zone assignment",
			onClick: () => setForm({}),
			className: "fab-dock fixed right-5 z-30 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-panel",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
				className: "size-7",
				strokeWidth: 2.25
			})
		}),
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(DateBar, {
				date,
				onChange: setDate,
				extra
			}),
			data ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CalendarBanner, {
				calendar: data.calendar,
				compact: true
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "flex items-center justify-between px-4 py-2",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "text-2xs uppercase tracking-wide-plus text-muted",
					children: data?.generated ? `${data.assignedCount} assigned` : "No watch posted — rebuild to fill zones"
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setShowOffDuty((v) => !v),
					className: "text-2xs uppercase tracking-label text-primary",
					children: showOffDuty ? "Hide off-duty" : "Show off-duty"
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "zone-cols grid border-y border-border bg-card-2 px-4 py-2 text-2xs font-medium uppercase tracking-wide-plus text-muted",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Deputy" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Unit" }),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "Zone" })
				]
			}),
			watchQuery.isLoading ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
				className: "space-y-0",
				children: Array.from({ length: 8 }).map((_, i) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-14 border-b border-border bg-card/60" }, i))
			}) : null,
			watchQuery.isError ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "px-4 py-8 text-sm text-muted",
				children: "Could not load the watch. Try again."
			}) : null,
			!watchQuery.isLoading && visible.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "px-6 py-16 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-display text-xl uppercase tracking-wide",
						children: "No one on this watch"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mt-2 text-sm text-muted",
						children: "Everyone is RDO or on approved leave. Rebuild after changing the date or requests."
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
						className: "mt-6",
						onClick: () => rebuild.mutate(),
						disabled: rebuild.isPending,
						children: "Build watch"
					})
				]
			}) : null,
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)("ul", { children: visible.map((row) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ZoneRow, {
				row,
				onOpen: () => row.status === "working" ? setForm({
					officer: row.officer,
					zone: row.zone ?? void 0
				}) : void 0
			}, row.officer.id)) }),
			data && working.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "space-y-3 px-4 py-4 max-md:pr-20",
				children: [data.assignedCount < working.length ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Button, {
					variant: "secondary",
					className: "w-full",
					onClick: () => rebuild.mutate(),
					disabled: rebuild.isPending,
					children: "Fill remaining zones from RDO"
				}) : null, /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Button, {
					className: "w-full",
					onClick: () => setSending(true),
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Share2, { className: "size-4" }), "Send to shift & dispatch"]
				})]
			}) : null,
			form ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ZoneForm, {
				officers: data?.officers ?? [],
				initialOfficerId: form.officer?.id,
				initialZone: form.zone,
				onCancel: () => setForm(null),
				onSave: (officerId, zone) => save.mutate({
					officerId,
					zone
				}),
				onRemove: form.officer ? () => remove.mutate(form.officer.id) : void 0
			}) : null,
			sending && data ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SendSheet, {
				date,
				rows: data.rows,
				onClose: () => setSending(false)
			}) : null
		]
	});
}
function ZoneRow({ row, onOpen }) {
	const off = row.status !== "working";
	const hint = row.zone ? zoneHint(row.zone) : "";
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("li", {
		className: "border-b border-border",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: onOpen,
			disabled: !onOpen,
			className: cn("zone-cols grid w-full items-center px-4 py-3.5 text-left", off && "opacity-55"),
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex min-w-0 flex-col",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "truncate text-sm font-medium tracking-wide",
						children: row.officer.name
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "mt-0.5 flex items-center gap-1.5",
						children: [
							row.officer.tmt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: "warning",
								children: "TMT"
							}) : null,
							off ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Badge, {
								tone: row.status === "rdo" ? "rdo" : "danger",
								children: row.statusLabel
							}) : null,
							row.eventTitle ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "truncate text-2xs text-muted",
								children: row.eventTitle
							}) : null
						]
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "tabular text-sm text-muted",
					children: row.officer.unit
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "flex items-center justify-between gap-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "min-w-0",
						children: off ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "text-sm font-medium",
							children: "—"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
							className: "flex flex-col",
							children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "text-sm font-medium",
								children: row.zone ?? ""
							}), hint && hint.toUpperCase() !== (row.zone ?? "").toUpperCase() ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
								className: "truncate text-micro text-muted",
								children: hint
							}) : null]
						})
					}), onOpen ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, { className: "size-4 shrink-0 text-subtle" }) : null]
				})
			]
		})
	});
}
//#endregion
export { ZonesPage as component };
