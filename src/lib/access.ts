export const PERMISSIONS = ["captain", "admin", "supervisor", "dispatcher", "officer"] as const;
export type Permission = (typeof PERMISSIONS)[number];

/**
 * Capabilities a shift commander can turn on/off for an individual login
 * (supervisor / dispatch / officer). Stored as diffs from the role defaults on
 * staff_accounts.cap_overrides, so untouched keys keep following the role.
 */
export const TOGGLE_CAPS = [
  "viewBoard",
  "editWatch",
  "sendList",
  "manageRoster",
  "approveRequests",
  "callIn",
  "viewCalendar",
  "viewShiftRequests",
  "submitRequests",
] as const;
export type ToggleCap = (typeof TOGGLE_CAPS)[number];
export type CapOverrides = Partial<Record<ToggleCap, boolean>>;

export const CAP_INFO: Record<ToggleCap, { label: string; hint: string; requires?: ToggleCap }> = {
  viewBoard: { label: "Zones board", hint: "See the zone list for the shift" },
  editWatch: { label: "Assign zones", hint: "Post and change zone assignments", requires: "viewBoard" },
  sendList: { label: "Send the watch", hint: "Share the posted list to shift & dispatch", requires: "viewBoard" },
  manageRoster: {
    label: "Shift schedule",
    hint: "Edit the roster, RDOs and minimum staffing",
    requires: "viewBoard",
  },
  approveRequests: {
    label: "Approve requests",
    hint: "Requests page: approve, deny, restore; request for others",
    requires: "viewBoard",
  },
  callIn: { label: "Call-in leave", hint: "Put someone on leave right away from Calendar", requires: "viewCalendar" },
  viewCalendar: { label: "Shift calendar", hint: "Calendar page and the leave calendar on Officer" },
  viewShiftRequests: {
    label: "See who’s off",
    hint: "Upcoming requests from others on the shift (no reasons)",
  },
  submitRequests: { label: "Request days off", hint: "Submit their own leave requests" },
};

export type StaffAccount = {
  userId: string;
  email: string;
  name: string;
  permission: Permission;
  officerId: string | null;
  shiftId: string | null;
  activeShiftId: string | null;
  agencyId: string | null;
  viewingAgencyId?: string | null;
  isOwner: boolean;
  agencyAdmin: boolean;
  capOverrides: CapOverrides;
};

export function isPermission(value: string): value is Permission {
  return (PERMISSIONS as readonly string[]).includes(value);
}

export function permissionLabel(permission: Permission): string {
  switch (permission) {
    case "captain":
      return "Division leader";
    case "admin":
      return "Shift commander";
    case "supervisor":
      return "Supervisor";
    case "dispatcher":
      return "Dispatch";
    case "officer":
      return "Officer";
  }
}

export function permissionHint(permission: Permission): string {
  switch (permission) {
    case "captain":
      return "Shifts, commanders, and agency setup";
    case "admin":
      return "Officers, deputies, and supervisors on this shift";
    case "supervisor":
      return "Watch, schedule, requests, calendar";
    case "dispatcher":
      return "View the board and send the list";
    case "officer":
      return "Request days off and see the leave calendar";
  }
}

export type Caps = {
  viewBoard: boolean;
  viewCalendar: boolean;
  editWatch: boolean;
  manageRoster: boolean;
  approveRequests: boolean;
  callIn: boolean;
  viewShiftRequests: boolean;
  submitRequests: boolean;
  sendList: boolean;
  manageAccounts: boolean;
  manageAgency: boolean;
  managePlatform: boolean;
};

type CapExtras = { isOwner?: boolean; agencyAdmin?: boolean };

/** Commanders, division leaders and the operator always have every capability. */
export function capsAreCustomizable(permission: Permission, extras?: CapExtras): boolean {
  if (extras?.isOwner || extras?.agencyAdmin) return false;
  return permission === "supervisor" || permission === "dispatcher" || permission === "officer";
}

