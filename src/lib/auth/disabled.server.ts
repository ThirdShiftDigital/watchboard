/**
 * Disabled logins (Edit user → Status). Server-only: checked by authMiddleware
 * on every server function and by Better Auth before it creates a session.
 */
export const DISABLED_MESSAGE = "This login is disabled. Contact your shift commander.";

/** Thrown for a disabled login; carries 401 like UnauthorizedError. */
export class DisabledLoginError extends Error {
  readonly status = 401;
  constructor() {
    super(DISABLED_MESSAGE);
    this.name = "DisabledLoginError";
  }
}

/**
 * True when the login has `staff_accounts.disabled_at` set. A database that
 * hasn't run migration 0013 yet (no column / table) counts as not disabled, so
 * a deploy ahead of its migration can't lock everyone out.
 */
export async function isLoginDisabled(userId: string): Promise<boolean> {
  try {
    const { getSql } = await import("../db");
    const sql = await getSql();
    const rows = await sql<{ disabled: boolean }>`
      select disabled_at is not null as disabled from staff_accounts where user_id = ${userId}
    `;
    return Boolean(rows[0]?.disabled);
  } catch (err) {
    const code = (err as { code?: string } | null)?.code;
    if (code === "42703" || code === "42P01") return false; // undefined column / table
    throw err;
  }
}
