-- Off / leave audit trail: who marked a deputy off, when, and who changed or
-- removed it. Append-only. Only the shift commander of the entry's shift may
-- read it (enforced in the app server: src/lib/off-audit.ts).
-- (0012 is reserved for the unmerged RLS draft; 0013 is the Edit user panel.)
-- Idempotent: safe to re-run by hand in the Supabase SQL editor. The app also
-- runs the table/index/trigger statements at startup (src/lib/schema-ensure.ts).
--
-- entity_type: 'request' (time_off_requests: leave, sick, call-in)
--              'override' (duty_overrides: overtime & swaps, incl. swap 'off' side)
-- action: created | approved | denied | restored | changed | cancelled |
--         ended_early | removed
-- actor_user_id is null only for backfilled rows where the actor was never
-- stored (e.g. who submitted a request before this table existed).
create table if not exists off_audit (
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
);
create index if not exists off_audit_entity_idx on off_audit (entity_type, entity_id, at);
create index if not exists off_audit_shift_idx on off_audit (shift_id, at);

-- Append-only: block UPDATE / DELETE / TRUNCATE.
create or replace function off_audit_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'off_audit is append-only';
end;
$$;
drop trigger if exists off_audit_no_change on off_audit;
create trigger off_audit_no_change before update or delete on off_audit
  for each row execute function off_audit_append_only();
drop trigger if exists off_audit_no_truncate on off_audit;
create trigger off_audit_no_truncate before truncate on off_audit
  for each statement execute function off_audit_append_only();

-- Not reachable through Supabase PostgREST: RLS on, no policies, no grants.
-- (The app's privileged DATABASE_URL role bypasses RLS; the server is the gate.)
alter table off_audit enable row level security;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on table off_audit from anon';
    execute 'revoke all on sequence off_audit_id_seq from anon';
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'revoke all on table off_audit from authenticated';
    execute 'revoke all on sequence off_audit_id_seq from authenticated';
  end if;
end;
$$;

-- Backfill only what existing columns prove. Skips anything already backfilled.
-- 1) Requests: submitted/called in at created_at. Who did it was never stored.
insert into off_audit (entity_type, entity_id, officer_id, shift_id, action, actor_user_id, actor_name, at, after, summary, backfilled)
select 'request', r.id::text, r.officer_id, o.shift_id, 'created', null, '', r.created_at,
       jsonb_build_object('startDate', r.start_date, 'endDate', r.end_date, 'kind', r.kind),
       'Entered (who entered it was not recorded before the audit trail)', true
from time_off_requests r
left join officers o on o.id = r.officer_id
where not exists (
  select 1 from off_audit a
  where a.entity_type = 'request' and a.entity_id = r.id::text and a.action = 'created'
);
-- 2) Requests: the last approve/deny/restore/end-early (decided_by, 0015).
insert into off_audit (entity_type, entity_id, officer_id, shift_id, action, actor_user_id, actor_name, at, after, summary, backfilled)
select 'request', r.id::text, r.officer_id, o.shift_id,
       case r.status when 'approved' then 'approved' when 'denied' then 'denied'
                     when 'cancelled' then 'cancelled' else 'restored' end,
       r.decided_by, coalesce(s.name, ''), r.decided_at,
       jsonb_build_object('status', r.status, 'endDate', r.end_date),
       'Last decision (earlier decisions were not recorded)', true
from time_off_requests r
left join officers o on o.id = r.officer_id
left join staff_accounts s on s.user_id = r.decided_by
where r.decided_by is not null and r.decided_at is not null
  and not exists (
    select 1 from off_audit a
    where a.entity_type = 'request' and a.entity_id = r.id::text and a.action <> 'created'
  );
-- 3) Overtime & swaps: created_by / created_at (0014).
insert into off_audit (entity_type, entity_id, officer_id, shift_id, action, actor_user_id, actor_name, at, after, summary, backfilled)
select 'override', d.id::text, d.officer_id, coalesce(d.shift_id, o.shift_id), 'created',
       d.created_by, coalesce(s.name, ''), d.created_at,
       jsonb_build_object('date', d.date, 'status', d.status, 'kind', d.kind, 'swapGroup', d.swap_group),
       'Entered', true
from duty_overrides d
left join officers o on o.id = d.officer_id
left join staff_accounts s on s.user_id = d.created_by
where not exists (
  select 1 from off_audit a
  where a.entity_type = 'override' and a.entity_id = d.id::text and a.action = 'created'
);
