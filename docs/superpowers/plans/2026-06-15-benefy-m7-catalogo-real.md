# M7 — Schema real + catálogo Nubank/Inter/XP + bandeiras — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir o seed demo pelo catálogo real (Nubank/Inter/XP + bandeiras Mastercard/Visa), estendendo o schema para acomodar os dados e fazendo benefícios de bandeira serem herdados por `(card_brand, card_level)`.

**Architecture:** Reaproveita o backbone existente (`sources → source_items → benefits` + `benefit_sources` + `user_sources` + view `my_benefits`). Adiciona colunas de compliance, recria o enum de categoria com 16 chaves técnicas, e introduz `benefit_card_tiers` para herança de bandeira. A `my_benefits` passa a unir dois caminhos: direto (emissor via `benefit_sources`) e derivado (bandeira via brand/level). Backend + catálogo apenas; sem UI de compliance (M8).

**Tech Stack:** Supabase (Postgres, RLS, PostgREST), SQL migrations, `seed.sql`, Vitest (testes de integração contra Supabase local), React + TypeScript (apenas labels de categoria).

**Spec:** `docs/superpowers/specs/2026-06-15-benefy-m7-catalogo-real-design.md`
**Catálogo-fonte:** `docs/superpowers/prompt_agente_mvp_beneficios_vantagens.md`

---

## Convenções fixas (válidas para todo o plano)

**Vocabulário controlado (lowercase, exato — a herança de bandeira depende de igualdade exata):**
- `card_brand`: `mastercard` | `visa`
- `card_level`: `gold` | `platinum` | `black` | `signature` | `infinite`

**Slugs** (kebab-case, estáveis, únicos):
- `sources`: `nubank`, `inter`, `xp`
- `source_items`: `nubank-gold`, `nubank-platinum`, `nubank-ultravioleta-black`, `inter-gold`, `inter-platinum`, `inter-prime`, `inter-win`, `inter-duo-gourmet`, `xp-one`, `xp-infinite`, `xp-legacy`, `xp-digital`, `xp-exclusive`, `xp-signature`, `xp-unique`
- `benefits`: derivar do id do doc trocando `_` por `-` e removendo o prefixo redundante quando útil (ex.: `benefit_nubank_ultravioleta_priority_pass` → slug `nubank-ultravioleta-priority-pass`).

**Mapa de `source_items` → brand/level** (itens sem cartão de bandeira ficam com brand/level NULL):

| slug | source | label | display_name | card_brand | card_level | product_type |
|---|---|---|---|---|---|---|
| nubank-gold | nubank | Gold | Cartão Nubank Mastercard Gold | mastercard | gold | credit_card |
| nubank-platinum | nubank | Platinum | Cartão Nubank Mastercard Platinum | mastercard | platinum | credit_card |
| nubank-ultravioleta-black | nubank | Ultravioleta | Nubank Ultravioleta Mastercard Black | mastercard | black | credit_card |
| inter-gold | inter | Gold | Cartão Inter Gold | mastercard | gold | credit_card |
| inter-platinum | inter | Platinum | Cartão Inter Platinum | mastercard | platinum | credit_card |
| inter-prime | inter | Prime | Inter Prime | mastercard | black | credit_card |
| inter-win | inter | Win | Inter Win | mastercard | black | credit_card |
| inter-duo-gourmet | inter | Duo Gourmet | Duo Gourmet (plano anual) | NULL | NULL | subscription_plan |
| xp-one | xp | XP One | Cartão XP One | visa | infinite | credit_card |
| xp-infinite | xp | XP Infinite | Cartão XP Infinite | visa | infinite | credit_card |
| xp-legacy | xp | XP Legacy | Cartão XP Legacy | visa | infinite | credit_card |
| xp-digital | xp | XP Digital | XP Digital | NULL | NULL | relationship_tier |
| xp-exclusive | xp | XP Exclusive | XP Exclusive | NULL | NULL | relationship_tier |
| xp-signature | xp | XP Signature | XP Signature | NULL | NULL | relationship_tier |
| xp-unique | xp | XP Unique | XP Unique | NULL | NULL | relationship_tier |

**Mapa de categoria (doc en → enum)**: o doc já usa as 16 chaves do enum; copiar verbatim. Único cuidado: valores fora da lista → `other`.

**Comandos recorrentes:**
- Aplicar migrations + seed no Supabase local: `npx supabase db reset`
- Rodar testes: `npm test`
- Regenerar tipos: `npm run gen:types`

---

## Task 1: Migrations 0009 (schema) + 0010 (RLS) e neutralização do seed

Objetivo: introduzir todo o schema novo e deixar `db reset` passar **sem** os valores demo antigos. O catálogo fica vazio ao fim desta task; tasks seguintes preenchem o seed. Para `npm test` continuar verde, os testes que dependiam do seed demo são convertidos para auto-semear seus dados.

**Files:**
- Create: `supabase/migrations/0009_catalogo_real.sql`
- Create: `supabase/migrations/0010_rls_benefit_card_tiers.sql`
- Modify: `supabase/seed.sql` (substituir conteúdo por preâmbulo de limpeza + cabeçalho, sem inserts)
- Test: `tests/catalogo_real_schema.integration.test.ts` (novo)
- Modify (desacoplar do seed demo): `tests/my_benefits.test.ts`, `tests/onboarding_save.integration.test.ts`, `tests/replace_user_sources.integration.test.ts`, `tests/my_benefits_dedup.integration.test.ts`

- [ ] **Step 1: Escrever a migration 0009 (schema completo)**

Create `supabase/migrations/0009_catalogo_real.sql`:

```sql
-- M7: catálogo real + herança de bandeira. Ver
-- docs/superpowers/specs/2026-06-15-benefy-m7-catalogo-real-design.md

-- my_benefits depende de benefits.category; precisa cair antes do swap de enum.
drop view if exists my_benefits;

-- 1) Slugs estáveis (idempotência do seed + referência em testes)
alter table sources       add column slug text unique;
alter table source_items  add column slug text unique;
alter table benefits      add column slug text unique;

-- 2) Recriar benefit_category com as 16 chaves técnicas (en)
create type benefit_category_v2 as enum (
  'travel','insurance','cashback','investback','points','miles','shopping',
  'restaurant','airport','concierge','investment','security',
  'account_service','international_purchase','experience','other');

alter table benefits
  alter column category type benefit_category_v2
  using (
    case category::text
      when 'viagem'         then 'travel'
      when 'entretenimento' then 'experience'
      when 'saude'          then 'security'
      when 'seguros'        then 'insurance'
      when 'compras'        then 'shopping'
      else 'other'
    end::benefit_category_v2
  );

drop type benefit_category;
alter type benefit_category_v2 rename to benefit_category;

-- 3) Enums auxiliares
create type benefit_source_kind as enum ('issuer','card_network','partner','mixed');
create type redemption_type as enum (
  'automatic','app','coupon','partner_portal','insurance_claim','certificate',
  'concierge','physical_access','points_exchange','statement_credit','other');
create type verification_status as enum (
  'official_confirmed','official_needs_regulation_check','partner_network',
  'inferred_from_card_network','needs_manual_validation');
create type location_scope as enum (
  'online','physical','global_network','countrywide','airport','city','regional','unknown');
create type geolocation_status as enum ('exact','approximate','needs_geocoding','not_applicable');

-- 4) Colunas aditivas
alter table benefits
  add column benefit_source benefit_source_kind,
  add column redemption_type redemption_type,
  add column source_url text,
  add column source_name text,
  add column observed_at date,
  add column verification_status verification_status,
  add column notes text,
  add column long_description text,
  add column program text,
  add column requires_activation boolean not null default false,
  add column requires_eligible_card boolean not null default false,
  add column requires_certificate boolean not null default false,
  add column limits_description text;

alter table source_items
  add column display_name text,
  add column product_type text,
  add column eligibility_description text,
  add column points_rule text,
  add column cashback_rule text,
  add column min_investment numeric,
  add column min_income numeric,
  add column min_monthly_spend numeric,
  add column source_url text,
  add column verification_status verification_status;

alter table benefit_locations
  alter column lat drop not null,
  alter column lng drop not null,
  add column scope location_scope,
  add column country text,
  add column region text,
  add column airport_code text,
  add column terminal text,
  add column geolocation_status geolocation_status;

-- 5) Herança de bandeira
create table benefit_card_tiers (
  benefit_id uuid not null references benefits(id) on delete cascade,
  card_brand text not null,
  card_level text not null,
  primary key (benefit_id, card_brand, card_level)
);
create index on benefit_card_tiers (card_brand, card_level);
grant select, insert, update, delete on benefit_card_tiers to service_role;

-- 6) Recriar my_benefits unindo caminho direto + derivado
create view my_benefits with (security_invoker = true) as
with unlocked as (
  select b.id as benefit_id, si.label as via
  from benefits b
  join benefit_sources bs on bs.benefit_id = b.id
  join source_items si on si.id = bs.source_item_id
  join user_sources us on us.source_item_id = si.id
  where us.user_id = auth.uid() and b.active
  union
  select b.id, si.label
  from benefits b
  join benefit_card_tiers bct on bct.benefit_id = b.id
  join source_items si on si.card_brand = bct.card_brand
                      and si.card_level = bct.card_level
  join user_sources us on us.source_item_id = si.id
  where us.user_id = auth.uid() and b.active
)
select b.id, b.title, b.summary, b.category, b.scope, b.uf, b.steps,
       b.partner_name, b.valid_until, b.image_url, b.action_url, b.action_label,
       b.created_at, array_agg(distinct u.via order by u.via) as via
from unlocked u join benefits b on b.id = u.benefit_id
group by b.id;

grant select on my_benefits to authenticated;
```

