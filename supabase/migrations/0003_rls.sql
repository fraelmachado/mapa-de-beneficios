-- Helper: o usuário atual é admin? (security definer -> roda como owner e
-- ignora RLS de profiles, evitando recursão de política)
create function is_admin()
returns boolean
language sql
security definer
stable
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and is_admin
  );
$$;

-- Grants ao authenticated (config local não concede default). RLS abaixo faz a
-- aplicação por linha; o grant só habilita o role a tocar a tabela.
grant select, insert, update, delete on
  sources, source_items, benefits, benefit_sources, benefit_locations, user_sources
  to authenticated;
grant select, update on profiles to authenticated;

-- Habilitar RLS
alter table sources enable row level security;
alter table source_items enable row level security;
alter table benefits enable row level security;
alter table benefit_sources enable row level security;
alter table benefit_locations enable row level security;
alter table profiles enable row level security;
alter table user_sources enable row level security;

-- Catálogo: leitura para qualquer autenticado, escrita só admin
create policy "sources read" on sources for select to authenticated using (true);
create policy "sources admin" on sources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "source_items read" on source_items for select to authenticated using (true);
create policy "source_items admin" on source_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "benefits read" on benefits for select to authenticated using (true);
create policy "benefits admin" on benefits for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "benefit_sources read" on benefit_sources for select to authenticated using (true);
create policy "benefit_sources admin" on benefit_sources for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "benefit_locations read" on benefit_locations for select to authenticated using (true);
create policy "benefit_locations admin" on benefit_locations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- profiles: dono lê o seu (admin lê todos); dono atualiza o seu
create policy "profiles select" on profiles for select to authenticated
  using (id = auth.uid() or public.is_admin());
create policy "profiles update" on profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- is_admin imutável por usuários comuns. security invoker para que current_user
-- reflita o role real do chamador; roles de backend privilegiados e admins podem
-- alterar (necessário para criar o primeiro admin via service role / SQL).
create function protect_is_admin()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.is_admin is distinct from old.is_admin
     and not public.is_admin()
     and current_user not in ('service_role', 'postgres', 'supabase_admin') then
    raise exception 'cannot modify is_admin';
  end if;
  return new;
end;
$$;

create trigger profiles_protect_is_admin
  before update on profiles
  for each row execute function protect_is_admin();

-- user_sources: dono faz tudo só no que é dele
create policy "user_sources own" on user_sources for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
