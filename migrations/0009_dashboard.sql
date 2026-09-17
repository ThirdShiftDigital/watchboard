alter table staff_accounts add column if not exists is_owner boolean not null default false;
alter table agency_members add column if not exists agency_admin boolean not null default false;

update staff_accounts
set is_owner = true
where permission = 'admin'
  and not exists (select 1 from staff_accounts s2 where s2.is_owner = true);

update agency_members m
set agency_admin = true
from staff_accounts s
where s.user_id = m.user_id and s.is_owner = true;

create table if not exists setups (
  id               text primary key,
  kind             text not null,
  status           text not null default 'pending',
  payload          text not null default '{}',
  agency_id        text,
  invite_code      text,
  submitted_by     text,
  submitted_at     timestamptz not null default now(),
  verified_by      text,
  verified_at      timestamptz,
  rejected_reason  text,
  live_id          text
);
