/**
 * Password-reset code rules (pure, no server imports so they're unit-testable).
 *
 * Codes are never shown to the requester. The person's shift commander (or a
 * division leader / the operator) reads them from Accounts, subject to the same
 * scope rules as other staff changes (`staffManageBlock`).
 */

/** How long a code stays valid. */
export const RESET_TTL_MINUTES = 45;
/** Wrong guesses allowed on one code before it is burned. */
export const RESET_MAX_ATTEMPTS = 5;
/** Rate-limit window for new reset requests. */
export const RESET_WINDOW_MINUTES = 15;
/** New codes per email per window. */
export const RESET_MAX_PER_EMAIL = 3;
/** Reset requests per client IP per window (any email). */
export const RESET_MAX_PER_IP = 10;
/** Failed completions per client IP per window (any email). */
export const RESET_MAX_FAILS_PER_IP = 15;

/** The one response /forgot ever gets, whether or not the account exists. */
export const RESET_REQUEST_MESSAGE =
  "If that account exists, a reset request was created. Get your reset code from your shift commander.";

/** Same error for unknown email, wrong code, expired, used, or burned codes. */
export const RESET_INVALID_MESSAGE = "That code is invalid or expired.";

export function normalizeResetCode(value: string): string {
  return value.replace(/\s+/g, "");
}

/**
 * Compare two codes without an early exit, so response time doesn't reveal
 * how many leading digits were right.
 */
export function codesMatch(expected: string, given: string): boolean {
  const a = normalizeResetCode(expected);
  const b = normalizeResetCode(given);
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i += 1) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0 && a.length > 0;
}

export function resetExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + RESET_TTL_MINUTES * 60_000);
}

export function resetWindowStart(now: Date = new Date()): Date {
  return new Date(now.getTime() - RESET_WINDOW_MINUTES * 60_000);
}

/** True when a new reset request should be silently dropped. */
export function resetRequestLimited(counts: { email: number; ip: number }): boolean {
  return counts.email >= RESET_MAX_PER_EMAIL || counts.ip >= RESET_MAX_PER_IP;
}

export type StoredReset = {
  code: string;
  used: boolean;
  attempts: number;
  expiresAt: Date;
};

/**
 * Decide what to do with a completion attempt against the newest pending code
 * for that account. `burn` means mark the code used (spent or out of attempts).
 */
export function checkResetAttempt(
  row: StoredReset | null,
  given: string,
  now: Date = new Date(),
): { ok: boolean; burn: boolean; attempts: number } {
  if (!row || row.used || row.expiresAt.getTime() <= now.getTime()) {
    return { ok: false, burn: false, attempts: row?.attempts ?? 0 };
  }
  if (row.attempts >= RESET_MAX_ATTEMPTS) {
    return { ok: false, burn: true, attempts: row.attempts };
  }
  if (codesMatch(row.code, given)) {
    return { ok: true, burn: true, attempts: row.attempts };
  }
  const attempts = row.attempts + 1;
  return { ok: false, burn: attempts >= RESET_MAX_ATTEMPTS, attempts };
}
