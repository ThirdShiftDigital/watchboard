delete from time_off_requests;
delete from schedule_meta where key = 'calendar_feed_url';
insert into schedule_meta (key, value) values ('demo_cleared', '1')
  on conflict (key) do update set value = '1';
