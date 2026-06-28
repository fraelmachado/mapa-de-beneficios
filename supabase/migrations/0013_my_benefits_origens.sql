-- P1: my_benefits ganha origem primária (origins) e secundária (benefit_source/networks).
-- Aditiva: só recria a view; security_invoker mantido, RLS das tabelas-base inalterada.
-- Leva o join a sources nos DOIS caminhos para agregar provedor + source_category.
drop view if exists my_benefits;
create view my_benefits with (security_invoker = true) as
with unlocked as (
  -- caminho direto: benefit_sources -> source_items -> sources
  select b.id as benefit_id, si.label as via,
         s.name as provider, s.source_category as source_category,
         null::text as network_brand, null::text as network_level
  from benefits b
  join benefit_sources bs on bs.benefit_id = b.id
  join source_items si on si.id = bs.source_item_id
  join sources s on s.id = si.source_id
  join user_sources us on us.source_item_id = si.id
  where us.user_id = auth.uid() and b.active
  union
  -- caminho derivado (bandeira): benefit_card_tiers casado por brand/level
  select b.id, si.label,
         s.name, s.source_category,
         si.card_brand, si.card_level
  from benefits b
  join benefit_card_tiers bct on bct.benefit_id = b.id
  join source_items si on si.card_brand = bct.card_brand
                      and si.card_level = bct.card_level
  join sources s on s.id = si.source_id
  join user_sources us on us.source_item_id = si.id
  where us.user_id = auth.uid() and b.active
)
select b.id, b.title, b.summary, b.category, b.scope, b.uf, b.steps,
       b.partner_name, b.valid_until, b.image_url, b.action_url, b.action_label,
       b.created_at, b.source_url, b.source_name, b.observed_at, b.benefit_source,
       array_agg(distinct u.via order by u.via) as via,
       coalesce(
         jsonb_agg(distinct jsonb_build_object(
           'provider', u.provider, 'category', u.source_category)),
         '[]'::jsonb) as origins,
       coalesce(
         jsonb_agg(distinct jsonb_build_object(
           'brand', u.network_brand, 'level', u.network_level))
           filter (where u.network_brand is not null),
         '[]'::jsonb) as networks
from unlocked u join benefits b on b.id = u.benefit_id
group by b.id;
grant select on my_benefits to authenticated;