- [ ] **Step 2: Escrever a migration 0010 (RLS de benefit_card_tiers)**

Create `supabase/migrations/0010_rls_benefit_card_tiers.sql` (mesmo padrão das demais tabelas de catálogo em `0003_rls.sql`):

```sql
grant select, insert, update, delete on benefit_card_tiers to authenticated;

alter table benefit_card_tiers enable row level security;

create policy "benefit_card_tiers read" on benefit_card_tiers
  for select to authenticated using (true);
create policy "benefit_card_tiers admin" on benefit_card_tiers
  for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
```

- [ ] **Step 3: Neutralizar o seed.sql**

Replace todo o conteúdo de `supabase/seed.sql` por (apenas a limpeza escopada + cabeçalho; sem inserts ainda — preenchidos nas Tasks 2–5):

```sql
-- Catálogo real (M7). Vocabulário controlado:
--   card_brand: mastercard | visa
--   card_level: gold | platinum | black | signature | infinite
-- Catálogo é autoritativo. Remoção ESCOPADA do catálogo demo (no-op em banco limpo,
-- relevante ao reaplicar sobre um banco com o seed demo do M5).
delete from benefits where id in (
  'd0000001-0000-0000-0000-000000000001',
  'd0000001-0000-0000-0000-000000000002',
  'd0000001-0000-0000-0000-000000000003');
delete from sources where id in (
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333');

-- (Tasks 2–5 inserem sources, source_items, benefits, benefit_sources,
--  benefit_card_tiers e benefit_locations abaixo desta linha.)
```

- [ ] **Step 4: Aplicar e verificar o reset**

Run: `npx supabase db reset`
Expected: aplica 0001–0010 + seed sem erro. Sem erro de enum (`viagem` não é mais referenciado pelo seed).

- [ ] **Step 5: Escrever o teste de schema (falha primeiro)**

Create `tests/catalogo_real_schema.integration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { serviceClient, userClient } from './helpers/clients'

describe('M7 schema', () => {
  it('benefits aceita campos de compliance e categoria nova', async () => {
    const db = serviceClient()
    const { data, error } = await db
      .from('benefits')
      .insert({
        title: 'T', summary: 's', category: 'airport',
        benefit_source: 'card_network', redemption_type: 'physical_access',
        verification_status: 'official_confirmed', observed_at: '2026-06-15',
        requires_activation: true, source_url: 'https://x.test', slug: `t-${Date.now()}`,
      })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data!.category).toBe('airport')
    await db.from('benefits').delete().eq('id', data!.id)
  })

  it('benefit_card_tiers: leitura autenticada e herança por brand/level', async () => {
    const db = serviceClient()
    // benefício de bandeira + item visa/infinite + usuário que o seleciona
    const { data: ben } = await db.from('benefits')
      .insert({ title: 'Bandeira', summary: 's', category: 'insurance',
                benefit_source: 'card_network', slug: `band-${Date.now()}` })
      .select().single()
    await db.from('benefit_card_tiers')
      .insert({ benefit_id: ben!.id, card_brand: 'visa', card_level: 'infinite' })
    const { data: src } = await db.from('sources')
      .insert({ kind: 'card', name: `S-${Date.now()}`, sort_order: 1, slug: `s-${Date.now()}` })
      .select().single()
    const { data: item } = await db.from('source_items')
      .insert({ source_id: src!.id, label: 'XP Inf', sort_order: 1,
                card_brand: 'visa', card_level: 'infinite', slug: `i-${Date.now()}` })
      .select().single()

    const { client, id } = await userClient()
    await client.from('user_sources').insert({ user_id: id, source_item_id: item!.id })

    const { data: mine, error } = await client.from('my_benefits').select('id, via')
    expect(error).toBeNull()
    const row = (mine ?? []).find((r) => r.id === ben!.id)
    expect(row).toBeTruthy()                      // herdou pelo caminho derivado
    expect(row!.via).toEqual(['XP Inf'])

    await db.from('sources').delete().eq('id', src!.id)
    await db.from('benefits').delete().eq('id', ben!.id)
  })

  it('não-admin não escreve em benefit_card_tiers', async () => {
    const { client } = await userClient()
    const { error } = await client.from('benefit_card_tiers')
      .insert({ benefit_id: '00000000-0000-0000-0000-000000000000',
                card_brand: 'visa', card_level: 'infinite' })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 6: Rodar o teste de schema**

Run: `npm test -- catalogo_real_schema`
Expected: PASS (migrations já aplicadas no Step 4).

- [ ] **Step 7: Desacoplar testes que dependiam do seed demo**

Esses testes referenciam UUIDs/categorias demo que não existem mais. Convertê-los para auto-semear via `serviceClient`. Primeiro, confirme o conjunto:

Run: `grep -rlnE "aaaaaaa1-|bbbbbbb2-|ccccccc3-|d0000001-|11111111-1111|22222222-2222|33333333-3333" tests/`
Expected (após esta task): nenhum match em `tests/`.

Substitua `tests/my_benefits_dedup.integration.test.ts` por:

```ts
import { describe, it, expect } from 'vitest'
import { serviceClient, userClient } from './helpers/clients'

