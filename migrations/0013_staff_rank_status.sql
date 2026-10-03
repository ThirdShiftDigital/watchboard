-- Edit user panel: login rank, Disabled status, and an audit trail.
-- (0012 is reserved for the unmerged RLS draft, 0012_enable_rls.sql.)
-- Idempotent: safe to re-run by hand in the Supabase SQL editor.

-- Rank for logins NOT linked to a roster officer. A linked login's rank is
-- officers.role (the roster is the single source of truth). Same five values
-- as ROLES in src/lib/types.ts. Rank never grants permissions.
alter table staff_accounts add column if not exists rank text;
alter table staff_accounts drop constraint if exists staff_accounts_rank_chk;
alter table staff_accounts add constraint staff_accounts_rank_chk
  check (rank is null or rank in ('lt', 'sgt', 'cpl', 'fto', 'deputy'));

-- Disabled logins can't sign in and their sessions are refused.
alter table staff_accounts add column if not exists disabled_at timestamptz;
alter table staff_accounts add column if not exists disabled_by text;

-- One row per Edit user save: who changed whom, and which fields (old -> new).
create table if not exists staff_audit (
  id         serial primary key,
  actor_id   text not null,
  target_id  text not null,
  changes    text not null, -- JSON {field: [old, new]}; never passwords
  created_at timestamptz not null default now()
);
create index if not exists staff_audit_target_idx on staff_audit (target_id, created_at desc);

-- Email unique ignoring case. Only created when there are no case-duplicates,
-- so a duplicate can't fail the deploy's migrate step; find them with
--   select lower(email), count(*) from "user" group by 1 having count(*) > 1;
-- resolve by hand, then re-run this statement (or the manual SQL file).
do $$
begin
  if to_regclass('public."user"') is not null
     and not exists (select 1 from "user" group by lower(email) having count(*) > 1) then
    create unique index if not exists user_email_lower_uniq on "user" (lower(email));
  else
    raise notice 'user_email_lower_uniq not created: "user" missing or has case-duplicate emails';
  end if;
end
$$;
