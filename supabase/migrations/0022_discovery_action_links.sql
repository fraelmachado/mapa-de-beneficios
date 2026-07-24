create or replace function public.promote_discovery_candidate(candidate_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c            public.discovery_candidates;
  parent       public.discovery_candidates;
  parent_id    uuid;
  new_id       uuid;
  p            jsonb;
  prov         jsonb;
  tier         jsonb;
  action_url   text;
  action_label text;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into c
  from public.discovery_candidates
  where id = candidate_id
  for update;

  if not found then
    raise exception 'candidate not found';
  end if;

  if c.promoted_id is not null then
    return c.promoted_id;
  end if;

  p := c.payload;
  prov := c.provenance;

  if c.parent_fingerprint is not null then
    select * into parent
    from public.discovery_candidates
    where fingerprint = c.parent_fingerprint;

    if found then
      parent_id := coalesce(parent.promoted_id, parent.matched_id);
    end if;
    if parent_id is null then
      raise exception 'parent % not promoted yet', c.parent_fingerprint;
    end if;
  end if;

  if c.entity_type = 'source' then
    insert into public.sources (slug, name, source_category, kind)
    values (
      p->>'slug',
      p->>'name',
      (p->>'source_category')::public.source_category,
      coalesce((p->>'kind')::public.source_kind, 'card')
    )
    on conflict (slug) do update set
      name = excluded.name,
      source_category = excluded.source_category
    returning id into new_id;

  elsif c.entity_type = 'source_item' then
    insert into public.source_items (
      slug, source_id, label, display_name, card_brand, card_level, product_type,
      source_url, verification_status
    )
    values (
      p->>'slug',
      parent_id,
      p->>'label',
      p->>'display_name',
      p->>'card_brand',
      p->>'card_level',
      p->>'product_type',
      prov->>'source_url',
      (prov->>'verification_status')::public.verification_status
    )
    on conflict (slug) do update set
      label = excluded.label
    returning id into new_id;

  elsif c.entity_type = 'benefit' then
    action_url := nullif(
      regexp_replace(coalesce(p->>'action_url', ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'),
      ''
    );
    action_label := nullif(
      regexp_replace(coalesce(p->>'action_label', ''), '^[[:space:]]+|[[:space:]]+$', '', 'g'),
      ''
    );

    if (action_url is null) <> (action_label is null) then
      raise exception 'invalid action link: action_url and action_label must be provided together'
        using errcode = '22023';
    end if;

    if action_url is not null
      and action_url !~ '^https?://[^[:space:]/?#]+[^[:space:]]*$'
    then
      raise exception 'invalid action link: action_url must be a canonical HTTP(S) URL'
        using errcode = '22023';
    end if;

    insert into public.benefits as existing (
      slug, title, summary, category, scope, active, redemption_type, benefit_source,
      long_description, program, source_url, source_name, observed_at, verification_status,
      action_url, action_label
    )
    values (
      p->>'slug', p->>'title', p->>'summary', (p->>'category')::public.benefit_category,
      coalesce((p->>'scope')::public.benefit_scope, 'nacional'), false,
      (p->>'redemption_type')::public.redemption_type,
      (p->>'benefit_source')::public.benefit_source_kind,
      p->>'long_description', p->>'program', prov->>'source_url', prov->>'source_name',
      (prov->>'observed_at')::date, (prov->>'verification_status')::public.verification_status,
      action_url, action_label
    )
    on conflict (slug) do update set
      title = excluded.title,
      summary = excluded.summary,
      action_url = case
        when excluded.action_url is not null and excluded.action_label is not null
          then excluded.action_url
        else existing.action_url
      end,
      action_label = case
        when excluded.action_url is not null and excluded.action_label is not null
          then excluded.action_label
        else existing.action_label
      end
    returning id into new_id;

    insert into public.benefit_sources (benefit_id, source_item_id)
    values (new_id, parent_id)
    on conflict do nothing;

    for tier in
      select * from jsonb_array_elements(coalesce(p->'card_tiers', '[]'::jsonb))
    loop
      insert into public.benefit_card_tiers (benefit_id, card_brand, card_level)
      values (new_id, tier->>'card_brand', tier->>'card_level')
      on conflict do nothing;
    end loop;
  end if;

  update public.discovery_candidates
  set
    promoted_id = new_id,
    promoted_at = now(),
    review_status = 'approved'
  where id = candidate_id;

  return new_id;
end;
$$;

grant execute on function public.promote_discovery_candidate(uuid) to authenticated;
grant execute on function public.promote_discovery_candidate(uuid) to service_role;