describe('my_benefits dedup', () => {
  it('1 linha por benefício; via agrega as fontes', async () => {
    const db = serviceClient()
    const stamp = `${Date.now()}`
    const { data: src } = await db.from('sources')
      .insert({ kind: 'card', name: `Dedup-${stamp}`, sort_order: 1, slug: `dedup-${stamp}` })
      .select().single()
    const mk = async (label: string) =>
      (await db.from('source_items')
        .insert({ source_id: src!.id, label, sort_order: 1, slug: `${label}-${stamp}` })
        .select().single()).data!
    const black = await mk('Black')
    const platinum = await mk('Platinum')
    const { data: ben } = await db.from('benefits')
      .insert({ title: `Dedup ${stamp}`, summary: 's', category: 'shopping', slug: `b-${stamp}` })
      .select().single()
    await db.from('benefit_sources').insert([
      { benefit_id: ben!.id, source_item_id: black.id },
      { benefit_id: ben!.id, source_item_id: platinum.id },
    ])

    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [black.id, platinum.id] })
    const { data, error } = await client.from('my_benefits').select('id, via')
    expect(error).toBeNull()
    const rows = (data ?? []).filter((r) => r.id === ben!.id)
    expect(rows.length).toBe(1)
    expect((rows[0].via as string[]).sort()).toEqual(['Black', 'Platinum'])

    await db.from('sources').delete().eq('id', src!.id)
    await db.from('benefits').delete().eq('id', ben!.id)
  })
})
```

Substitua o terceiro caso de `tests/my_benefits.test.ts` (o bloco `it('seed: usuário com Itaú Black vê 2 benefícios', ...)`) por uma versão auto-semeada:

```ts
  it('um item que destrava 2 benefícios retorna os 2', async () => {
    const db = serviceClient()
    const stamp = `${Date.now()}`
    const { data: src } = await db.from('sources')
      .insert({ kind: 'card', name: `Two-${stamp}`, sort_order: 1, slug: `two-${stamp}` })
      .select().single()
    const { data: item } = await db.from('source_items')
      .insert({ source_id: src!.id, label: 'Black', sort_order: 1, slug: `two-item-${stamp}` })
      .select().single()
    const mkBen = async (n: number) => {
      const { data: ben } = await db.from('benefits')
        .insert({ title: `B${n}-${stamp}`, summary: 's', category: 'shopping', slug: `two-b${n}-${stamp}` })
        .select().single()
      await db.from('benefit_sources').insert({ benefit_id: ben!.id, source_item_id: item!.id })
      return ben!.id
    }
    const ids = [await mkBen(1), await mkBen(2)]
    const { client, id } = await userClient()
    await client.from('user_sources').insert({ user_id: id, source_item_id: item!.id })
    const { data, error } = await client.from('my_benefits').select('id').in('id', ids)
    expect(error).toBeNull()
    expect(data!.length).toBe(2)
    await db.from('sources').delete().eq('id', src!.id)
  })
```

Também troque, nos dois primeiros casos de `tests/my_benefits.test.ts`, o `category: 'compras'` da função `seedBenefit` por `category: 'shopping'` (a categoria demo não existe mais).

Substitua `tests/replace_user_sources.integration.test.ts` para auto-semear dois itens em vez de usar `BLACK`/`PLATINUM` demo:

```ts
import { describe, it, expect } from 'vitest'
import { userClient, serviceClient } from './helpers/clients'

async function twoItems() {
  const db = serviceClient()
  const stamp = `${Date.now()}-${Math.floor(performance.now() * 1000)}`
  const { data: src } = await db.from('sources')
    .insert({ kind: 'card', name: `RUS-${stamp}`, sort_order: 1, slug: `rus-${stamp}` })
    .select().single()
  const mk = async (n: number) =>
    (await db.from('source_items')
      .insert({ source_id: src!.id, label: `L${n}`, sort_order: n, slug: `rus-${n}-${stamp}` })
      .select().single()).data!.id as string
  return { a: await mk(1), b: await mk(2), srcId: src!.id, db }
}

describe('replace_user_sources RPC', () => {
  it('substitui a seleção do usuário atomicamente', async () => {
    const { a, b, srcId, db } = await twoItems()
    const { client, id } = await userClient()
    let res = await client.rpc('replace_user_sources', { item_ids: [a] })
    expect(res.error).toBeNull()
    res = await client.rpc('replace_user_sources', { item_ids: [b] })
    expect(res.error).toBeNull()
    const { data } = await db.from('user_sources').select('source_item_id').eq('user_id', id)
    expect(data!.map((r) => r.source_item_id)).toEqual([b])
    await db.from('sources').delete().eq('id', srcId)
  })

  it('lista vazia limpa a seleção', async () => {
    const { a, srcId, db } = await twoItems()
    const { client, id } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [a] })
    const res = await client.rpc('replace_user_sources', { item_ids: [] })
    expect(res.error).toBeNull()
    const { count } = await db
      .from('user_sources')
      .select('source_item_id', { count: 'exact', head: true })
      .eq('user_id', id)
    expect(count).toBe(0)
    await db.from('sources').delete().eq('id', srcId)
  })
})
```

Substitua `tests/onboarding_save.integration.test.ts` para auto-semear (mantendo o fluxo anônimo):

```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { serviceClient } from './helpers/clients'

const url = process.env.VITE_SUPABASE_URL!
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!

describe('fluxo de gravação do onboarding', () => {
  it('usuário anônimo grava seleção e vê a contagem de benefícios', async () => {
    const db = serviceClient()
    const stamp = `${Date.now()}`
    const { data: src } = await db.from('sources')
      .insert({ kind: 'card', name: `Onb-${stamp}`, sort_order: 1, slug: `onb-${stamp}` })
      .select().single()
    const { data: item } = await db.from('source_items')
      .insert({ source_id: src!.id, label: 'Black', sort_order: 1, slug: `onb-item-${stamp}` })
      .select().single()
    for (const n of [1, 2]) {
      const { data: ben } = await db.from('benefits')
        .insert({ title: `Onb B${n} ${stamp}`, summary: 's', category: 'shopping', slug: `onb-b${n}-${stamp}` })
        .select().single()
      await db.from('benefit_sources').insert({ benefit_id: ben!.id, source_item_id: item!.id })
    }

    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: signIn, error: authErr } = await client.auth.signInAnonymously()
    expect(authErr).toBeNull()
    const userId = signIn.user!.id
    const { error: insErr } = await client
      .from('user_sources')
      .insert({ user_id: userId, source_item_id: item!.id })
    expect(insErr).toBeNull()

    const { data, error } = await client.from('my_benefits').select('id')
    expect(error).toBeNull()
    const distinct = new Set((data ?? []).map((r) => r.id)).size
    expect(distinct).toBe(2)

    await db.from('sources').delete().eq('id', src!.id)
  })
})
```

- [ ] **Step 8: Rodar a suíte inteira**

Run: `npm test`
Expected: tudo verde. Confirme também que o grep do Step 7 não retorna mais nada em `tests/`.

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/0009_catalogo_real.sql supabase/migrations/0010_rls_benefit_card_tiers.sql \
        supabase/seed.sql tests/catalogo_real_schema.integration.test.ts \
        tests/my_benefits.test.ts tests/my_benefits_dedup.integration.test.ts \
        tests/replace_user_sources.integration.test.ts tests/onboarding_save.integration.test.ts
git commit -m "feat(m7): schema catálogo real + benefit_card_tiers + my_benefits union"
```

---

## Task 2: Seed — sources + source_items reais

**Files:**
- Modify: `supabase/seed.sql` (inserir sources + source_items)
- Test: `tests/seed_catalog.integration.test.ts` (novo)

- [ ] **Step 1: Escrever o teste (falha primeiro)**

