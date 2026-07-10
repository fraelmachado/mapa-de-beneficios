# P1 — Modelo de origem fonte-agnóstico (camada de dados) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status de execução (auditado em 2026-07-10):** implementação concluída no repositório (`cc335e5` a `c00316c`). Taxonomia, contrato da view e tipos estão cobertos pelos testes de integração aprovados. Os checklists abaixo permanecem como roteiro histórico.

**Goal:** Dar à `my_benefits` o contrato de dados que o reskin fonte-agnóstico (P2) precisa: origem primária (tipo-de-fonte + provedor) e origem secundária (bandeira/parceiro), introduzindo a taxonomia `source_category`.

**Architecture:** Duas migrations aditivas. A primeira cria o enum `source_category` (7 valores) + coluna em `sources`, faz backfill das fontes atuais para `bank_card` e atualiza o `seed.sql`. A segunda recria a view `my_benefits` (security_invoker mantido) levando o `join sources` nos **dois** caminhos (direto e derivado por bandeira) para agregar `origins` (`{provider, category}[]`) e `networks` (`{brand, level}[]`), e projeta o escalar `benefit_source`. Os tipos TypeScript do front (`MyBenefit`) e os tipos gerados (`database.types.ts`) acompanham.

**Tech Stack:** Supabase/Postgres (migrations SQL, views `security_invoker`, PostgREST), Vitest (testes de integração contra o Supabase local via OrbStack/Docker), TypeScript.

## Global Constraints

- **Escopo é só dados.** Nenhuma mudança de UI/onboarding (isso é P2/P3): não tocar em **componentes React de tela** nem em copy/layout. Os únicos arquivos de front nesta P1 são os do contrato de dados: `src/features/benefits/types.ts` (tipos), `src/features/benefits/useMyBenefits.ts` (o `select` da query, para os campos novos chegarem ao app) e `src/lib/database.types.ts` (gerado).
- **Migrations aditivas.** Não dropar colunas existentes. `sources.kind` é **mantido** como metadado técnico (legado); `source_category` é a nova dimensão de UI. Não remover `kind` neste P1.
- **`source_category` enum — exatamente estes 7 valores, em snake_case minúsculo, nesta ordem:** `bank_card`, `carrier`, `health`, `corporate_benefits`, `loyalty`, `retail`, `mall`.
- **`benefit_source` já existe** como enum `benefit_source_kind` (`issuer`/`card_network`/`partner`/`mixed`) em `benefits` (migration 0009). P1 só passa a **projetá-lo** na view — não recria o enum.
- **A view DEVE manter `with (security_invoker = true)`** e `grant select on my_benefits to authenticated`. Qualquer recreação que perca isso é um vazamento de RLS.
- **Não alterar `user_sources` nem o mecanismo de seleção** (`replace_user_sources`). Só muda a projeção/leitura.
- **Vocabulário controlado de bandeira (já vigente, minúsculo):** `card_brand ∈ {mastercard, visa}`, `card_level ∈ {gold, platinum, black, signature, infinite}`.
- **Numeração de migration:** a próxima livre é `0012`, depois `0013` (atual topo: `0011_my_benefits_fonte.sql`).
- **Ambiente de teste:** OrbStack/Docker no ar; `npx supabase db reset` aplica migrations + `seed.sql`; testes de integração em `tests/*.integration.test.ts` usam `serviceClient()`/`userClient()` de `tests/helpers/clients`.

---

## File Structure

