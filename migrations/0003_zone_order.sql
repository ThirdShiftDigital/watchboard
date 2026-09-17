insert into schedule_meta (key, value) values
  ('zone_order', 'ALL,RE,NE,SE,CENTRAL,RW,NW,SW,VANDY ER')
on conflict (key) do nothing;