Create `tests/seed_catalog.integration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { serviceClient } from './helpers/clients'

describe('seed: catálogo real', () => {
  it('só existem as 3 sources reais; nenhuma demo', async () => {
    const db = serviceClient()
    const { data } = await db.from('sources').select('slug, name')
    const slugs = (data ?? []).map((r) => r.slug).sort()
    expect(slugs).toEqual(['inter', 'nubank', 'xp'])
    const names = (data ?? []).map((r) => r.name)
    expect(names).not.toContain('Itaú')
    expect(names).not.toContain('Claro')
    expect(names).not.toContain('Livelo')
  })

  it('source_items têm brand/level no vocabulário controlado', async () => {
    const db = serviceClient()
    const { data } = await db.from('source_items')
      .select('slug, card_brand, card_level')
      .in('slug', ['nubank-ultravioleta-black', 'xp-infinite', 'inter-duo-gourmet'])
    const bySlug = Object.fromEntries((data ?? []).map((r) => [r.slug, r]))
    expect(bySlug['nubank-ultravioleta-black']).toMatchObject({ card_brand: 'mastercard', card_level: 'black' })
    expect(bySlug['xp-infinite']).toMatchObject({ card_brand: 'visa', card_level: 'infinite' })
    expect(bySlug['inter-duo-gourmet'].card_brand).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar o teste**

Run: `npm test -- seed_catalog`
Expected: FAIL (nenhuma source ainda).

- [ ] **Step 3: Inserir sources + source_items no seed.sql**

Append em `supabase/seed.sql` (após o preâmbulo de limpeza). Usar `gen_random_uuid()` para os PKs e `on conflict (slug) do update` para idempotência:

```sql
-- ===== SOURCES =====
insert into sources (slug, kind, name, sort_order, institution_url, country) values
  ('nubank', 'card', 'Nubank',      1, 'https://nubank.com.br', 'BR'),
  ('inter',  'card', 'Banco Inter', 2, 'https://inter.co',      'BR'),
  ('xp',     'card', 'XP',          3, 'https://www.xpi.com.br','BR')
on conflict (slug) do update set
  kind = excluded.kind, name = excluded.name, sort_order = excluded.sort_order,
  institution_url = excluded.institution_url, country = excluded.country;

-- ===== SOURCE_ITEMS =====
-- (source_id resolvido por subselect via slug da source)
insert into source_items (slug, source_id, label, display_name, sort_order, card_brand, card_level, product_type, source_url, verification_status) values
  ('nubank-gold',              (select id from sources where slug='nubank'), 'Gold',        'Cartão Nubank Mastercard Gold',        1, 'mastercard','gold',    'credit_card',      'https://nubank.com.br/nu/cartao', 'official_confirmed'),
  ('nubank-platinum',          (select id from sources where slug='nubank'), 'Platinum',    'Cartão Nubank Mastercard Platinum',    2, 'mastercard','platinum','credit_card',      'https://nubank.com.br/nu/cartao', 'official_confirmed'),
  ('nubank-ultravioleta-black',(select id from sources where slug='nubank'), 'Ultravioleta','Nubank Ultravioleta Mastercard Black',  3, 'mastercard','black',   'credit_card',      'https://nubank.com.br/ultravioleta/cartao-black', 'official_confirmed'),
  ('inter-gold',               (select id from sources where slug='inter'),  'Gold',        'Cartão Inter Gold',                    1, 'mastercard','gold',    'credit_card',      'https://inter.co/pra-voce/cartoes/', 'official_confirmed'),
  ('inter-platinum',           (select id from sources where slug='inter'),  'Platinum',    'Cartão Inter Platinum',                2, 'mastercard','platinum','credit_card',      'https://inter.co/pra-voce/cartoes/', 'official_confirmed'),
  ('inter-prime',              (select id from sources where slug='inter'),  'Prime',       'Inter Prime',                          3, 'mastercard','black',   'credit_card',      'https://inter.co/pra-voce/relacionamento/inter-prime/', 'official_confirmed'),
  ('inter-win',                (select id from sources where slug='inter'),  'Win',         'Inter Win',                            4, 'mastercard','black',   'credit_card',      'https://inter.co/pra-voce/relacionamento/inter-win/', 'official_confirmed'),
  ('inter-duo-gourmet',        (select id from sources where slug='inter'),  'Duo Gourmet', 'Duo Gourmet (plano anual)',            5, null,        null,      'subscription_plan','https://inter.co/pra-voce/duo-gourmet/', 'official_confirmed'),
  ('xp-one',                   (select id from sources where slug='xp'),     'XP One',      'Cartão XP One',                        1, 'visa',      'infinite','credit_card',      'https://www.xpi.com.br/produtos/cartao-de-credito/', 'official_confirmed'),
  ('xp-infinite',              (select id from sources where slug='xp'),     'XP Infinite', 'Cartão XP Infinite',                   2, 'visa',      'infinite','credit_card',      'https://www.xpi.com.br/produtos/cartao-de-credito/', 'official_confirmed'),
  ('xp-legacy',                (select id from sources where slug='xp'),     'XP Legacy',   'Cartão XP Legacy',                     3, 'visa',      'infinite','credit_card',      'https://www.xpi.com.br/produtos/cartao-xp-legacy/', 'official_needs_regulation_check'),
  ('xp-digital',               (select id from sources where slug='xp'),     'XP Digital',  'XP Digital',                           4, null,        null,      'relationship_tier','https://www.xpi.com.br/app/', 'official_confirmed'),
  ('xp-exclusive',             (select id from sources where slug='xp'),     'XP Exclusive','XP Exclusive',                         5, null,        null,      'relationship_tier','https://www.xpi.com.br/app/', 'official_confirmed'),
  ('xp-signature',             (select id from sources where slug='xp'),     'XP Signature','XP Signature',                         6, null,        null,      'relationship_tier','https://www.xpi.com.br/app/', 'official_confirmed'),
  ('xp-unique',                (select id from sources where slug='xp'),     'XP Unique',   'XP Unique',                            7, null,        null,      'relationship_tier','https://www.xpi.com.br/app/', 'official_confirmed')
on conflict (slug) do update set
  source_id = excluded.source_id, label = excluded.label, display_name = excluded.display_name,
  sort_order = excluded.sort_order, card_brand = excluded.card_brand, card_level = excluded.card_level,
  product_type = excluded.product_type, source_url = excluded.source_url,
  verification_status = excluded.verification_status;
```

> Campos opcionais de regra (`points_rule`, `cashback_rule`, `min_*`, `eligibility_description`) podem ser preenchidos a partir das seções 6.2.2/6.3.2/6.4.2 do doc; não são exigidos por testes do M7, mas inclua-os onde o doc fornecer (mecânico, melhora o dado).

- [ ] **Step 4: Reset + teste**

Run: `npx supabase db reset && npm test -- seed_catalog`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql tests/seed_catalog.integration.test.ts
git commit -m "feat(m7): seed de sources e source_items reais"
```

---

## Task 3: Seed — benefícios de emissor/parceiro (caminho direto)

Benefícios cujo `benefit_source` é `issuer` ou `partner` (e os `mixed` atrelados a um produto específico), ligados via `benefit_sources` ao `source_item` correspondente. Fonte: doc §6.2.3 (Nubank), §6.3.3 (Inter), §6.4.3 (XP).

**Files:**
- Modify: `supabase/seed.sql`
- Test: `tests/seed_issuer_benefits.integration.test.ts` (novo)

- [ ] **Step 1: Escrever o teste (falha primeiro)**