- **Create** `supabase/migrations/0012_source_category.sql` — enum `source_category` + coluna em `sources` + backfill `bank_card` + `set not null`.
- **Modify** `supabase/seed.sql` — incluir `source_category` no insert de `sources` e no `on conflict do update set`.
- **Create** `supabase/migrations/0013_my_benefits_origens.sql` — recria `my_benefits` com `origins`, `networks` e `benefit_source`.
- **Modify** `src/features/benefits/types.ts` — `SourceCategory`, `BenefitSourceKind`, `BenefitOrigin`, `BenefitNetwork`; estender `MyBenefit`.
- **Modify** `src/features/benefits/useMyBenefits.ts` — o `select` é hard-coded por coluna; incluir `benefit_source, origins, networks` (senão os campos novos voltam `undefined` em runtime apesar do tipo).
- **Modify** `src/lib/database.types.ts` — regenerado via `npm run gen:types` (mecânico).
- **Create** `tests/source_category.integration.test.ts` — contrato do enum/coluna/backfill.
- **Create** `tests/my_benefits_origens.integration.test.ts` — contrato da view (origins/networks/benefit_source).

---

### Task 1: Taxonomia `source_category` (enum + coluna + backfill + seed)

**Files:**
- Create: `supabase/migrations/0012_source_category.sql`
- Modify: `supabase/seed.sql` (insert de `sources`)
- Test: `tests/source_category.integration.test.ts`

**Interfaces:**
- Consumes: tabela `sources` (colunas `slug`, `kind`, `name`, …); seed atual com 3 fontes (`nubank`/`inter`/`xp`, todas `kind='card'`).
- Produces: enum Postgres `source_category` (7 valores) + coluna `sources.source_category source_category not null`. Todas as fontes do catálogo passam a ter `source_category='bank_card'`. Consumido pela view na Task 2 (`s.source_category`).

**Por que migration e seed juntos:** o `default 'bank_card'` cobre o NOT NULL para qualquer writer (prod, teste, admin) — mas o seed de catálogo deve setar `source_category` **explicitamente** para não depender do default (deixa a intenção clara e já prepara o terreno para futuras fontes não-bancárias, que NÃO devem herdar o default). Por isso as duas mudanças andam juntas nesta task.

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/source_category.integration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { serviceClient } from './helpers/clients'

describe('taxonomia source_category', () => {
  it('sources do catálogo têm source_category = bank_card', async () => {
    const db = serviceClient()
    const { data, error } = await db
      .from('sources')
      .select('slug, source_category')
      .in('slug', ['nubank', 'inter', 'xp'])
    expect(error).toBeNull()
    const rows = data ?? []
    expect(rows.length).toBe(3)
    expect(rows.every((r) => r.source_category === 'bank_card')).toBe(true)
  })

  it('source_category rejeita valor fora do enum', async () => {
    const stamp = `${Date.now()}-${Math.floor(performance.now() * 1000)}`
    const db = serviceClient()
    const { error } = await db
      .from('sources')
      .insert({ kind: 'card', name: `S-${stamp}`, sort_order: 99, slug: `s-${stamp}`,
                source_category: 'not_a_real_category' })
    expect(error).not.toBeNull()
  })

  it('aceita um novo valor válido do enum (ex.: health)', async () => {
    const stamp = `${Date.now()}-${Math.floor(performance.now() * 1000)}`
    const db = serviceClient()
    const { data, error } = await db
      .from('sources')
      .insert({ kind: 'loyalty', name: `S-${stamp}`, sort_order: 99, slug: `s-${stamp}`,
                source_category: 'health' })
      .select('source_category')
      .single()
    expect(error).toBeNull()
    expect(data!.source_category).toBe('health')
    await db.from('sources').delete().eq('slug', `s-${stamp}`)
  })
})
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/source_category.integration.test.ts`
Expected: FAIL — coluna `source_category` não existe (erro PostgREST `column sources.source_category does not exist`).

- [ ] **Step 3: Escrever a migration**

Create `supabase/migrations/0012_source_category.sql`:

```sql
-- P1: taxonomia de categoria de fonte (UI). Aditiva.
-- source_category é a dimensão voltada ao usuário (agrupa onboarding, ícone, pílula
-- de origem). sources.kind é mantido como metadado técnico (legado), não é removido.
create type source_category as enum (
  'bank_card','carrier','health','corporate_benefits','loyalty','retail','mall');

