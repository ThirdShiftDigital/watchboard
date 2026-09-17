create table if not exists officers (
  id            text primary key,
  name          text not null,
  unit          text not null,
  rank_sort     integer not null,
  role          text not null default 'deputy',
  hire_date     text,
  tmt           boolean not null default false,
  radio_num     integer,
  rdo_days      text not null default '',
  default_zone  text,
  last_name     text not null
);

create table if not exists zone_assignments (
  id          serial primary key,
  date        text not null,
  officer_id  text not null references officers(id),
  zone        text not null,
  unique (date, officer_id)
);
create index if not exists zone_assignments_date_idx on zone_assignments (date);

create table if not exists time_off_requests (
  id          serial primary key,
  officer_id  text not null references officers(id),
  start_date  text not null,
  end_date    text not null,
  kind        text not null,
  reason      text not null default '',
  status      text not null default 'pending',
  created_at  timestamptz not null default now()
);
create index if not exists time_off_requests_status_idx on time_off_requests (status);
create index if not exists time_off_requests_dates_idx on time_off_requests (start_date, end_date);

create table if not exists schedule_meta (
  key   text primary key,
  value text not null
);

insert into officers (id, name, unit, rank_sort, role, hire_date, tmt, radio_num, rdo_days, default_zone, last_name) values
  ('keyes',      'LT. C. KEYES',          '305', 1, 'lt',     '2007-05-14', false, null, '5,6', 'ALL',    'KEYES'),
  ('johnson',    'SGT. R. JOHNSON',       '306', 2, 'sgt',    '1997-04-17', false, null, '0,6', 'ALL',    'JOHNSON'),
  ('henry',      'CPL. S. HENRY',         '307', 3, 'cpl',    '2022-06-05', true,  null, '4,5', 'ALL',    'HENRY'),
  ('garmon',     'CPL/FTO J. GARMON',     '308', 4, 'cpl',    '2017-02-01', false, null, '0,1', 'RW',     'GARMON'),
  ('means',      'R. MEANS',              '309', 5, 'deputy', '2024-12-01', false, 8,    '1,2', null,     'MEANS'),
  ('griese',     'FTO. A.GRIESE',         '310', 6, 'fto',    '2021-02-07', false, 1,    '5,6', null,     'GRIESE'),
  ('hill',       'D.HILL',                '311', 7, 'deputy', '2025-02-03', false, 8,    '2,3', null,     'HILL'),
  ('gainey',     'J. GAINEY',             '312', 8, 'deputy', '2025-03-31', false, 10,   '1,2', null,     'GAINEY'),
  ('hudgens',    'J.HUDGENS',             '313', 9, 'deputy', '2021-04-25', false, 3,    '0,6', null,     'HUDGENS'),
  ('scott',      'J. SCOTT',              '314', 10,'deputy', '2024-06-07', false, 7,    '3,4', 'NW',     'SCOTT'),
  ('brazelton',  'T.BRAZELTON',           '315', 11,'deputy', '2022-10-10', true,  5,    '3,4', 'NE',     'BRAZELTON'),
  ('anderson',   'A.ANDERSON',            '316', 12,'deputy', '2023-04-09', false, 6,    '1,2', 'SE',     'ANDERSON'),
  ('metcalf',    'S.METCALF',             '317', 13,'deputy', '2021-02-07', false, 2,    '0,6', null,     'METCALF'),
  ('harris',     'D.HARRIS',              '318', 14,'deputy', '2022-08-07', false, 4,    '0,1', 'RE',     'HARRIS'),
  ('ladd',       'R.LADD',                '319', 15,'deputy', '2023-06-13', true,  1,    '4,5', null,     'LADD'),
  ('dodson',     'B.DODSON',              '320', 16,'deputy', '2026-08-03', false, 11,   '2,3', 'SW',     'DODSON');

insert into schedule_meta (key, value) values
  ('effective_date', '2026-08-30');