/** Role defaults — what every login had before per-officer permissions. */
export function defaultCapsFor(permission: Permission, extras?: CapExtras): Caps {
  const owner = Boolean(extras?.isOwner);
  const captain = owner || permission === "captain" || Boolean(extras?.agencyAdmin);
  const admin = captain || permission === "admin";
  const supervisor = admin || permission === "supervisor";
  const dispatcher = supervisor || permission === "dispatcher";
  // Dispatch runs the board; the shift's leave calendar is not theirs to see.
  const dispatchOnly = permission === "dispatcher" && !supervisor;
  return {
    viewBoard: dispatcher,
    viewCalendar: !dispatchOnly,
    editWatch: supervisor,
    manageRoster: supervisor,
    approveRequests: supervisor,
    callIn: supervisor,
    viewShiftRequests: !dispatchOnly,
    submitRequests: true,
    sendList: dispatcher,
    manageAccounts: admin,
    manageAgency: captain,
    managePlatform: owner,
  };
}

/** Turn off anything whose prerequisite is off (e.g. Assign zones without the board). */
export function normalizeToggles(caps: Caps): Caps {
  const next = { ...caps };
  for (const key of TOGGLE_CAPS) {
    const req = CAP_INFO[key].requires;
    if (req && !next[req]) next[key] = false;
  }
  return next;
}

export function capsFor(permission: Permission, extras?: CapExtras, overrides?: CapOverrides): Caps {
  const base = defaultCapsFor(permission, extras);
  if (!overrides || !capsAreCustomizable(permission, extras)) return base;
  const merged = { ...base };
  for (const key of TOGGLE_CAPS) {
    const v = overrides[key];
    if (typeof v === "boolean") merged[key] = v;
  }
  return normalizeToggles(merged);
}

export function parseCapOverrides(raw: unknown): CapOverrides {
  let value: unknown = raw;
  if (typeof raw === "string") {
    try {
      value = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: CapOverrides = {};
  for (const key of TOGGLE_CAPS) {
    const v = (value as Record<string, unknown>)[key];
    if (typeof v === "boolean") out[key] = v;
  }
  return out;
}

export function assignablePermissions(caps: Caps): Permission[] {
  if (caps.managePlatform || caps.manageAgency) return [...PERMISSIONS];
  return ["supervisor", "dispatcher", "officer"];
}

/** Higher number = more authority. An agency admin counts as a division leader. */
export const ROLE_RANK: Record<Permission, number> = {
  officer: 0,
  dispatcher: 1,
  supervisor: 2,
  admin: 3,
  captain: 4,
};

/** The signed-in login acting from Accounts. `shiftId` is the shift they work / are viewing. */
export type StaffActor = {
  userId: string;
  permission: Permission;
  isOwner: boolean;
  manageAgency: boolean;
  managePlatform: boolean;
  agencyId: string | null;
  shiftId: string | null;
};

/** The login being changed. `shiftId` is their home shift (shift_id, else active_shift_id). */
export type StaffTarget = {
  userId: string;
  permission: Permission;
  isOwner: boolean;
  agencyAdmin: boolean;
  agencyId: string | null;
  shiftId: string | null;
};

/**
 * Why `actor` may not change `target` from Accounts (role, shift, officer link,
 * password, permissions, delete), or null when allowed.
 * - The operator can act on anyone.
 * - Division leaders (and agency admins) can act on anyone in their agency.
 * - Shift commanders can act only on people on their own shift who rank below
 *   them (so not other commanders, division leaders, or agency admins).
 * - Nobody acts on their own login here.
 */
export function staffManageBlock(actor: StaffActor, target: StaffTarget): string | null {
  if (actor.userId === target.userId) return "You can’t change your own login here.";
  if (actor.isOwner || actor.managePlatform) return null;
  if (target.isOwner) return "Account not found.";
  if (!actor.agencyId || target.agencyId !== actor.agencyId) {
    return "That login belongs to another agency.";
  }
  if (actor.manageAgency) return null;
  if (!actor.shiftId || target.shiftId !== actor.shiftId) {
    return "You can only manage people on your own shift.";
  }
  const theirs = target.agencyAdmin ? ROLE_RANK.captain : ROLE_RANK[target.permission];
  if (theirs >= ROLE_RANK[actor.permission]) {
    return "Only a division leader can change a login at or above your level.";
  }
  return null;
}

/** Why `actor` may not give someone `role`, or null. Division leaders keep their full list. */
export function roleAssignBlock(actor: StaffActor, role: Permission): string | null {
  if (actor.isOwner || actor.managePlatform || actor.manageAgency) return null;
  if (ROLE_RANK[role] >= ROLE_RANK[actor.permission]) {
    return "Only a division leader can give that role.";
  }
  return null;
}