-- not null DEFAULT 'bank_card': em produção a coluna é preenchida automaticamente
-- para todas as fontes existentes (100% do catálogo atual é banco/cartão), e
-- escritores que ainda não conhecem a coluna (seed de teste, admin SourceForm)
-- não quebram o NOT NULL — recebem o default. O seed de catálogo (Task 1, Step 4)
-- ainda seta 'bank_card' explicitamente.
alter table sources add column source_category source_category not null default 'bank_card';
```

> **Por que `default` e não `set not null` puro:** writers existentes inserem em `sources` sem `source_category` — o teste de schema (`tests/catalogo_real_schema.integration.test.ts:32`) e o admin `SourceForm`/`useAdminSources`. Sem default, o NOT NULL os faz falhar. O default mantém o contrato NOT NULL forte sem quebrá-los.
>
> **Follow-up (fora do P1):** quando o P4 introduzir fontes não-bancárias, o admin `SourceForm` precisa ganhar o campo `source_category` (senão carrier/health criados pela UI viram `bank_card` silenciosamente), e aí o default pode ser removido. Registrar isso na spec do P2/P4.

- [ ] **Step 4: Atualizar o seed**

In `supabase/seed.sql`, alterar o insert de `sources` para incluir `source_category`. Substituir o bloco atual:

```sql
insert into sources (slug, kind, name, sort_order, institution_url, country) values
  ('nubank', 'card', 'Nubank',      1, 'https://nubank.com.br', 'BR'),
  ('inter',  'card', 'Banco Inter', 2, 'https://inter.co',      'BR'),
  ('xp',     'card', 'XP',          3, 'https://www.xpi.com.br','BR')
on conflict (slug) do update set
  kind = excluded.kind, name = excluded.name, sort_order = excluded.sort_order,
  institution_url = excluded.institution_url, country = excluded.country;
```

por:

```sql
insert into sources (slug, kind, name, sort_order, institution_url, country, source_category) values
  ('nubank', 'card', 'Nubank',      1, 'https://nubank.com.br', 'BR', 'bank_card'),
  ('inter',  'card', 'Banco Inter', 2, 'https://inter.co',      'BR', 'bank_card'),
  ('xp',     'card', 'XP',          3, 'https://www.xpi.com.br','BR', 'bank_card')
on conflict (slug) do update set
  kind = excluded.kind, name = excluded.name, sort_order = excluded.sort_order,
  institution_url = excluded.institution_url, country = excluded.country,
  source_category = excluded.source_category;
```

- [ ] **Step 5: Aplicar migrations + seed e rodar o teste**

Run: `npx supabase db reset && npx vitest run tests/source_category.integration.test.ts`
Expected: PASS (3 testes verdes).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0012_source_category.sql supabase/seed.sql tests/source_category.integration.test.ts
git commit -m "feat(p1): taxonomia source_category (enum + coluna + backfill bank_card)"
```

---

### Task 2: `my_benefits` projeta origem primária (origins) + secundária (benefit_source/networks)

**Files:**
- Create: `supabase/migrations/0013_my_benefits_origens.sql`
- Modify: `src/features/benefits/types.ts`
- Modify: `src/features/benefits/useMyBenefits.ts` (select hard-coded por coluna)
- Modify: `src/lib/database.types.ts` (regenerado, mecânico)
- Test: `tests/my_benefits_origens.integration.test.ts`

