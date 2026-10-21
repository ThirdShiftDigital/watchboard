/**
 * Who may read the off / leave audit trail (pure; unit-tested).
 *
 * Rule (Chris, Oct 2026): ONLY the shift commander of the entry's shift.
 * "Shift commander" = permission 'admin' (permissionLabel → "Shift commander"),
 * home shift (staff_accounts.shift_id, else active_shift_id) equal to the
 * shift the entry's officer is on, in the same agency. Division leaders
 * ('captain' / agency admins) and the operator (owner) are deliberately NOT
 * included — the most restrictive reading until Chris says otherwise.
 */
import type { Permission } from "@/lib/access";

export type AuditViewer = {
  permission: Permission;
  isOwner: boolean;
  agencyAdmin: boolean;
  unassigned: boolean;
  agencyId: string | null;
  /** Home shift: shift_id, else active_shift_id. */
  homeShiftId: string | null;
};

/** Is this login a shift commander at all (of some shift)? */
export function isShiftCommander(v: AuditViewer): boolean {
  return !v.unassigned && v.permission === "admin" && !v.isOwner && !v.agencyAdmin && Boolean(v.homeShiftId) && Boolean(v.agencyId);
}

/**
 * Who sees audit history, time-off totals, print and PDF/email exports.
 *   A = only the shift commander of that shift
 *   B = A + division leaders (captain / agency admin) in the same agency
 *   C = B + the operator (owner)
 * ONE-LINE SWITCH: change this constant.
 */
export type AuditAudience = "A" | "B" | "C";
export const OFF_AUDIT_AUDIENCE: AuditAudience = "A";

/**
 * The single shared visibility rule (server-enforced everywhere: loaders,
 * history, totals, print / PDF report). May `v` see audit-level data for an
 * entry or officer on `entry.shiftId`?
 */
export function canSeeOffAudit(
  v: AuditViewer,
  entry: { shiftId: string | null; agencyId: string | null },
  audience: AuditAudience = OFF_AUDIT_AUDIENCE,
): boolean {
  if (v.unassigned || !entry.shiftId || !entry.agencyId) return false;
  if (audience === "C" && v.isOwner) return true;
  if (!v.agencyId || v.agencyId !== entry.agencyId) return false;
  if (audience !== "A" && (v.permission === "captain" || v.agencyAdmin)) return true;
  return isShiftCommander(v) && entry.shiftId === v.homeShiftId;
}

export type OffAuditAction =
  | "created"
  | "approved"
  | "denied"
  | "restored"
  | "changed"
  | "cancelled"
  | "ended_early"
  | "removed";

export function actionLabel(a: string): string {
  switch (a) {
    case "created":
      return "Marked off";
    case "approved":
      return "Approved";
    case "denied":
      return "Denied / removed";
    case "restored":
      return "Restored to pending";
    case "changed":
      return "Changed";
    case "cancelled":
      return "Cancelled";
    case "ended_early":
      return "Ended early";
    case "removed":
      return "Removed";
    default:
      return a;
  }
}

/** "Oct 20, 6:52 PM CT" */
export function formatCT(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return (
    d.toLocaleString("en-US", {
      timeZone: "America/Chicago",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }) + " CT"
  );
}
