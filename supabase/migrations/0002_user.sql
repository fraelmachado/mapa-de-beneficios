create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table user_sources (
  user_id uuid not null references auth.users(id) on delete cascade,
  source_item_id uuid not null references source_items(id) on delete cascade,
  primary key (user_id, source_item_id)
);

create index on user_sources (source_item_id);

-- Cria profile automaticamente quando um auth.user é criado
create function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Mesma necessidade da Task 3: conceder DML ao service_role (config local
-- não concede default). authenticated será tratado na migration de RLS.
grant select, insert, update, delete on profiles, user_sources to service_role;
