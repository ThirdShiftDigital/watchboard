/**
 * Startup "ensure" for schema added after the deploy-time migrator became
 * production-only (b988ca5). Same pattern as ensureTables (staff.ts) and
 * ensureShifts (shifts.ts): idempotent, additive DDL, run once per server
 * process from ensureShifts. Keep in sync with:
 *   migrations/0014_duty_overrides.sql
 *   migrations/0015_request_decisions.sql
 *   migrations/0016_off_audit.sql (table, indexes, append-only trigger, RLS; backfill is migration-only)
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
    // 0016 — off / leave audit trail (backfill lives in the migration only)
    `create table if not exists off_audit (
      id            bigserial primary key,
      entity_type   text not null check (entity_type in ('request', 'override')),
      entity_id     text not null,
      officer_id    text not null,
      shift_id      text,
      action        text not null,
      actor_user_id text,
      actor_name    text not null default '',
      at            timestamptz not null default now(),
      before        jsonb,
      after         jsonb,
      summary       text not null default '',
      backfilled    boolean not null default false
    )`,
    `create index if not exists off_audit_entity_idx on off_audit (entity_type, entity_id, at)`,
    `create index if not exists off_audit_shift_idx on off_audit (shift_id, at)`,
    `create or replace function off_audit_append_only() returns trigger language plpgsql as $$
      begin raise exception 'off_audit is append-only'; end; $$`,
    `drop trigger if exists off_audit_no_change on off_audit`,
    `create trigger off_audit_no_change before update or delete on off_audit
      for each row execute function off_audit_append_only()`,
    `drop trigger if exists off_audit_no_truncate on off_audit`,
    `create trigger off_audit_no_truncate before truncate on off_audit
      for each statement execute function off_audit_append_only()`,
    `alter table off_audit enable row level security`,
    `do $$ begin
      if exists (select 1 from pg_roles where rolname = 'anon') then
        execute 'revoke all on table off_audit from anon';
        execute 'revoke all on sequence off_audit_id_seq from anon';
      end if;
      if exists (select 1 from pg_roles where rolname = 'authenticated') then
        execute 'revoke all on table off_audit from authenticated';
        execute 'revoke all on sequence off_audit_id_seq from authenticated';
      end if;
    end $$`,
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