**Interfaces:**
- Consumes: `sources.source_category` (Task 1); `sources.name`; `benefits.benefit_source` (enum `benefit_source_kind`, migration 0009); `benefit_card_tiers (card_brand, card_level)`; `source_items.card_brand/card_level`; `user_sources`. Caminhos direto (`benefit_sources`) e derivado (`benefit_card_tiers`) já existentes na view 0011.
- Produces: a view `my_benefits` ganha 3 colunas:
  - `benefit_source text|null` — escalar (`issuer`/`card_network`/`partner`/`mixed`).
  - `origins jsonb` — array de `{ "provider": string, "category": source_category }` (sempre ≥1).
  - `networks jsonb` — array de `{ "brand": string, "level": string }` (bandeira que destrava, só caminho derivado; `[]` quando não houver).
  - `MyBenefit` (TS) ganha `benefit_source`, `origins`, `networks`; e exporta `SourceCategory`, `BenefitSourceKind`, `BenefitOrigin`, `BenefitNetwork`.

**Decisão pinada:** `networks` projeta o **par bruto** `{brand, level}` (não o rótulo "Visa Infinite" já formatado). A formatação ("🏦 Banco · Nubank", "Visa Infinite") é apresentação e fica no P2. Mantém a camada de dados sem lógica de copy.

**Nota de multiplicidade:** `source_items.source_id` é `not null references sources(id)`, então `join sources` é 1:1 e não altera a contagem de linhas (dedup e `via` preservados). `group by b.id` é válido (PK de `benefits`).

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/my_benefits_origens.integration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { serviceClient, userClient } from './helpers/clients'

describe('my_benefits projeta origem primária e secundária', () => {
  it('origins traz {provider, category}; networks traz {brand, level} no caminho de bandeira', async () => {
    const db = serviceClient()
    // xp-infinite é um source_item de cartão (visa/infinite) que destrava
    // benefícios card_network via benefit_card_tiers (caminho derivado).
    const { data: item } = await db.from('source_items').select('id').eq('slug', 'xp-infinite').single()
    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [item!.id] })

    const { data, error } = await client
      .from('my_benefits')
      .select('title, benefit_source, origins, networks')
    expect(error).toBeNull()
    const rows = data ?? []
    expect(rows.length).toBeGreaterThan(0)

    // origin primária: toda linha tem ao menos um {provider, category}
    expect(rows.every((r) => Array.isArray(r.origins) && r.origins.length > 0)).toBe(true)
    expect(rows.every((r) =>
      (r.origins as Array<{ provider: string; category: string }>).every(
        (o) => typeof o.provider === 'string' && typeof o.category === 'string',
      ),
    )).toBe(true)
    // a fonte é XP → categoria bank_card, provedor "XP"
    expect(rows.some((r) =>
      (r.origins as Array<{ provider: string; category: string }>).some(
        (o) => o.provider === 'XP' && o.category === 'bank_card',
      ),
    )).toBe(true)

    // origem secundária: pelo menos um benefício card_network com networks {brand, level}
    const cardNetwork = rows.filter((r) => r.benefit_source === 'card_network')
    expect(cardNetwork.length).toBeGreaterThan(0)
    expect(cardNetwork.some((r) =>
      (r.networks as Array<{ brand: string; level: string }>).some(
        (n) => n.brand === 'visa' && n.level === 'infinite',
      ),
    )).toBe(true)
  })

  it('networks é [] para benefício do caminho direto (sem bandeira)', async () => {
    const db = serviceClient()
    // nubank-ultravioleta-black destrava benefícios issuer/partner pelo caminho direto
    // (benefit_sources). Benefícios issuer/partner nunca entram em benefit_card_tiers,
    // então só aparecem pelo caminho direto, onde network_brand é null → networks [].
    const { data: item } = await db.from('source_items').select('id').eq('slug', 'nubank-ultravioleta-black').single()
    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [item!.id] })

    const { data, error } = await client
      .from('my_benefits')
      .select('benefit_source, networks')
    expect(error).toBeNull()
    const direct = (data ?? []).filter((r) => r.benefit_source !== 'card_network')
    expect(direct.length).toBeGreaterThan(0)
    expect(direct.every((r) => Array.isArray(r.networks) && r.networks.length === 0)).toBe(true)
  })
})
```

> Se os slugs `xp-infinite`/`nubank-ultravioleta` não existirem no seed, confirme os slugs reais com:
> `grep -nE "slug.*(infinite|ultravioleta|xp|nubank)" supabase/seed.sql` e ajuste o teste para um `source_item` de cartão (visa/infinite) e um item que só destrava pelo caminho direto. Não invente slugs.

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/my_benefits_origens.integration.test.ts`
Expected: FAIL — colunas `origins`/`networks`/`benefit_source` não existem na view (`column my_benefits.origins does not exist`).

