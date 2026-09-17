alter table time_off_requests
  add column if not exists calendar_event_id text;
