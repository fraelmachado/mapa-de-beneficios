grant select, insert, update, delete on benefit_card_tiers to authenticated;

alter table benefit_card_tiers enable row level security;

create policy "benefit_card_tiers read" on benefit_card_tiers
  for select to authenticated using (true);
create policy "benefit_card_tiers admin" on benefit_card_tiers
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