Create `tests/seed_issuer_benefits.integration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { serviceClient, userClient } from './helpers/clients'

async function itemId(slug: string) {
  const db = serviceClient()
  const { data } = await db.from('source_items').select('id').eq('slug', slug).single()
  return data!.id as string
}

describe('seed: benefícios de emissor (caminho direto)', () => {
  it('Ultravioleta destrava Priority Pass, Lounge GRU, pontos/cashback, Nu Viagens e IOF zero', async () => {
    const item = await itemId('nubank-ultravioleta-black')
    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [item] })
    const { data, error } = await client.from('my_benefits').select('title')
    expect(error).toBeNull()
    const titles = (data ?? []).map((r) => r.title as string)
    expect(titles.some((t) => /Priority Pass/i.test(t))).toBe(true)
    expect(titles.some((t) => /Lounge.*Guarulhos/i.test(t))).toBe(true)
    expect(titles.some((t) => /Cashback/i.test(t))).toBe(true)
    expect(titles.some((t) => /Nu Viagens/i.test(t))).toBe(true)
    expect(titles.some((t) => /IOF zero/i.test(t))).toBe(true)
  })

  it('Duo Gourmet destrava o 2-por-1', async () => {
    const item = await itemId('inter-duo-gourmet')
    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [item] })
    const { data } = await client.from('my_benefits').select('title')
    expect((data ?? []).some((r) => /2 pratos|2 por 1|2-por-1/i.test(r.title as string))).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar o teste**

Run: `npm test -- seed_issuer_benefits`
Expected: FAIL.

- [ ] **Step 3: Inserir benefícios de emissor/parceiro + benefit_sources**

Append em `supabase/seed.sql`. Transcrever de §6.2.3/§6.3.3/§6.4.3 **apenas** os benefícios com `benefitSource` em (`issuer`, `partner`, `mixed`-atrelado-a-produto). Mapa de colunas: doc `name`→`title`, `shortDescription`→`summary`, `category`→`category`, `benefitSource`→`benefit_source`, `redemptionType`→`redemption_type`, `requiresActivation`→`requires_activation`, `requiresPurchaseWithEligibleCard`→`requires_eligible_card`, `requiresTicketOrCertificate`→`requires_certificate`, `partnerName`→`partner_name`, `limitsDescription`→`limits_description`, `sourceUrl`→`source_url`, `observedAt`→`observed_at`, `verificationStatus`→`verification_status`, `notes`→`notes`.

Padrão (exemplo completo para 2 benefícios; replicar para todos os de emissor/parceiro):

```sql
-- ===== BENEFITS (emissor/parceiro) =====
insert into benefits (slug, title, summary, category, scope, benefit_source, redemption_type,
                      requires_activation, requires_eligible_card, partner_name, limits_description,
                      source_url, observed_at, verification_status) values
  ('nubank-ultravioleta-priority-pass',
   '4 acessos Priority Pass por ano', 'Clientes Ultravioleta têm 4 visitas por ano à rede Priority Pass, com mais de 1.700 salas VIP em mais de 145 países.',
   'airport', 'nacional', 'partner', 'physical_access',
   true, false, 'Priority Pass', '4 visitas por ano, conforme regras do Nubank Ultravioleta.',
   'https://nubank.com.br/ultravioleta/cartao-black/salas-vip', '2026-06-15', 'official_confirmed'),
  ('nubank-ultravioleta-lounge-gru',
   'Nubank Ultravioleta Lounge em Guarulhos', 'Acesso gratuito e ilimitado ao Nubank Ultravioleta Lounge no Aeroporto Internacional de São Paulo/Guarulhos.',
   'airport', 'pontual', 'issuer', 'physical_access',
   true, false, 'Nubank', 'Entrada permitida até 3 horas antes do voo; verificar regras de acompanhante.',
   'https://nubank.com.br/ultravioleta/cartao-black/ultravioleta-lounge', '2026-06-15', 'official_confirmed')
  -- ... continuar: nubank-ultravioleta-pontos-cashback, nubank-ultravioleta-transferencia-milhas,
  --     nubank-ultravioleta-nu-viagens, nubank-ultravioleta-iof-zero,
  --     inter-loop-* (pontos gold/platinum/prime/win, resgate milhas, desconto fatura, cashback shop, dolares),
  --     inter-prime-salas-vip, inter-prime-priority-pass, inter-duo-gourmet-2-por-1, inter-duo-experiencias,
  --     inter-win-gestao-patrimonial,
  --     xp-*-pontos-investback (one/infinite/legacy), xp-one-sala-vip, xp-infinite-sala-vip,
  --     xp-infinite-fast-pass, xp-legacy-salas-vip-ilimitado, xp-legacy-meet-greet, xp-legacy-vistos-passaportes,
  --     xp-legacy-concierge, xp-experience-signature-assessoria, xp-experience-unique-wealth-planning,
  --     xp-private-visa-infinite-privilege-lounge (mixed, atrelado a xp-legacy)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, category = excluded.category, scope = excluded.scope,
  benefit_source = excluded.benefit_source, redemption_type = excluded.redemption_type,
  requires_activation = excluded.requires_activation, requires_eligible_card = excluded.requires_eligible_card,
  partner_name = excluded.partner_name, limits_description = excluded.limits_description,
  source_url = excluded.source_url, observed_at = excluded.observed_at, verification_status = excluded.verification_status;

-- ===== BENEFIT_SOURCES (liga benefício de emissor ao source_item específico) =====
insert into benefit_sources (benefit_id, source_item_id)
select b.id, si.id from benefits b, source_items si
where (b.slug, si.slug) in (
  ('nubank-ultravioleta-priority-pass',          'nubank-ultravioleta-black'),
  ('nubank-ultravioleta-lounge-gru',             'nubank-ultravioleta-black'),
  ('nubank-ultravioleta-pontos-cashback',        'nubank-ultravioleta-black'),
  ('nubank-ultravioleta-transferencia-milhas',   'nubank-ultravioleta-black'),
  ('nubank-ultravioleta-nu-viagens',             'nubank-ultravioleta-black'),
  ('nubank-ultravioleta-iof-zero',               'nubank-ultravioleta-black'),
  ('inter-loop-pontos-gold',                     'inter-gold'),
  ('inter-loop-pontos-platinum',                 'inter-platinum'),
  ('inter-loop-pontos-prime',                    'inter-prime'),
  ('inter-loop-pontos-win',                      'inter-win'),
  ('inter-loop-resgate-milhas',                  'inter-prime'),
  ('inter-loop-desconto-fatura',                 'inter-gold'),
  ('inter-loop-cashback-inter-shop',             'inter-gold'),
  ('inter-loop-dolares-global-account',          'inter-prime'),
  ('inter-prime-salas-vip',                      'inter-prime'),
  ('inter-prime-priority-pass',                  'inter-prime'),
  ('inter-duo-gourmet-2-por-1',                  'inter-duo-gourmet'),
  ('inter-duo-experiencias',                     'inter-duo-gourmet'),
  ('inter-win-gestao-patrimonial',              'inter-win'),
  ('xp-one-pontos-investback',                   'xp-one'),
  ('xp-one-sala-vip',                            'xp-one'),
  ('xp-infinite-pontos-investback',             'xp-infinite'),
  ('xp-infinite-sala-vip',                       'xp-infinite'),
  ('xp-infinite-fast-pass',                      'xp-infinite'),
  ('xp-legacy-pontos-investback',               'xp-legacy'),
  ('xp-legacy-salas-vip-ilimitado',             'xp-legacy'),
  ('xp-legacy-meet-greet',                       'xp-legacy'),
  ('xp-legacy-vistos-passaportes',              'xp-legacy'),
  ('xp-legacy-concierge',                        'xp-legacy'),
  ('xp-experience-signature-assessoria',        'xp-signature'),
  ('xp-experience-unique-wealth-planning',      'xp-unique'),
  ('xp-private-visa-infinite-privilege-lounge', 'xp-legacy')
)
on conflict do nothing;
```

> Os títulos devem casar com os regexes do teste do Step 1 (Priority Pass, Lounge…Guarulhos, Cashback, Nu Viagens, IOF zero, 2…). O benefício de pontos/cashback do Ultravioleta tem título contendo "Cashback"; o de IOF tem "IOF zero". Transcrever os textos verbatim do doc garante isso.

- [ ] **Step 4: Reset + teste**

Run: `npx supabase db reset && npm test -- seed_issuer_benefits`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql tests/seed_issuer_benefits.integration.test.ts
git commit -m "feat(m7): seed de benefícios de emissor/parceiro (caminho direto)"
```

---

