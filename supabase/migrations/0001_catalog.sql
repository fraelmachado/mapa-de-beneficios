create type source_kind as enum ('card', 'carrier', 'loyalty', 'cpf');
create type benefit_category as enum ('viagem', 'entretenimento', 'saude', 'seguros', 'compras');
create type benefit_scope as enum ('nacional', 'regional', 'pontual');

create table sources (
  id uuid primary key default gen_random_uuid(),
  kind source_kind not null,
  name text not null,
  logo_url text,
  sort_order int not null default 0,
  active boolean not null default true
);

create table source_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);

create table benefits (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null,
  category benefit_category not null,
  scope benefit_scope not null default 'nacional',
  uf text,
  steps text,
  partner_name text,
  valid_until date,
  image_url text,
  action_url text,
  action_label text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table benefit_sources (
  benefit_id uuid not null references benefits(id) on delete cascade,
  source_item_id uuid not null references source_items(id) on delete cascade,
  primary key (benefit_id, source_item_id)
);

create table benefit_locations (
  id uuid primary key default gen_random_uuid(),
  benefit_id uuid not null references benefits(id) on delete cascade,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  address text,
  city text,
  uf text,
  radius_m int,
  active boolean not null default true
);

create index on source_items (source_id);
create index on benefit_sources (source_item_id);
create index on benefit_locations (benefit_id);

grant select, insert, update, delete on
  sources, source_items, benefits, benefit_sources, benefit_locations
  to service_role;
