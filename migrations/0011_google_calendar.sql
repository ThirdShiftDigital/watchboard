alter table shifts
  add column if not exists google_calendar boolean not null default false;

create table if not exists calendar_cache (
  shift_id   text not null,
  event_id   text not null,
  title      text not null,
  start_at   text not null,
  end_at     text,
  all_day    boolean not null default true,
  primary key (shift_id, event_id)
);
