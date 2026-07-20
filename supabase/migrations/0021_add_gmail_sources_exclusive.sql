-- supabase/migrations/0021_add_gmail_sources_exclusive.sql
-- add_gmail_sources: um tier por marca. Antes de inserir o item escolhido,
-- remove os IRMÃOS (mesmo source_id, derivado do próprio item) que o usuário tenha.
-- Mantém aditividade ENTRE marcas e idempotência da evidência.
create or replace function add_gmail_sources(payload jsonb)
returns void language plpgsql security invoker set search_path = '' as $fn$
declare rec jsonb;
begin
  for rec in select value from jsonb_array_elements(payload) as value loop
    -- exclusividade por marca: apaga tiers irmãos do usuário
    delete from public.user_sources us
    using public.source_items si, public.source_items chosen
    where us.user_id = auth.uid()
      and us.source_item_id = si.id
      and chosen.id = (rec->>'item_id')::uuid
      and si.source_id = chosen.source_id
      and us.source_item_id <> chosen.id;

    insert into public.user_sources (user_id, source_item_id)
    values (auth.uid(), (rec->>'item_id')::uuid)
    on conflict (user_id, source_item_id) do nothing;

    -- source_id da evidência DERIVADO do item (não confia no payload)
    insert into public.source_evidence
      (user_id, source_id, gmail_account, gmail_message_id, email_from, email_subject, email_date)
    values (auth.uid(),
            (select si.source_id from public.source_items si where si.id = (rec->>'item_id')::uuid),
            rec->>'gmail_account', rec->>'gmail_message_id',
            rec->>'email_from', rec->>'email_subject', (rec->>'email_date')::timestamptz)
    on conflict (user_id, gmail_account, source_id, gmail_message_id) do nothing;
  end loop;
end;
$fn$;
grant execute on function add_gmail_sources(jsonb) to authenticated;

-- limpeza única (retroativa): colapsa tiers duplicados por (user, marca),
-- mantendo o de maior sort_order (desempate por id). Impõe o invariante "1 tier/marca".
delete from public.user_sources us
using public.source_items si
where us.source_item_id = si.id
  and exists (
    select 1 from public.user_sources us2
    join public.source_items si2 on si2.id = us2.source_item_id
    where us2.user_id = us.user_id and si2.source_id = si.source_id
      and (si2.sort_order > si.sort_order
           or (si2.sort_order = si.sort_order and us2.source_item_id > us.source_item_id))
  );
