-- M7: catálogo real + herança de bandeira. Ver
-- docs/superpowers/specs/2026-06-15-benefy-m7-catalogo-real-design.md

-- my_benefits depende de benefits.category; precisa cair antes do swap de enum.
drop view if exists my_benefits;

-- 1) Slugs estáveis (idempotência do seed + referência em testes)
alter table sources       add column slug text unique;
alter table source_items  add column slug text unique;
alter table benefits      add column slug text unique;

-- 2) Recriar benefit_category com as 16 chaves técnicas (en)
create type benefit_category_v2 as enum (
  'travel','insurance','cashback','investback','points','miles','shopping',
  'restaurant','airport','concierge','investment','security',
  'account_service','international_purchase','experience','other');

alter table benefits
  alter column category type benefit_category_v2
  using (
    case category::text
      when 'viagem'         then 'travel'
      when 'entretenimento' then 'experience'
      when 'saude'          then 'security'
      when 'seguros'        then 'insurance'
      when 'compras'        then 'shopping'
      else 'other'
    end::benefit_category_v2
  );

drop type benefit_category;
alter type benefit_category_v2 rename to benefit_category;

-- 3) Enums auxiliares
create type benefit_source_kind as enum ('issuer','card_network','partner','mixed');
create type redemption_type as enum (
  'automatic','app','coupon','partner_portal','insurance_claim','certificate',
  'concierge','physical_access','points_exchange','statement_credit','other');
create type verification_status as enum (
  'official_confirmed','official_needs_regulation_check','partner_network',
  'inferred_from_card_network','needs_manual_validation');
create type location_scope as enum (
  'online','physical','global_network','countrywide','airport','city','regional','unknown');
create type geolocation_status as enum ('exact','approximate','needs_geocoding','not_applicable');

-- 4) Colunas aditivas
alter table benefits
  add column benefit_source benefit_source_kind,
  add column redemption_type redemption_type,
  add column source_url text,
  add column source_name text,
  add column observed_at date,
  add column verification_status verification_status,
  add column notes text,
  add column long_description text,
  add column program text,
  add column requires_activation boolean not null default false,
  add column requires_eligible_card boolean not null default false,
  add column requires_certificate boolean not null default false,
  add column limits_description text;

alter table source_items
  add column display_name text,
  add column product_type text,
  add column eligibility_description text,
  add column points_rule text,
  add column cashback_rule text,
  add column min_investment numeric,
  add column min_income numeric,
  add column min_monthly_spend numeric,
  add column source_url text,
  add column verification_status verification_status;

alter table benefit_locations
  alter column lat drop not null,
  alter column lng drop not null,
  add column scope location_scope,
  add column country text,
  add column region text,
  add column airport_code text,
  add column terminal text,
  add column geolocation_status geolocation_status;

-- 5) Herança de bandeira
create table benefit_card_tiers (
  benefit_id uuid not null references benefits(id) on delete cascade,
  card_brand text not null,
  card_level text not null,
  primary key (benefit_id, card_brand, card_level)
);
create index on benefit_card_tiers (card_brand, card_level);
grant select, insert, update, delete on benefit_card_tiers to service_role;

-- 6) Recriar my_benefits unindo caminho direto + derivado
create view my_benefits with (security_invoker = true) as
with unlocked as (
  select b.id as benefit_id, si.label as via
  from benefits b
  join benefit_sources bs on bs.benefit_id = b.id
  join source_items si on si.id = bs.source_item_id
  join user_sources us on us.source_item_id = si.id
  where us.user_id = auth.uid() and b.active
  union
  select b.id, si.label
  from benefits b
  join benefit_card_tiers bct on bct.benefit_id = b.id
  join source_items si on si.card_brand = bct.card_brand
                      and si.card_level = bct.card_level
  join user_sources us on us.source_item_id = si.id
  where us.user_id = auth.uid() and b.active
)
select b.id, b.title, b.summary, b.category, b.scope, b.uf, b.steps,
       b.partner_name, b.valid_until, b.image_url, b.action_url, b.action_label,
       b.created_at, array_agg(distinct u.via order by u.via) as via
from unlocked u join benefits b on b.id = u.benefit_id
group by b.id;

grant select on my_benefits to authenticated;
