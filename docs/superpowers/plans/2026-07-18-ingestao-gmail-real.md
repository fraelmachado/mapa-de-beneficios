# Ingestão real via Gmail — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ler o Gmail do usuário de verdade (client-side, one-shot) para sugerir marcas de programas de benefícios, deixando o usuário confirmar/escolher o tier, e gravar o e-mail (remetente/assunto/data) que atribuiu cada programa.

**Architecture:** Google Identity Services (GIS) no browser pega um access token `gmail.readonly` curto; o browser consulta a Gmail API por domínio de remetente, casa contra `sources.match_domains` do catálogo e produz "findings" por marca. O usuário confirma no `RevisarGmail`; marcas multi-tier abrem o bottom-sheet existente. Ao salvar, uma RPC única grava `user_sources` + `source_evidence` atomicamente. Sem backend, sem token guardado.

**Tech Stack:** Vite + React + TS, TanStack Query v5, Supabase self-hosted (Postgres + RLS + pg_cron), Vitest. Gmail REST v1 + `https://accounts.google.com/gsi/client`.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-18-ingestao-gmail-real-design.md` (rev 3). Toda tarefa herda estas regras.
- **Detecção por marca; tier sempre escolhido.** Nenhum finding grava tier sozinho. Marca multi-tier exige escolha no sheet; a CTA de confirmar fica **bloqueada** enquanto houver marca incluída sem tier resolvido. Sem default de "tier topo".
- **Persistência atômica** via RPC única `add_gmail_sources(payload jsonb)`. Nada de commitar sources e depois evidência à parte.
- **Idempotência:** `source_evidence` tem `unique(user_id, gmail_account, source_id, gmail_message_id)`; ingestão é **aditiva** (nunca remove sources já marcados).
- **Scan anônimo permitido; retenção curta.** Sem gate de login. Evidência de usuário anônimo expira em 30 dias (`pg_cron`); `user_sources` não expira.
- **Privacidade:** escopo `gmail.readonly`; token só em memória, nunca persistido/logado; só headers (`format=metadata`), nunca corpo; cópia honesta ("metadados: remetente, assunto, data" — **não** "nada foi lido").
- **Matching seguro:** casar domínio por **boundary de label** (`spotify.com` casa `e.spotify.com`, rejeita `evilspotify.com`). Recência por **`internalDate`**, não pelo header `Date`.
- **Env:** `VITE_GOOGLE_CLIENT_ID` (público). Ausente → caminho Gmail desabilitado, app não quebra.
- **Copy/idioma:** pt-BR. **Termo canônico:** "programas de benefícios" (não "fontes/provedores").
- **Padrões do repo:** RLS own-rows com `grant … to authenticated` + policy `using/with check (user_id = auth.uid())` (ver `0014`/`0019`); RPC `security invoker set search_path = ''` (ver `0005`); tipos via `npm run gen:types`; `npm test` **não** roda tsc → rodar `npm run build` para checar tipos.
- **Migrations DB:** aplicar local com `supabase db reset`/`supabase migration up`; testes de integração/RLS batem no Supabase local (`tests/helpers/clients.ts`).

---

## File Structure

**Criar:**
- `supabase/migrations/0020_gmail_ingestion.sql` — `sources.match_domains`, tabela `source_evidence` + RLS + unique, RPC `add_gmail_sources`, job `pg_cron` de retenção.
- `src/features/onboarding/gmail/types.ts` — `ScanEmail`, `EvidenceInput`, `Finding`, `ScanResult`, `GmailSourcePayload`.
- `src/features/onboarding/gmail/parseFrom.ts` (+ `.test.ts`) — header `From` → domínio; `domainMatches`.
- `src/features/onboarding/gmail/matchSources.ts` (+ `.test.ts`) — e-mails × catálogo → findings.
- `src/features/onboarding/gmail/gmailScan.ts` (+ `.test.ts`) — orquestra list+get por domínio, fetcher injetável.
- `src/features/onboarding/gmail/useGmailAuth.ts` — GIS: token, `getProfile`, `revoke`, cancelamento.
- `src/features/onboarding/gmail/GmailConsent.tsx` — tela de pré-consent (disclosure).
- `src/features/onboarding/gmail/TierSheet.tsx` — bottom-sheet de tier extraído do `ManualWizard`, reusável.
- `src/features/onboarding/useAddGmailSources.ts` (+ uso em teste) — hook da RPC.
- `src/features/onboarding/useDisconnectGmail.ts` — revoke + delete evidência.
- `tests/source_evidence.rls.test.ts` — RLS adversarial da nova tabela.
- `tests/add_gmail_sources.integration.test.ts` — atomicidade/idempotência/aditividade.

**Modificar:**
- `src/features/onboarding/types.ts` — `Source` ganha `match_domains: string[]`.
- `src/features/onboarding/useSources.ts` — `SELECT` inclui `match_domains`.
- `src/features/onboarding/ManualWizard.tsx` — usar `TierSheet` e `recommendedItemId` extraídos.
- `src/features/onboarding/RevisarGmail.tsx` — findings por marca, sheet, CTA bloqueada, submit via `add_gmail_sources`.
- `src/features/onboarding/OnboardingPage.tsx` — scan real, tela de consent, estados (parcial/erro/vazio).
- `src/features/onboarding/demoFindings.ts` — remover (substituído pelo scan real).
- `src/features/perfil/Perfil.tsx` — botão "Desconectar Gmail e apagar dados".
- `supabase/seed.sql` — `match_domains` das 25 marcas.
- `Dockerfile` — build arg `VITE_GOOGLE_CLIENT_ID`.
- `src/lib/database.types.ts` — regenerado (`npm run gen:types`).

---

## Task 1: Migration 0020 — schema, RLS, unique

**Files:**
- Create: `supabase/migrations/0020_gmail_ingestion.sql`
- Create: `tests/source_evidence.rls.test.ts`

**Interfaces:**
- Produces: coluna `sources.match_domains text[]`; tabela `source_evidence(id, user_id, source_id, gmail_account, gmail_message_id, email_from, email_subject, email_date, created_at)` com `unique(user_id, gmail_account, source_id, gmail_message_id)` e RLS own-rows (`select`/`insert`/`delete`).

- [ ] **Step 1: Escrever a migration (schema + RLS)** — só o schema; a RPC e o pg_cron entram nas Tasks 2/3 no mesmo arquivo.

```sql
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
```

- [ ] **Step 2: Aplicar a migration local**

Run: `supabase migration up` (ou `supabase db reset` se preferir base limpa)
Expected: aplica `0020` sem erro; `\d source_evidence` mostra a tabela e a unique.

- [ ] **Step 3: Escrever o teste de RLS adversarial**

```ts
// tests/source_evidence.rls.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceClient, userClient, anonClient } from './helpers/clients'

let srcId: string

beforeAll(async () => {
  const db = serviceClient()
  const stamp = `${Date.now()}-${Math.floor(performance.now() * 1000)}`
  const { data } = await db.from('sources')
    .insert({ kind: 'loyalty', name: `EvSrc-${stamp}`, sort_order: 99, slug: `evsrc-${stamp}` })
    .select().single()
  srcId = data!.id
})

afterAll(async () => {
  if (srcId) await serviceClient().from('sources').delete().eq('id', srcId)
})

