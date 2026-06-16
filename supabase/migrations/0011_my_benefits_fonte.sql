-- M8a: expõe fonte/data de coleta em my_benefits. Aditiva: só recria a view
-- (security_invoker mantido; RLS das tabelas-base inalterada).
drop view if exists my_benefits;
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
       b.created_at, b.source_url, b.source_name, b.observed_at,
       array_agg(distinct u.via order by u.via) as via
from unlocked u join benefits b on b.id = u.benefit_id
group by b.id;
grant select on my_benefits to authenticated;
