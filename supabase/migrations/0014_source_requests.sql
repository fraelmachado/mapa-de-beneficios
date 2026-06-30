-- supabase/migrations/0014_source_requests.sql
-- P3: captura de "Outro" (provedor não-listado) no onboarding. Sinal de demanda
-- para a curadoria do P4 — NÃO referencia source_items e NÃO destrava benefícios.
create table source_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_category source_category not null,
  text text not null check (char_length(text) between 1 and 200),
  created_at timestamptz not null default now()
);

alter table source_requests enable row level security;

-- O RLS faz a aplicação por linha; o grant habilita o role a tocar a tabela
-- (padrão do repo — ver 0003_rls.sql / 0002_user.sql). Sem o grant, o insert/select
-- falha com permissão negada mesmo para o dono.
grant select, insert on source_requests to authenticated;
grant select, insert, update, delete on source_requests to service_role;

-- usuário autenticado (inclusive anônimo) insere apenas em seu próprio nome
create policy "source_requests_own_insert" on source_requests
  for insert to authenticated
  with check (user_id = auth.uid());

-- usuário lê apenas os próprios pedidos
create policy "source_requests_own_select" on source_requests
  for select to authenticated
  using (user_id = auth.uid());

-- admin lê todos (curadoria)
create policy "source_requests_admin_select" on source_requests
  for select to authenticated
  using (public.is_admin());
