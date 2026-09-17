create table if not exists shifts (
  id                 text primary key,
  name               text not null,
  start_time         text not null default '14:00',
  end_time           text not null default '02:00',
  effective_date     text,
  min_working        integer not null default 10,
  zone_order         text not null default '',
  calendar_feed_url  text not null default '',
  created_at         timestamptz not null default now()
);

insert into shifts (id, name, start_time, end_time, effective_date, min_working, zone_order, calendar_feed_url)
select
  'default',
  'Watch',
  '14:00',
  '02:00',
  coalesce((select value from schedule_meta where key = 'effective_date'), '2026-08-30'),
  coalesce(nullif((select value from schedule_meta where key = 'min_working'), '')::int, 10),
  coalesce((select value from schedule_meta where key = 'zone_order'), ''),
  coalesce((select value from schedule_meta where key = 'calendar_feed_url'), '')
where not exists (select 1 from shifts where id = 'default');

alter table officers add column if not exists shift_id text not null default 'default';
alter table staff_accounts add column if not exists shift_id text;
alter table staff_accounts add column if not exists active_shift_id text;

update officers set shift_id = 'default' where shift_id is null or shift_id = '';
update staff_accounts set shift_id = 'default' where shift_id is null or shift_id = '';
update staff_accounts set active_shift_id = coalesce(nullif(active_shift_id, ''), shift_id, 'default');
