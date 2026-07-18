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
