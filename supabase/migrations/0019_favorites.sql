-- Salvar/favoritar benefício (mockup Tela 05 — botão bookmark no header do detalhe).
create table favorites (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  benefit_id uuid not null references benefits(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, benefit_id)
);

alter table favorites enable row level security;

-- grant habilita o role a tocar a tabela; o RLS faz a aplicação por linha
-- (padrão do repo — ver 0003_rls.sql / 0014_source_requests.sql).
grant select, insert, delete on favorites to authenticated;
grant select, insert, update, delete on favorites to service_role;

-- usuário autenticado (inclusive anônimo) gerencia apenas os próprios favoritos
create policy "favorites_own" on favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