describe('RLS source_evidence', () => {
  it('usuário só enxerga as próprias evidências', async () => {
    const a = await userClient()
    const b = await userClient()
    const row = (uid: string) => ({
      user_id: uid, source_id: srcId, gmail_account: 'x@gmail.com',
      gmail_message_id: `m-${uid}`, email_from: 'no-reply@x.com',
    })
    await a.client.from('source_evidence').insert(row(a.id))
    await b.client.from('source_evidence').insert(row(b.id))
    const { data } = await a.client.from('source_evidence').select('user_id')
    expect(data!.every((r) => r.user_id === a.id)).toBe(true)
  })

  it('não dá para inserir evidência em nome de outro (user_id forjado)', async () => {
    const a = await userClient()
    const b = await userClient()
    const { error } = await a.client.from('source_evidence').insert({
      user_id: b.id, source_id: srcId, gmail_account: 'x@gmail.com',
      gmail_message_id: 'forged', email_from: 'no-reply@x.com',
    })
    expect(error).not.toBeNull()
  })

  it('anônimo não-autenticado não lê evidências', async () => {
    const { error, data } = await anonClient().from('source_evidence').select('id')
    expect(error !== null || (data ?? []).length === 0).toBe(true)
  })

  it('delete só remove as próprias linhas', async () => {
    const a = await userClient()
    await a.client.from('source_evidence').insert({
      user_id: a.id, source_id: srcId, gmail_account: 'x@gmail.com',
      gmail_message_id: 'del', email_from: 'no-reply@x.com',
    })
    await a.client.from('source_evidence').delete().eq('user_id', a.id)
    const { data } = await a.client.from('source_evidence').select('id')
    expect(data!.length).toBe(0)
  })
})
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- source_evidence.rls`
Expected: PASS (4 testes).

- [ ] **Step 5: Regenerar tipos + commit**

```bash
npm run gen:types
git add supabase/migrations/0020_gmail_ingestion.sql tests/source_evidence.rls.test.ts src/lib/database.types.ts
git commit -m "feat(gmail): migration 0020 — match_domains + source_evidence com RLS own-rows"
```

---

## Task 2: RPC `add_gmail_sources` (atômica, aditiva, idempotente)

**Files:**
- Modify: `supabase/migrations/0020_gmail_ingestion.sql` (append)
- Create: `tests/add_gmail_sources.integration.test.ts`

**Interfaces:**
- Produces: `add_gmail_sources(payload jsonb) returns void`. `payload` = array de `{ item_id, source_id, gmail_account, gmail_message_id, email_from, email_subject, email_date }`. Numa transação: insere `user_sources` (aditivo, sem duplicar) + `source_evidence` (upsert idempotente).

- [ ] **Step 1: Append da RPC na migration 0020**

```sql
-- 3. Grava seleção + evidência numa única transação (atômico, aditivo, idempotente).
-- security invoker: RLS de user_sources/source_evidence se aplica; user_id = auth.uid().
create function add_gmail_sources(payload jsonb)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare rec jsonb;
begin
  for rec in select value from jsonb_array_elements(payload) as value loop
    -- aditivo: não remove seleções anteriores, não duplica
    insert into public.user_sources (user_id, source_item_id)
    values (auth.uid(), (rec->>'item_id')::uuid)
    on conflict (user_id, source_item_id) do nothing;

    -- idempotente: rescan da mesma mensagem não duplica evidência
    insert into public.source_evidence
      (user_id, source_id, gmail_account, gmail_message_id, email_from, email_subject, email_date)
    values (
      auth.uid(), (rec->>'source_id')::uuid, rec->>'gmail_account', rec->>'gmail_message_id',
      rec->>'email_from', rec->>'email_subject', (rec->>'email_date')::timestamptz
    )
    on conflict (user_id, gmail_account, source_id, gmail_message_id) do nothing;
  end loop;
end;
$$;

grant execute on function add_gmail_sources(jsonb) to authenticated;
```

- [ ] **Step 2: Reaplicar a migration**

Run: `supabase db reset` (recria com a função)
Expected: sem erro; `\df add_gmail_sources` lista a função.

- [ ] **Step 3: Escrever o teste de integração**

```ts
// tests/add_gmail_sources.integration.test.ts
import { describe, it, expect } from 'vitest'
import { userClient, serviceClient } from './helpers/clients'

async function oneItem() {
  const db = serviceClient()
  const stamp = `${Date.now()}-${Math.floor(performance.now() * 1000)}`
  const { data: src } = await db.from('sources')
    .insert({ kind: 'card', name: `AGS-${stamp}`, sort_order: 1, slug: `ags-${stamp}` })
    .select().single()
  const { data: item } = await db.from('source_items')
    .insert({ source_id: src!.id, label: 'L1', sort_order: 1, slug: `ags-i-${stamp}` })
    .select().single()
  return { srcId: src!.id as string, itemId: item!.id as string, db }
}

function payload(srcId: string, itemId: string, messageId: string) {
  return [{
    item_id: itemId, source_id: srcId, gmail_account: 'me@gmail.com',
    gmail_message_id: messageId, email_from: 'no-reply@brand.com',
    email_subject: 'Sua fatura', email_date: '2026-07-01T10:00:00Z',
  }]
}

describe('add_gmail_sources RPC', () => {
  it('grava source + evidência juntos', async () => {
    const { srcId, itemId, db } = await oneItem()
    const { client, id } = await userClient()
    const res = await client.rpc('add_gmail_sources', { payload: payload(srcId, itemId, 'm1') })
    expect(res.error).toBeNull()
    const us = await db.from('user_sources').select('source_item_id').eq('user_id', id)
    expect(us.data!.map((r) => r.source_item_id)).toEqual([itemId])
    const ev = await db.from('source_evidence').select('gmail_message_id').eq('user_id', id)
    expect(ev.data!.map((r) => r.gmail_message_id)).toEqual(['m1'])
    await db.from('sources').delete().eq('id', srcId)
  })

  it('rescan da mesma mensagem é idempotente', async () => {
    const { srcId, itemId, db } = await oneItem()
    const { client, id } = await userClient()
    await client.rpc('add_gmail_sources', { payload: payload(srcId, itemId, 'dup') })
    await client.rpc('add_gmail_sources', { payload: payload(srcId, itemId, 'dup') })
    const ev = await db.from('source_evidence').select('id').eq('user_id', id)
    expect(ev.data!.length).toBe(1)
    await db.from('sources').delete().eq('id', srcId)
  })

  it('é aditivo: não apaga seleção anterior', async () => {
    const { srcId, itemId, db } = await oneItem()
    const { client, id } = await userClient()
    // seleção prévia via replace (outro item)
    const { data: item2 } = await db.from('source_items')
      .insert({ source_id: srcId, label: 'L2', sort_order: 2, slug: `ags-i2-${Date.now()}` })
      .select().single()
    await client.rpc('replace_user_sources', { item_ids: [item2!.id] })
    await client.rpc('add_gmail_sources', { payload: payload(srcId, itemId, 'm2') })
    const us = await db.from('user_sources').select('source_item_id').eq('user_id', id)
    expect(us.data!.map((r) => r.source_item_id).sort()).toEqual([itemId, item2!.id].sort())
    await db.from('sources').delete().eq('id', srcId)
  })
})
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- add_gmail_sources`
Expected: PASS (3 testes).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0020_gmail_ingestion.sql tests/add_gmail_sources.integration.test.ts
git commit -m "feat(gmail): RPC add_gmail_sources — atômica, aditiva, idempotente"
```

---

## Task 3: Retenção de 30 dias (pg_cron)

**Files:**
- Modify: `supabase/migrations/0020_gmail_ingestion.sql` (append)

**Interfaces:**
- Produces: job diário que apaga `source_evidence` de usuários **ainda anônimos** com `created_at < now() - 30 days`. `user_sources` não é tocado.

- [ ] **Step 1: Append do job pg_cron na migration** — `create extension if not exists` é idempotente; se o self-hosted não tiver `pg_cron`, o fallback (Dokploy schedule) está documentado no Step 3.

```sql
-- 4. Retenção: evidência de usuário AINDA anônimo expira em 30 dias.
-- Só a proveniência some; user_sources (os programas) permanecem.
create extension if not exists pg_cron;

select cron.schedule(
  'source_evidence_anon_retention',
  '17 4 * * *',
  $$
    delete from public.source_evidence e
    using auth.users u
    where e.user_id = u.id
      and u.is_anonymous
      and e.created_at < now() - interval '30 days'
  $$
);
```

- [ ] **Step 2: Aplicar + validar a query do job (roda o DELETE manualmente uma vez)**

Run:
```bash
supabase db reset
psql "$LOCAL_DB_URL" -c "delete from public.source_evidence e using auth.users u where e.user_id = u.id and u.is_anonymous and e.created_at < now() - interval '30 days';"
```
Expected: `create extension`/`cron.schedule` sem erro; o `delete` executa sem erro (0 linhas numa base limpa). Se `create extension pg_cron` falhar localmente, comente o bloco `cron.schedule` **apenas** para o teste local e siga o fallback no Step 3 (a query em si já foi validada).

- [ ] **Step 3: Documentar o fallback (comentário no topo do bloco)**

Adicionar acima do `create extension`:
```sql
-- Requer pg_cron no Supabase self-hosted. Se indisponível em produção, agendar
-- o mesmo DELETE via task do Dokploy chamando pg-meta /pg/query (service_role).
-- Ver spec: seção "Modelo de dados" e memória mapa-de-beneficios-prod-supabase-ops.
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0020_gmail_ingestion.sql
git commit -m "feat(gmail): retenção de 30 dias da evidência anônima via pg_cron"
```

---

## Task 4: Seed `match_domains` das 25 marcas

**Files:**
- Modify: `supabase/seed.sql`
- Create: `tests/seed_match_domains.test.ts`

**Interfaces:**
- Consumes: coluna `sources.match_domains` (Task 1).
- Produces: marcas do catálogo com `match_domains` preenchido.

- [ ] **Step 1: Escrever o teste (o catálogo tem domínios de match)**

