# P4 — Autodiscover de catálogo (discovery) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status de execução (auditado em 2026-07-10):** implementação concluída no repositório (`ccc0beb` a `29e7d3a`). Schema staging, agente, validação, promoção transacional e UI admin passaram na suíte cumulativa; o smoke real local foi executado anteriormente com Wellhub. O P4 não foi identificado no bundle atualmente publicado, portanto deploy e smoke de produção permanecem pendentes.

**Goal:** Build a human-gated discovery pipeline that lets an LLM research agent propose new catalog sources/items/benefits as reviewable candidates, which an admin approves and promotes into the real catalog.

**Architecture:** A staging layer (`discovery_jobs` + `discovery_candidates`) holds machine-proposed candidates; nothing reaches the catalog without an admin promoting it. A Node script (`scripts/discovery/discover.ts`) claims a job atomically, shells out to the Codex CLI (untrusted subprocess, secret-free env) to produce a `candidates.json` tree, validates it with zod, and upserts fingerprinted candidates. An admin reviews at `/admin/discovery` and promotes via a transactional SECURITY DEFINER RPC. Idempotency (fingerprint upsert) and parallelism (`FOR UPDATE SKIP LOCKED` claim) live in the schema, so a future Worker wraps the same code with no data rework.

**Tech Stack:** TypeScript, React + react-router, `@supabase/supabase-js`, TanStack Query, Postgres (Supabase local), Vitest, zod (new dep), Codex CLI (`codex exec`).

**Spec:** [`docs/superpowers/specs/2026-06-28-mapa-de-beneficios-p4-autodiscover-catalogo-design.md`](../specs/2026-06-28-mapa-de-beneficios-p4-autodiscover-catalogo-design.md)

## Global Constraints

- **Migration numbering:** next free numbers are `0015` and `0016` (P1 landed as `0012_source_category.sql`; last is `0014_source_requests.sql`). `source_category` already exists as a Postgres enum with values `bank_card, carrier, health, corporate_benefits, loyalty, retail, mall`.
- **No server.** The app is a Vite SPA. The browser uses the **anon** client (`src/lib/supabase.ts`) authenticated as an admin; catalog writes are authorized by `is_admin()` RLS policies. `SUPABASE_SERVICE_ROLE_KEY` exists **only** in Node (scripts/tests) via `.env.local`.
- **Security (load-bearing):** the Codex subprocess is untrusted (consumes web content → prompt-injection risk). It must be spawned with an **allowlisted env** that contains **no** `SUPABASE_*` secrets — only what Codex needs to authenticate (`HOME`/`CODEX_HOME`, `PATH`). Only `discover.ts` (holding `service_role`) writes to the DB, after zod validation.
- **RLS pattern:** copy the exact `is_admin()` pattern from `0003_rls.sql` — `grant ... to authenticated` + `enable row level security` + read/admin policies. `service_role` gets full grants and bypasses RLS.
- **Test pattern:** integration tests use `serviceClient()` / `userClient()` / `adminClient()` from [`tests/helpers/clients.ts`](../../../tests/helpers/clients.ts); env loads from `.env.local` (dotenv, via `src/test-setup.ts`). Local Supabase must be running (`supabase start`). Unique test data uses a `${Date.now()}-${Math.floor(performance.now()*1000)}` stamp.
- **Test DB hygiene:** integration tests create rows and don't always tear down. When onboarding/admin looks polluted, run `supabase db reset` (see memory `mapa-de-beneficios-test-db-pollution`).
- **Slugs are kebab-case:** sources `nubank`; source_items `<source-slug>-<label>` e.g. `nubank-gold`; benefits their own slug. Slug uniqueness (`slug unique`) is what makes promotion idempotent.
- **Type check:** `npm test` does NOT run `tsc`. Run `npm run build` to catch type breakage (memory `mapa-de-beneficios-vitest-no-typecheck`).

---

## File Structure

**Migrations**
- `supabase/migrations/0015_discovery.sql` — enums, `discovery_jobs`, `discovery_candidates`, RLS, grants, `claim_discovery_job()` RPC.
- `supabase/migrations/0016_discovery_promote.sql` — `promote_discovery_candidate()` transactional RPC.

**Discovery script (`scripts/discovery/`)** — Node/TS, run manually or in CI.
- `fingerprint.ts` — `normalize`, `slugify`, and per-entity fingerprint functions. Pure.
- `candidatesSchema.ts` — zod schema for the agent's output tree + the plain JSON Schema object passed to Codex. Pure.
- `matchCatalog.ts` — `matchStatus()` computes `new|update|duplicate` against a catalog snapshot. Pure.
- `catalogSnapshot.ts` — reads existing slugs/ids from the DB (service client).
- `flatten.ts` — turns the validated tree into flat candidate rows with `fingerprint` / `parent_fingerprint` / `match_status`. Pure.
- `runCodex.ts` — spawns Codex with a sanitized env; returns parsed (untrusted) JSON. Injectable.
- `discover.ts` — orchestrator: `runJob(deps)` + a CLI `main()`.

**Admin UI (`src/features/admin/discovery/`)** — mirrors `src/features/admin/benefits/`.
- `types.ts` — row/enum types.
- `useDiscovery.ts` — TanStack Query hooks (jobs list, create job, candidates by job, promote via RPC, reject, patch payload).
- `AdminDiscovery.tsx` — jobs list + "novo job" form.
- `CandidateTree.tsx` — candidate tree grouped source→item→benefit with chips + approve/reject/edit actions.

**Wiring**
- `src/router.tsx` — add `/admin/discovery` route.
- `src/features/admin/AdminHome.tsx` + `src/features/admin/AdminLayout.tsx` — add nav link.

---

## Phase A — Schema & pure logic

### Task 1: Discovery tables, RLS, and atomic job claim

**Files:**
- Create: `supabase/migrations/0015_discovery.sql`
- Test: `tests/discovery_schema.integration.test.ts`

**Interfaces:**
- Produces (SQL surface):
  - Table `discovery_jobs(id uuid pk, brief text, status discovery_job_status, claimed_at timestamptz, claimed_by text, error text, created_by uuid, created_at timestamptz)`.
  - Table `discovery_candidates(id uuid pk, job_id uuid, entity_type discovery_entity_type, fingerprint text unique, parent_fingerprint text, payload jsonb, provenance jsonb, match_status discovery_match_status, matched_id uuid, review_status discovery_review_status, reviewed_by uuid, promoted_id uuid, promoted_at timestamptz, created_at timestamptz)`.
  - Enums: `discovery_job_status(pending|processing|done|error)`, `discovery_entity_type(source|source_item|benefit)`, `discovery_match_status(new|update|duplicate)`, `discovery_review_status(pending|approved|rejected)`.
  - RPC `claim_discovery_job(worker text) returns discovery_jobs` — atomically flips one `pending` job to `processing` using `FOR UPDATE SKIP LOCKED`; returns the claimed row or no rows.

- [ ] **Step 1: Write the failing test**

Create `tests/discovery_schema.integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { serviceClient, userClient, adminClient } from './helpers/clients'

const stamp = () => `${Date.now()}-${Math.floor(performance.now() * 1000)}`

describe('discovery schema', () => {
  it('service_role insere job e candidato; enums válidos', async () => {
    const db = serviceClient()
    const brief = `Discovery ${stamp()}`
    const job = await db.from('discovery_jobs').insert({ brief }).select('id, status').single()
    expect(job.error).toBeNull()
    expect(job.data!.status).toBe('pending')

    const cand = await db
      .from('discovery_candidates')
      .insert({
        job_id: job.data!.id,
        entity_type: 'source',
        fingerprint: `source|s-${stamp()}`,
        payload: { name: 'X', source_category: 'health', slug: `s-${stamp()}` },
        provenance: { source_url: 'https://x.dev' },
        match_status: 'new',
        review_status: 'pending',
      })
      .select('id, review_status')
      .single()
    expect(cand.error).toBeNull()
    expect(cand.data!.review_status).toBe('pending')
  })

  it('fingerprint é unique (upsert em vez de duplicar)', async () => {
    const db = serviceClient()
    const job = await db.from('discovery_jobs').insert({ brief: `J-${stamp()}` }).select('id').single()
    const fp = `source|dup-${stamp()}`
    const base = {
      job_id: job.data!.id, entity_type: 'source' as const, fingerprint: fp,
      payload: {}, provenance: {}, match_status: 'new' as const, review_status: 'pending' as const,
    }
    const a = await db.from('discovery_candidates').insert(base).select('id').single()
    expect(a.error).toBeNull()
    const b = await db.from('discovery_candidates').insert(base)
    expect(b.error).not.toBeNull() // viola unique(fingerprint)
  })

  it('RLS: admin lê candidatos; usuário comum não', async () => {
    const db = serviceClient()
    const job = await db.from('discovery_jobs').insert({ brief: `R-${stamp()}` }).select('id').single()
    const seeded = await db.from('discovery_candidates').insert({
      job_id: job.data!.id, entity_type: 'source', fingerprint: `source|rls-${stamp()}`,
      payload: {}, provenance: {}, match_status: 'new', review_status: 'pending',
    }).select('id').single()
    expect(seeded.error).toBeNull()

    const adm = await adminClient()
    const admRead = await adm.client.from('discovery_candidates').select('id').eq('id', seeded.data!.id)
    expect(admRead.error).toBeNull()
    expect((admRead.data ?? []).length).toBe(1)

    const usr = await userClient()
    const usrRead = await usr.client.from('discovery_candidates').select('id').eq('id', seeded.data!.id)
    expect((usrRead.data ?? []).length).toBe(0)
  })

  it('claim_discovery_job reivindica um pending e o segundo claim não repega o mesmo', async () => {
    const db = serviceClient()
    const brief = `CLAIM-${stamp()}`
    const job = await db.from('discovery_jobs').insert({ brief }).select('id').single()

    const first = await db.rpc('claim_discovery_job', { worker: 'w1' })
    expect(first.error).toBeNull()
    const claimed = (first.data ?? []) as { id: string; status: string; claimed_by: string }[]
    // pode pegar qualquer pending; garanta que pegou um e marcou processing
    expect(claimed.length).toBe(1)
    expect(claimed[0].status).toBe('processing')
    expect(claimed[0].claimed_by).toBe('w1')

    // o job específico que criamos não deve mais estar pending após ser reivindicado por alguém
    const check = await db.from('discovery_jobs').select('status').eq('id', job.data!.id).single()
    expect(['pending', 'processing']).toContain(check.data!.status)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- discovery_schema`
