/**
 * Startup "ensure" for schema added after the deploy-time migrator became
 * production-only (b988ca5). Same pattern as ensureTables (staff.ts) and
 * ensureShifts (shifts.ts): idempotent, additive DDL, run once per server
 * process from ensureShifts. Keep in sync with:
 *   migrations/0014_duty_overrides.sql
 *   migrations/0015_request_decisions.sql
 * Never throws: a failure is logged and reads stay guarded (overrides-db.ts).
 */
export async function ensureLateSchema(sql: {
  query: (text: string, params?: unknown[]) => Promise<unknown[]>;
}): Promise<void> {
  const statements = [
    // 0014 — Overtime & swaps
    `create table if not exists duty_overrides (
      id                 serial primary key,
      shift_id           text,
      officer_id         text not null references officers(id) on delete cascade,
      date               text not null,
      status             text not null check (status in ('working', 'off')),
      kind               text not null check (kind in ('ot', 'swap')),
      partner_officer_id text references officers(id) on delete set null,
      swap_group         text,
      is_payback         boolean not null default false,
      reason             text not null default '',
      created_by         text,
      created_at         timestamptz not null default now(),
      unique (officer_id, date)
    )`,
    `create index if not exists duty_overrides_date_idx on duty_overrides (date)`,
    `create index if not exists duty_overrides_group_idx on duty_overrides (swap_group)`,
    // 0015 — denial reasons + decision stamp
    `alter table time_off_requests add column if not exists denial_reason text`,
    `alter table time_off_requests add column if not exists decided_by text`,
    `alter table time_off_requests add column if not exists decided_at timestamptz`,
  ];
  for (const text of statements) {
    try {
      await sql.query(text);
    } catch (err) {
      console.error("[schema] ensure failed", {
        statement: text.slice(0, 60),
        error: err instanceof Error ? err.message.slice(0, 200) : String(err),
      });
    }
  }
}