## Task 4: Seed — benefícios de bandeira (caminho derivado via benefit_card_tiers)

Benefícios `benefit_source = 'card_network'` da §6.5 (Mastercard Gold/Platinum/Black) e §6.6 (Visa Infinite/Signature). Os duplicados por emissor no doc (ex.: `benefit_nubank_gold_*`) **não** são semeados — colapsam aqui. Ligados via `benefit_card_tiers (card_brand, card_level)`.

**Files:**
- Modify: `supabase/seed.sql`
- Test: `tests/seed_card_network.integration.test.ts` (novo)

- [ ] **Step 1: Escrever o teste (falha primeiro)**

Create `tests/seed_card_network.integration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { serviceClient, userClient } from './helpers/clients'

async function itemId(slug: string) {
  const db = serviceClient()
  const { data } = await db.from('source_items').select('id').eq('slug', slug).single()
  return data!.id as string
}

describe('seed: benefícios de bandeira (caminho derivado)', () => {
  it('XP Infinite (visa/infinite) herda benefícios Visa Infinite', async () => {
    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [await itemId('xp-infinite')] })
    const { data, error } = await client.from('my_benefits').select('title')
    expect(error).toBeNull()
    const titles = (data ?? []).map((r) => r.title as string)
    expect(titles.some((t) => /Veículos de Locadora|veículo de locadora/i.test(t))).toBe(true)
    expect(titles.some((t) => /Emergência Médica/i.test(t))).toBe(true)
    expect(titles.some((t) => /Proteção de Compra/i.test(t))).toBe(true)
  })

  it('Nubank Ultravioleta (mastercard/black) herda benefícios Mastercard Black', async () => {
    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [await itemId('nubank-ultravioleta-black')] })
    const { data } = await client.from('my_benefits').select('title')
    const titles = (data ?? []).map((r) => r.title as string)
    expect(titles.some((t) => /Garantia Estendida/i.test(t))).toBe(true)
    expect(titles.some((t) => /Compra Protegida/i.test(t))).toBe(true)
    expect(titles.some((t) => /Concierge/i.test(t))).toBe(true)
  })

  it('Nubank Gold (mastercard/gold) herda Compra Protegida e Proteção de Preço Mastercard Gold', async () => {
    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [await itemId('nubank-gold')] })
    const { data } = await client.from('my_benefits').select('title')
    const titles = (data ?? []).map((r) => r.title as string)
    expect(titles.some((t) => /Proteção de Preço/i.test(t))).toBe(true)
    expect(titles.some((t) => /Compra Protegida/i.test(t))).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar o teste**

Run: `npm test -- seed_card_network`
Expected: FAIL.

- [ ] **Step 3: Inserir benefícios de bandeira + benefit_card_tiers**

Append em `supabase/seed.sql`. Transcrever de §6.5/§6.6 (mesmo mapa de colunas da Task 3). Exemplo completo (2 benefícios) + a tabela de ligação por brand/level:

```sql
-- ===== BENEFITS (bandeira / card_network) =====
insert into benefits (slug, title, summary, category, scope, benefit_source, redemption_type,
                      requires_activation, requires_eligible_card, requires_certificate,
                      source_url, observed_at, verification_status) values
  ('mastercard-black-garantia-estendida',
   'Garantia Estendida Original Mastercard Black', 'Duplica a garantia original do fabricante/loja por até 1 ano, respeitando o limite máximo informado pela Mastercard.',
   'shopping', 'nacional', 'card_network', 'insurance_claim',
   true, true, false,
   'https://www.mastercard.com/br/pt/personal/find-a-card/credit-card/black-credit-card/garantia-estendida-original.html', '2026-06-15', 'official_confirmed'),
  ('visa-infinite-seguro-veiculo-locadora',
   'Seguro para Veículos de Locadora Visa Infinite', 'Proteção gratuita contra roubo e danos ao pagar e reservar a locação de automóvel com cartão Visa elegível.',
   'insurance', 'nacional', 'card_network', 'insurance_claim',
   false, true, false,
   'https://www.visa.com.br/pague-com-visa/cartoes/beneficios.html', '2026-06-15', 'official_confirmed')
  -- ... continuar Mastercard Gold: proteção-preco, compra-protegida (mastercard/gold);
  --     Mastercard Platinum: concierge, masterassist-plus, masterseguro-automoveis (mastercard/platinum);
  --     Mastercard Black: compra-protegida, concierge (mastercard/black) [+ garantia acima];
  --     Visa Infinite: seguro-emergencia-medica, cancelamento-viagem, bagagem, fast-pass,
  --                    airport-companion, protecao-compra, concierge (visa/infinite) [+ locadora acima];
  --     Visa Signature: airport-companion, seguro-emergencia-medica, protecao-compra (visa/signature)
on conflict (slug) do update set
  title = excluded.title, summary = excluded.summary, category = excluded.category, scope = excluded.scope,
  benefit_source = excluded.benefit_source, redemption_type = excluded.redemption_type,
  requires_activation = excluded.requires_activation, requires_eligible_card = excluded.requires_eligible_card,
  requires_certificate = excluded.requires_certificate, source_url = excluded.source_url,
  observed_at = excluded.observed_at, verification_status = excluded.verification_status;

-- ===== BENEFIT_CARD_TIERS (herança por brand/level) =====
insert into benefit_card_tiers (benefit_id, card_brand, card_level)
select b.id, t.card_brand, t.card_level
from benefits b
join (values
  ('mastercard-gold-protecao-preco',           'mastercard','gold'),
  ('mastercard-gold-compra-protegida',         'mastercard','gold'),
  ('mastercard-platinum-concierge',            'mastercard','platinum'),
  ('mastercard-platinum-masterassist-plus',    'mastercard','platinum'),
  ('mastercard-platinum-masterseguro-automoveis','mastercard','platinum'),
  ('mastercard-black-compra-protegida',        'mastercard','black'),
  ('mastercard-black-garantia-estendida',      'mastercard','black'),
  ('mastercard-black-concierge',               'mastercard','black'),
  ('visa-infinite-seguro-emergencia-medica',   'visa','infinite'),
  ('visa-infinite-seguro-veiculo-locadora',    'visa','infinite'),
  ('visa-infinite-cancelamento-viagem',        'visa','infinite'),
  ('visa-infinite-bagagem',                    'visa','infinite'),
  ('visa-infinite-fast-pass',                  'visa','infinite'),
  ('visa-infinite-airport-companion',          'visa','infinite'),
  ('visa-infinite-protecao-compra',            'visa','infinite'),
  ('visa-infinite-concierge',                  'visa','infinite'),
  ('visa-signature-airport-companion',         'visa','signature'),
  ('visa-signature-seguro-emergencia-medica',  'visa','signature'),
  ('visa-signature-protecao-compra',           'visa','signature')
) as t(slug, card_brand, card_level) on t.slug = b.slug
on conflict do nothing;
```

> Atenção aos títulos exigidos pelos regexes: "Garantia Estendida", "Compra Protegida", "Concierge" (Mastercard Black); "Veículos de Locadora", "Emergência Médica", "Proteção de Compra" (Visa Infinite); "Proteção de Preço" + "Compra Protegida" (Mastercard Gold). Transcrever verbatim do doc satisfaz todos.

- [ ] **Step 4: Reset + teste**

Run: `npx supabase db reset && npm test -- seed_card_network`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql tests/seed_card_network.integration.test.ts
git commit -m "feat(m7): seed de benefícios de bandeira + herança por brand/level"
```

---

## Task 5: Seed — locais de resgate (benefit_locations)

Locais da §6.2.4/§6.3.4/§6.4.4/§6.6.3. Locais com aeroporto/cidade levam `lat`/`lng` quando o doc fornecer (a maioria é `needs_geocoding` — inserir sem coordenada). `global_network`/`online` entram com `geolocation_status='not_applicable'`.

