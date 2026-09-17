create table if not exists agencies (
  id          text primary key,
  name        text not null,
  short_name  text not null default '',
  created_by  text,
  created_at  timestamptz not null default now()
);

insert into agencies (id, name, short_name)
select 'home', 'WatchBoard', 'HOME'
where not exists (select 1 from agencies where id = 'home');

alter table shifts add column if not exists agency_id text;
update shifts set agency_id = 'home' where agency_id is null or agency_id = '';

alter table staff_accounts add column if not exists agency_id text;
update staff_accounts set agency_id = 'home' where agency_id is null or agency_id = '';

create table if not exists agency_members (
  user_id     text not null,
  agency_id   text not null,
  permission  text not null default 'officer',
  officer_id  text,
  created_at  timestamptz not null default now(),
  primary key (user_id, agency_id)
);

insert into agency_members (user_id, agency_id, permission, officer_id)
select user_id, coalesce(nullif(agency_id, ''), 'home'), permission, officer_id
from staff_accounts
on conflict (user_id, agency_id) do nothing;

create table if not exists agency_invites (
  id          serial primary key,
  code        text not null unique,
  kind        text not null default 'agency',
  agency_id   text,
  created_by  text,
  expires_at  timestamptz not null,
  used        boolean not null default false,
  used_by     text,
  used_at     timestamptz,
  created_at  timestamptz not null default now()
);
