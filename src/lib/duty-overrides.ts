/**
 * Overtime & swaps: pure rules (no DB, no Google). The server functions in
 * overrides-fns.ts load the roster/leave/overrides and call these.
 *
 * - Overtime: an officer works a date their standing RDO pattern has them off.
 *   Nobody else changes.
 * - Swap: A works their RDO covering B; B is off that date. An optional payback
 *   date adds the reverse pair (B works their RDO, A is off) in the same group.
 * Whole shifts only, same shift only. Dates are the shift start date (Central),
 * the same day the app already files a shift under.
 */
import type { Caps } from "./access.ts";
import type { DutyOverride, Officer, TimeOffRequest } from "./types.ts";
import { weekdayOf } from "./dates.ts";

export type OverrideRowSpec = Omit<DutyOverride, "id" | "swapGroup"> & { swapGroup: string | null };

type Ctx = {
  requests: TimeOffRequest[];
  overrides: DutyOverride[];
};

function shortName(o: Officer): string {
  return o.name;
}

function onLeave(officerId: string, date: string, requests: TimeOffRequest[]): boolean {
  return requests.some(
    (r) => r.status === "approved" && r.officerId === officerId && date >= r.startDate && date <= r.endDate,
  );
}

function isRdo(o: Officer, date: string): boolean {
  return o.rdoDays.includes(weekdayOf(date));
}

function existing(officerId: string, date: string, overrides: DutyOverride[]): DutyOverride | undefined {
  return overrides.find((o) => o.officerId === officerId && o.date === date);
}

/** Why `officer` can't be put on duty on an RDO for `date`, or null. */
function workBlock(officer: Officer, date: string, ctx: Ctx): string | null {
  if (!isRdo(officer, date)) return `${shortName(officer)} is already scheduled to work ${date}.`;
  if (onLeave(officer.id, date, ctx.requests)) return `${shortName(officer)} is on approved leave ${date}.`;
  if (existing(officer.id, date, ctx.overrides)) {
    return `${shortName(officer)} already has an overtime or swap entry on ${date}. Remove it first.`;
  }
  return null;
}

/** Why `officer` can't be taken off on `date` as the other side of a swap, or null. */
function offBlock(officer: Officer, date: string, ctx: Ctx): string | null {
  if (isRdo(officer, date)) return `${shortName(officer)} is already off (RDO) ${date}.`;
  if (onLeave(officer.id, date, ctx.requests)) return `${shortName(officer)} is already on leave ${date}.`;
  if (existing(officer.id, date, ctx.overrides)) {
    return `${shortName(officer)} already has an overtime or swap entry on ${date}. Remove it first.`;
  }
  return null;
}

export function planOvertime(input: {
  officer: Officer;
  date: string;
  reason?: string;
} & Ctx): { error: string } | { rows: OverrideRowSpec[] } {
  const block = workBlock(input.officer, input.date, input);
  if (block) return { error: block };
  return {
    rows: [
      {
        officerId: input.officer.id,
        date: input.date,
        status: "working",
        kind: "ot",
        partnerOfficerId: null,
        swapGroup: null,
        isPayback: false,
        reason: (input.reason ?? "").trim(),
      },
    ],
  };
}

/**
 * `worker` works their RDO on `date` covering `partner`, who is off.
 * Optional `paybackDate`: partner works their RDO covering worker, who is off.
 */
export function planSwap(input: {
  worker: Officer;
  partner: Officer;
  date: string;
  paybackDate?: string | null;
  reason?: string;
  swapGroup: string;
} & Ctx): { error: string } | { rows: OverrideRowSpec[] } {
  const { worker, partner, date, swapGroup } = input;
  if (worker.id === partner.id) return { error: "Pick a different officer to swap with." };
  const reason = (input.reason ?? "").trim();
  const block = workBlock(worker, date, input) ?? offBlock(partner, date, input);
  if (block) return { error: block };
  const pair = (w: Officer, p: Officer, d: string, isPayback: boolean): OverrideRowSpec[] => [
    { officerId: w.id, date: d, status: "working", kind: "swap", partnerOfficerId: p.id, swapGroup, isPayback, reason },
    { officerId: p.id, date: d, status: "off", kind: "swap", partnerOfficerId: w.id, swapGroup, isPayback, reason },
  ];
  const rows = pair(worker, partner, date, false);
  const payback = input.paybackDate?.trim();
  if (payback) {
    if (payback === date) return { error: "The payback date must be a different day." };
    const pb = workBlock(partner, payback, input) ?? offBlock(worker, payback, input);
    if (pb) return { error: `Payback: ${pb}` };
    rows.push(...pair(partner, worker, payback, true));
  }
  return { rows };
}