- [ ] **Step 3: Escrever a migration da view**

Create `supabase/migrations/0013_my_benefits_origens.sql`:

```sql
-- P1: my_benefits ganha origem primária (origins) e secundária (benefit_source/networks).
-- Aditiva: só recria a view; security_invoker mantido, RLS das tabelas-base inalterada.
-- Leva o join a sources nos DOIS caminhos para agregar provedor + source_category.
drop view if exists my_benefits;
create view my_benefits with (security_invoker = true) as
with unlocked as (
  -- caminho direto: benefit_sources -> source_items -> sources
  select b.id as benefit_id, si.label as via,
         s.name as provider, s.source_category as source_category,
         null::text as network_brand, null::text as network_level
  from benefits b
  join benefit_sources bs on bs.benefit_id = b.id
  join source_items si on si.id = bs.source_item_id
  join sources s on s.id = si.source_id
  join user_sources us on us.source_item_id = si.id
  where us.user_id = auth.uid() and b.active
  union
  -- caminho derivado (bandeira): benefit_card_tiers casado por brand/level
  select b.id, si.label,
         s.name, s.source_category,
         si.card_brand, si.card_level
  from benefits b
  join benefit_card_tiers bct on bct.benefit_id = b.id
  join source_items si on si.card_brand = bct.card_brand
                      and si.card_level = bct.card_level
  join sources s on s.id = si.source_id
  join user_sources us on us.source_item_id = si.id
  where us.user_id = auth.uid() and b.active
)
select b.id, b.title, b.summary, b.category, b.scope, b.uf, b.steps,
       b.partner_name, b.valid_until, b.image_url, b.action_url, b.action_label,
       b.created_at, b.source_url, b.source_name, b.observed_at, b.benefit_source,
       array_agg(distinct u.via order by u.via) as via,
       coalesce(
         jsonb_agg(distinct jsonb_build_object(
           'provider', u.provider, 'category', u.source_category)),
         '[]'::jsonb) as origins,
       coalesce(
         jsonb_agg(distinct jsonb_build_object(
           'brand', u.network_brand, 'level', u.network_level))
           filter (where u.network_brand is not null),
         '[]'::jsonb) as networks
from unlocked u join benefits b on b.id = u.benefit_id
group by b.id;
grant select on my_benefits to authenticated;
```

- [ ] **Step 4: Aplicar e rodar o teste da view**

Run: `npx supabase db reset && npx vitest run tests/my_benefits_origens.integration.test.ts`
Expected: PASS (2 testes verdes).

- [ ] **Step 5: Estender os tipos TypeScript do front**

In `src/features/benefits/types.ts`, abaixo do `BenefitCategory`, adicionar os tipos novos e estender `MyBenefit`. Inserir antes de `export interface MyBenefit`:

```ts
export type SourceCategory =
  | 'bank_card' | 'carrier' | 'health' | 'corporate_benefits'
  | 'loyalty' | 'retail' | 'mall'

export type BenefitSourceKind = 'issuer' | 'card_network' | 'partner' | 'mixed'

export interface BenefitOrigin {
  provider: string
  category: SourceCategory
}

export interface BenefitNetwork {
  brand: string
  level: string
}
```

E dentro de `MyBenefit`, adicionar os três campos (após `observed_at`, antes de `via`):

```ts
  observed_at: string | null
  benefit_source: BenefitSourceKind | null
  origins: BenefitOrigin[]
  networks: BenefitNetwork[]
  via: string[]
```