Expected: FAIL — relation `discovery_jobs` does not exist / `claim_discovery_job` not found.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0015_discovery.sql`:

```sql
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
```

- [ ] **Step 4: Apply the migration**

Run: `npx -y supabase@2.95.0 db reset`
Expected: all migrations apply cleanly through `0015`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- discovery_schema`
Expected: PASS (4 tests).

- [ ] **Step 6: Regenerate DB types**

Run: `npm run gen:types`
Expected: `src/lib/database.types.ts` updated with `discovery_jobs`, `discovery_candidates`, and `claim_discovery_job`.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0015_discovery.sql tests/discovery_schema.integration.test.ts src/lib/database.types.ts
git commit -m "feat(p4): discovery staging tables, RLS, and atomic job claim"
```

---

### Task 2: Add zod + fingerprint helpers

**Files:**
- Modify: `package.json` (add `zod` to `dependencies`)
- Create: `scripts/discovery/fingerprint.ts`
- Test: `scripts/discovery/fingerprint.test.ts`

**Interfaces:**
- Produces:
  - `normalize(s: string): string` — lowercases, strips accents, collapses whitespace.
  - `slugify(s: string): string` — `normalize` + non-alphanumerics → single `-`, trimmed.
  - `sourceFingerprint(slug: string): string` → `source|<slug>`
  - `sourceItemFingerprint(sourceSlug: string, label: string): string` → `source_item|<sourceSlug>|<slugify(label)>`
  - `benefitFingerprint(sourceItemSlug: string, title: string): string` → `benefit|<sourceItemSlug>|<slugify(title)>`

- [ ] **Step 1: Write the failing test**

Create `scripts/discovery/fingerprint.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  normalize, slugify, sourceFingerprint, sourceItemFingerprint, benefitFingerprint,
} from './fingerprint'