```ts
// tests/seed_match_domains.test.ts
import { describe, it, expect } from 'vitest'
import { serviceClient } from './helpers/clients'

describe('seed match_domains', () => {
  it('marcas conhecidas têm domínios de remetente', async () => {
    const db = serviceClient()
    const { data } = await db.from('sources').select('name, match_domains').eq('active', true)
    const withDomains = (data ?? []).filter((s) => (s.match_domains ?? []).length > 0)
    // pelo menos as principais marcas mapeadas
    expect(withDomains.length).toBeGreaterThanOrEqual(15)
    const spotify = (data ?? []).find((s) => s.name.toLowerCase().includes('spotify'))
    expect(spotify?.match_domains).toContain('spotify.com')
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npm test -- seed_match_domains`
Expected: FAIL (match_domains vazio no seed atual).

- [ ] **Step 3: Preencher `match_domains` no seed** — localizar cada `insert into sources (...)` e adicionar a coluna/valor. Mapear pelo domínio oficial do remetente. Exemplos (ajustar aos slugs/marcas reais do seed):

```sql
-- em cada insert de sources, incluir match_domains. Ex.:
-- Spotify
update sources set match_domains = '{spotify.com}'         where slug = 'spotify';
update sources set match_domains = '{nubank.com.br}'         where slug = 'nubank';
update sources set match_domains = '{itau.com.br}'           where slug = 'itau';
update sources set match_domains = '{bradesco.com.br}'       where slug = 'bradesco';
update sources set match_domains = '{disneyplus.com}'        where slug = 'disney-plus';
update sources set match_domains = '{mail.mercadolivre.com.br,mercadopago.com.br}' where slug = 'mercado-pago';
update sources set match_domains = '{amazon.com.br}'         where slug = 'amazon-prime';
update sources set match_domains = '{vivo.com.br}'           where slug = 'vivo';
update sources set match_domains = '{claro.com.br}'          where slug = 'claro';
update sources set match_domains = '{tim.com.br}'            where slug = 'tim';
update sources set match_domains = '{xpi.com.br,xpinvestimentos.com.br}' where slug = 'xp';
update sources set match_domains = '{bancointer.com.br}'     where slug = 'inter';
update sources set match_domains = '{picpay.com}'            where slug = 'picpay';
-- … completar TODAS as 25 marcas ativas do seed (health/carrier/retail/loyalty).
-- ponytail: usar UPDATE por slug ao fim do seed mantém os inserts existentes intactos.
```

> Regra: só domínios **registráveis oficiais** do remetente (sem `gmail.com`/genéricos). Se não souber o domínio de uma marca, deixar `'{}'` e anotar `-- TODO domínio` no seed (marca fica invisível ao scan — aceitável).

- [ ] **Step 4: Reaplicar seed + rodar teste**

Run: `supabase db reset && npm test -- seed_match_domains`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/seed.sql tests/seed_match_domains.test.ts
git commit -m "feat(gmail): match_domains das marcas no seed"
```

---

## Task 5: `parseFrom` + `domainMatches` (puros)

**Files:**
- Create: `src/features/onboarding/gmail/parseFrom.ts`
- Create: `src/features/onboarding/gmail/parseFrom.test.ts`

**Interfaces:**
- Produces: `parseFrom(header: string): string | null` (domínio em minúsculas); `domainMatches(emailDomain: string, matchDomain: string): boolean` (boundary de label).

- [ ] **Step 1: Escrever os testes**

```ts
// src/features/onboarding/gmail/parseFrom.test.ts
import { describe, it, expect } from 'vitest'
import { parseFrom, domainMatches } from './parseFrom'

describe('parseFrom', () => {
  it('extrai domínio de "Nome <local@dominio>"', () => {
    expect(parseFrom('"Spotify" <no-reply@e.spotify.com>')).toBe('e.spotify.com')
  })
  it('extrai de endereço puro', () => {
    expect(parseFrom('billing@nubank.com.br')).toBe('nubank.com.br')
  })
  it('normaliza case e ponto final', () => {
    expect(parseFrom('X <A@Spotify.COM.>')).toBe('spotify.com')
  })
  it('primeiro endereço quando há vários', () => {
    expect(parseFrom('a@x.com, b@y.com')).toBe('x.com')
  })
  it('lixo → null', () => {
    expect(parseFrom('sem-arroba')).toBeNull()
    expect(parseFrom('')).toBeNull()
  })
})