- [ ] **Step 6: Atualizar o `select` do hook consumidor**

`src/features/benefits/useMyBenefits.ts` lista as colunas explicitamente no `.select(...)`; sem isso, PostgREST não retorna os campos novos e eles vêm `undefined` em runtime (apesar do tipo). Adicionar `benefit_source, origins, networks` à string do select:

```ts
        .select(
          'id, title, summary, category, scope, uf, steps, partner_name, valid_until, image_url, action_url, action_label, created_at, source_url, source_name, observed_at, benefit_source, origins, networks, via',
        )
```

- [ ] **Step 7: Regenerar os tipos do banco e rodar a suíte completa**

Run: `npm run gen:types && npm test`
Expected: `gen:types` atualiza `src/lib/database.types.ts` com o enum `source_category`, a coluna em `sources` e as colunas novas da view `my_benefits`; `npm test` passa inteiro (nenhuma tela mudou, só o tipo cresceu de forma aditiva e o hook passou a selecionar os campos novos).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0013_my_benefits_origens.sql src/features/benefits/types.ts src/features/benefits/useMyBenefits.ts src/lib/database.types.ts tests/my_benefits_origens.integration.test.ts
git commit -m "feat(p1): my_benefits projeta origins + benefit_source + networks"
```

---

## Self-Review

**1. Cobertura da spec (`docs/superpowers/specs/2026-06-16-modelo-fonte-agnostico-design.md`):**
- §2 / §7.1 — enum `source_category` (7 valores) + coluna + backfill `bank_card` → **Task 1**. ✅
- §3 / §7.2 — view projeta provedor (`sources.name`) + `source_category` agregados (primária) → `origins` na **Task 2**. ✅
- §3 / §7.2 — view projeta `benefit_source` (faltava) → escalar na **Task 2**. ✅
- §3 / §7.2 — rótulo de bandeira = `card_brand`/`card_level` do match no caminho derivado (faltava) → `networks` na **Task 2**. ✅
- §7.2 — manter `partner_name` (secundária) → já projetado, preservado na recriação. ✅
- §7.4 — `kind` alinhado/depreciado: decisão de execução = **manter `kind` como metadado técnico legado**, `source_category` vira a dimensão de UI (Global Constraints + comentário do migration 0012). ✅
- §7.5 — sem mudança em `user_sources`/seleção → nenhuma task toca isso. ✅

**Consumidores da view (verificado no código):** só `src/features/benefits/useMyBenefits.ts` faz `.from('my_benefits')` com `select` por coluna → atualizado na Task 2 Step 6. `NOT NULL DEFAULT 'bank_card'` evita quebrar os writers existentes de `sources` (`tests/catalogo_real_schema.integration.test.ts:32` e o admin `SourceForm`/`useAdminSources`, que não enviam `source_category`). Follow-up registrado: P2/P4 devem adicionar o campo ao admin `SourceForm` e remover o default quando surgirem fontes não-bancárias.

**2. Placeholder scan:** sem TBD/TODO; todo SQL e TS estão completos. A única ressalva condicional (slugs `xp-infinite`/`nubank-ultravioleta`) traz o comando exato de verificação e a instrução de ajuste — não é placeholder de implementação.

**3. Consistência de tipos:** `origins` (SQL `{provider, category}`) ↔ `BenefitOrigin {provider, category}`; `networks` (SQL `{brand, level}`) ↔ `BenefitNetwork {brand, level}`; `benefit_source` enum (`issuer`/`card_network`/`partner`/`mixed`) ↔ `BenefitSourceKind`. `source_category` (7 valores) idêntico no enum SQL e em `SourceCategory`. Consistente.

**Fora do escopo (planos próprios):** formatação/exibição da origem e diversificação de exemplos (P2 — reskin); onboarding multi-step (P3); popular categorias novas com providers reais (P4).
