/**
 * Approve / deny / restore rules for days-off requests (pure; no DB).
 */
import type { Caps } from "./access.ts";

export const DENIAL_REASON_MAX = 300;

/** Trim, collapse control characters, cap length. Empty -> null. */
export function cleanDenialReason(raw: string | null | undefined): string | null {
  const text = String(raw ?? "")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, DENIAL_REASON_MAX)
    .trim();
  return text ? text : null;
}

/**
 * Why this login may not decide a request for `officer`, or null.
 * Approvers on their own shift; division leaders across their agency; the
 * operator anyone. (Same scope as requests for others, PR #30.)
 */
export function decisionBlock(input: {
  caps: Caps;
  officer: { shiftId: string | null; agencyId: string | null } | null;
  actorAgencyId: string | null;
  actorShiftId: string | null;
}): string | null {
  if (!input.caps.approveRequests) return "You do not have permission for that.";
  if (!input.officer) return "Request not found.";
  if (input.caps.managePlatform) return null;
  if (!input.actorAgencyId || input.officer.agencyId !== input.actorAgencyId) {
    return "That request belongs to another agency.";
  }
  if (!input.caps.manageAgency && (!input.actorShiftId || input.officer.shiftId !== input.actorShiftId)) {
    return "That request is for another shift.";
  }
  return null;
}

/** The reason to show: only while the request is denied (kept as history after Restore). */
export function visibleDenialReason(status: string, stored: string | null | undefined): string | null {
  return status === "denied" ? (stored ?? null) || null : null;
}
