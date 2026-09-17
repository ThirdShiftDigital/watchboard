export const PERMISSIONS = ["captain", "admin", "supervisor", "dispatcher", "officer"] as const;
export type Permission = (typeof PERMISSIONS)[number];

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
  sendList: boolean;
  manageAccounts: boolean;
  manageAgency: boolean;
  managePlatform: boolean;
};

export function capsFor(
  permission: Permission,
  extras?: { isOwner?: boolean; agencyAdmin?: boolean },
): Caps {
  const owner = Boolean(extras?.isOwner);
  const captain = owner || permission === "captain" || Boolean(extras?.agencyAdmin);
  const admin = captain || permission === "admin";
  const supervisor = admin || permission === "supervisor";
  const dispatcher = supervisor || permission === "dispatcher";
  return {
    viewBoard: dispatcher,
    viewCalendar: true,
    editWatch: supervisor,
    manageRoster: supervisor,
    approveRequests: supervisor,
    sendList: dispatcher,
    manageAccounts: admin,
    manageAgency: captain,
    managePlatform: owner,
  };
}

export function assignablePermissions(caps: Caps): Permission[] {
  if (caps.managePlatform || caps.manageAgency) return [...PERMISSIONS];
  return ["supervisor", "dispatcher", "officer"];
}