**Files:**
- Modify: `supabase/seed.sql`
- Test: `tests/seed_locations.integration.test.ts` (novo)

- [ ] **Step 1: Escrever o teste (falha primeiro)**

Create `tests/seed_locations.integration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { serviceClient } from './helpers/clients'

describe('seed: locais de resgate', () => {
  it('Lounge GRU tem aeroporto e escopo de aeroporto', async () => {
    const db = serviceClient()
    const { data: ben } = await db.from('benefits').select('id')
      .eq('slug', 'nubank-ultravioleta-lounge-gru').single()
    const { data } = await db.from('benefit_locations')
      .select('airport_code, scope, geolocation_status').eq('benefit_id', ben!.id)
    expect((data ?? []).some((l) => l.airport_code === 'GRU' && l.scope === 'airport')).toBe(true)
  })

  it('Priority Pass é global_network sem coordenada', async () => {
    const db = serviceClient()
    const { data: ben } = await db.from('benefits').select('id')
      .eq('slug', 'nubank-ultravioleta-priority-pass').single()
    const { data } = await db.from('benefit_locations')
      .select('scope, lat, geolocation_status').eq('benefit_id', ben!.id)
    expect((data ?? []).some((l) => l.scope === 'global_network' && l.lat === null
      && l.geolocation_status === 'not_applicable')).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar o teste**

Run: `npm test -- seed_locations`
Expected: FAIL.

- [ ] **Step 3: Inserir benefit_locations no seed.sql**

Append em `supabase/seed.sql`. Mapa: doc `scope`→`scope`, `placeName`→`name`, `country/region/state/city`→idem (`state`→`uf`), `airportCode`→`airport_code`, `terminal`→`terminal`, `latitude/longitude`→`lat`/`lng`, `geolocationStatus`→`geolocation_status`, `notes`→(omitir; coluna não existe em locations). Ligar por slug do benefício:

```sql
insert into benefit_locations (benefit_id, name, scope, country, region, uf, city, airport_code, terminal, lat, lng, geolocation_status)
select b.id, t.name, t.scope::location_scope, t.country, t.region, t.uf, t.city,
       t.airport_code, t.terminal, t.lat, t.lng, t.geolocation_status::geolocation_status
from benefits b
join (values
  ('nubank-ultravioleta-lounge-gru', 'Nubank Ultravioleta Lounge — GRU', 'airport', 'BR', 'Sudeste', 'SP', 'Guarulhos', 'GRU', 'Terminal 3', null::float8, null::float8, 'needs_geocoding'),
  ('nubank-ultravioleta-priority-pass', 'Rede Priority Pass', 'global_network', 'GLOBAL', null, null, null, null, null, null::float8, null::float8, 'not_applicable'),
  ('nubank-ultravioleta-nu-viagens', 'App Nubank / Nu Viagens', 'online', 'BR', null, null, null, null, null, null::float8, null::float8, 'not_applicable'),
  ('inter-prime-salas-vip', 'Sala VIP Inter — GRU', 'airport', 'BR', 'Sudeste', 'SP', 'Guarulhos', 'GRU', null, null::float8, null::float8, 'needs_geocoding'),
  ('inter-prime-salas-vip', 'Sala VIP Inter — CWB', 'airport', 'BR', 'Sul', 'PR', 'Curitiba', 'CWB', null, null::float8, null::float8, 'needs_geocoding'),
  ('inter-prime-salas-vip', 'Sala VIP Inter — CNF', 'airport', 'BR', 'Sudeste', 'MG', 'Confins', 'CNF', null, null::float8, null::float8, 'needs_geocoding'),
  ('inter-prime-salas-vip', 'Sala VIP Inter — FOR', 'airport', 'BR', 'Nordeste', 'CE', 'Fortaleza', 'FOR', null, null::float8, null::float8, 'needs_geocoding'),
  ('inter-prime-priority-pass', 'Rede Priority Pass', 'global_network', 'GLOBAL', null, null, null, null, null, null::float8, null::float8, 'not_applicable'),
  ('inter-loop-cashback-inter-shop', 'Super App Inter / Inter Shop', 'online', 'BR', null, null, null, null, null, null::float8, null::float8, 'not_applicable'),
  ('inter-duo-gourmet-2-por-1', 'Rede Duo Gourmet', 'global_network', 'BR', null, null, null, null, null, null::float8, null::float8, 'not_applicable'),
  ('xp-infinite-fast-pass', 'Aeroporto de Guarulhos', 'airport', 'BR', 'Sudeste', 'SP', 'Guarulhos', 'GRU', null, null::float8, null::float8, 'needs_geocoding'),
  ('xp-legacy-salas-vip-ilimitado', 'Rede global de salas VIP', 'global_network', 'GLOBAL', null, null, null, null, null, null::float8, null::float8, 'not_applicable'),
  ('xp-private-visa-infinite-privilege-lounge', 'Visa Infinite Privilege Lounge — GRU', 'airport', 'BR', 'Sudeste', 'SP', 'Guarulhos', 'GRU', null, null::float8, null::float8, 'needs_geocoding'),
  ('visa-infinite-fast-pass', 'Visa Infinite Fast Pass — GRU', 'airport', 'BR', 'Sudeste', 'SP', 'Guarulhos', 'GRU', 'Terminais 2 e 3', null::float8, null::float8, 'needs_geocoding'),
  ('visa-infinite-fast-pass', 'Visa Infinite Fast Pass — RIOgaleão', 'airport', 'BR', 'Sudeste', 'RJ', 'Rio de Janeiro', 'GIG', null, null::float8, null::float8, 'needs_geocoding'),
  ('visa-infinite-airport-companion', 'Visa Airport Companion', 'global_network', 'GLOBAL', null, null, null, null, null, null::float8, null::float8, 'not_applicable'),
  ('visa-infinite-protecao-compra', 'Portal de Benefícios Visa', 'online', 'BR', null, null, null, null, null, null::float8, null::float8, 'not_applicable')
) as t(slug, name, scope, country, region, uf, city, airport_code, terminal, lat, lng, geolocation_status)
  on t.slug = b.slug;
```

> Slugs de benefício referenciados aqui (ex.: `xp-infinite-fast-pass`, `xp-legacy-salas-vip-ilimitado`) precisam existir nas Tasks 3/4 — verifique que foram criados; o doc lista `benefit_xp_fast_pass_gru_gig`, `benefit_xp_legacy_salas_vip_ilimitado`. Se ainda não estiverem na Task 3, adicione-os lá (XP Infinite tem fast-pass; XP Legacy tem salas VIP ilimitadas e Meet&Greet — todos `mixed`/`issuer`, caminho direto).

- [ ] **Step 4: Reset + teste**

Run: `npx supabase db reset && npm test -- seed_locations`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql tests/seed_locations.integration.test.ts
git commit -m "feat(m7): seed de locais de resgate"
```

---

## Task 6: Frontend — 16 categorias (labels pt-BR) + regenerar tipos

**Files:**
- Modify: `src/features/benefits/types.ts`
- Modify: `src/lib/database.types.ts` (gerado)
- Test: `src/features/benefits/CategoryChips.test.tsx` (ajustar), `src/features/benefits/filterBenefits.test.ts` (ajustar se referenciar categoria removida)

- [ ] **Step 1: Atualizar o teste de CategoryChips (falha primeiro)**

Em `src/features/benefits/CategoryChips.test.tsx`, ajustar qualquer asserção que dependa das categorias antigas (`Viagem/Lazer/Saúde/Seguros/Compras`). Garantir que cobre pelo menos uma categoria nova, ex.:

