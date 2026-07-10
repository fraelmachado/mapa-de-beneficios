# Mapa de Benefícios M1 — Fundação (backend + schema) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status de execução (auditado em 2026-07-10):** implementação concluída no repositório (`9ed6733` a `c5c9428`). O estado cumulativo foi validado pela suíte local (64 arquivos/182 testes) e pelo build. Os checklists abaixo permanecem como roteiro histórico e não foram marcados retroativamente.

**Goal:** Repositório scaffoldado (Vite+React+TS+Tailwind+Vitest) com Supabase local rodando, schema completo via migrations, RLS aplicada e testada, view `my_benefits` e seed do catálogo inicial.

**Architecture:** Backend é Supabase (Postgres). Todo o schema vive em `supabase/migrations/*.sql` versionado pela Supabase CLI. A segurança é garantida por RLS testada com testes de integração (Vitest + @supabase/supabase-js contra a instância local). O front nesta milestone é só o scaffold que builda — telas vêm em M2+.

**Tech Stack:** Vite, React 18, TypeScript, Tailwind, Vitest, @supabase/supabase-js, Supabase CLI (Postgres local via Docker).

**Pré-requisito:** Docker Desktop rodando (necessário para `supabase start`). Node 18+.

**Referência:** spec em `docs/superpowers/specs/2026-06-13-mapa-de-beneficios-mvp-design.md`.

---

## Estrutura de arquivos (criada nesta milestone)

```
package.json                          # deps + scripts
vite.config.ts                        # Vite + Vitest config
tsconfig.json
tailwind.config.js / postcss.config.js
index.html
src/
  main.tsx                            # bootstrap React (placeholder)
  App.tsx                             # placeholder "Mapa de Benefícios"
  index.css                           # diretivas Tailwind
  lib/supabase.ts                     # client tipado
  lib/database.types.ts               # tipos gerados do schema
supabase/
  config.toml                         # gerado pelo `supabase init`
  migrations/
    0001_catalog.sql                  # enums + tabelas de catálogo
    0002_user.sql                     # profiles, user_sources, trigger de signup
    0003_rls.sql                      # RLS + helper is_admin + trigger is_admin imutável
    0004_my_benefits.sql              # view de cruzamento
  seed.sql                            # catálogo inicial curado
tests/
  helpers/clients.ts                  # fábrica de clients (anon/service/user)
  schema.test.ts                      # tabelas existem / inserts via service role
  rls.test.ts                         # políticas RLS
  my_benefits.test.ts                 # cruzamento perfil→benefícios
.env.local                            # SUPABASE_URL + keys (gitignored)
.env.example                          # template commitado
```

---

## Task 1: Scaffold do projeto Vite + Tailwind + Vitest

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.node.json`, `index.html`, `tailwind.config.js`, `postcss.config.js`, `src/main.tsx`, `src/App.tsx`, `src/index.css`, `.gitignore`
- Test: `src/App.test.tsx`

- [ ] **Step 1: Criar o projeto base com o template Vite**

Run:
```bash
npm create vite@latest . -- --template react-ts
npm install
```
Quando perguntar sobre diretório não-vazio, escolha "Ignore files and continue" (já existem `docs/` e `IDEA.md`).

- [ ] **Step 2: Instalar Tailwind, Vitest e Testing Library**

Run:
```bash
npm install -D tailwindcss postcss autoprefixer vitest @testing-library/react @testing-library/jest-dom jsdom @vitejs/plugin-react
npm install @supabase/supabase-js
npx tailwindcss init -p
```

- [ ] **Step 3: Configurar Tailwind**

Edit `tailwind.config.js`:
```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: { extend: {} },
  plugins: [],
}
```

Replace `src/index.css` with:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 4: Configurar Vitest no `vite.config.ts`**

Replace `vite.config.ts`:
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})
```

Create `src/test-setup.ts`:
```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 5: Placeholder do App**

Replace `src/App.tsx`:
```tsx
export default function App() {
  return <h1>Mapa de Benefícios</h1>
}
```

- [ ] **Step 6: Escrever o teste que falha**

Create `src/App.test.tsx`:
```tsx
import { render, screen } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import App from './App'

