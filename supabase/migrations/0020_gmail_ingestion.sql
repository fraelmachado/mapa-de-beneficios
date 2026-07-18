-- supabase/migrations/0020_gmail_ingestion.sql
-- Ingestão real via Gmail: domínios de match no catálogo + evidência do e-mail
-- que atribuiu cada programa. Ver spec 2026-07-18-ingestao-gmail-real-design.md.

-- 1. Domínios de remetente por marca (autoridade = seed).
alter table sources add column match_domains text[] not null default '{}';

-- 2. Evidência: qual e-mail atribuiu qual programa (proveniência + base p/ futuro).
create table source_evidence (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_id        uuid not null references sources(id) on delete cascade,
  gmail_account    text not null,
  gmail_message_id text not null,
  email_from       text not null,
  email_subject    text,
  email_date       timestamptz,
  created_at       timestamptz not null default now(),
  unique (user_id, gmail_account, source_id, gmail_message_id)
);

create index on source_evidence (user_id);

alter table source_evidence enable row level security;

-- grant habilita o role; o RLS aplica por linha (padrão do repo — 0014/0019).
grant select, insert, delete on source_evidence to authenticated;
grant select, insert, update, delete on source_evidence to service_role;

-- usuário autenticado (inclusive anônimo) gerencia só as próprias evidências
create policy "source_evidence_own" on source_evidence for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 3. Grava seleção + evidência numa única transação (atômico, aditivo, idempotente).
-- security invoker: RLS de user_sources/source_evidence se aplica; user_id = auth.uid().
create function add_gmail_sources(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare rec jsonb;
begin
  for rec in select value from jsonb_array_elements(payload) as value loop
    -- aditivo: não remove seleções anteriores, não duplica
    insert into public.user_sources (user_id, source_item_id)
    values (auth.uid(), (rec->>'item_id')::uuid)
    on conflict (user_id, source_item_id) do nothing;

    -- idempotente: rescan da mesma mensagem não duplica evidência
    insert into public.source_evidence
      (user_id, source_id, gmail_account, gmail_message_id, email_from, email_subject, email_date)
    values (
      auth.uid(), (rec->>'source_id')::uuid, rec->>'gmail_account', rec->>'gmail_message_id',
      rec->>'email_from', rec->>'email_subject', (rec->>'email_date')::timestamptz
    )
    on conflict (user_id, gmail_account, source_id, gmail_message_id) do nothing;
  end loop;
end;
$$;

grant execute on function add_gmail_sources(jsonb) to authenticated;

-- 4. Retenção: evidência de usuário AINDA anônimo expira em 30 dias.
-- Só a proveniência some; user_sources (os programas) permanecem.
-- Requer pg_cron no Supabase self-hosted. Se indisponível em produção, agendar
-- o mesmo DELETE via task do Dokploy chamando pg-meta /pg/query (service_role).
-- Ver spec: seção "Modelo de dados" e memória mapa-de-beneficios-prod-supabase-ops.
create extension if not exists pg_cron;

select cron.schedule(
  'source_evidence_anon_retention',
  '17 4 * * *',
  $$
    delete from public.source_evidence e
    using auth.users u
    where e.user_id = u.id
      and u.is_anonymous
      and e.created_at < now() - interval '30 days'
  $$
);