describe('domainMatches', () => {
  it('casa domínio exato', () => {
    expect(domainMatches('spotify.com', 'spotify.com')).toBe(true)
  })
  it('casa subdomínio (boundary de label)', () => {
    expect(domainMatches('e.spotify.com', 'spotify.com')).toBe(true)
  })
  it('REJEITA colisão de sufixo', () => {
    expect(domainMatches('evilspotify.com', 'spotify.com')).toBe(false)
  })
  it('não casa domínio diferente', () => {
    expect(domainMatches('nubank.com.br', 'spotify.com')).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npm test -- parseFrom`
Expected: FAIL ("parseFrom is not defined").

- [ ] **Step 3: Implementar**

```ts
// src/features/onboarding/gmail/parseFrom.ts

/** Domínio do primeiro endereço de um header From, em minúsculas. `null` se inválido. */
export function parseFrom(header: string): string | null {
  const first = header.split(',')[0] ?? ''
  const angle = first.match(/<([^>]+)>/)
  const addr = (angle ? angle[1] : first).trim()
  const at = addr.lastIndexOf('@')
  if (at < 0) return null
  const domain = addr.slice(at + 1).trim().toLowerCase().replace(/\.+$/, '')
  return domain.includes('.') ? domain : null
}

/** Casa por boundary de label: `matchDomain` ou um subdomínio dele. Rejeita colisão de sufixo. */
export function domainMatches(emailDomain: string, matchDomain: string): boolean {
  const e = emailDomain.toLowerCase()
  const m = matchDomain.toLowerCase()
  return e === m || e.endsWith('.' + m)
}
```

- [ ] **Step 4: Rodar para ver passar**

Run: `npm test -- parseFrom`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/gmail/parseFrom.ts src/features/onboarding/gmail/parseFrom.test.ts
git commit -m "feat(gmail): parseFrom + domainMatches (boundary de label)"
```

---

## Task 6: Tipos + `matchSources` (puro)

**Files:**
- Create: `src/features/onboarding/gmail/types.ts`
- Create: `src/features/onboarding/gmail/matchSources.ts`
- Create: `src/features/onboarding/gmail/matchSources.test.ts`
- Modify: `src/features/onboarding/types.ts` (adicionar `match_domains`)

**Interfaces:**
- Consumes: `parseFrom`/`domainMatches` (Task 5); `Source`/`SourceItem` (`../types`).
- Produces:
  - `types.ts`: `ScanEmail`, `EvidenceInput`, `Finding`, `ScanResult`, `GmailSourcePayload`.
  - `matchSources(emails: ScanEmail[], sources: Source[], gmailAccount: string): Finding[]` — 1 finding por marca casada; evidência = e-mail de maior `internalDate`.

- [ ] **Step 1: Adicionar `match_domains` ao `Source`**

```ts
// src/features/onboarding/types.ts — dentro de interface Source, após logo_url:
  match_domains?: string[]
```

- [ ] **Step 2: Criar os tipos do gmail**

```ts
// src/features/onboarding/gmail/types.ts
import type { SourceItem } from '../types'

export interface ScanEmail {
  domain: string
  from: string
  subject: string | null
  internalDate: number // ms epoch
  messageId: string
}

export interface EvidenceInput {
  gmailAccount: string
  gmailMessageId: string
  emailFrom: string
  emailSubject: string | null
  emailDate: string // ISO
}

export interface Finding {
  sourceId: string
  provider: string
  logo: string | null
  items: SourceItem[] // tiers da marca; length 1 = marca de item único
  evidence: EvidenceInput
}

export interface ScanResult {
  findings: Finding[]
  partial: boolean // algum domínio não pôde ser verificado
}

export interface GmailSourcePayload {
  item_id: string
  source_id: string
  gmail_account: string
  gmail_message_id: string
  email_from: string
  email_subject: string | null
  email_date: string
}
```

- [ ] **Step 3: Escrever os testes de `matchSources`**

```ts
// src/features/onboarding/gmail/matchSources.test.ts
import { describe, it, expect } from 'vitest'
import { matchSources } from './matchSources'
import type { ScanEmail } from './types'
import type { Source } from '../types'

const src = (over: Partial<Source>): Source => ({
  id: 's1', kind: 'retail', name: 'Spotify', logo_url: null, sort_order: 1,
  match_domains: ['spotify.com'],
  source_items: [{ id: 'i1', label: 'Premium', sort_order: 1 }],
  ...over,
})
const mail = (over: Partial<ScanEmail>): ScanEmail => ({
  domain: 'spotify.com', from: 'no-reply@spotify.com', subject: 'oi',
  internalDate: 1000, messageId: 'm1', ...over,
})

describe('matchSources', () => {
  it('casa marca por domínio e monta evidência', () => {
    const f = matchSources([mail({})], [src({})], 'me@gmail.com')
    expect(f).toHaveLength(1)
    expect(f[0].sourceId).toBe('s1')
    expect(f[0].items).toHaveLength(1)
    expect(f[0].evidence.gmailAccount).toBe('me@gmail.com')
    expect(f[0].evidence.gmailMessageId).toBe('m1')
  })

  it('ignora domínio desconhecido', () => {
    const f = matchSources([mail({ domain: 'x.com', from: 'a@x.com' })], [src({})], 'me@gmail.com')
    expect(f).toHaveLength(0)
  })

  it('rejeita colisão de sufixo', () => {
    const f = matchSources([mail({ domain: 'evilspotify.com', from: 'a@evilspotify.com' })], [src({})], 'me@gmail.com')
    expect(f).toHaveLength(0)
  })

  it('dedupe por marca mantendo o e-mail mais recente (internalDate)', () => {
    const emails = [mail({ messageId: 'old', internalDate: 1000 }), mail({ messageId: 'new', internalDate: 5000 })]
    const f = matchSources(emails, [src({})], 'me@gmail.com')
    expect(f).toHaveLength(1)
    expect(f[0].evidence.gmailMessageId).toBe('new')
  })

  it('converte internalDate para ISO em email_date', () => {
    const f = matchSources([mail({ internalDate: 0 })], [src({})], 'me@gmail.com')
    expect(f[0].evidence.emailDate).toBe('1970-01-01T00:00:00.000Z')
  })
})
```

- [ ] **Step 4: Rodar para ver falhar**

Run: `npm test -- matchSources`
Expected: FAIL.

- [ ] **Step 5: Implementar**

```ts
// src/features/onboarding/gmail/matchSources.ts
import type { Source } from '../types'
import type { ScanEmail, Finding } from './types'
import { domainMatches } from './parseFrom'

export function matchSources(emails: ScanEmail[], sources: Source[], gmailAccount: string): Finding[] {
  const bySource = new Map<string, { source: Source; email: ScanEmail }>()
  for (const email of emails) {
    const source = sources.find((s) =>
      (s.match_domains ?? []).some((d) => domainMatches(email.domain, d)),
    )
    if (!source) continue
    const prev = bySource.get(source.id)
    if (!prev || email.internalDate > prev.email.internalDate) {
      bySource.set(source.id, { source, email })
    }
  }
  return [...bySource.values()].map(({ source, email }) => ({
    sourceId: source.id,
    provider: source.name,
    logo: source.logo_url,
    items: source.source_items,
    evidence: {
      gmailAccount,
      gmailMessageId: email.messageId,
      emailFrom: email.from,
      emailSubject: email.subject,
      emailDate: new Date(email.internalDate).toISOString(),
    },
  }))
}
```

- [ ] **Step 6: Rodar + build (checa tipos do `Source`)**

Run: `npm test -- matchSources && npm run build`
Expected: testes PASS; build sem erro de tipo.

- [ ] **Step 7: Commit**

```bash
git add src/features/onboarding/gmail/types.ts src/features/onboarding/gmail/matchSources.ts src/features/onboarding/gmail/matchSources.test.ts src/features/onboarding/types.ts
git commit -m "feat(gmail): tipos + matchSources (dedupe por marca, evidência recente)"
```

---

## Task 7: `gmailScan` (list+get por domínio, fetcher injetável)

**Files:**
- Create: `src/features/onboarding/gmail/gmailScan.ts`
- Create: `src/features/onboarding/gmail/gmailScan.test.ts`

**Interfaces:**
- Consumes: `matchSources` (Task 6); `Source` (`../types`).
- Produces: `gmailScan(opts: { gmailAccount: string; sources: Source[]; fetchJson: FetchJson }): Promise<ScanResult>` onde `FetchJson = (path: string) => Promise<any>` (path relativo à Gmail API v1; a auth fica no fetcher).

- [ ] **Step 1: Escrever os testes (fetcher fake)**

```ts
// src/features/onboarding/gmail/gmailScan.test.ts
import { describe, it, expect } from 'vitest'
import { gmailScan } from './gmailScan'
import type { Source } from '../types'

const sources: Source[] = [{
  id: 's1', kind: 'retail', name: 'Spotify', logo_url: null, sort_order: 1,
  match_domains: ['spotify.com'], source_items: [{ id: 'i1', label: 'Premium', sort_order: 1 }],
}]

// fetcher fake: mapeia path → resposta
function fakeFetch(map: Record<string, any>) {
  return async (path: string) => {
    for (const key of Object.keys(map)) if (path.includes(key)) return map[key]
    throw new Error('404 ' + path)
  }
}

describe('gmailScan', () => {
  it('lista por domínio, busca headers e casa a marca', async () => {
    const fetchJson = fakeFetch({
      'messages?q=': { messages: [{ id: 'm1' }] },
      'messages/m1': {
        id: 'm1', internalDate: '5000',
        payload: { headers: [
          { name: 'From', value: 'no-reply@spotify.com' },
          { name: 'Subject', value: 'Seu recibo' },
        ] },
      },
    })
    const res = await gmailScan({ gmailAccount: 'me@gmail.com', sources, fetchJson })
    expect(res.partial).toBe(false)
    expect(res.findings).toHaveLength(1)
    expect(res.findings[0].evidence.emailFrom).toBe('no-reply@spotify.com')
  })

  it('domínio sem resultado não vira finding e não marca parcial', async () => {
    const fetchJson = fakeFetch({ 'messages?q=': { messages: [] } })
    const res = await gmailScan({ gmailAccount: 'me@gmail.com', sources, fetchJson })
    expect(res.findings).toHaveLength(0)
    expect(res.partial).toBe(false)
  })

  it('erro na busca de um domínio marca scan parcial', async () => {
    const fetchJson = async () => { throw new Error('429') }
    const res = await gmailScan({ gmailAccount: 'me@gmail.com', sources, fetchJson })
    expect(res.partial).toBe(true)
    expect(res.findings).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npm test -- gmailScan`
Expected: FAIL.

- [ ] **Step 3: Implementar**

```ts
// src/features/onboarding/gmail/gmailScan.ts
import type { Source } from '../types'
import type { ScanEmail, ScanResult } from './types'
import { parseFrom } from './parseFrom'
import { matchSources } from './matchSources'

export type FetchJson = (path: string) => Promise<any>

const MAX_PER_DOMAIN = 3

function header(msg: any, name: string): string | null {
  const h = (msg?.payload?.headers ?? []).find((x: any) => x.name?.toLowerCase() === name.toLowerCase())
  return h?.value ?? null
}

// ponytail: uma marca só precisa de UM e-mail recente; por-domínio evita 1 remetente
// ruidoso mascarar os demais e dispensa paginação. Promise.all sobre ~25 domínios é ok.
async function scanDomain(domain: string, fetchJson: FetchJson): Promise<ScanEmail | null> {
  const q = encodeURIComponent(`from:${domain} newer_than:2y`)
  const list = await fetchJson(`messages?q=${q}&maxResults=${MAX_PER_DOMAIN}`)
  const ids: string[] = (list?.messages ?? []).map((m: any) => m.id)
  let best: ScanEmail | null = null
  for (const id of ids) {
    const msg = await fetchJson(`messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`)
    const from = header(msg, 'From')
    const emailDomain = from ? parseFrom(from) : null
    if (!from || !emailDomain) continue
    const internalDate = Number(msg.internalDate ?? 0)
    if (!best || internalDate > best.internalDate) {
      best = { domain: emailDomain, from, subject: header(msg, 'Subject'), internalDate, messageId: id }
    }
  }
  return best
}

export async function gmailScan(opts: { gmailAccount: string; sources: Source[]; fetchJson: FetchJson }): Promise<ScanResult> {
  const { gmailAccount, sources, fetchJson } = opts
  const domains = [...new Set(sources.flatMap((s) => s.match_domains ?? []))]
  let partial = false
  const results = await Promise.all(
    domains.map((d) => scanDomain(d, fetchJson).catch(() => { partial = true; return null })),
  )
  const emails = results.filter((e): e is ScanEmail => e !== null)
  return { findings: matchSources(emails, sources, gmailAccount), partial }
}
```

- [ ] **Step 4: Rodar + build**

Run: `npm test -- gmailScan && npm run build`
Expected: PASS + build limpo.

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/gmail/gmailScan.ts src/features/onboarding/gmail/gmailScan.test.ts
git commit -m "feat(gmail): gmailScan por-domínio com fetcher injetável + estado parcial"
```

---

## Task 8: `useGmailAuth` (GIS: token, profile, revoke)

**Files:**
- Create: `src/features/onboarding/gmail/useGmailAuth.ts`
- Create: `src/features/onboarding/gmail/useGmailAuth.test.ts`

**Interfaces:**
- Produces: `useGmailAuth()` → `{ available: boolean; connect(): Promise<{ token: string; account: string }>; makeFetchJson(token: string): FetchJson; revoke(token: string): void }`.
  - `available` = `!!import.meta.env.VITE_GOOGLE_CLIENT_ID`.
  - `connect` carrega o GIS, pede o token (`gmail.readonly`), busca `users/me/profile` → `emailAddress`. Rejeita se o popup for cancelado/erro.
  - `makeFetchJson(token)` = `FetchJson` que prefixa `https://gmail.googleapis.com/gmail/v1/users/me/` e injeta o Bearer.

- [ ] **Step 1: Escrever o teste (parte pura: makeFetchJson + available)**

```ts
// src/features/onboarding/gmail/useGmailAuth.test.ts
import { describe, it, expect, vi } from 'vitest'
import { makeFetchJson } from './useGmailAuth'

describe('makeFetchJson', () => {
  it('prefixa a base da Gmail API e injeta o Bearer', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ id: 'm1' }) })) as any
    vi.stubGlobal('fetch', fetchMock)
    const fj = makeFetchJson('tok123')
    const out = await fj('messages/m1')
    expect(out).toEqual({ id: 'm1' })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://gmail.googleapis.com/gmail/v1/users/me/messages/m1')
    expect(init.headers.Authorization).toBe('Bearer tok123')
    vi.unstubAllGlobals()
  })

  it('rejeita em resposta não-ok', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 429 })) as any)
    await expect(makeFetchJson('t')('messages')).rejects.toThrow('429')
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npm test -- useGmailAuth`
Expected: FAIL.

- [ ] **Step 3: Implementar** — `makeFetchJson` é a parte testável; `connect`/`revoke` encapsulam o GIS (verificados no browser, Task 14).

```ts
// src/features/onboarding/gmail/useGmailAuth.ts
import type { FetchJson } from './gmailScan'

const SCOPE = 'https://www.googleapis.com/auth/gmail.readonly'
const GIS_SRC = 'https://accounts.google.com/gsi/client'
const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

export function makeFetchJson(token: string): FetchJson {
  return async (path: string) => {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error(String(res.status))
    return res.json()
  }
}

let gisPromise: Promise<void> | null = null
function loadGis(): Promise<void> {
  if (gisPromise) return gisPromise
  gisPromise = new Promise((resolve, reject) => {
    if ((window as any).google?.accounts?.oauth2) return resolve()
    const s = document.createElement('script')
    s.src = GIS_SRC
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error('gis_load_failed'))
    document.head.appendChild(s)
  })
  return gisPromise
}

function requestToken(): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = (window as any).google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: (resp: any) => (resp?.access_token ? resolve(resp.access_token) : reject(new Error('no_token'))),
      error_callback: (err: any) => reject(new Error(err?.type ?? 'popup_error')),
    })
    client.requestAccessToken()
  })
}

export function useGmailAuth() {
  const available = !!clientId

  async function connect(): Promise<{ token: string; account: string }> {
    await loadGis()
    const token = await requestToken()
    const profile = await makeFetchJson(token)('profile')
    return { token, account: profile.emailAddress as string }
  }

  function revoke(token: string) {
    ;(window as any).google?.accounts?.oauth2?.revoke?.(token)
  }

  return { available, connect, makeFetchJson, revoke }
}
```

- [ ] **Step 4: Rodar + build**

Run: `npm test -- useGmailAuth && npm run build`
Expected: PASS + build limpo.

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/gmail/useGmailAuth.ts src/features/onboarding/gmail/useGmailAuth.test.ts
git commit -m "feat(gmail): useGmailAuth (GIS token + profile + revoke) e makeFetchJson"
```

---

## Task 9: `useAddGmailSources` + `SELECT` com `match_domains`

**Files:**
- Create: `src/features/onboarding/useAddGmailSources.ts`
- Modify: `src/features/onboarding/useSources.ts` (SELECT + enrich preservam `match_domains`)

**Interfaces:**
- Consumes: RPC `add_gmail_sources` (Task 2); `GmailSourcePayload` (Task 6).
- Produces: `useAddGmailSources()` → mutation que recebe `GmailSourcePayload[]` e chama a RPC, invalidando `my_benefits`/`has_onboarded`/`user_sources`.

- [ ] **Step 1: Incluir `match_domains` no SELECT e no enrich**

```ts
// src/features/onboarding/useSources.ts — no SELECT, adicionar match_domains:
const SELECT =
  'id, kind, name, logo_url, sort_order, source_category, match_domains, ' +
  'source_items(id, label, sort_order, benefit_sources(benefits(estimated_value_brl, active)))'
```
`enrich` já faz `...s`, então `match_domains` passa adiante — mas garanta o tipo em `RawSource` (é `Omit<Source,'source_items'>`, que agora inclui `match_domains?`).

- [ ] **Step 2: Escrever o hook**

```ts
// src/features/onboarding/useAddGmailSources.ts
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'
import type { GmailSourcePayload } from './gmail/types'

// Grava seleção + evidência do Gmail atomicamente (RPC add_gmail_sources).
export function useAddGmailSources() {
  return useMutation({
    mutationFn: async (payload: GmailSourcePayload[]) => {
      const { error } = await supabase.rpc('add_gmail_sources', { payload })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_benefits'] })
      queryClient.invalidateQueries({ queryKey: ['has_onboarded'] })
      queryClient.invalidateQueries({ queryKey: ['user_sources'] })
    },
  })
}
```

- [ ] **Step 3: Build (checa o tipo do rpc gerado)**

Run: `npm run gen:types && npm run build`
Expected: build limpo (a RPC `add_gmail_sources` aparece em `database.types.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/features/onboarding/useAddGmailSources.ts src/features/onboarding/useSources.ts src/lib/database.types.ts
git commit -m "feat(gmail): useAddGmailSources + match_domains no SELECT do catálogo"
```

---

## Task 10: Extrair `TierSheet` do `ManualWizard`

**Files:**
- Create: `src/features/onboarding/gmail/TierSheet.tsx`
- Modify: `src/features/onboarding/ManualWizard.tsx` (usar o componente extraído)

**Interfaces:**
- Produces: `TierSheet({ brand, selectedId, onPick, onClose })` e `recommendedItemId(items)`, movidos de `ManualWizard`. `brand: Source`, `selectedId: string | null`, `onPick(itemId: string, markUnsure?: boolean): void`, `onClose(): void`.

- [ ] **Step 1: Criar `TierSheet.tsx`** — mover o JSX do sheet (linhas ~320-375 do `ManualWizard`) e `recommendedItemId` (linhas ~37-48) para o componente. Manter classes `.ob-sheet*`.

```tsx
// src/features/onboarding/gmail/TierSheet.tsx
import type { Source } from '../types'
import { formatBRL } from '../../benefits/estimatedValue'

// tier "Mais completo": mais benefícios, desempate por maior valor estimado.
export function recommendedItemId(items: Source['source_items']): string {
  let bestId = ''
  let bestScore = -1
  for (const it of items) {
    const score = (it.benefitCount ?? 0) * 1e6 + (it.estValueBrl ?? 0)
    if (score > bestScore) { bestScore = score; bestId = it.id }
  }
  return bestId
}

export function TierSheet({
  brand, selectedId, onPick, onClose,
}: {
  brand: Source
  selectedId: string | null
  onPick: (itemId: string, markUnsure?: boolean) => void
  onClose: () => void
}) {
  const recId = recommendedItemId(brand.source_items)
  return (
    <div className="ob-sheet" role="dialog" aria-modal="true" aria-label={`Qual o seu ${brand.name}?`}>
      <div className="ob-sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div className="ob-sheet-panel">
        <div className="ob-sheet-grip" aria-hidden="true" />
        <h3 className="ob-sheet-title">Qual o seu {brand.name}?</h3>
        <p className="ob-sheet-sub">Os benefícios mudam conforme a versão. Escolha a sua para o radar acertar.</p>
        <div className="ob-sheet-list">
          {brand.source_items.map((it) => {
            const isRec = it.id === recId
            const picked = selectedId === it.id
            return (
              <button key={it.id} type="button" className={'ob-sheet-item' + (picked ? ' on' : '')}
                aria-pressed={picked} onClick={() => onPick(it.id)}>
                <span className="ob-sheet-item-main">
                  <span className="ob-sheet-item-head">
                    <span className="ob-sheet-item-name">{it.label}</span>
                    {isRec && (it.benefitCount ?? 0) > 0 ? <span className="ob-sheet-badge">Mais completo</span> : null}
                  </span>
                  <span className="ob-sheet-item-meta">
                    {it.benefitCount ? `${it.benefitCount} benefício${it.benefitCount > 1 ? 's' : ''}` : 'Benefícios em breve'}
                  </span>
                </span>
                <span className="ob-sheet-item-side">
                  {it.estValueBrl ? (
                    <span className="ob-sheet-item-est"><span className="ob-sheet-approx">≈</span>{formatBRL(it.estValueBrl)}<span className="ob-sheet-year">/ano</span></span>
                  ) : null}
                  <span className="ob-sheet-radio" aria-hidden="true" />
                </span>
              </button>
            )
          })}
          <button type="button" className="ob-sheet-unsure" onClick={() => onPick(recId, true)}>
            <span>
              <span className="ob-sheet-unsure-title">Não tenho certeza</span>
              <span className="ob-sheet-unsure-sub">Mostramos o potencial e você confirma depois</span>
            </span>
            <span className="ob-sheet-chevron" aria-hidden="true">›</span>
          </button>
        </div>
        <div className="ob-sheet-hint">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0c1 8 4 11 12 12-8 1-11 4-12 12-1-8-4-11-12-12 8-1 11-4 12-12Z" /></svg>
          <p>Conectando o Gmail, descobrimos sua versão exata automaticamente — sem precisar escolher.</p>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Trocar o `ManualWizard` para usar `TierSheet`** — remover `recommendedItemId` local e o JSX inline do sheet; importar de `./gmail/TierSheet`. Substituir o bloco `{sheetBrand ? (...) : null}` por:

```tsx
// import no topo:
import { TierSheet } from './gmail/TierSheet'
// no fim do JSX, no lugar do sheet inline:
{sheetBrand ? (
  <TierSheet
    brand={sheetBrand}
    selectedId={unsure.has(sheetBrand.id) ? null : (sheetBrand.source_items.find((it) => selected.has(it.id))?.id ?? null)}
    onPick={(itemId, markUnsure) => pickTier(sheetBrand, itemId, markUnsure)}
    onClose={() => setSheetSourceId(null)}
  />
) : null}
```

- [ ] **Step 3: Rodar os testes do wizard + build**

Run: `npm test -- ManualWizard && npm run build`
Expected: PASS (comportamento inalterado) + build limpo.

- [ ] **Step 4: Commit**

```bash
git add src/features/onboarding/gmail/TierSheet.tsx src/features/onboarding/ManualWizard.tsx
git commit -m "refactor(onboarding): extrair TierSheet reusável do ManualWizard"
```

---

## Task 11: `RevisarGmail` — findings por marca, sheet, CTA bloqueada

**Files:**
- Modify: `src/features/onboarding/RevisarGmail.tsx`
- Modify: `src/features/onboarding/RevisarGmail.test.tsx`

**Interfaces:**
- Consumes: `Finding` (Task 6), `useAddGmailSources` (Task 9), `TierSheet` (Task 10).
- Produces: `RevisarGmail({ findings, partial, onDone, onBack })`. `onDone(saved: Finding[])`. Item único → resolvido ao incluir; multi → precisa escolher tier; CTA bloqueada enquanto houver incluído multi sem tier.

- [ ] **Step 1: Escrever/atualizar os testes**

```tsx
// src/features/onboarding/RevisarGmail.test.tsx (substituir o conteúdo)
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { RevisarGmail } from './RevisarGmail'
import type { Finding } from './gmail/types'

const rpc = vi.fn(async () => ({ error: null }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: any[]) => rpc(...a) } }))
vi.mock('../auth/AuthProvider', () => ({ useSession: () => ({ session: { user: { id: 'u1' } } }) }))

const single: Finding = {
  sourceId: 's1', provider: 'Spotify', logo: null,
  items: [{ id: 'i1', label: 'Premium', sort_order: 1 }],
  evidence: { gmailAccount: 'me@gmail.com', gmailMessageId: 'm1', emailFrom: 'a@spotify.com', emailSubject: 'x', emailDate: '2026-01-01T00:00:00Z' },
}
const multi: Finding = {
  sourceId: 's2', provider: 'Nubank', logo: null,
  items: [{ id: 'a', label: 'Gold', sort_order: 1 }, { id: 'b', label: 'Platinum', sort_order: 2 }],
  evidence: { gmailAccount: 'me@gmail.com', gmailMessageId: 'm2', emailFrom: 'a@nubank.com.br', emailSubject: 'y', emailDate: '2026-01-01T00:00:00Z' },
}

it('marca de item único salva direto via add_gmail_sources', async () => {
  const onDone = vi.fn()
  render(<RevisarGmail findings={[single]} partial={false} onDone={onDone} />)
  fireEvent.click(screen.getByRole('button', { name: /adicionar ao radar/i }))
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('add_gmail_sources', expect.anything()))
  const payload = rpc.mock.calls.at(-1)![1].payload
  expect(payload[0].item_id).toBe('i1')
  expect(onDone).toHaveBeenCalled()
})

it('marca multi-tier bloqueia a CTA até escolher o tier', async () => {
  render(<RevisarGmail findings={[multi]} partial={false} onDone={vi.fn()} />)
  expect(screen.getByRole('button', { name: /adicionar ao radar/i })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /Nubank/i })) // abre a sheet
  fireEvent.click(screen.getByRole('button', { name: /Platinum/i }))
  await waitFor(() => expect(screen.getByRole('button', { name: /adicionar ao radar/i })).not.toBeDisabled())
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npm test -- RevisarGmail`
Expected: FAIL.

- [ ] **Step 3: Reescrever o `RevisarGmail`**

```tsx
// src/features/onboarding/RevisarGmail.tsx
import { useMemo, useState } from 'react'
import { useAddGmailSources } from './useAddGmailSources'
import { TierSheet } from './gmail/TierSheet'
import { Button } from '../../ui/Button'
import { formatBRL } from '../benefits/estimatedValue'
import type { Finding } from './gmail/types'
import type { GmailSourcePayload } from './gmail/types'

export function RevisarGmail({
  findings, partial, onDone, onBack,
}: {
  findings: Finding[]
  partial: boolean
  onDone: (saved: Finding[]) => void
  onBack?: () => void
}) {
  const add = useAddGmailSources()
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [chosen, setChosen] = useState<Map<string, string>>(new Map()) // sourceId → itemId (multi)
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const included = findings.filter((f) => !excluded.has(f.sourceId))
  // resolvido: item único (auto) ou multi com tier escolhido
  const resolvedItem = (f: Finding): string | null =>
    f.items.length === 1 ? f.items[0].id : chosen.get(f.sourceId) ?? null
  const blocked = included.some((f) => resolvedItem(f) === null)
  const estValue = useMemo(
    () => included.reduce((acc, f) => {
      const id = resolvedItem(f)
      const it = f.items.find((x) => x.id === id)
      return acc + (it?.estValueBrl ?? 0)
    }, 0),
    [included, chosen],
  )

  function toggle(sourceId: string) {
    setExcluded((prev) => { const n = new Set(prev); n.has(sourceId) ? n.delete(sourceId) : n.add(sourceId); return n })
  }

  async function submit() {
    if (blocked || included.length === 0 || saving) return
    setSaving(true); setSaveError(false)
    const payload: GmailSourcePayload[] = included.map((f) => ({
      item_id: resolvedItem(f)!, source_id: f.sourceId, gmail_account: f.evidence.gmailAccount,
      gmail_message_id: f.evidence.gmailMessageId, email_from: f.evidence.emailFrom,
      email_subject: f.evidence.emailSubject, email_date: f.evidence.emailDate,
    }))
    try {
      await add.mutateAsync(payload)
      onDone(included)
    } catch {
      setSaving(false); setSaveError(true)
    }
  }

  const sheetBrand = sheetId ? findings.find((f) => f.sourceId === sheetId) : null

  return (
    <div className="ob">
      <div className="ob-scroll">
        <div className="ob-card">
          {onBack ? (
            <button type="button" className="ob-back-btn" aria-label="Voltar" onClick={onBack} style={{ marginBottom: 'var(--s3)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          ) : null}
          <p className="lbl" style={{ color: 'var(--ok)' }}>Descoberta concluída</p>
          <h1 className="ob-title">Revise o que encontramos</h1>
          <p className="review-count">incluídos <b>{formatBRL(estValue)}</b>/ano estimado</p>
          <div className="review-list">
            {findings.map((f) => {
              const on = !excluded.has(f.sourceId)
              const multi = f.items.length > 1
              const pickedId = chosen.get(f.sourceId)
              const pickedLabel = multi ? (f.items.find((it) => it.id === pickedId)?.label ?? 'Escolher versão') : f.items[0]?.label
              return (
                <button key={f.sourceId} type="button"
                  className={'review-item' + (on ? '' : ' off')}
                  aria-pressed={on}
                  aria-haspopup={multi ? 'dialog' : undefined}
                  onClick={() => (multi ? setSheetId(f.sourceId) : toggle(f.sourceId))}>
                  <span className="review-item-mark" aria-hidden="true">{f.logo ? <img src={f.logo} alt="" /> : f.provider.charAt(0).toUpperCase()}</span>
                  <span className="review-item-body"><strong>{f.provider} {pickedLabel}</strong><span>via {f.provider}</span></span>
                  <span className={'review-check' + (on ? ' on' : '')} aria-hidden="true">{on ? '✓' : '+'}</span>
                </button>
              )
            })}
          </div>
          <p className="review-note">
            Lemos os <b>metadados</b> (remetente, assunto e data) de e-mails das marcas do catálogo — nunca o conteúdo. Guardamos só o que você confirmar aqui.
          </p>
          {partial ? <p className="review-note" role="status">Alguns programas não puderam ser verificados agora; você pode adicionar manualmente depois.</p> : null}
          {blocked ? <p className="review-note" role="status">Escolha a versão das marcas com “Escolher versão” para continuar.</p> : null}
          {saveError ? <p role="alert" aria-live="assertive" className="review-error">Não foi possível salvar. Tente de novo.</p> : null}
        </div>
      </div>
      <div className="ob-foot">
        <div className="ob-foot-inner">
          <div className="ob-cta">
            <Button onClick={submit} disabled={blocked || included.length === 0 || saving}>
              {saving ? 'Salvando…' : 'Adicionar ao radar'}
            </Button>
          </div>
        </div>
      </div>
      {sheetBrand ? (
        <TierSheet
          brand={{ id: sheetBrand.sourceId, name: sheetBrand.provider, logo_url: sheetBrand.logo, kind: 'card', sort_order: 0, source_items: sheetBrand.items }}
          selectedId={chosen.get(sheetBrand.sourceId) ?? null}
          onPick={(itemId) => {
            setChosen((prev) => new Map(prev).set(sheetBrand.sourceId, itemId))
            setExcluded((prev) => { const n = new Set(prev); n.delete(sheetBrand.sourceId); return n })
            setSheetId(null)
          }}
          onClose={() => setSheetId(null)}
        />
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Rodar + build**

Run: `npm test -- RevisarGmail && npm run build`
Expected: PASS + build limpo.

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/RevisarGmail.tsx src/features/onboarding/RevisarGmail.test.tsx
git commit -m "feat(gmail): RevisarGmail real — marca não-resolvida, sheet, CTA bloqueada, RPC"
```

---

## Task 12: `OnboardingPage` — consent + scan real + estados

**Files:**
- Create: `src/features/onboarding/gmail/GmailConsent.tsx`
- Modify: `src/features/onboarding/OnboardingPage.tsx`
- Modify: `src/features/onboarding/OnboardingPage.test.tsx`
- Delete: `src/features/onboarding/demoFindings.ts` (+ `demoFindings.test.ts`)

**Interfaces:**
- Consumes: `useGmailAuth` (Task 8), `gmailScan` (Task 7), `useSources` (flatten p/ `Source[]`), `Finding`/`ScanResult` (Task 6).
- Produces: state machine com `gmail-consent` → `gmail-scan` (real) → `gmail-review` → `gmail-done`.

- [ ] **Step 1: Criar `GmailConsent.tsx` (pré-consent honesto)**

```tsx
// src/features/onboarding/gmail/GmailConsent.tsx
import { Button } from '../../../ui/Button'

export function GmailConsent({ onConnect, onBack, connecting, error }: {
  onConnect: () => void; onBack: () => void; connecting: boolean; error: boolean
}) {
  return (
    <div className="ob">
      <div className="ob-scroll">
        <div className="ob-card">
          <button type="button" className="ob-back-btn" aria-label="Voltar" onClick={onBack} style={{ marginBottom: 'var(--s3)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <h1 className="ob-title">Conectar seu Gmail</h1>
          <p className="ob-sub">Procuramos e-mails das marcas do catálogo dos últimos 2 anos para sugerir seus programas.</p>
          <ul className="ob-consent-list">
            <li>Lemos só os <b>metadados</b> (remetente, assunto, data) — nunca o conteúdo dos e-mails.</li>
            <li>O acesso é temporário e não fica guardado; você revoga quando quiser.</li>
            <li>Guardamos no servidor só o que você confirmar na próxima tela.</li>
            <li>Sem conta cadastrada, esses dados são apagados em 30 dias.</li>
          </ul>
          {error ? <p role="alert" className="review-error">Não foi possível conectar ao Google. Tente de novo.</p> : null}
        </div>
      </div>
      <div className="ob-foot"><div className="ob-foot-inner"><div className="ob-cta">
        <Button onClick={onConnect} disabled={connecting}>{connecting ? 'Conectando…' : 'Conectar Gmail'}</Button>
      </div></div></div>
    </div>
  )
}
```

- [ ] **Step 2: Reescrever a máquina de estados Gmail no `OnboardingPage`** — trocar `demoFindings` pelo fluxo real. Trecho central (substituir os blocos `gmail-*` e `startGmail`):

```tsx
// imports novos:
import { GmailConsent } from './gmail/GmailConsent'
import { useGmailAuth } from './gmail/useGmailAuth'
import { gmailScan } from './gmail/gmailScan'
import type { Finding, ScanResult } from './gmail/types'
// remover: import { demoFindings, type Finding } from './demoFindings'

// estado adicional no componente:
const gmail = useGmailAuth()
const [connecting, setConnecting] = useState(false)
const [connectError, setConnectError] = useState(false)
const [scan, setScan] = useState<ScanResult | null>(null)
const [saved, setSaved] = useState<Finding[]>([])

const flatSources = (sourcesQuery.data ?? []).flatMap((g) => g.sources)

// startGmail: sem catálogo/domínios → cai no manual; senão vai pro consent
function startGmail() {
  if (!gmail.available) { setScreen('manual'); return } // sem client id → manual
  setScreen('gmail-consent')
}

async function connectAndScan() {
  setConnecting(true); setConnectError(false)
  try {
    const { token, account } = await gmail.connect()
    const result = await gmailScan({ gmailAccount: account, sources: flatSources, fetchJson: gmail.makeFetchJson(token) })
    gmail.revoke(token) // one-shot: não precisamos mais do token
    setScan(result)
    if (result.findings.length === 0) { setScreen('manual'); return } // nada encontrado → manual
    setScreen('gmail-scan')
  } catch {
    setConnectError(true)
  } finally {
    setConnecting(false)
  }
}
```

E as telas:

```tsx
if (screen === 'gmail-consent') {
  return <GmailConsent onConnect={connectAndScan} onBack={() => setScreen('method')} connecting={connecting} error={connectError} />
}
if (screen === 'gmail-scan' && scan) {
  return <Vasculhando count={scan.findings.length} onDone={() => setScreen('gmail-review')} onBack={() => setScreen('method')} />
}
if (screen === 'gmail-review' && scan) {
  return <RevisarGmail findings={scan.findings} partial={scan.partial} onDone={(inc) => { setSaved(inc); setScreen('gmail-done') }} onBack={() => setScreen('method')} />
}
if (screen === 'gmail-done') {
  const groupsSummary: SummaryGroup[] = saved.length
    ? [{ label: 'Seus programas', items: saved.map((f) => ({ provider: f.provider, variant: f.items.length === 1 ? f.items[0].label : '' })) }]
    : []
  return <RadarMontado groups={groupsSummary} onView={() => navigate('/alertas?from=onboarding')} />
}
```

Ajustar o tipo `Screen` para incluir `'gmail-consent'` e remover o `useEffect`/`findings = demoFindings(...)` antigos.

- [ ] **Step 3: Atualizar `OnboardingPage.test.tsx`** — mockar `useGmailAuth` (available true, `connect` resolvendo `{token,account}`) e `gmailScan` retornando findings; testar o caminho consent→scan→review. Remover asserts do `demoFindings`.

```tsx
// exemplo de mocks no topo do teste:
vi.mock('./gmail/useGmailAuth', () => ({
  useGmailAuth: () => ({
    available: true,
    connect: async () => ({ token: 't', account: 'me@gmail.com' }),
    makeFetchJson: () => async () => ({}),
    revoke: () => {},
  }),
}))
vi.mock('./gmail/gmailScan', () => ({
  gmailScan: async () => ({ findings: [{ sourceId: 's1', provider: 'Spotify', logo: null, items: [{ id: 'i1', label: 'Premium', sort_order: 1 }], evidence: { gmailAccount: 'me@gmail.com', gmailMessageId: 'm1', emailFrom: 'a@spotify.com', emailSubject: 'x', emailDate: '2026-01-01T00:00:00Z' } }], partial: false }),
}))
```

- [ ] **Step 4: Remover `demoFindings`**

```bash
git rm src/features/onboarding/demoFindings.ts src/features/onboarding/demoFindings.test.ts
```

- [ ] **Step 5: Rodar a suíte de onboarding + build**

Run: `npm test -- onboarding && npm run build`
Expected: PASS + build limpo (nenhum import remanescente de `demoFindings`).

- [ ] **Step 6: Commit**

```bash
git add src/features/onboarding/
git commit -m "feat(gmail): OnboardingPage com consent + scan real (fim do demoFindings)"
```

---

## Task 13: Perfil — "Desconectar Gmail e apagar dados"

**Files:**
- Create: `src/features/onboarding/useDisconnectGmail.ts`
- Modify: `src/features/perfil/Perfil.tsx`
- Create: `src/features/onboarding/useDisconnectGmail.test.ts`

**Interfaces:**
- Consumes: `supabase` (delete own-rows em `source_evidence`); `useSession`.
- Produces: `useDisconnectGmail()` → mutation que apaga a evidência do usuário. (O `revoke` do token é no-op se não houver token vivo — o token é one-shot e já foi revogado no scan.)

- [ ] **Step 1: Escrever o teste do hook**

```ts
// src/features/onboarding/useDisconnectGmail.test.ts
import { describe, it, expect, vi } from 'vitest'
const del = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ delete: del }) } }))
vi.mock('../../lib/queryClient', () => ({ queryClient: { invalidateQueries: vi.fn() } }))

import { deleteEvidence } from './useDisconnectGmail'

describe('deleteEvidence', () => {
  it('apaga evidência do próprio usuário', async () => {
    await deleteEvidence('u1')
    expect(del).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Rodar para ver falhar**

Run: `npm test -- useDisconnectGmail`
Expected: FAIL.

- [ ] **Step 3: Implementar o hook**

```ts
// src/features/onboarding/useDisconnectGmail.ts
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'

export async function deleteEvidence(userId: string) {
  const { error } = await supabase.from('source_evidence').delete().eq('user_id', userId)
  if (error) throw error
}

// Apaga todos os metadados de e-mail guardados do usuário. Não desfaz programas
// já adicionados ao radar (user_sources permanece).
export function useDisconnectGmail(userId: string | undefined) {
  return useMutation({
    mutationFn: async () => { if (userId) await deleteEvidence(userId) },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['source_evidence'] }),
  })
}
```

- [ ] **Step 4: Adicionar o botão no `Perfil`** — perto da seção de conta/privacidade (o link "Ajuda e privacidade" hoje é `href="#"`). Inserir:

```tsx
// import:
import { useDisconnectGmail } from '../onboarding/useDisconnectGmail'
import { useSession } from '../auth/AuthProvider'
// dentro do componente:
const { session } = useSession()
const disconnect = useDisconnectGmail(session?.user.id)
// no JSX, na lista de ações:
<button type="button" className="btn ghost" onClick={() => disconnect.mutate()} disabled={disconnect.isPending}>
  {disconnect.isPending ? 'Apagando…' : 'Desconectar Gmail e apagar dados'}
</button>
{disconnect.isSuccess ? <p className="muted" style={{ fontSize: 14 }}>Metadados do Gmail apagados. Seus programas seguem no radar. ✓</p> : null}
```

- [ ] **Step 5: Rodar + build**

Run: `npm test -- useDisconnectGmail Perfil && npm run build`
Expected: PASS + build limpo.

- [ ] **Step 6: Commit**

```bash
git add src/features/onboarding/useDisconnectGmail.ts src/features/onboarding/useDisconnectGmail.test.ts src/features/perfil/Perfil.tsx
git commit -m "feat(gmail): Perfil desconectar Gmail + apagar evidência (delete own-rows)"
```

---

## Task 14: Env `VITE_GOOGLE_CLIENT_ID` + Dockerfile + verificação no browser

**Files:**
- Modify: `Dockerfile`
- Modify: `.env.local` (não versionado; instrução)
- Create: `docs/ops/2026-07-18-gmail-oauth-setup.md` (passo-a-passo Google Cloud)

**Interfaces:** —

- [ ] **Step 1: Build arg no Dockerfile** — após os args do Supabase:

```dockerfile
ARG VITE_GOOGLE_CLIENT_ID
ENV VITE_GOOGLE_CLIENT_ID=$VITE_GOOGLE_CLIENT_ID
```

- [ ] **Step 2: Escrever o runbook do Google Cloud**

```markdown
# Setup OAuth Gmail (modo Testing)  — docs/ops/2026-07-18-gmail-oauth-setup.md
1. console.cloud.google.com → criar/usar um projeto.
2. APIs & Services → Enabled APIs → habilitar **Gmail API**.
3. OAuth consent screen → tipo External → **Testing** → adicionar seu e-mail
   (e dos testadores) em "Test users". Scope: `.../auth/gmail.readonly`.
4. Credentials → Create OAuth client ID → **Web application**.
   Authorized JavaScript origins: `http://localhost:5173` e o domínio de prod
   (`https://www.mapadebeneficios.com.br`). Sem client secret no fluxo GIS.
5. Copiar o Client ID.
   - Local: `.env.local` → `VITE_GOOGLE_CLIENT_ID=<id>`.
   - Prod: Dokploy app → build arg `VITE_GOOGLE_CLIENT_ID=<id>` → redeploy.
```

- [ ] **Step 3: Configurar local e verificar no browser** — com `VITE_GOOGLE_CLIENT_ID` em `.env.local`:

Run: `npm run dev` → abrir `/onboarding` → método Gmail → consent → conectar com uma conta de teste.
Expected: popup do Google aparece; após consentir, `Vasculhando` mostra a contagem real; `Revisar` lista marcas reais do inbox; confirmar grava (checar `select * from source_evidence` no Supabase local). Sem `VITE_GOOGLE_CLIENT_ID`, o método Gmail cai direto no wizard manual (não quebra).

- [ ] **Step 4: Rodar a suíte inteira + build final**

Run: `npm test && npm run build`
Expected: tudo verde.

- [ ] **Step 5: Commit**

```bash
git add Dockerfile docs/ops/2026-07-18-gmail-oauth-setup.md
git commit -m "chore(gmail): build arg VITE_GOOGLE_CLIENT_ID + runbook do Google Cloud"
```

---

## Self-Review (checagem contra a spec)

**Cobertura da spec:**
- Arquitetura A client-side → Tasks 7, 8, 12. ✔
- `match_domains` + seed → Tasks 1, 4. ✔
- `source_evidence` (remetente/assunto/data) + RLS own-rows + delete → Tasks 1, 13. ✔
- Idempotência (unique + upsert) → Tasks 1, 2. ✔
- RPC atômica aditiva → Task 2. ✔
- Retenção 30d anônimo (pg_cron) → Task 3. ✔
- Detecção por marca; tier escolhido; CTA bloqueada → Tasks 6, 11. ✔
- Boundary de label; internalDate → Tasks 5, 6, 7. ✔
- Privacidade (só headers, cópia honesta, revoke, pré-consent) → Tasks 7, 11, 12, 13. ✔
- Env + prereqs (Google Cloud) → Task 14. ✔
- Estado parcial + erros/cancelamento → Tasks 7, 8, 12. ✔

**Consistência de tipos:** `Finding` (Task 6) usado igual em 7/11/12; `GmailSourcePayload` igual em 6/9/11; `FetchJson` definido em 7 e consumido em 8; `add_gmail_sources(payload)` igual em 2/9. ✔

**Placeholders:** o seed (Task 4) e o runbook (Task 14) têm passos manuais explícitos (domínios reais, Client ID) — são dados do mundo, não placeholders de código; marcados como tal.

**Ponto de atenção (não-bloqueante):** `pg_cron` pode não existir no self-hosted; Task 3 documenta o fallback (Dokploy schedule).