describe('App', () => {
  it('renderiza o nome do produto', () => {
    render(<App />)
    expect(screen.getByRole('heading', { name: 'Mapa de Benefícios' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 7: Adicionar scripts de teste no `package.json`**

No bloco `"scripts"` do `package.json`, adicione:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 8: Rodar o teste e ver passar**

Run: `npm test`
Expected: 1 arquivo de teste, `App > renderiza o nome do produto` PASS.

- [ ] **Step 9: Garantir `.gitignore`**

Confirme/adicione em `.gitignore`:
```
node_modules
dist
.env.local
.env
supabase/.branches
supabase/.temp
```

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: scaffold Vite+React+TS+Tailwind+Vitest"
```

---

## Task 2: Inicializar Supabase local

**Files:**
- Create: `supabase/config.toml` (gerado), `.env.example`, `.env.local`

- [ ] **Step 1: Inicializar a CLI do Supabase**

Run:
```bash
npx supabase init
```
Aceite os defaults. Isso cria `supabase/config.toml`.

- [ ] **Step 2: Subir a stack local**

Run:
```bash
npx supabase start
```
Expected: ao final imprime `API URL`, `anon key` e `service_role key`. Copie esses valores.
(Se falhar, confirme que o Docker Desktop está rodando.)

- [ ] **Step 3: Criar `.env.example`**

Create `.env.example`:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=
# Usada só por testes/scripts locais, nunca no front:
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 4: Criar `.env.local` com os valores reais**

Create `.env.local` colando os valores do Step 2:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key do output>
SUPABASE_SERVICE_ROLE_KEY=<service_role key do output>
```

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml .env.example .gitignore
git commit -m "chore: inicializa Supabase local"
```

---

## Task 3: Migration do catálogo (enums + tabelas)

**Files:**
- Create: `supabase/migrations/0001_catalog.sql`
- Create: `tests/helpers/clients.ts`, `tests/schema.test.ts`

- [ ] **Step 1: Fábrica de clients para testes**

Create `tests/helpers/clients.ts`:
```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL!
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export function anonClient(): SupabaseClient {
  return createClient(url, anonKey)
}

export function serviceClient(): SupabaseClient {
  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// Cria um usuário confirmado e devolve um client autenticado como ele.
export async function userClient(): Promise<{ client: SupabaseClient; id: string }> {
  const admin = serviceClient()
  const email = `u${Date.now()}-${Math.floor(performance.now() * 1000)}@test.dev`
  const password = 'test-password-123'
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (error) throw error
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password })
  if (signInErr) throw signInErr
  return { client, id: data.user!.id }
}
```

Carregue o `.env.local` nos testes — edite `src/test-setup.ts`:
```ts
import '@testing-library/jest-dom'
import { config } from 'dotenv'
config({ path: '.env.local' })
```
Run: `npm install -D dotenv`

- [ ] **Step 2: Escrever o teste de schema que falha**

Create `tests/schema.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { serviceClient } from './helpers/clients'

describe('catalog schema', () => {
  it('insere source + source_item + benefit + mapping + location', async () => {
    const db = serviceClient()

    const { data: src, error: e1 } = await db
      .from('sources')
      .insert({ kind: 'card', name: 'TestBank', sort_order: 1 })
      .select()
      .single()
    expect(e1).toBeNull()

    const { data: item, error: e2 } = await db
      .from('source_items')
      .insert({ source_id: src!.id, label: 'Black', sort_order: 1 })
      .select()
      .single()
    expect(e2).toBeNull()

    const { data: ben, error: e3 } = await db
      .from('benefits')
      .insert({
        title: 'Sala VIP',
        summary: 'Acesso gratuito',
        category: 'viagem',
        scope: 'pontual',
      })
      .select()
      .single()
    expect(e3).toBeNull()

    const { error: e4 } = await db
      .from('benefit_sources')
      .insert({ benefit_id: ben!.id, source_item_id: item!.id })
    expect(e4).toBeNull()

    const { error: e5 } = await db.from('benefit_locations').insert({
      benefit_id: ben!.id,
      name: 'GRU T2',
      lat: -23.43,
      lng: -46.47,
    })
    expect(e5).toBeNull()

    // cleanup
    await db.from('sources').delete().eq('id', src!.id)
    await db.from('benefits').delete().eq('id', ben!.id)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- tests/schema.test.ts`
Expected: FAIL — relações `sources`/`benefits` não existem.

- [ ] **Step 4: Escrever a migration do catálogo**

Create `supabase/migrations/0001_catalog.sql`:
```sql
create type source_kind as enum ('card', 'carrier', 'loyalty', 'cpf');
create type benefit_category as enum ('viagem', 'entretenimento', 'saude', 'seguros', 'compras');
create type benefit_scope as enum ('nacional', 'regional', 'pontual');

create table sources (
  id uuid primary key default gen_random_uuid(),
  kind source_kind not null,
  name text not null,
  logo_url text,
  sort_order int not null default 0,
  active boolean not null default true
);

create table source_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references sources(id) on delete cascade,
  label text not null,
  sort_order int not null default 0
);

create table benefits (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null,
  category benefit_category not null,
  scope benefit_scope not null default 'nacional',
  uf text,
  steps text,
  partner_name text,
  valid_until date,
  image_url text,
  action_url text,
  action_label text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table benefit_sources (
  benefit_id uuid not null references benefits(id) on delete cascade,
  source_item_id uuid not null references source_items(id) on delete cascade,
  primary key (benefit_id, source_item_id)
);

create table benefit_locations (
  id uuid primary key default gen_random_uuid(),
  benefit_id uuid not null references benefits(id) on delete cascade,
  name text not null,
  lat double precision not null,
  lng double precision not null,
  address text,
  city text,
  uf text,
  radius_m int,
  active boolean not null default true
);

create index on source_items (source_id);
create index on benefit_sources (source_item_id);
create index on benefit_locations (benefit_id);
```

- [ ] **Step 5: Aplicar a migration resetando o banco local**

Run:
```bash
npx supabase db reset
```
Expected: aplica `0001_catalog.sql` sem erros.

- [ ] **Step 6: Rodar o teste e ver passar**

Run: `npm test -- tests/schema.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0001_catalog.sql tests/ src/test-setup.ts package.json package-lock.json
git commit -m "feat: schema do catálogo (sources, benefits, locations)"
```

---

## Task 4: Migration das tabelas de usuário + trigger de signup

**Files:**
- Create: `supabase/migrations/0002_user.sql`
- Test: `tests/schema.test.ts` (adiciona caso)

- [ ] **Step 1: Adicionar teste que falha (profile criado no signup)**

Append em `tests/schema.test.ts`, dentro do `describe`:
```ts
  it('cria profile automaticamente ao criar usuário', async () => {
    const { userClient } = await import('./helpers/clients')
    const { id } = await userClient()
    const db = serviceClient()
    const { data, error } = await db
      .from('profiles')
      .select('id, is_admin')
      .eq('id', id)
      .single()
    expect(error).toBeNull()
    expect(data!.is_admin).toBe(false)
  })
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/schema.test.ts`
Expected: FAIL — relação `profiles` não existe.

- [ ] **Step 3: Escrever a migration de usuário**

Create `supabase/migrations/0002_user.sql`:
```sql
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
```

- [ ] **Step 4: Resetar e aplicar**

Run: `npx supabase db reset`
Expected: aplica 0001 e 0002 sem erros.

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npm test -- tests/schema.test.ts`
Expected: ambos os casos PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0002_user.sql tests/schema.test.ts
git commit -m "feat: tabelas de usuário (profiles, user_sources) + trigger de signup"
```

---

## Task 5: RLS — políticas + admin helper + is_admin imutável

**Files:**
- Create: `supabase/migrations/0003_rls.sql`
- Create: `tests/rls.test.ts`

- [ ] **Step 1: Escrever os testes de RLS que falham**

Create `tests/rls.test.ts`:
```ts
import { describe, it, expect, beforeAll } from 'vitest'
import { serviceClient, userClient, anonClient } from './helpers/clients'

let itemId: string

beforeAll(async () => {
  const db = serviceClient()
  const { data: src } = await db
    .from('sources')
    .insert({ kind: 'loyalty', name: 'RLSProg', sort_order: 99 })
    .select()
    .single()
  const { data: item } = await db
    .from('source_items')
    .insert({ source_id: src!.id, label: '—', sort_order: 1 })
    .select()
    .single()
  itemId = item!.id
})

describe('RLS catálogo', () => {
  it('usuário autenticado lê o catálogo', async () => {
    const { client } = await userClient()
    const { data, error } = await client.from('sources').select('id').limit(1)
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  it('usuário comum NÃO escreve no catálogo', async () => {
    const { client } = await userClient()
    const { error } = await client
      .from('sources')
      .insert({ kind: 'card', name: 'Hacker', sort_order: 1 })
    expect(error).not.toBeNull()
  })
})

describe('RLS user_sources', () => {
  it('usuário só enxerga as próprias seleções', async () => {
    const a = await userClient()
    const b = await userClient()
    await a.client.from('user_sources').insert({ user_id: a.id, source_item_id: itemId })
    await b.client.from('user_sources').insert({ user_id: b.id, source_item_id: itemId })

    const { data } = await a.client.from('user_sources').select('user_id')
    expect(data!.every((r) => r.user_id === a.id)).toBe(true)
  })
})

describe('RLS is_admin imutável', () => {
  it('usuário não consegue se auto-promover a admin', async () => {
    const { client, id } = await userClient()
    const { error } = await client.from('profiles').update({ is_admin: true }).eq('id', id)
    expect(error).not.toBeNull()

    const db = serviceClient()
    const { data } = await db.from('profiles').select('is_admin').eq('id', id).single()
    expect(data!.is_admin).toBe(false)
  })

  it('usuário consegue atualizar o próprio display_name', async () => {
    const { client, id } = await userClient()
    const { error } = await client
      .from('profiles')
      .update({ display_name: 'Fulano' })
      .eq('id', id)
    expect(error).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/rls.test.ts`
Expected: FAIL — sem RLS, escrita do "hacker" é permitida e a auto-promoção não dá erro.

- [ ] **Step 3: Escrever a migration de RLS**

Create `supabase/migrations/0003_rls.sql`:
```sql
-- Helper: o usuário atual é admin?
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

-- is_admin imutável por não-admin (RLS não filtra coluna; usamos trigger)
create function protect_is_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_admin is distinct from old.is_admin and not public.is_admin() then
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
```

- [ ] **Step 4: Resetar e aplicar**

Run: `npx supabase db reset`
Expected: aplica 0001–0003 sem erros.

- [ ] **Step 5: Rodar os testes e ver passar**

Run: `npm test -- tests/rls.test.ts`
Expected: todos PASS.

- [ ] **Step 6: Garantir que o schema.test ainda passa**

Run: `npm test -- tests/schema.test.ts`
Expected: PASS (inserts de schema usam service role, que ignora RLS).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0003_rls.sql tests/rls.test.ts
git commit -m "feat: RLS do catálogo, profiles e user_sources + is_admin imutável"
```

---

## Task 6: View `my_benefits` (cruzamento)

**Files:**
- Create: `supabase/migrations/0004_my_benefits.sql`
- Create: `tests/my_benefits.test.ts`

- [ ] **Step 1: Escrever o teste de cruzamento que falha**

Create `tests/my_benefits.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { serviceClient, userClient } from './helpers/clients'

async function seedBenefit(itemLabel: string) {
  const db = serviceClient()
  const { data: src } = await db
    .from('sources')
    .insert({ kind: 'card', name: `MB-${itemLabel}-${Date.now()}`, sort_order: 1 })
    .select()
    .single()
  const { data: item } = await db
    .from('source_items')
    .insert({ source_id: src!.id, label: itemLabel, sort_order: 1 })
    .select()
    .single()
  const { data: ben } = await db
    .from('benefits')
    .insert({ title: `Benefício ${itemLabel}`, summary: 's', category: 'compras' })
    .select()
    .single()
  await db.from('benefit_sources').insert({ benefit_id: ben!.id, source_item_id: item!.id })
  return { itemId: item!.id, benefitId: ben!.id }
}

describe('my_benefits', () => {
  it('mostra só benefícios cujas fontes o usuário marcou, com o selo via', async () => {
    const mine = await seedBenefit('Black')
    const other = await seedBenefit('Gold') // usuário NÃO terá esse

    const { client, id } = await userClient()
    await client.from('user_sources').insert({ user_id: id, source_item_id: mine.itemId })

    const { data, error } = await client.from('my_benefits').select('id, via')
    expect(error).toBeNull()
    const ids = data!.map((r) => r.id)
    expect(ids).toContain(mine.benefitId)
    expect(ids).not.toContain(other.benefitId)
    const row = data!.find((r) => r.id === mine.benefitId)
    expect(row!.via).toBe('Black')
  })

  it('não vaza benefícios de um usuário para outro', async () => {
    const mine = await seedBenefit('Platinum')
    const a = await userClient()
    const b = await userClient()
    await a.client.from('user_sources').insert({ user_id: a.id, source_item_id: mine.itemId })

    const { data } = await b.client.from('my_benefits').select('id')
    expect(data!.map((r) => r.id)).not.toContain(mine.benefitId)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test -- tests/my_benefits.test.ts`
Expected: FAIL — relação `my_benefits` não existe.

- [ ] **Step 3: Escrever a migration da view**

Create `supabase/migrations/0004_my_benefits.sql`:
```sql
-- security_invoker = true: a RLS das tabelas-base é avaliada como o usuário
-- que consulta, então user_sources já filtra por auth.uid() naturalmente.
create view my_benefits with (security_invoker = true) as
select distinct
  b.id,
  b.title,
  b.summary,
  b.category,
  b.scope,
  b.uf,
  b.steps,
  b.partner_name,
  b.valid_until,
  b.image_url,
  b.action_url,
  b.action_label,
  b.created_at,
  si.label as via,
  si.id as via_source_item_id
from benefits b
join benefit_sources bs on bs.benefit_id = b.id
join source_items si on si.id = bs.source_item_id
join user_sources us on us.source_item_id = si.id
where us.user_id = auth.uid() and b.active;
```
Nota: se o usuário tiver dois source_items que destravam o mesmo benefício, ele
aparece uma vez por fonte (uma linha por `via`). Dedup por benefício, se desejado,
fica a cargo do app em M3 — comportamento aceitável e intencional no MVP.

- [ ] **Step 4: Resetar e aplicar**

Run: `npx supabase db reset`
Expected: aplica 0001–0004 sem erros.

- [ ] **Step 5: Rodar o teste e ver passar**

Run: `npm test -- tests/my_benefits.test.ts`
Expected: todos PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0004_my_benefits.sql tests/my_benefits.test.ts
git commit -m "feat: view my_benefits (cruzamento perfil x benefícios)"
```

---

## Task 7: Seed do catálogo inicial

**Files:**
- Create: `supabase/seed.sql`
- Test: `tests/my_benefits.test.ts` (adiciona smoke test do seed)

- [ ] **Step 1: Escrever o seed inicial**

Create `supabase/seed.sql` (catálogo mínimo real para validar o app de ponta a ponta; expandido depois junto com o usuário):
```sql
-- Fontes
insert into sources (id, kind, name, sort_order) values
  ('11111111-1111-1111-1111-111111111111', 'card', 'Itaú', 1),
  ('22222222-2222-2222-2222-222222222222', 'carrier', 'Claro', 2),
  ('33333333-3333-3333-3333-333333333333', 'loyalty', 'Livelo', 3);

-- Folhas selecionáveis
insert into source_items (id, source_id, label, sort_order) values
  ('aaaaaaa1-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Black/Infinite', 1),
  ('aaaaaaa1-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Platinum', 2),
  ('bbbbbbb2-0000-0000-0000-000000000001', '22222222-2222-2222-2222-222222222222', 'Pós', 1),
  ('ccccccc3-0000-0000-0000-000000000001', '33333333-3333-3333-3333-333333333333', '—', 1);

-- Benefícios
insert into benefits (id, title, summary, category, scope, partner_name, steps, action_label) values
  ('d0000001-0000-0000-0000-000000000001', 'Sala VIP em Guarulhos', 'Acesso gratuito à sala VIP do aeroporto.', 'viagem', 'pontual', 'Mastercard', '1. Apresente seu cartão na entrada da sala.', 'Ver salas'),
  ('d0000001-0000-0000-0000-000000000002', '50% no Cinemark', 'Metade do preço no ingresso de cinema.', 'entretenimento', 'nacional', 'Cinemark', '1. Compre pelo site oficial usando o cartão elegível.', 'Comprar'),
  ('d0000001-0000-0000-0000-000000000003', 'Streaming incluso', 'Uma assinatura de streaming à sua escolha.', 'entretenimento', 'nacional', 'Claro', '1. Ative no app da operadora.', 'Ativar');

-- Mapeamento benefício -> folha
insert into benefit_sources (benefit_id, source_item_id) values
  ('d0000001-0000-0000-0000-000000000001', 'aaaaaaa1-0000-0000-0000-000000000001'),
  ('d0000001-0000-0000-0000-000000000002', 'aaaaaaa1-0000-0000-0000-000000000001'),
  ('d0000001-0000-0000-0000-000000000002', 'aaaaaaa1-0000-0000-0000-000000000002'),
  ('d0000001-0000-0000-0000-000000000003', 'bbbbbbb2-0000-0000-0000-000000000001');

-- Local físico de exemplo (geo capturado já)
insert into benefit_locations (benefit_id, name, lat, lng, city, uf) values
  ('d0000001-0000-0000-0000-000000000001', 'Sala VIP GRU Terminal 2', -23.4356, -46.4731, 'Guarulhos', 'SP');
```

- [ ] **Step 2: Aplicar o seed via reset**

Run: `npx supabase db reset`
Expected: aplica migrations e roda `seed.sql` sem erros (a CLI executa `seed.sql` automaticamente no reset).

- [ ] **Step 3: Escrever smoke test do seed**

Append em `tests/my_benefits.test.ts`, dentro do `describe('my_benefits', ...)`:
```ts
  it('seed: usuário com Itaú Black vê 2 benefícios', async () => {
    const { client, id } = await userClient()
    await client
      .from('user_sources')
      .insert({ user_id: id, source_item_id: 'aaaaaaa1-0000-0000-0000-000000000001' })
    const { data, error } = await client
      .from('my_benefits')
      .select('id')
      .in('id', [
        'd0000001-0000-0000-0000-000000000001',
        'd0000001-0000-0000-0000-000000000002',
      ])
    expect(error).toBeNull()
    expect(data!.length).toBe(2)
  })
```

- [ ] **Step 4: Rodar o teste e ver passar**

Run: `npm test -- tests/my_benefits.test.ts`
Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql tests/my_benefits.test.ts
git commit -m "feat: seed do catálogo inicial"
```

---

## Task 8: Client Supabase tipado

**Files:**
- Create: `src/lib/supabase.ts`, `src/lib/database.types.ts`
- Test: `src/lib/supabase.test.ts`

- [ ] **Step 1: Gerar os tipos do schema**

Run:
```bash
npx supabase gen types typescript --local > src/lib/database.types.ts
```
Expected: arquivo com `export type Database = {...}` contendo as tabelas e a view.

- [ ] **Step 2: Escrever o teste que falha**

Create `src/lib/supabase.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { supabase } from './supabase'

describe('supabase client', () => {
  it('expõe um client configurado com a URL do env', () => {
    expect(supabase).toBeDefined()
    expect(typeof supabase.from).toBe('function')
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npm test -- src/lib/supabase.test.ts`
Expected: FAIL — módulo `./supabase` não existe.

- [ ] **Step 4: Criar o client**

Create `src/lib/supabase.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórios')
}

export const supabase = createClient<Database>(url, anonKey)
```

- [ ] **Step 5: Garantir env nos testes Vite**

Como os testes do front leem `import.meta.env`, exponha as vars. Crie `.env.test` (commitável, valores locais não-secretos do anon local):
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<anon key local>
```
Vitest carrega `.env.test` automaticamente (modo `test`). O anon key local do Supabase não é secreto (é o mesmo fixo para todo ambiente local), então pode commitar.

- [ ] **Step 6: Rodar o teste e ver passar**

Run: `npm test -- src/lib/supabase.test.ts`
Expected: PASS.

- [ ] **Step 7: Rodar a suíte inteira**

Run: `npm test`
Expected: todos os arquivos de teste PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/ .env.test
git commit -m "feat: client Supabase tipado"
```

---

## Definition of Done (M1)

- [ ] `npm test` passa inteiro (schema, RLS, my_benefits, seed, client).
- [ ] `npx supabase db reset` aplica 0001–0004 + seed sem erros.
- [ ] RLS comprovadamente bloqueia: escrita de catálogo por não-admin, auto-promoção a admin, e vazamento de `user_sources`/`my_benefits` entre usuários.
- [ ] `src/lib/supabase.ts` e tipos gerados disponíveis para M2.
- [ ] App scaffold builda (`npm run build`).

**Próximo:** plano do M2 (casca do app + auth anônimo + onboarding).
```