/** Adds a payback pair to an existing swap group that has none yet. */
export function planPayback(input: {
  group: DutyOverride[];
  officers: Officer[];
  paybackDate: string;
} & Ctx): { error: string } | { rows: OverrideRowSpec[] } {
  const original = input.group.filter((o) => !o.isPayback);
  if (input.group.some((o) => o.isPayback)) return { error: "That swap already has a payback date." };
  const workerRow = original.find((o) => o.status === "working");
  const offRow = original.find((o) => o.status === "off");
  if (!workerRow || !offRow) return { error: "Swap not found." };
  const worker = input.officers.find((o) => o.id === workerRow.officerId);
  const partner = input.officers.find((o) => o.id === offRow.officerId);
  if (!worker || !partner) return { error: "Both officers must still be on this shift." };
  if (input.paybackDate === workerRow.date) return { error: "The payback date must be a different day." };
  // Payback reverses the pair: the partner works, the original worker is off.
  const block = workBlock(partner, input.paybackDate, input) ?? offBlock(worker, input.paybackDate, input);
  if (block) return { error: `Payback: ${block}` };
  const swapGroup = workerRow.swapGroup;
  return {
    rows: [
      { officerId: partner.id, date: input.paybackDate, status: "working", kind: "swap", partnerOfficerId: worker.id, swapGroup, isPayback: true, reason: workerRow.reason },
      { officerId: worker.id, date: input.paybackDate, status: "off", kind: "swap", partnerOfficerId: partner.id, swapGroup, isPayback: true, reason: workerRow.reason },
    ],
  };
}

/**
 * Why this login may not enter or remove overtime / swaps for `officer`, or null.
 * Same scope as requests for others (PR #30): your own shift; division leaders
 * their agency (on the shift they are viewing); the operator anyone.
 */
export function overrideBlock(input: {
  caps: Caps;
  officer: { shiftId: string | null; agencyId: string | null } | null;
  actorAgencyId: string | null;
  actorShiftId: string | null;
}): string | null {
  if (!input.caps.overtimeSwaps) return "You do not have permission for overtime & swaps.";
  if (!input.officer) return "Officer not found.";
  if (input.caps.managePlatform) return null;
  if (!input.actorAgencyId || input.officer.agencyId !== input.actorAgencyId) {
    return "That officer belongs to another agency.";
  }
  if (!input.caps.manageAgency && (!input.actorShiftId || input.officer.shiftId !== input.actorShiftId)) {
    return "That officer is on another shift.";
  }
  return null;
}

export type SwapSummary = {
  swapGroup: string;
  date: string;
  workerId: string;
  workerName: string;
  partnerId: string;
  partnerName: string;
  reason: string;
  payback: { date: string; state: "scheduled" | "done" } | null;
  /** owed = no payback date set yet; scheduled = payback in the future; done = payback date passed. */
  state: "owed" | "scheduled" | "done";
};

/** One line per swap group, newest first, for the Swaps list. */
export function summarizeSwaps(overrides: DutyOverride[], officers: Officer[], today: string): SwapSummary[] {
  const name = (id: string | null) => officers.find((o) => o.id === id)?.name ?? "Removed officer";
  const groups = new Map<string, DutyOverride[]>();
  for (const o of overrides) {
    if (o.kind !== "swap" || !o.swapGroup) continue;
    groups.set(o.swapGroup, [...(groups.get(o.swapGroup) ?? []), o]);
  }
  const out: SwapSummary[] = [];
  for (const [swapGroup, rows] of groups) {
    const worker = rows.find((r) => !r.isPayback && r.status === "working");
    if (!worker) continue;
    const pb = rows.find((r) => r.isPayback && r.status === "working");
    const partnerId = worker.partnerOfficerId ?? rows.find((r) => !r.isPayback && r.status === "off")?.officerId ?? "";
    const payback = pb ? { date: pb.date, state: pb.date < today ? ("done" as const) : ("scheduled" as const) } : null;
    out.push({
      swapGroup,
      date: worker.date,
      workerId: worker.officerId,
      workerName: name(worker.officerId),
      partnerId,
      partnerName: name(partnerId),
      reason: worker.reason,
      payback,
      state: payback ? payback.state : "owed",
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
