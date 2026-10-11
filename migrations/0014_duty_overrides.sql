-- Overtime & swaps: per-date exceptions to an officer's standing RDO pattern.
-- (0012 is reserved for the unmerged RLS draft; 0013 is the Edit user panel, PR #34.
--  Migrations apply by name in sorted order, skipping ones already recorded, so
--  0013 still applies fine if it lands after this file.)
-- Idempotent: safe to re-run by hand in the Supabase SQL editor.
--
-- One row per officer per date (shift start date, Central):
--   status 'working' + kind 'ot'   -> overtime on an RDO; nobody else changes.
--   status 'working' + kind 'swap' -> covering a partner who is off that date.
--   status 'off'     + kind 'swap' -> the partner's side of that swap.
-- Both sides of a swap (and its optional payback pair) share swap_group;
-- deleting one side deletes the whole group. Nothing here is written to
-- Google Calendar.
create table if not exists duty_overrides (
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
);
create index if not exists duty_overrides_date_idx on duty_overrides (date);
create index if not exists duty_overrides_group_idx on duty_overrides (swap_group);
