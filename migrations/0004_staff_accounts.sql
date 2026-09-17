create table if not exists staff_accounts (
  user_id     text primary key,
  email       text not null,
  name        text not null,
  permission  text not null default 'officer',
  officer_id  text,
  created_at  timestamptz not null default now()
);

create table if not exists password_resets (
  id          serial primary key,
  email       text not null,
  code        text not null,
  expires_at  timestamptz not null,
  used        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists password_resets_email_idx on password_resets (email);
