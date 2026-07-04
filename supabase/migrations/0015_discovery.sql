-- P4: staging de discovery (fila de revisão humana). O catálogo real nunca recebe
-- escrita de máquina sem aprovação. Ver
-- docs/superpowers/specs/2026-06-28-mapa-de-beneficios-p4-autodiscover-catalogo-design.md

create type discovery_job_status  as enum ('pending', 'processing', 'done', 'error');
create type discovery_entity_type as enum ('source', 'source_item', 'benefit');
create type discovery_match_status as enum ('new', 'update', 'duplicate');
create type discovery_review_status as enum ('pending', 'approved', 'rejected');

create table discovery_jobs (
  id         uuid primary key default gen_random_uuid(),
  brief      text not null,
  status     discovery_job_status not null default 'pending',
  claimed_at timestamptz,
  claimed_by text,
  error      text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table discovery_candidates (
  id                 uuid primary key default gen_random_uuid(),
  job_id             uuid not null references discovery_jobs(id) on delete cascade,
  entity_type        discovery_entity_type not null,
  fingerprint        text not null unique,
  parent_fingerprint text,
  payload            jsonb not null default '{}'::jsonb,
  provenance         jsonb not null default '{}'::jsonb,
  match_status       discovery_match_status not null default 'new',
  matched_id         uuid,
  review_status      discovery_review_status not null default 'pending',
  reviewed_by        uuid references auth.users(id) on delete set null,
  promoted_id        uuid,
  promoted_at        timestamptz,
  created_at         timestamptz not null default now()
);

create index on discovery_candidates (job_id);
create index on discovery_candidates (parent_fingerprint);

-- Grants: service_role faz tudo (script); admins gerenciam pela UI sob RLS.
grant select, insert, update, delete on discovery_jobs, discovery_candidates to service_role;
grant select, insert, update, delete on discovery_jobs, discovery_candidates to authenticated;

alter table discovery_jobs enable row level security;
alter table discovery_candidates enable row level security;

-- Só admin toca a fila (mesmo padrão de 0003_rls.sql).
create policy "discovery_jobs admin" on discovery_jobs for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy "discovery_candidates admin" on discovery_candidates for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Claim atômico: N processos podem chamar em paralelo sem pegar o mesmo job.
-- security invoker: service_role (o único chamador no v1) já tem acesso à tabela.
create function claim_discovery_job(worker text)
returns setof discovery_jobs
language sql
as $$
  update discovery_jobs
     set status = 'processing', claimed_at = now(), claimed_by = worker
   where id = (
     select id from discovery_jobs
      where status = 'pending'
      order by created_at
      for update skip locked
      limit 1
   )
  returning *;
$$;

grant execute on function claim_discovery_job(text) to service_role;