```tsx
import { render, screen } from '@testing-library/react'
import { CategoryChips } from './CategoryChips'

it('renderiza o chip de aeroporto e o "Todos"', () => {
  render(<CategoryChips selected={null} onChange={() => {}} />)
  expect(screen.getByText('Todos')).toBeInTheDocument()
  expect(screen.getByText(/Aeroporto/)).toBeInTheDocument()
})
```

- [ ] **Step 2: Rodar o teste**

Run: `npm test -- CategoryChips`
Expected: FAIL (categoria "Aeroporto" ainda não existe).

- [ ] **Step 3: Atualizar types.ts com as 16 categorias**

Replace em `src/features/benefits/types.ts` o tipo `BenefitCategory` e a constante `CATEGORIES`:

```ts
export type BenefitCategory =
  | 'travel' | 'insurance' | 'cashback' | 'investback' | 'points' | 'miles'
  | 'shopping' | 'restaurant' | 'airport' | 'concierge' | 'investment'
  | 'security' | 'account_service' | 'international_purchase' | 'experience' | 'other'

// ... interface MyBenefit permanece igual (category: BenefitCategory) ...

export const CATEGORIES: { key: BenefitCategory; label: string; emoji: string }[] = [
  { key: 'travel', label: 'Viagem', emoji: '✈️' },
  { key: 'airport', label: 'Aeroporto', emoji: '🛫' },
  { key: 'insurance', label: 'Seguros', emoji: '🛡️' },
  { key: 'shopping', label: 'Compras', emoji: '🛍️' },
  { key: 'cashback', label: 'Cashback', emoji: '💸' },
  { key: 'investback', label: 'Investback', emoji: '📈' },
  { key: 'points', label: 'Pontos', emoji: '⭐' },
  { key: 'miles', label: 'Milhas', emoji: '🪙' },
  { key: 'restaurant', label: 'Restaurantes', emoji: '🍽️' },
  { key: 'concierge', label: 'Concierge', emoji: '🛎️' },
  { key: 'investment', label: 'Investimentos', emoji: '🏦' },
  { key: 'security', label: 'Proteção', emoji: '🔒' },
  { key: 'account_service', label: 'Conta', emoji: '💳' },
  { key: 'international_purchase', label: 'Internacional', emoji: '🌎' },
  { key: 'experience', label: 'Experiências', emoji: '🎬' },
  { key: 'other', label: 'Outros', emoji: '🎁' },
]
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- CategoryChips`
Expected: PASS.

- [ ] **Step 5: Regenerar os tipos do banco**

Run: `npm run gen:types`
Then run: `npm run build`
Expected: `tsc` sem erros. Se houver erro de enum em algum cast `as never` no admin (`src/features/admin/benefits/BenefitForm.tsx`), confirmar que os valores de categoria oferecidos no form usam as novas chaves; ajustar a lista de opções do form para `CATEGORIES` se necessário.

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npm test`
Expected: tudo verde.

- [ ] **Step 7: Commit**

```bash
git add src/features/benefits/types.ts src/features/benefits/CategoryChips.test.tsx \
        src/lib/database.types.ts src/features/admin/benefits/BenefitForm.tsx
git commit -m "feat(m7): 16 categorias com labels pt-BR + tipos regenerados"
```

---

## Task 7: Verificação final + checklist do doc (§13)

**Files:**
- Test: `tests/checklist_mvp.integration.test.ts` (novo)

- [ ] **Step 1: Escrever o teste de checklist (falha primeiro se faltar dado)**

Create `tests/checklist_mvp.integration.test.ts` (cobre cenários da §13 ainda não cobertos):

```ts
import { describe, it, expect } from 'vitest'
import { serviceClient, userClient } from './helpers/clients'

async function titlesFor(slug: string) {
  const db = serviceClient()
  const { data: it } = await db.from('source_items').select('id').eq('slug', slug).single()
  const { client } = await userClient()
  await client.rpc('replace_user_sources', { item_ids: [it!.id] })
  const { data } = await client.from('my_benefits').select('title')
  return (data ?? []).map((r) => r.title as string)
}

describe('checklist MVP (doc §13)', () => {
  it('Inter Gold/Platinum/Prime/Win têm pontuação Loop', async () => {
    for (const slug of ['inter-gold', 'inter-platinum', 'inter-prime', 'inter-win']) {
      const titles = await titlesFor(slug)
      expect(titles.some((t) => /Loop/i.test(t))).toBe(true)
    }
  })

  it('XP Infinite vê 4 salas VIP + benefícios Visa Infinite', async () => {
    const titles = await titlesFor('xp-infinite')
    expect(titles.some((t) => /salas VIP|sala VIP/i.test(t))).toBe(true)
    expect(titles.some((t) => /Visa|Locadora|Emergência Médica/i.test(t))).toBe(true)
  })

  it('Mastercard Black (via Inter Prime) vê compra protegida, garantia estendida e concierge', async () => {
    const titles = await titlesFor('inter-prime')
    expect(titles.some((t) => /Compra Protegida/i.test(t))).toBe(true)
    expect(titles.some((t) => /Garantia Estendida/i.test(t))).toBe(true)
    expect(titles.some((t) => /Concierge/i.test(t))).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar o teste**

Run: `npm test -- checklist_mvp`
Expected: PASS (se algum cenário falhar, completar o benefício/ligação faltante na Task 3/4 e re-rodar).

- [ ] **Step 3: Verificação completa**

Run: `npx supabase db reset && npm test && npm run build`
Expected: reset limpo; toda a suíte verde; build ok.

- [ ] **Step 4: Confirmar ausência de catálogo demo**

Run: `npm test -- seed_catalog`
Expected: PASS (asserção "nenhuma demo" já cobre).

- [ ] **Step 5: Commit**

```bash
git add tests/checklist_mvp.integration.test.ts
git commit -m "test(m7): checklist MVP do catálogo real (doc §13)"
```

---

## Pós-execução (fora do escopo de código — exige decisão/autorização)

- **Aplicar em produção (hard replace autorizado):** rodar a remoção escopada + seed via `/pg/query` no Supabase de produção. **Antes**, reportar a contagem de `user_sources` afetadas (`select count(*) from user_sources;`). **Só com confirmação explícita do usuário** (seção 5.0 do spec). Não é passo automatizável — requer o "pode aplicar em prod".
- **Push para origin/main:** dispara auto-deploy do front (webhook). Confirmar com o usuário antes.

---

## Self-Review (preenchido pelo autor do plano)

**Cobertura do spec:**
- §3.1 slugs → Task 1 Step 1. §3.2 enum 16 → Task 1 Step 1. §3.3 enums aux → Task 1 Step 1. §3.4 colunas → Task 1 Step 1. §3.5 benefit_card_tiers → Task 1 Step 1. §3.6 RLS → Task 1 Step 2 (migration 0010). §4 view UNION → Task 1 Step 1. §5.0 limpeza escopada → Task 1 Step 3. §5.1 seed (sources/items/benefits/card_tiers/locations) → Tasks 2–5. §6 testes → todas as tasks + Task 7. §7 arquivos → cobertos. §8 riscos (demo sobrevivente, user_sources prod) → Task 1 Step 3 + bloco Pós-execução.
- Gap conhecido e tratado: troca de enum + remoção demo quebraria 4 testes → Task 1 Step 7 os desacopla.

**Placeholder scan:** as listas de benefícios em §Task 3/4 trazem exemplos completos + enumeração explícita de TODOS os slugs e ligações; os textos verbatim vêm do doc in-repo (transcrição mecânica, não placeholder). Migrations, RLS, view, frontend e testes têm código completo.

**Consistência de tipos/nomes:** vocabulário brand/level lowercase usado de forma idêntica em seed e testes; slugs idênticos entre benefits/benefit_sources/benefit_card_tiers/benefit_locations; colunas batem com a migration 0009.