describe('fingerprint', () => {
  it('normalize remove acentos, caixa e espaços extras', () => {
    expect(normalize('  Unimed  Saúde ')).toBe('unimed saude')
  })

  it('slugify produz kebab-case estável', () => {
    expect(slugify('Cartão Nubank Ultravioleta!')).toBe('cartao-nubank-ultravioleta')
    expect(slugify('C6  Carbon')).toBe('c6-carbon')
  })

  it('fingerprints são determinísticas e insensíveis a caixa/acento', () => {
    expect(sourceFingerprint('unimed')).toBe('source|unimed')
    expect(sourceItemFingerprint('nubank', 'Gold')).toBe('source_item|nubank|gold')
    expect(sourceItemFingerprint('nubank', ' góld ')).toBe('source_item|nubank|gold')
    expect(benefitFingerprint('nubank-gold', 'Sala VIP no Aeroporto'))
      .toBe('benefit|nubank-gold|sala-vip-no-aeroporto')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- fingerprint`
Expected: FAIL — cannot find module `./fingerprint`.

- [ ] **Step 3: Implement `fingerprint.ts`**

Create `scripts/discovery/fingerprint.ts`:

```typescript
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove diacríticos
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

export function slugify(s: string): string {
  return normalize(s)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function sourceFingerprint(slug: string): string {
  return `source|${slug}`
}

export function sourceItemFingerprint(sourceSlug: string, label: string): string {
  return `source_item|${sourceSlug}|${slugify(label)}`
}

export function benefitFingerprint(sourceItemSlug: string, title: string): string {
  return `benefit|${sourceItemSlug}|${slugify(title)}`
}
```

- [ ] **Step 4: Add zod dependency**

Run: `npm install zod`
Expected: `zod` appears under `dependencies` in `package.json`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- fingerprint`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json scripts/discovery/fingerprint.ts scripts/discovery/fingerprint.test.ts
git commit -m "feat(p4): add zod + deterministic discovery fingerprints"
```

---

### Task 3: Candidate tree schema (zod) + JSON Schema for the agent

**Files:**
- Create: `scripts/discovery/candidatesSchema.ts`
- Test: `scripts/discovery/candidatesSchema.test.ts`

**Interfaces:**
- Consumes: `zod` (Task 2).
- Produces:
  - Type `CandidatesTree` — `{ sources: SourceNode[] }`.
  - `SourceNode` = `{ name, source_category, kind?, source_url, verification_status?, items: SourceItemNode[] }`.
  - `SourceItemNode` = `{ label, card_brand?, card_level?, display_name?, product_type?, source_url, verification_status?, benefits: BenefitNode[] }`.
  - `BenefitNode` = `{ title, summary, category, scope?, redemption_type?, benefit_source?, long_description?, program?, card_tiers?: {card_brand,card_level}[], source_url, source_name?, observed_at?, verification_status? }`.
  - `candidatesTreeSchema: z.ZodType<CandidatesTree>` — validates + returns typed tree.
  - `candidatesJsonSchema: object` — plain JSON Schema (draft-07) describing the same shape, written to a file and passed to `codex exec --output-schema`.

Enum value lists (must match the DB exactly):
- `source_category`: `bank_card, carrier, health, corporate_benefits, loyalty, retail, mall`
- `source_kind`: `card, carrier, loyalty, cpf`
- `benefit_category`: `travel, insurance, cashback, investback, points, miles, shopping, restaurant, airport, concierge, investment, security, account_service, international_purchase, experience, other`
- `benefit_scope`: `nacional, regional, pontual`
- `benefit_source_kind`: `issuer, card_network, partner, mixed`
- `verification_status`: `official_confirmed, official_needs_regulation_check, partner_network, inferred_from_card_network, needs_manual_validation`

- [ ] **Step 1: Write the failing test**

Create `scripts/discovery/candidatesSchema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { candidatesTreeSchema, candidatesJsonSchema } from './candidatesSchema'

const validTree = {
  sources: [
    {
      name: 'Unimed',
      source_category: 'health',
      source_url: 'https://unimed.coop.br',
      items: [
        {
          label: 'Unimed Nacional',
          source_url: 'https://unimed.coop.br/nacional',
          benefits: [
            {
              title: 'Desconto em farmácias',
              summary: 'Descontos na rede parceira',
              category: 'security',
              source_url: 'https://unimed.coop.br/farmacia',
            },
          ],
        },
      ],
    },
  ],
}

describe('candidatesTreeSchema', () => {
  it('aceita uma árvore válida', () => {
    const parsed = candidatesTreeSchema.safeParse(validTree)
    expect(parsed.success).toBe(true)
  })

  it('rejeita source_category fora da taxonomia', () => {
    const bad = structuredClone(validTree)
    ;(bad.sources[0] as { source_category: string }).source_category = 'nope'
    expect(candidatesTreeSchema.safeParse(bad).success).toBe(false)
  })

  it('rejeita nó sem source_url (regra de procedência)', () => {
    const bad = structuredClone(validTree)
    delete (bad.sources[0] as { source_url?: string }).source_url
    expect(candidatesTreeSchema.safeParse(bad).success).toBe(false)
  })

  it('rejeita benefit sem category', () => {
    const bad = structuredClone(validTree)
    delete (bad.sources[0].items[0].benefits[0] as { category?: string }).category
    expect(candidatesTreeSchema.safeParse(bad).success).toBe(false)
  })

  it('exporta um JSON Schema com a raiz sources', () => {
    expect(candidatesJsonSchema).toHaveProperty('properties.sources')
    expect(candidatesJsonSchema).toHaveProperty('type', 'object')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- candidatesSchema`
Expected: FAIL — cannot find module `./candidatesSchema`.

- [ ] **Step 3: Implement `candidatesSchema.ts`**

Create `scripts/discovery/candidatesSchema.ts`:

```typescript
import { z } from 'zod'

const SOURCE_CATEGORY = ['bank_card', 'carrier', 'health', 'corporate_benefits', 'loyalty', 'retail', 'mall'] as const
const SOURCE_KIND = ['card', 'carrier', 'loyalty', 'cpf'] as const
const BENEFIT_CATEGORY = ['travel', 'insurance', 'cashback', 'investback', 'points', 'miles', 'shopping',
  'restaurant', 'airport', 'concierge', 'investment', 'security', 'account_service',
  'international_purchase', 'experience', 'other'] as const
const BENEFIT_SCOPE = ['nacional', 'regional', 'pontual'] as const
const BENEFIT_SOURCE_KIND = ['issuer', 'card_network', 'partner', 'mixed'] as const
const VERIFICATION_STATUS = ['official_confirmed', 'official_needs_regulation_check', 'partner_network',
  'inferred_from_card_network', 'needs_manual_validation'] as const

const url = z.string().url()

const benefitNode = z.object({
  title: z.string().min(1),
  summary: z.string().min(1),
  category: z.enum(BENEFIT_CATEGORY),
  scope: z.enum(BENEFIT_SCOPE).optional(),
  redemption_type: z.string().optional(),
  benefit_source: z.enum(BENEFIT_SOURCE_KIND).optional(),
  long_description: z.string().optional(),
  program: z.string().optional(),
  card_tiers: z.array(z.object({ card_brand: z.string(), card_level: z.string() })).optional(),
  source_url: url,
  source_name: z.string().optional(),
  observed_at: z.string().optional(), // ISO date
  verification_status: z.enum(VERIFICATION_STATUS).optional(),
})

const sourceItemNode = z.object({
  label: z.string().min(1),
  card_brand: z.string().optional(),
  card_level: z.string().optional(),
  display_name: z.string().optional(),
  product_type: z.string().optional(),
  source_url: url,
  verification_status: z.enum(VERIFICATION_STATUS).optional(),
  benefits: z.array(benefitNode).default([]),
})

const sourceNode = z.object({
  name: z.string().min(1),
  source_category: z.enum(SOURCE_CATEGORY),
  kind: z.enum(SOURCE_KIND).optional(),
  source_url: url,
  verification_status: z.enum(VERIFICATION_STATUS).optional(),
  items: z.array(sourceItemNode).default([]),
})

export const candidatesTreeSchema = z.object({ sources: z.array(sourceNode).default([]) })

export type CandidatesTree = z.infer<typeof candidatesTreeSchema>
export type SourceNode = z.infer<typeof sourceNode>
export type SourceItemNode = z.infer<typeof sourceItemNode>
export type BenefitNode = z.infer<typeof benefitNode>

// JSON Schema (draft-07) entregue ao Codex via --output-schema. Escrito à mão para não
// puxar dep de conversão; mantenha alinhado ao zod acima quando editar campos.
export const candidatesJsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['sources'],
  properties: {
    sources: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'source_category', 'source_url', 'items'],
        properties: {
          name: { type: 'string' },
          source_category: { type: 'string', enum: [...SOURCE_CATEGORY] },
          kind: { type: 'string', enum: [...SOURCE_KIND] },
          source_url: { type: 'string' },
          verification_status: { type: 'string', enum: [...VERIFICATION_STATUS] },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['label', 'source_url', 'benefits'],
              properties: {
                label: { type: 'string' },
                card_brand: { type: 'string' },
                card_level: { type: 'string' },
                display_name: { type: 'string' },
                product_type: { type: 'string' },
                source_url: { type: 'string' },
                verification_status: { type: 'string', enum: [...VERIFICATION_STATUS] },
                benefits: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['title', 'summary', 'category', 'source_url'],
                    properties: {
                      title: { type: 'string' },
                      summary: { type: 'string' },
                      category: { type: 'string', enum: [...BENEFIT_CATEGORY] },
                      scope: { type: 'string', enum: [...BENEFIT_SCOPE] },
                      redemption_type: { type: 'string' },
                      benefit_source: { type: 'string', enum: [...BENEFIT_SOURCE_KIND] },
                      long_description: { type: 'string' },
                      program: { type: 'string' },
                      card_tiers: {
                        type: 'array',
                        items: {
                          type: 'object',
                          additionalProperties: false,
                          required: ['card_brand', 'card_level'],
                          properties: { card_brand: { type: 'string' }, card_level: { type: 'string' } },
                        },
                      },
                      source_url: { type: 'string' },
                      source_name: { type: 'string' },
                      observed_at: { type: 'string' },
                      verification_status: { type: 'string', enum: [...VERIFICATION_STATUS] },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- candidatesSchema`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/discovery/candidatesSchema.ts scripts/discovery/candidatesSchema.test.ts
git commit -m "feat(p4): zod candidate tree schema + agent JSON Schema"
```

---

### Task 4: Catalog match (new/update/duplicate) + tree flattening

**Files:**
- Create: `scripts/discovery/matchCatalog.ts`
- Create: `scripts/discovery/flatten.ts`
- Test: `scripts/discovery/flatten.test.ts`

**Interfaces:**
- Consumes: `fingerprint.ts` (Task 2), `candidatesSchema.ts` types (Task 3).
- Produces:
  - `CatalogSnapshot` = `{ sources: Map<slug,id>; sourceItems: Map<slug,id>; benefits: Map<slug,id> }`.
  - `matchStatus(entityType, slug, snap): { match_status: 'new'|'update'|'duplicate'; matched_id: string | null }` — `update`/`duplicate` when the slug exists (v1 treats any existing slug as `update` so the admin can diff; `duplicate` is reserved and returned when the incoming payload is byte-identical — out of the pure helper's reach, so v1 returns `new`/`update` only). **ponytail: `duplicate` collapses into `update` in v1; add byte-diff later if noise appears.**
  - `FlatCandidate` = `{ entity_type, fingerprint, parent_fingerprint: string | null, payload: object, provenance: object, match_status, matched_id: string | null }`.
  - `flattenTree(tree: CandidatesTree, snap: CatalogSnapshot): FlatCandidate[]` — walks source→item→benefit, computes slugs, fingerprints, `parent_fingerprint`, `match_status`, and builds `payload`/`provenance` mirroring the real columns. Each node's `payload.slug` is the authoritative slug used by promotion.

- [ ] **Step 1: Write the failing test**

Create `scripts/discovery/flatten.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { flattenTree, matchStatus, type CatalogSnapshot } from './matchCatalog'
import { flattenTree as _reexportGuard } from './flatten'
import type { CandidatesTree } from './candidatesSchema'

// flatten.ts re-exporta de matchCatalog? Não — flattenTree vive em flatten.ts.
// Este teste importa flattenTree de flatten.ts e matchStatus de matchCatalog.ts.
```

Replace the file body with the real test (the note above is guidance — do not keep it):

```typescript
import { describe, it, expect } from 'vitest'
import { matchStatus, type CatalogSnapshot } from './matchCatalog'
import { flattenTree } from './flatten'
import type { CandidatesTree } from './candidatesSchema'

const emptySnap: CatalogSnapshot = { sources: new Map(), sourceItems: new Map(), benefits: new Map() }

const tree: CandidatesTree = {
  sources: [
    {
      name: 'Unimed', source_category: 'health', source_url: 'https://unimed.coop.br',
      items: [
        {
          label: 'Nacional', source_url: 'https://unimed.coop.br/n',
          benefits: [
            { title: 'Farmácia', summary: 'desconto', category: 'security', source_url: 'https://unimed.coop.br/f' },
          ],
        },
      ],
    },
  ],
}

describe('matchStatus', () => {
  it('slug inexistente -> new', () => {
    expect(matchStatus('source', 'unimed', emptySnap)).toEqual({ match_status: 'new', matched_id: null })
  })
  it('slug existente -> update com matched_id', () => {
    const snap: CatalogSnapshot = { ...emptySnap, sources: new Map([['unimed', 'abc-id']]) }
    expect(matchStatus('source', 'unimed', snap)).toEqual({ match_status: 'update', matched_id: 'abc-id' })
  })
})

describe('flattenTree', () => {
  it('produz 3 candidatos com fingerprints e parent_fingerprint encadeados', () => {
    const flat = flattenTree(tree, emptySnap)
    expect(flat.map((c) => c.entity_type)).toEqual(['source', 'source_item', 'benefit'])

    const [src, item, ben] = flat
    expect(src.fingerprint).toBe('source|unimed')
    expect(src.parent_fingerprint).toBeNull()
    expect((src.payload as { slug: string }).slug).toBe('unimed')

    expect(item.fingerprint).toBe('source_item|unimed|nacional')
    expect(item.parent_fingerprint).toBe('source|unimed')
    expect((item.payload as { slug: string }).slug).toBe('unimed-nacional')

    expect(ben.fingerprint).toBe('benefit|unimed-nacional|farmacia')
    expect(ben.parent_fingerprint).toBe('source_item|unimed|nacional')
    expect((ben.provenance as { source_url: string }).source_url).toBe('https://unimed.coop.br/f')
  })

  it('marca match_status=update quando o source já existe no catálogo', () => {
    const snap: CatalogSnapshot = { ...emptySnap, sources: new Map([['unimed', 'existing-id']]) }
    const flat = flattenTree(tree, snap)
    expect(flat[0].match_status).toBe('update')
    expect(flat[0].matched_id).toBe('existing-id')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- flatten`
Expected: FAIL — cannot find module `./matchCatalog`.

- [ ] **Step 3: Implement `matchCatalog.ts`**

Create `scripts/discovery/matchCatalog.ts`:

```typescript
import type { DiscoveryEntityType } from './flatten'

export interface CatalogSnapshot {
  sources: Map<string, string>      // slug -> id
  sourceItems: Map<string, string>  // slug -> id
  benefits: Map<string, string>     // slug -> id
}

export function matchStatus(
  entityType: DiscoveryEntityType,
  slug: string,
  snap: CatalogSnapshot,
): { match_status: 'new' | 'update' | 'duplicate'; matched_id: string | null } {
  const map =
    entityType === 'source' ? snap.sources
    : entityType === 'source_item' ? snap.sourceItems
    : snap.benefits
  const existing = map.get(slug)
  // ponytail: sem byte-diff em v1 -> qualquer slug existente é 'update' (admin decide no review).
  return existing ? { match_status: 'update', matched_id: existing } : { match_status: 'new', matched_id: null }
}
```

- [ ] **Step 4: Implement `flatten.ts`**

Create `scripts/discovery/flatten.ts`:

```typescript
import { slugify, sourceFingerprint, sourceItemFingerprint, benefitFingerprint } from './fingerprint'
import { matchStatus, type CatalogSnapshot } from './matchCatalog'
import type { CandidatesTree } from './candidatesSchema'

export type DiscoveryEntityType = 'source' | 'source_item' | 'benefit'

export interface FlatCandidate {
  entity_type: DiscoveryEntityType
  fingerprint: string
  parent_fingerprint: string | null
  payload: Record<string, unknown>
  provenance: Record<string, unknown>
  match_status: 'new' | 'update' | 'duplicate'
  matched_id: string | null
}

export function flattenTree(tree: CandidatesTree, snap: CatalogSnapshot): FlatCandidate[] {
  const out: FlatCandidate[] = []

  for (const s of tree.sources) {
    const sourceSlug = slugify(s.name)
    const sourceFp = sourceFingerprint(sourceSlug)
    out.push({
      entity_type: 'source',
      fingerprint: sourceFp,
      parent_fingerprint: null,
      payload: { slug: sourceSlug, name: s.name, source_category: s.source_category, kind: s.kind ?? null },
      provenance: { source_url: s.source_url, verification_status: s.verification_status ?? null },
      ...matchStatus('source', sourceSlug, snap),
    })

    for (const it of s.items) {
      const itemSlug = `${sourceSlug}-${slugify(it.label)}`
      const itemFp = sourceItemFingerprint(sourceSlug, it.label)
      out.push({
        entity_type: 'source_item',
        fingerprint: itemFp,
        parent_fingerprint: sourceFp,
        payload: {
          slug: itemSlug, label: it.label, display_name: it.display_name ?? null,
          card_brand: it.card_brand ?? null, card_level: it.card_level ?? null,
          product_type: it.product_type ?? null,
        },
        provenance: { source_url: it.source_url, verification_status: it.verification_status ?? null },
        ...matchStatus('source_item', itemSlug, snap),
      })

      for (const b of it.benefits) {
        const benefitSlug = `${itemSlug}-${slugify(b.title)}`
        out.push({
          entity_type: 'benefit',
          fingerprint: benefitFingerprint(itemSlug, b.title),
          parent_fingerprint: itemFp,
          payload: {
            slug: benefitSlug, title: b.title, summary: b.summary, category: b.category,
            scope: b.scope ?? 'nacional', redemption_type: b.redemption_type ?? null,
            benefit_source: b.benefit_source ?? null, long_description: b.long_description ?? null,
            program: b.program ?? null, card_tiers: b.card_tiers ?? [],
          },
          provenance: {
            source_url: b.source_url, source_name: b.source_name ?? null,
            observed_at: b.observed_at ?? null, verification_status: b.verification_status ?? null,
          },
          ...matchStatus('benefit', benefitSlug, snap),
        })
      }
    }
  }

  return out
}
```

- [ ] **Step 5: Fix the test file**

Ensure `scripts/discovery/flatten.test.ts` contains only the real test from Step 1 (delete the guidance stub). Import `matchStatus`/`CatalogSnapshot` from `./matchCatalog` and `flattenTree` from `./flatten`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- flatten`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add scripts/discovery/matchCatalog.ts scripts/discovery/flatten.ts scripts/discovery/flatten.test.ts
git commit -m "feat(p4): catalog match + tree flattening into flat candidates"
```

---

## Phase B — The agent (`discover.ts`)

### Task 5: Sanitized Codex shell-out (`runCodex.ts`)

**Files:**
- Create: `scripts/discovery/runCodex.ts`
- Test: `scripts/discovery/runCodex.test.ts`

**Interfaces:**
- Produces:
  - `sanitizedEnv(parentEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv` — returns an allowlisted env containing **only** `PATH`, `HOME`, `CODEX_HOME` (when set), `TERM`, `LANG`. Explicitly excludes anything matching `SUPABASE`, `SERVICE_ROLE`, `ANON`, `VITE_`, `DATABASE`, or `KEY`.
  - `buildCodexArgs(opts: { cwd: string; schemaPath: string; outPath: string }): string[]` — the `codex exec` argv (headless, read-only sandbox, schema-shaped output).
  - `runCodex(opts: { cwd, prompt, schemaPath, outPath }): Promise<unknown>` — spawns `codex`, waits, reads `outPath` (the agent's last message JSON), returns parsed JSON. **Injectable/replaceable in tests via `discover.ts` deps — this function is NOT unit-tested against the real binary.**

- [ ] **Step 1: Write the failing test**

Create `scripts/discovery/runCodex.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { sanitizedEnv, buildCodexArgs } from './runCodex'

describe('sanitizedEnv', () => {
  it('remove segredos e mantém só o allowlist', () => {
    const parent = {
      PATH: '/usr/bin', HOME: '/home/x', CODEX_HOME: '/home/x/.codex',
      SUPABASE_SERVICE_ROLE_KEY: 'secret', VITE_SUPABASE_URL: 'https://db',
      SUPABASE_ANON_KEY: 'anon', DATABASE_URL: 'postgres://', SOME_API_KEY: 'k',
    }
    const env = sanitizedEnv(parent)
    expect(env.PATH).toBe('/usr/bin')
    expect(env.HOME).toBe('/home/x')
    expect(env.CODEX_HOME).toBe('/home/x/.codex')
    expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined()
    expect(env.VITE_SUPABASE_URL).toBeUndefined()
    expect(env.SUPABASE_ANON_KEY).toBeUndefined()
    expect(env.DATABASE_URL).toBeUndefined()
    expect(env.SOME_API_KEY).toBeUndefined()
  })
})

describe('buildCodexArgs', () => {
  it('roda exec headless, sandbox read-only, com schema e saída em arquivo', () => {
    const args = buildCodexArgs({ cwd: '/tmp/wd', schemaPath: '/tmp/wd/schema.json', outPath: '/tmp/wd/out.json' })
    expect(args[0]).toBe('exec')
    expect(args).toContain('--skip-git-repo-check')
    expect(args).toContain('--sandbox')
    expect(args).toContain('read-only')
    expect(args).toContain('--output-schema')
    expect(args).toContain('/tmp/wd/schema.json')
    expect(args).toContain('--output-last-message')
    expect(args).toContain('/tmp/wd/out.json')
    expect(args).toContain('-C')
    expect(args).toContain('/tmp/wd')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- runCodex`
Expected: FAIL — cannot find module `./runCodex`.

- [ ] **Step 3: Implement `runCodex.ts`**

Create `scripts/discovery/runCodex.ts`:

```typescript
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const ALLOW = ['PATH', 'HOME', 'CODEX_HOME', 'TERM', 'LANG']
const DENY = /(SUPABASE|SERVICE_ROLE|ANON|VITE_|DATABASE|KEY|SECRET|TOKEN)/i

// Env allowlist: o subprocesso Codex é NÃO-CONFIÁVEL (consome web -> prompt-injection).
// Ele recebe só o que precisa pra autenticar (Codex guarda auth em CODEX_HOME/HOME),
// nunca a service-role key nem env do Supabase. Esta é a trava principal de segurança.
export function sanitizedEnv(parentEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const k of ALLOW) {
    if (parentEnv[k] !== undefined && !DENY.test(k)) env[k] = parentEnv[k]
  }
  return env
}

export function buildCodexArgs(opts: { cwd: string; schemaPath: string; outPath: string }): string[] {
  return [
    'exec',
    '--skip-git-repo-check',
    '--sandbox', 'read-only',
    '-C', opts.cwd,
    '--output-schema', opts.schemaPath,
    '--output-last-message', opts.outPath,
    '-', // prompt via stdin
  ]
}

export async function runCodex(opts: {
  cwd: string; prompt: string; schemaPath: string; outPath: string
}): Promise<unknown> {
  const args = buildCodexArgs(opts)
  await new Promise<void>((resolve, reject) => {
    const child = spawn('codex', args, {
      cwd: opts.cwd,
      env: sanitizedEnv(process.env),
      stdio: ['pipe', 'inherit', 'inherit'],
    })
    child.on('error', reject)
    child.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`codex exit ${code}`))))
    child.stdin.write(opts.prompt)
    child.stdin.end()
  })
  const raw = await readFile(opts.outPath, 'utf8')
  return JSON.parse(raw)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- runCodex`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/discovery/runCodex.ts scripts/discovery/runCodex.test.ts
git commit -m "feat(p4): sanitized Codex shell-out (secret-free env, read-only sandbox)"
```

---

### Task 6: Orchestrator `discover.ts` (claim → agent → validate+retry → upsert)

**Files:**
- Create: `scripts/discovery/catalogSnapshot.ts`
- Create: `scripts/discovery/discover.ts`
- Test: `scripts/discovery/discover.test.ts`

**Interfaces:**
- Consumes: `claim_discovery_job` RPC (Task 1), `candidatesTreeSchema` + `candidatesJsonSchema` (Task 3), `flattenTree` + `CatalogSnapshot` (Task 4), `runCodex` (Task 5), `@supabase/supabase-js`.
- Produces:
  - `loadCatalogSnapshot(db): Promise<CatalogSnapshot>` (in `catalogSnapshot.ts`).
  - `RunJobDeps = { db: SupabaseClient; worker: string; runAgent: (job, ctx) => Promise<unknown>; workdir: string }` — `runAgent` is injected (real impl wires `runCodex`; tests inject a fixture returner).
  - `runJob(deps): Promise<{ status: 'done' | 'error' | 'idle'; jobId?: string }>` — claims one job; on success upserts flattened candidates and marks `done`; on validation failure retries once, then marks `error`; returns `idle` when no pending job.
  - `main()` — CLI entry: builds a real `db` (service client) + real `runAgent` (writes brief/context/schema to `workdir`, calls `runCodex`), loops `runJob` until `idle`.

- [ ] **Step 1: Write `catalogSnapshot.ts` (no separate test — covered via discover.test)**

Create `scripts/discovery/catalogSnapshot.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import type { CatalogSnapshot } from './matchCatalog'

export async function loadCatalogSnapshot(db: SupabaseClient): Promise<CatalogSnapshot> {
  const [sources, items, benefits] = await Promise.all([
    db.from('sources').select('id, slug'),
    db.from('source_items').select('id, slug'),
    db.from('benefits').select('id, slug'),
  ])
  const toMap = (rows: { id: string; slug: string | null }[] | null) =>
    new Map((rows ?? []).filter((r) => r.slug).map((r) => [r.slug as string, r.id]))
  return {
    sources: toMap(sources.data as never),
    sourceItems: toMap(items.data as never),
    benefits: toMap(benefits.data as never),
  }
}
```

- [ ] **Step 2: Write the failing test**

Create `scripts/discovery/discover.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { serviceClient } from '../../tests/helpers/clients'
import { runJob } from './discover'

const stamp = () => `${Date.now()}-${Math.floor(performance.now() * 1000)}`

const fixtureTree = (name: string) => ({
  sources: [
    {
      name, source_category: 'health', source_url: 'https://x.dev',
      items: [
        {
          label: 'Nacional', source_url: 'https://x.dev/n',
          benefits: [{ title: 'Farmácia', summary: 's', category: 'security', source_url: 'https://x.dev/f' }],
        },
      ],
    },
  ],
})

describe('runJob', () => {
  it('claim -> agente -> upsert de candidatos encadeados -> job done', async () => {
    const db = serviceClient()
    const name = `Unimed ${stamp()}`
    const job = await db.from('discovery_jobs').insert({ brief: name }).select('id').single()

    const res = await runJob({
      db, worker: 'test', workdir: '/tmp/ignored',
      runAgent: async () => fixtureTree(name),
    })
    expect(res.status).toBe('done')

    const cands = await db
      .from('discovery_candidates')
      .select('entity_type, fingerprint, parent_fingerprint, match_status')
      .eq('job_id', job.data!.id)
    expect((cands.data ?? []).length).toBe(3)
    const src = cands.data!.find((c) => c.entity_type === 'source')!
    const item = cands.data!.find((c) => c.entity_type === 'source_item')!
    const ben = cands.data!.find((c) => c.entity_type === 'benefit')!
    expect(src.parent_fingerprint).toBeNull()
    expect(item.parent_fingerprint).toBe(src.fingerprint)
    expect(ben.parent_fingerprint).toBe(item.fingerprint)

    const done = await db.from('discovery_jobs').select('status').eq('id', job.data!.id).single()
    expect(done.data!.status).toBe('done')
  })

  it('retry: 1ª saída inválida, 2ª válida -> done', async () => {
    const db = serviceClient()
    const name = `Retry ${stamp()}`
    await db.from('discovery_jobs').insert({ brief: name }).select('id').single()
    let calls = 0
    const res = await runJob({
      db, worker: 'test', workdir: '/tmp/ignored',
      runAgent: async () => {
        calls += 1
        return calls === 1 ? { sources: [{ name, source_category: 'NOPE' }] } : fixtureTree(name)
      },
    })
    expect(calls).toBe(2)
    expect(res.status).toBe('done')
  })

  it('saída inválida nas 2 tentativas -> job error, nada na fila', async () => {
    const db = serviceClient()
    const name = `Bad ${stamp()}`
    const job = await db.from('discovery_jobs').insert({ brief: name }).select('id').single()
    const res = await runJob({
      db, worker: 'test', workdir: '/tmp/ignored',
      runAgent: async () => ({ sources: [{ name, source_category: 'NOPE' }] }),
    })
    expect(res.status).toBe('error')
    const errored = await db.from('discovery_jobs').select('status, error').eq('id', job.data!.id).single()
    expect(errored.data!.status).toBe('error')
    const cands = await db.from('discovery_candidates').select('id').eq('job_id', job.data!.id)
    expect((cands.data ?? []).length).toBe(0)
  })
})
```

> Note: `claim_discovery_job` picks the oldest `pending` job, so with a polluted DB it may claim a job other than the one this test just inserted. To keep the assertion targeting our row, each test first drains older pending jobs is overkill — instead assert on the **claimed job's** candidates. Refine Step-2 tests to read `res.jobId` and query candidates by `res.jobId` rather than the inserted id. Adjust the three tests to use `res.jobId`.

- [ ] **Step 3: Run test to verify it fails**

Run: `npm test -- discover`
Expected: FAIL — cannot find module `./discover`.

- [ ] **Step 4: Implement `discover.ts`**

Create `scripts/discovery/discover.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js'
import { candidatesTreeSchema } from './candidatesSchema'
import { flattenTree } from './flatten'
import { loadCatalogSnapshot } from './catalogSnapshot'

export interface RunJobDeps {
  db: SupabaseClient
  worker: string
  workdir: string
  runAgent: (job: { id: string; brief: string }, ctx: { attemptErrors: string | null }) => Promise<unknown>
}

export async function runJob(deps: RunJobDeps): Promise<{ status: 'done' | 'error' | 'idle'; jobId?: string }> {
  const { db, worker } = deps
  const claim = await db.rpc('claim_discovery_job', { worker })
  if (claim.error) throw claim.error
  const jobs = (claim.data ?? []) as { id: string; brief: string }[]
  if (jobs.length === 0) return { status: 'idle' }
  const job = jobs[0]

  let attemptErrors: string | null = null
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const raw = await deps.runAgent(job, { attemptErrors })
    const parsed = candidatesTreeSchema.safeParse(raw)
    if (parsed.success) {
      const snap = await loadCatalogSnapshot(db)
      const flat = flattenTree(parsed.data, snap).map((c) => ({ ...c, job_id: job.id, review_status: 'pending' as const }))
      // upsert idempotente por fingerprint
      const up = await db.from('discovery_candidates').upsert(flat as never, { onConflict: 'fingerprint' })
      if (up.error) throw up.error
      await db.from('discovery_jobs').update({ status: 'done' }).eq('id', job.id)
      return { status: 'done', jobId: job.id }
    }
    attemptErrors = JSON.stringify(parsed.error.issues)
  }

  await db.from('discovery_jobs').update({ status: 'error', error: attemptErrors }).eq('id', job.id)
  return { status: 'error', jobId: job.id }
}
```

- [ ] **Step 5: Adjust tests to key off `res.jobId`**

In `discover.test.ts`, change each candidate/job query to use `res.jobId` (the claimed job) instead of the inserted `job.data!.id`. For the first two tests, first drain any pre-existing pending jobs is unnecessary — instead loop `runJob` until `res.jobId === insertedId` is fragile; simplest: at the top of each test, mark all existing pending jobs as `done` so the only claimable job is the one just inserted:

```typescript
// no início de cada teste, após criar o db:
await db.from('discovery_jobs').update({ status: 'done' }).eq('status', 'pending')
// ...então insira o job do teste e rode runJob; res.jobId === job.data!.id
```

Apply this drain line before inserting the test's own job in all three tests, then assert on `job.data!.id`.

- [ ] **Step 6: Run test to verify it passes**

Run: `npm test -- discover`
Expected: PASS (3 tests).

- [ ] **Step 7: Add the CLI `main()` (manual/CI entry — not unit-tested)**

Append to `scripts/discovery/discover.ts`:

```typescript
import { createClient } from '@supabase/supabase-js'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { config as loadEnv } from 'dotenv'
import { candidatesJsonSchema } from './candidatesSchema'
import { runCodex } from './runCodex'
import { SOURCE_CATEGORY_TAXONOMY } from './taxonomy'

async function main() {
  loadEnv({ path: '.env.local' })
  const db = createClient(process.env.VITE_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const worker = `cli-${process.pid}`

  for (;;) {
    const res = await runJob({
      db, worker, workdir: tmpdir(),
      runAgent: async (job, ctx) => {
        // dir de trabalho ISOLADO fora do repo (scratchpad)
        const wd = await mkdtemp(join(tmpdir(), 'discover-'))
        const snap = await loadCatalogSnapshot(db)
        const context = {
          existing_sources: [...snap.sources.keys()],
          existing_source_items: [...snap.sourceItems.keys()],
          existing_benefits: [...snap.benefits.keys()],
          source_categories: SOURCE_CATEGORY_TAXONOMY,
        }
        const schemaPath = join(wd, 'schema.json')
        const outPath = join(wd, 'out.json')
        await writeFile(schemaPath, JSON.stringify(candidatesJsonSchema))
        const retry = ctx.attemptErrors ? `\nA tentativa anterior falhou na validação:\n${ctx.attemptErrors}\nCorrija.` : ''
        const prompt = [
          `Pesquise na web o brief a seguir e proponha catálogo de benefícios como JSON no schema fornecido.`,
          `Brief: ${job.brief}`,
          `Classifique cada fonte numa source_category da taxonomia. Cite source_url em CADA nó.`,
          `NÃO reproponha itens já existentes (contexto abaixo). Não faça nada além de produzir o JSON final.`,
          `Contexto do catálogo: ${JSON.stringify(context)}`,
          retry,
        ].join('\n')
        return runCodex({ cwd: wd, prompt, schemaPath, outPath })
      },
    })
    if (res.status === 'idle') break
    console.log(`job ${res.jobId ?? '?'} -> ${res.status}`)
  }
}

// Executa só quando chamado como script (não em import de teste).
if (process.argv[1] && process.argv[1].endsWith('discover.ts')) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
```

Create `scripts/discovery/taxonomy.ts`:

```typescript
// Taxonomia source_category (P1) com rótulo/exemplos para o agente classificar a fonte.
export const SOURCE_CATEGORY_TAXONOMY = {
  bank_card: 'Banco / cartão de crédito (ex.: Nubank, Itaú, C6)',
  carrier: 'Operadora de telefonia/internet (ex.: Vivo, Claro, TIM)',
  health: 'Saúde / plano ou operadora (ex.: Unimed, SulAmérica)',
  corporate_benefits: 'Multibenefícios corporativos (ex.: Wellhub, Flash, iFood Benefícios, Caju)',
  loyalty: 'Programa de fidelidade / pontos (ex.: Livelo, Smiles, Esfera)',
  retail: 'Varejo / assinatura (ex.: Meli+, Amazon Prime)',
  mall: 'Shopping center (ex.: Iguatemi, JHSF)',
} as const
```

- [ ] **Step 8: Add an npm script**

In `package.json` `scripts`, add:

```json
"discover": "npx tsx scripts/discovery/discover.ts"
```

Then: `npm install -D tsx`

- [ ] **Step 9: Type-check**

Run: `npm run build`
Expected: no TypeScript errors.

- [ ] **Step 10: Commit**

```bash
git add scripts/discovery/discover.ts scripts/discovery/catalogSnapshot.ts scripts/discovery/taxonomy.ts scripts/discovery/discover.test.ts package.json package-lock.json
git commit -m "feat(p4): discover.ts orchestrator (claim, validate+retry, upsert) + CLI"
```

---

## Phase C — Promotion (candidate → catalog)

### Task 7: Transactional `promote_discovery_candidate` RPC

**Files:**
- Create: `supabase/migrations/0016_discovery_promote.sql`
- Test: `tests/discovery_promote.integration.test.ts`

**Interfaces:**
- Consumes: `discovery_candidates` (Task 1), catalog tables `sources`/`source_items`/`benefits`/`benefit_sources`/`benefit_card_tiers`.
- Produces:
  - RPC `promote_discovery_candidate(candidate_id uuid) returns uuid` — SECURITY DEFINER; requires `public.is_admin()`; locks the candidate row; idempotent (returns existing `promoted_id` when already promoted); inserts/updates the catalog row by `slug` (`on conflict (slug) do update`); resolves parent via `parent_fingerprint` (parent must be promoted/matched first, else raises); copies provenance; sets `promoted_id`/`promoted_at`/`review_status='approved'`. Returns the catalog row id.

- [ ] **Step 1: Write the failing test**

Create `tests/discovery_promote.integration.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { serviceClient, adminClient, userClient } from './helpers/clients'

const stamp = () => `${Date.now()}-${Math.floor(performance.now() * 1000)}`

async function seedTree(db: ReturnType<typeof serviceClient>, tag: string) {
  const job = await db.from('discovery_jobs').insert({ brief: `P-${tag}` }).select('id').single()
  const jobId = job.data!.id
  const srcSlug = `src-${tag}`, itemSlug = `src-${tag}-nacional`, benSlug = `src-${tag}-nacional-farmacia`
  const srcFp = `source|${srcSlug}`, itemFp = `source_item|${srcSlug}|nacional`, benFp = `benefit|${itemSlug}|farmacia`
  await db.from('discovery_candidates').insert([
    { job_id: jobId, entity_type: 'source', fingerprint: srcFp, parent_fingerprint: null,
      payload: { slug: srcSlug, name: `Src ${tag}`, source_category: 'health', kind: 'cpf' },
      provenance: { source_url: 'https://x.dev', verification_status: 'official_confirmed' },
      match_status: 'new', review_status: 'pending' },
    { job_id: jobId, entity_type: 'source_item', fingerprint: itemFp, parent_fingerprint: srcFp,
      payload: { slug: itemSlug, label: 'Nacional', card_brand: null, card_level: null },
      provenance: { source_url: 'https://x.dev/n' }, match_status: 'new', review_status: 'pending' },
    { job_id: jobId, entity_type: 'benefit', fingerprint: benFp, parent_fingerprint: itemFp,
      payload: { slug: benSlug, title: 'Farmácia', summary: 'desconto', category: 'security',
                 scope: 'nacional', card_tiers: [] },
      provenance: { source_url: 'https://x.dev/f', source_name: 'Site', observed_at: '2026-07-01',
                    verification_status: 'official_confirmed' },
      match_status: 'new', review_status: 'pending' },
  ])
  return { db, jobId, srcFp, itemFp, benFp, srcSlug, itemSlug, benSlug }
}

async function candId(db: ReturnType<typeof serviceClient>, fp: string) {
  const r = await db.from('discovery_candidates').select('id').eq('fingerprint', fp).single()
  return r.data!.id as string
}

describe('promote_discovery_candidate', () => {
  it('promove árvore de cima pra baixo: source -> item -> benefit com procedência', async () => {
    const db = serviceClient()
    const t = stamp()
    const s = await seedTree(db, t)
    const adm = await adminClient()

    const srcRes = await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.srcFp) })
    expect(srcRes.error).toBeNull()
    const srcId = srcRes.data as string
    const src = await db.from('sources').select('source_category, slug').eq('id', srcId).single()
    expect(src.data!.source_category).toBe('health')

    const itemRes = await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.itemFp) })
    expect(itemRes.error).toBeNull()

    const benRes = await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.benFp) })
    expect(benRes.error).toBeNull()
    const benId = benRes.data as string
    const ben = await db.from('benefits')
      .select('active, source_url, source_name, verification_status').eq('id', benId).single()
    expect(ben.data!.active).toBe(false) // rascunho publicável
    expect(ben.data!.source_url).toBe('https://x.dev/f')
    expect(ben.data!.verification_status).toBe('official_confirmed')

    const link = await db.from('benefit_sources').select('source_item_id').eq('benefit_id', benId)
    expect((link.data ?? []).length).toBe(1)
  })

  it('re-promover é no-op idempotente (mesmo id, sem duplicar)', async () => {
    const db = serviceClient()
    const s = await seedTree(db, stamp())
    const adm = await adminClient()
    const id = await candId(db, s.srcFp)
    const a = await adm.client.rpc('promote_discovery_candidate', { candidate_id: id })
    const b = await adm.client.rpc('promote_discovery_candidate', { candidate_id: id })
    expect(a.data).toBe(b.data)
    const count = await db.from('sources').select('id', { count: 'exact', head: true }).eq('slug', s.srcSlug)
    expect(count.count).toBe(1)
  })

  it('promover benefit antes do item pai levanta erro', async () => {
    const db = serviceClient()
    const s = await seedTree(db, stamp())
    const adm = await adminClient()
    const res = await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.benFp) })
    expect(res.error).not.toBeNull() // pai não promovido
  })

  it('não-admin não promove', async () => {
    const db = serviceClient()
    const s = await seedTree(db, stamp())
    const usr = await userClient()
    const res = await usr.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.srcFp) })
    expect(res.error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- discovery_promote`
Expected: FAIL — function `promote_discovery_candidate` does not exist.

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/0016_discovery_promote.sql`:

```sql
-- P4: promoção transacional candidato -> catálogo. SECURITY DEFINER + gate is_admin().
-- Uma função plpgsql roda numa transação; o lock no candidato guarda a corrida
-- de dois admins; on conflict(slug) torna a promoção idempotente.

create function promote_discovery_candidate(candidate_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c            public.discovery_candidates;
  parent       public.discovery_candidates;
  parent_id    uuid;
  new_id       uuid;
  p            jsonb;
  prov         jsonb;
  tier         jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into c from public.discovery_candidates where id = candidate_id for update;
  if not found then
    raise exception 'candidate not found';
  end if;

  -- idempotência: já promovido -> devolve o mesmo id
  if c.promoted_id is not null then
    return c.promoted_id;
  end if;

  p := c.payload;
  prov := c.provenance;

  -- resolve o pai (quando houver) via parent_fingerprint: precisa estar promovido ou casado
  if c.parent_fingerprint is not null then
    select * into parent from public.discovery_candidates where fingerprint = c.parent_fingerprint;
    if found then
      parent_id := coalesce(parent.promoted_id, parent.matched_id);
    end if;
    if parent_id is null then
      raise exception 'parent % not promoted yet', c.parent_fingerprint;
    end if;
  end if;

  if c.entity_type = 'source' then
    insert into public.sources (slug, name, source_category, kind)
    values (p->>'slug', p->>'name', (p->>'source_category')::public.source_category,
            coalesce((p->>'kind')::public.source_kind, 'card'))
    on conflict (slug) do update set name = excluded.name, source_category = excluded.source_category
    returning id into new_id;

  elsif c.entity_type = 'source_item' then
    insert into public.source_items (slug, source_id, label, display_name, card_brand, card_level, product_type,
                                     source_url, verification_status)
    values (p->>'slug', parent_id, p->>'label', p->>'display_name', p->>'card_brand', p->>'card_level',
            p->>'product_type', prov->>'source_url', (prov->>'verification_status')::public.verification_status)
    on conflict (slug) do update set label = excluded.label
    returning id into new_id;

  elsif c.entity_type = 'benefit' then
    insert into public.benefits (slug, title, summary, category, scope, active, redemption_type, benefit_source,
                                 long_description, program, source_url, source_name, observed_at, verification_status)
    values (p->>'slug', p->>'title', p->>'summary', (p->>'category')::public.benefit_category,
            coalesce((p->>'scope')::public.benefit_scope, 'nacional'), false,
            (p->>'redemption_type')::public.redemption_type, (p->>'benefit_source')::public.benefit_source_kind,
            p->>'long_description', p->>'program', prov->>'source_url', prov->>'source_name',
            (prov->>'observed_at')::date, (prov->>'verification_status')::public.verification_status)
    on conflict (slug) do update set title = excluded.title, summary = excluded.summary
    returning id into new_id;

    -- liga ao source_item pai
    insert into public.benefit_sources (benefit_id, source_item_id)
    values (new_id, parent_id)
    on conflict do nothing;

    -- herança de bandeira, quando informada
    for tier in select * from jsonb_array_elements(coalesce(p->'card_tiers', '[]'::jsonb)) loop
      insert into public.benefit_card_tiers (benefit_id, card_brand, card_level)
      values (new_id, tier->>'card_brand', tier->>'card_level')
      on conflict do nothing;
    end loop;
  end if;

  update public.discovery_candidates
     set promoted_id = new_id, promoted_at = now(), review_status = 'approved'
   where id = candidate_id;

  return new_id;
end;
$$;

grant execute on function promote_discovery_candidate(uuid) to authenticated;
grant execute on function promote_discovery_candidate(uuid) to service_role;
```

- [ ] **Step 4: Apply the migration**

Run: `npx -y supabase@2.95.0 db reset`
Expected: applies cleanly through `0016`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- discovery_promote`
Expected: PASS (4 tests).

- [ ] **Step 6: Regenerate types + commit**

```bash
npm run gen:types
git add supabase/migrations/0016_discovery_promote.sql tests/discovery_promote.integration.test.ts src/lib/database.types.ts
git commit -m "feat(p4): transactional promote_discovery_candidate RPC (admin-gated, idempotent)"
```

---

## Phase D — Admin review UI (`/admin/discovery`)

### Task 8: Data hooks (`types.ts` + `useDiscovery.ts`)

**Files:**
- Create: `src/features/admin/discovery/types.ts`
- Create: `src/features/admin/discovery/useDiscovery.ts`
- Test: `src/features/admin/discovery/useDiscovery.test.tsx`

**Interfaces:**
- Consumes: `supabase` (`src/lib/supabase.ts`), `promote_discovery_candidate` RPC (Task 7), `is_admin` RLS on discovery tables.
- Produces:
  - Types: `DiscoveryJob`, `DiscoveryCandidate` (matching DB columns), `DiscoveryEntityType`, `DiscoveryMatchStatus`, `DiscoveryReviewStatus`.
  - Hooks: `useDiscoveryJobs()`, `useCreateJob()` (`mutate(brief)`), `useJobCandidates(jobId)`, `usePromoteCandidate()` (`mutate(candidateId)` → calls `supabase.rpc`), `useRejectCandidate()` (`mutate(candidateId)` → update `review_status='rejected'`), `useUpdateCandidatePayload()` (`mutate({id, payload})`).

- [ ] **Step 1: Write the failing test (hooks smoke test with a QueryClient wrapper)**

Create `src/features/admin/discovery/useDiscovery.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useDiscoveryJobs } from './useDiscovery'

vi.mock('../../../lib/supabase', () => {
  const jobs = [{ id: 'j1', brief: 'Unimed', status: 'pending', created_at: '2026-07-01' }]
  return {
    supabase: {
      from: () => ({
        select: () => ({ order: () => Promise.resolve({ data: jobs, error: null }) }),
      }),
    },
  }
})

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useDiscoveryJobs', () => {
  beforeEach(() => vi.clearAllMocks())
  it('carrega a lista de jobs', async () => {
    const { result } = renderHook(() => useDiscoveryJobs(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].brief).toBe('Unimed')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- useDiscovery`
Expected: FAIL — cannot find module `./useDiscovery`.

- [ ] **Step 3: Implement `types.ts`**

Create `src/features/admin/discovery/types.ts`:

```typescript
export type DiscoveryEntityType = 'source' | 'source_item' | 'benefit'
export type DiscoveryMatchStatus = 'new' | 'update' | 'duplicate'
export type DiscoveryReviewStatus = 'pending' | 'approved' | 'rejected'

export interface DiscoveryJob {
  id: string
  brief: string
  status: 'pending' | 'processing' | 'done' | 'error'
  error: string | null
  created_at: string
}

export interface DiscoveryCandidate {
  id: string
  job_id: string
  entity_type: DiscoveryEntityType
  fingerprint: string
  parent_fingerprint: string | null
  payload: Record<string, unknown>
  provenance: Record<string, unknown>
  match_status: DiscoveryMatchStatus
  matched_id: string | null
  review_status: DiscoveryReviewStatus
  promoted_id: string | null
  created_at: string
}
```

- [ ] **Step 4: Implement `useDiscovery.ts`**

Create `src/features/admin/discovery/useDiscovery.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import type { DiscoveryCandidate, DiscoveryJob } from './types'

export function useDiscoveryJobs() {
  return useQuery({
    queryKey: ['discovery_jobs'],
    queryFn: async (): Promise<DiscoveryJob[]> => {
      const { data, error } = await supabase
        .from('discovery_jobs')
        .select('id, brief, status, error, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as DiscoveryJob[]
    },
  })
}

export function useCreateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (brief: string) => {
      const { error } = await supabase.from('discovery_jobs').insert({ brief } as never)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discovery_jobs'] }),
  })
}

export function useJobCandidates(jobId: string | null) {
  return useQuery({
    queryKey: ['discovery_candidates', jobId],
    enabled: !!jobId,
    queryFn: async (): Promise<DiscoveryCandidate[]> => {
      const { data, error } = await supabase
        .from('discovery_candidates')
        .select('*')
        .eq('job_id', jobId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as DiscoveryCandidate[]
    },
  })
}

export function usePromoteCandidate(jobId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (candidateId: string) => {
      const { error } = await supabase.rpc('promote_discovery_candidate', { candidate_id: candidateId })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery_candidates', jobId] })
      qc.invalidateQueries({ queryKey: ['admin_benefits'] })
      qc.invalidateQueries({ queryKey: ['admin_sources'] })
    },
  })
}

export function useRejectCandidate(jobId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (candidateId: string) => {
      const { error } = await supabase
        .from('discovery_candidates')
        .update({ review_status: 'rejected' } as never)
        .eq('id', candidateId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discovery_candidates', jobId] }),
  })
}

export function useUpdateCandidatePayload(jobId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('discovery_candidates')
        .update({ payload } as never)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discovery_candidates', jobId] }),
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- useDiscovery`
Expected: PASS (1 test).

- [ ] **Step 6: Commit**

```bash
git add src/features/admin/discovery/types.ts src/features/admin/discovery/useDiscovery.ts src/features/admin/discovery/useDiscovery.test.tsx
git commit -m "feat(p4): discovery admin data hooks (jobs, candidates, promote, reject)"
```

---

### Task 9: Candidate tree component + review page + wiring

**Files:**
- Create: `src/features/admin/discovery/CandidateTree.tsx`
- Create: `src/features/admin/discovery/AdminDiscovery.tsx`
- Modify: `src/router.tsx` (add `/admin/discovery` route)
- Modify: `src/features/admin/AdminHome.tsx` (add nav link)
- Modify: `src/features/admin/AdminLayout.tsx` (add header link)
- Test: `src/features/admin/discovery/CandidateTree.test.tsx`

**Interfaces:**
- Consumes: hooks from Task 8, `DiscoveryCandidate` type.
- Produces:
  - `<CandidateTree jobId candidates onPromote onReject />` — groups candidates by `entity_type` into a source→item→benefit tree via `parent_fingerprint`, renders each node with a `match_status`/`verification_status`/`review_status` chip and Aprovar / Rejeitar buttons (disabled when `review_status !== 'pending'`).
  - `<AdminDiscovery />` — jobs list + "Novo job" form (brief input → `useCreateJob`); selecting a job shows its `CandidateTree`.

- [ ] **Step 1: Write the failing test**

Create `src/features/admin/discovery/CandidateTree.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CandidateTree } from './CandidateTree'
import type { DiscoveryCandidate } from './types'

const base = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate => ({
  id: 'x', job_id: 'j', entity_type: 'source', fingerprint: 'source|s', parent_fingerprint: null,
  payload: {}, provenance: {}, match_status: 'new', matched_id: null, review_status: 'pending',
  promoted_id: null, created_at: '', ...over,
})

const candidates: DiscoveryCandidate[] = [
  base({ id: 's1', entity_type: 'source', fingerprint: 'source|unimed', payload: { name: 'Unimed', slug: 'unimed' } }),
  base({ id: 'i1', entity_type: 'source_item', fingerprint: 'source_item|unimed|nacional',
         parent_fingerprint: 'source|unimed', payload: { label: 'Nacional' } }),
  base({ id: 'b1', entity_type: 'benefit', fingerprint: 'benefit|unimed-nacional|farmacia',
         parent_fingerprint: 'source_item|unimed|nacional', payload: { title: 'Farmácia' } }),
]

describe('CandidateTree', () => {
  it('renderiza a árvore source -> item -> benefit', () => {
    render(<CandidateTree jobId="j" candidates={candidates} onPromote={vi.fn()} onReject={vi.fn()} />)
    expect(screen.getByText('Unimed')).toBeInTheDocument()
    expect(screen.getByText('Nacional')).toBeInTheDocument()
    expect(screen.getByText('Farmácia')).toBeInTheDocument()
  })

  it('Aprovar chama onPromote com o id do candidato', () => {
    const onPromote = vi.fn()
    render(<CandidateTree jobId="j" candidates={candidates} onPromote={onPromote} onReject={vi.fn()} />)
    fireEvent.click(screen.getAllByRole('button', { name: /aprovar/i })[0])
    expect(onPromote).toHaveBeenCalledWith('s1')
  })

  it('esconde ações de um candidato já aprovado', () => {
    const approved = [base({ id: 's1', payload: { name: 'Unimed' }, review_status: 'approved' })]
    render(<CandidateTree jobId="j" candidates={approved} onPromote={vi.fn()} onReject={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CandidateTree`
Expected: FAIL — cannot find module `./CandidateTree`.

- [ ] **Step 3: Implement `CandidateTree.tsx`**

Create `src/features/admin/discovery/CandidateTree.tsx`:

```tsx
import type { DiscoveryCandidate } from './types'

const label = (c: DiscoveryCandidate): string => {
  const p = c.payload as { name?: string; label?: string; title?: string }
  return p.name ?? p.label ?? p.title ?? c.fingerprint
}

function Chip({ text }: { text: string }) {
  return (
    <span className="muted" style={{ fontSize: 11, border: '1px solid var(--line)', borderRadius: 6, padding: '0 6px' }}>
      {text}
    </span>
  )
}

function Node({
  c, depth, onPromote, onReject,
}: { c: DiscoveryCandidate; depth: number; onPromote: (id: string) => void; onReject: (id: string) => void }) {
  const prov = c.provenance as { verification_status?: string | null }
  return (
    <div style={{ paddingLeft: depth * 16, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
      <strong>{label(c)}</strong>
      <Chip text={c.match_status} />
      {prov.verification_status ? <Chip text={prov.verification_status} /> : null}
      {c.review_status !== 'pending' ? <Chip text={c.review_status} /> : (
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => onPromote(c.id)}>Aprovar</button>
          <button type="button" className="muted" onClick={() => onReject(c.id)}>Rejeitar</button>
        </span>
      )}
    </div>
  )
}

export function CandidateTree({
  candidates, onPromote, onReject,
}: {
  jobId: string
  candidates: DiscoveryCandidate[]
  onPromote: (id: string) => void
  onReject: (id: string) => void
}) {
  const byParent = new Map<string | null, DiscoveryCandidate[]>()
  for (const c of candidates) {
    const k = c.parent_fingerprint
    byParent.set(k, [...(byParent.get(k) ?? []), c])
  }

  const rows: { c: DiscoveryCandidate; depth: number }[] = []
  const walk = (parentFp: string | null, depth: number) => {
    for (const c of byParent.get(parentFp) ?? []) {
      rows.push({ c, depth })
      walk(c.fingerprint, depth + 1)
    }
  }
  walk(null, 0) // raízes = sources (parent_fingerprint null)

  if (rows.length === 0) return <p className="muted">Nenhum candidato ainda.</p>
  return (
    <div>
      {rows.map(({ c, depth }) => (
        <Node key={c.id} c={c} depth={depth} onPromote={onPromote} onReject={onReject} />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- CandidateTree`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement `AdminDiscovery.tsx`**

Create `src/features/admin/discovery/AdminDiscovery.tsx`:

```tsx
import { useState } from 'react'
import { CandidateTree } from './CandidateTree'
import {
  useCreateJob, useDiscoveryJobs, useJobCandidates, usePromoteCandidate, useRejectCandidate,
} from './useDiscovery'

export function AdminDiscovery() {
  const jobs = useDiscoveryJobs()
  const createJob = useCreateJob()
  const [brief, setBrief] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const candidates = useJobCandidates(selected)
  const promote = usePromoteCandidate(selected)
  const reject = useRejectCandidate(selected)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
      <h1 style={{ fontSize: 'var(--fz-h1)', fontWeight: 700, letterSpacing: '-.03em', margin: 0 }}>
        Discovery
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (brief.trim()) createJob.mutate(brief.trim(), { onSuccess: () => setBrief('') })
        }}
        style={{ display: 'flex', gap: 8 }}
      >
        <input
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Novo job (ex.: Unimed, Wellhub, Livelo…)"
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={createJob.isPending}>Enfileirar</button>
      </form>

      <div>
        {(jobs.data ?? []).map((j) => (
          <button
            key={j.id}
            type="button"
            className="row"
            onClick={() => setSelected(j.id)}
            style={{ color: 'inherit', width: '100%', textAlign: 'left', background: selected === j.id ? 'var(--surface)' : 'transparent' }}
          >
            {j.brief}
            <span className="muted" aria-hidden="true">{j.status}</span>
          </button>
        ))}
      </div>

      {selected ? (
        candidates.isLoading ? <p className="muted">Carregando…</p> : (
          <CandidateTree
            jobId={selected}
            candidates={candidates.data ?? []}
            onPromote={(id) => promote.mutate(id)}
            onReject={(id) => reject.mutate(id)}
          />
        )
      ) : null}
    </div>
  )
}
```

- [ ] **Step 6: Wire the route**

In `src/router.tsx`, add the import and the route under the `AdminLayout` children (alongside `/admin/benefits`):

```tsx
import { AdminDiscovery } from './features/admin/discovery/AdminDiscovery'
```

```tsx
          { path: '/admin/benefits', element: <AdminBenefits /> },
          { path: '/admin/discovery', element: <AdminDiscovery /> },
```

- [ ] **Step 7: Add nav links**

In `src/features/admin/AdminHome.tsx`, add a third link after "Gerenciar benefícios":

```tsx
        <Link className="row" to="/admin/discovery" style={{ color: 'inherit' }}>
          Discovery (fila de revisão)
          <span className="muted" aria-hidden="true">
            →
          </span>
        </Link>
```

In `src/features/admin/AdminLayout.tsx`, add a header link after the "Benefícios" link:

```tsx
        <Link to="/admin/discovery" className="muted" style={{ fontSize: 13, textDecoration: 'none' }}>
          Discovery
        </Link>
```

- [ ] **Step 8: Type-check + full test run**

Run: `npm run build && npm test`
Expected: build passes; all tests green.

- [ ] **Step 9: Commit**

```bash
git add src/features/admin/discovery/CandidateTree.tsx src/features/admin/discovery/AdminDiscovery.tsx src/features/admin/discovery/CandidateTree.test.tsx src/router.tsx src/features/admin/AdminHome.tsx src/features/admin/AdminLayout.tsx
git commit -m "feat(p4): /admin/discovery review page + candidate tree + nav"
```

---

## Phase E — End-to-end smoke (manual, no CI)

### Task 10: One real Codex run against a live brief

**Files:** none (operational verification).

This validates the one thing unit tests mock: the real `codex exec` shell-out. Requires the Codex CLI installed and authenticated (`codex --version` works) and local Supabase running.

- [ ] **Step 1: Confirm prerequisites**

Run: `codex --version && npx -y supabase@2.95.0 status`
Expected: Codex prints a version; Supabase reports running with API URL + keys.

- [ ] **Step 2: Enqueue a job via the admin UI**

Run: `npm run dev`, log in as admin, go to `/admin/discovery`, enqueue brief `Wellhub` (a `corporate_benefits` source with no catalog overlap).

- [ ] **Step 3: Run the discover script**

Run: `npm run discover`
Expected: logs `job <id> -> done` (or `-> error` with a printed validation reason). No secret env reaches Codex — confirm by checking the script never passes `SUPABASE_*` (already enforced by `sanitizedEnv`).

- [ ] **Step 4: Review + promote in the UI**

Reload `/admin/discovery`, select the job, confirm a source→item→benefit tree with `source_category` chips and `source_url` provenance. Approve the source, then an item, then a benefit (top-down). Confirm the benefit appears in `/admin/benefits` with `active=false`.

- [ ] **Step 5: Confirm human-gate + secret isolation held**

Verify nothing entered `benefits`/`sources` before you clicked Aprovar (the script only writes to `discovery_candidates`). This is the core invariant: machine never writes catalog without a human.

- [ ] **Step 6: Reset test pollution (optional)**

Run: `npx -y supabase@2.95.0 db reset` to clear the manual run's rows if you don't want them in your local catalog.

---

## Self-Review

**Spec coverage:**
- §1 schema staging genérico → Task 1 (`0015`).
- §3 agente Codex-runtime, validate-and-retry → Tasks 5–6.
- §3 segurança / isolamento de segredos → Task 5 (`sanitizedEnv`) + Task 10 verification.
- §4 modelo de dados (2 tabelas) → Task 1.
- §5 idempotência (fingerprint upsert) + claim atômico → Tasks 2/4/6 + `claim_discovery_job` (Task 1).
- §6 admin `/admin/discovery` (árvore, chips, ações) → Tasks 8–9.
- §7 promoção transacional + procedência + idempotência → Task 7.
- §8 disparo v1 (admin enfileira, script fora de banda) → Task 9 (form) + Task 6 (`main()`).
- §9 testes (unit fingerprint/match/schema; agente com shell-out mockado; promoção integração; componentes admin) → Tasks 2/3/4/6/7/8/9.

**Out of scope (correctly not planned):** Worker Dokploy/cron, botão "rodar agora" síncrono, descoberta de fontes do usuário, re-verificação periódica, o modelo fonte-agnóstico em si (P1, já landed).

**Deliberate v1 simplifications (ponytail):**
- `match_status` `duplicate` collapses into `update` (no byte-diff) — `matchCatalog.ts` comment marks the upgrade path.
- Candidate editing is a raw `payload` patch hook (`useUpdateCandidatePayload`), not a full `BenefitForm`/`SourceForm` embed as §6 aspires to. The hook is wired; embedding the real forms is a follow-up (they operate on catalog rows, not candidates). If the reviewer wants full form reuse in v1, that's an added task.

**Type consistency check:** `DiscoveryEntityType` / `match_status` values are identical across `flatten.ts`, `matchCatalog.ts`, DB enums, and `types.ts`. RPC names (`claim_discovery_job`, `promote_discovery_candidate`) match between migrations, `discover.ts`, and `useDiscovery.ts`. `payload.slug` is written by `flattenTree` and read by the promotion RPC — same key.
