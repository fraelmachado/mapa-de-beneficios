-- security_invoker = true: a RLS das tabelas-base é avaliada como o usuário que
-- consulta, então user_sources já filtra por auth.uid() naturalmente.
create view my_benefits with (security_invoker = true) as
select distinct
  b.id,
  b.title,
  b.summary,
  b.category,
  b.scope,
  b.uf,
  b.steps,
  b.partner_name,
  b.valid_until,
  b.image_url,
  b.action_url,
  b.action_label,
  b.created_at,
  si.label as via,
  si.id as via_source_item_id
from benefits b
join benefit_sources bs on bs.benefit_id = b.id
join source_items si on si.id = bs.source_item_id
join user_sources us on us.source_item_id = si.id
where us.user_id = auth.uid() and b.active;

-- Quirk local: a view precisa de grant explícito.
grant select on my_benefits to authenticated;
