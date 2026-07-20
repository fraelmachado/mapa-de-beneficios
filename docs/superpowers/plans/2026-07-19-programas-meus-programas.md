# Programas → Meus programas — Implementation Plan (rev 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**rev 2** incorpora a review adversarial do Codex (2026-07-19): (a) exclusividade de tier por marca na RPC (1 migration), correção do "última busca" (rename honesto), bugs de código nas tasks, robustez (erro/pending/concorrência/ordenação/a11y), invalidação de cache e cobertura de rotas/E2E.

**Goal:** Tela **"Meus programas"** (lista + proveniência + gestão + re-scan) no lugar do wizard como "Programas"; e garantir **um tier por marca** ao adicionar via Gmail.

**Architecture:** Front + **1 migration** (`0021`) que torna `add_gmail_sources` exclusivo por `source_id`. Nova rota `/programas` sob `AppLayout`. Um hook compõe `user_sources` × catálogo × `source_evidence`. Gestão via `replace_user_sources` (recomputa o conjunto, **deduplicado**). Re-scan via `?method=gmail` no `OnboardingPage`.

**Tech Stack:** React+TS, TanStack Query v5, React Router, Vitest+TL, Playwright (e2e), Supabase.

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-19-programas-meus-programas-design.md`.
- **Uma migration** (`0021`): `add_gmail_sources` passa a **remover tiers irmãos da mesma marca** antes de inserir o escolhido (exclusividade por `source_id`), derivando a marca do próprio `item_id` (não confia no `source_id` do payload). Aplicar local (`npx -y supabase@2.95.0 db reset`) e, no deploy, em prod (via `psql` no container, `-U supabase_admin` — ver memória `mapa-de-beneficios-prod-supabase-ops`).
- **Gestão** via `replace_user_sources(item_ids)` (existente). Ao recomputar, **deduplicar** o array (`[...new Set(ids)]`) — a RPC faz delete+insert e um id repetido viola a PK.
- **Proveniência** = `source_id` em `source_evidence` ⇒ `gmail` (senão `manual`). O rótulo da lista é **"Gmail"/"Manual"**; o texto de detalhe é **"Encontrado no Gmail · <remetente>"** (não afirma "como foi adicionado", só que a marca tem evidência).
- **"Última busca" é semanticamente inexata** (re-scan idempotente não atualiza `created_at`): o resumo diz **"Último via Gmail <quando>"**, não "última busca".
- `onboarding.css`/`perfil.css` já são importados **globalmente** em `src/index.css`. NÃO usar `@import` de `onboarding.css`; `programas.css` só tem classes `prg-*` e é adicionado ao `index.css`.
- **`SourceKind`** válido = `'card'|'carrier'|'loyalty'|'cpf'` (fixtures de teste).
- **Testes:** `npm test` (vitest, exclui e2e) + `npm run test:e2e` (Playwright, 4 projetos) + `npm run build` (tsc). Copiar valores/assinaturas exatas; nada de placeholder.

---

## File Structure

**Criar:** `supabase/migrations/0021_add_gmail_sources_exclusive.sql`; `src/features/programas/{buildPrograms.ts,buildPrograms.test.ts,useSourceEvidence.ts,useSourceEvidence.test.tsx,useMyPrograms.ts,ProgramSheet.tsx,ProgramSheet.test.tsx,MeusProgramas.tsx,MeusProgramas.test.tsx,programas.css}`.

**Modificar:** `supabase/migrations/…`(nenhuma edição — só a nova); `tests/add_gmail_sources.integration.test.ts` (semântica exclusiva); `src/features/onboarding/useAddGmailSources.ts` (invalidar `source_evidence`); `src/router.tsx`; `src/features/layout/{BottomNav,AppLayout}.tsx` + `.test.tsx`; `src/router.test.tsx`; `src/index.css` (importar `programas.css`); `src/features/onboarding/OnboardingPage.tsx` + `.test.tsx`; `tests/e2e/app-layout.spec.ts`.

---

## Task 1: Migration 0021 — `add_gmail_sources` exclusivo por marca

**Files:** Create `supabase/migrations/0021_add_gmail_sources_exclusive.sql`; Modify `tests/add_gmail_sources.integration.test.ts`.

**Interfaces:** `add_gmail_sources(payload jsonb)` passa a **remover** os `source_items` irmãos (mesma `source_id` do item escolhido) do usuário antes de inserir o escolhido. Continua aditivo **entre marcas** e idempotente na evidência.

- [ ] **Step 1: Escrever a migration** (`create or replace`, idempotente)

```sql
-- supabase/migrations/0021_add_gmail_sources_exclusive.sql
-- add_gmail_sources: um tier por marca. Antes de inserir o item escolhido,
-- remove os IRMÃOS (mesmo source_id, derivado do próprio item) que o usuário tenha.
-- Mantém aditividade ENTRE marcas e idempotência da evidência.
create or replace function add_gmail_sources(payload jsonb)
returns void language plpgsql security invoker set search_path = '' as $fn$
declare rec jsonb;
begin
  for rec in select value from jsonb_array_elements(payload) as value loop
    -- exclusividade por marca: apaga tiers irmãos do usuário
    delete from public.user_sources us
    using public.source_items si, public.source_items chosen
    where us.user_id = auth.uid()
      and us.source_item_id = si.id
      and chosen.id = (rec->>'item_id')::uuid
      and si.source_id = chosen.source_id
      and us.source_item_id <> chosen.id;

    insert into public.user_sources (user_id, source_item_id)
    values (auth.uid(), (rec->>'item_id')::uuid)
    on conflict (user_id, source_item_id) do nothing;

    insert into public.source_evidence
      (user_id, source_id, gmail_account, gmail_message_id, email_from, email_subject, email_date)
    values (auth.uid(), (rec->>'source_id')::uuid, rec->>'gmail_account', rec->>'gmail_message_id',
            rec->>'email_from', rec->>'email_subject', (rec->>'email_date')::timestamptz)
    on conflict (user_id, gmail_account, source_id, gmail_message_id) do nothing;
  end loop;
end;
$fn$;
grant execute on function add_gmail_sources(jsonb) to authenticated;
```

- [ ] **Step 2: Aplicar** — `npx -y supabase@2.95.0 db reset`.

- [ ] **Step 3: Atualizar `tests/add_gmail_sources.integration.test.ts`** — o caso "aditivo" hoje usa **dois tiers da mesma marca** e espera os dois; com exclusividade isso muda. Ajustar para: (i) aditivo **entre marcas diferentes**; (ii) NOVO caso: adicionar um tier **substitui** o irmão da mesma marca.

```ts
// substituir o teste 'é aditivo: não apaga seleção anterior' por DOIS testes:

it('é aditivo entre marcas diferentes', async () => {
  const { srcId, itemId, db } = await oneItem()
  // segunda MARCA
  const stamp = `${Date.now()}-${Math.floor(performance.now() * 1000)}`
  const { data: src2 } = await db.from('sources').insert({ kind: 'card', name: `AGS2-${stamp}`, sort_order: 1, slug: `ags2-${stamp}` }).select().single()
  const { data: item2 } = await db.from('source_items').insert({ source_id: src2!.id, label: 'L1', sort_order: 1, slug: `ags2-i-${stamp}` }).select().single()
  const { client, id } = await userClient()
  await client.rpc('replace_user_sources', { item_ids: [item2!.id] })
  await client.rpc('add_gmail_sources', { payload: payload(srcId, itemId, 'm2') })
  const us = await db.from('user_sources').select('source_item_id').eq('user_id', id)
  expect(us.data!.map((r) => r.source_item_id).sort()).toEqual([itemId, item2!.id].sort())
  await db.from('sources').delete().in('id', [srcId, src2!.id])
})

it('exclusividade por marca: adicionar um tier substitui o irmão da mesma marca', async () => {
  const { srcId, itemId, db } = await oneItem()
  const { data: item2 } = await db.from('source_items')
    .insert({ source_id: srcId, label: 'L2', sort_order: 2, slug: `ags-i2-${Date.now()}` }).select().single()
  const { client, id } = await userClient()
  // usuário já tem o tier "irmão" (item2, mesma marca) manualmente
  await client.rpc('replace_user_sources', { item_ids: [item2!.id] })
  // Gmail adiciona o tier itemId da MESMA marca → deve remover item2
  await client.rpc('add_gmail_sources', { payload: payload(srcId, itemId, 'm3') })
  const us = await db.from('user_sources').select('source_item_id').eq('user_id', id)
  expect(us.data!.map((r) => r.source_item_id)).toEqual([itemId]) // só o novo, sem o irmão
  await db.from('sources').delete().eq('id', srcId)
})
```

- [ ] **Step 4: Rodar** — `npm test -- add_gmail_sources` (3 casos verdes: source+evidência, idempotente, aditivo-entre-marcas; + o novo de exclusividade = 4).

- [ ] **Step 5: Commit** — `git add supabase/migrations/0021_add_gmail_sources_exclusive.sql tests/add_gmail_sources.integration.test.ts && git commit -m "fix(gmail): add_gmail_sources exclusivo por marca (0021) — um tier por source"`

---

## Task 2: `useSourceEvidence` + invalidação no `useAddGmailSources`

**Files:** Create `src/features/programas/useSourceEvidence.ts`, `useSourceEvidence.test.tsx`; Modify `src/features/onboarding/useAddGmailSources.ts`.

**Interfaces:** `EvidenceRow = { source_id, email_from, email_date: string|null, created_at, gmail_account }`; `useSourceEvidence(userId?)` → query de `EvidenceRow[]`. `useAddGmailSources` passa a invalidar `['source_evidence']` (pro resumo atualizar após re-scan).

- [ ] **Step 1: teste** — arquivo `.test.tsx` (contém JSX):

```tsx
// src/features/programas/useSourceEvidence.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const rows = [{ source_id: 's1', email_from: 'a@nubank.com.br', email_date: '2026-07-01T00:00:00Z', created_at: '2026-07-16T00:00:00Z', gmail_account: 'me@gmail.com' }]
const select = vi.fn(async () => ({ data: rows, error: null }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ select }) } }))

import { useSourceEvidence } from './useSourceEvidence'

const wrap = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useSourceEvidence', () => {
  it('lê as evidências e seleciona os campos certos', async () => {
    const { result } = renderHook(() => useSourceEvidence('u1'), { wrapper: wrap() })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data![0].source_id).toBe('s1')
    expect(select).toHaveBeenCalledWith('source_id, email_from, email_date, created_at, gmail_account')
  })
})
```

- [ ] **Step 2: rodar → falhar** (`npm test -- useSourceEvidence`).

- [ ] **Step 3: implementar o hook**

```ts
// src/features/programas/useSourceEvidence.ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface EvidenceRow {
  source_id: string
  email_from: string
  email_date: string | null
  created_at: string
  gmail_account: string
}

export function useSourceEvidence(userId: string | undefined) {
  return useQuery({
    queryKey: ['source_evidence', userId],
    enabled: !!userId,
    queryFn: async (): Promise<EvidenceRow[]> => {
      const { data, error } = await supabase
        .from('source_evidence')
        .select('source_id, email_from, email_date, created_at, gmail_account')
      if (error) throw error
      return (data ?? []) as EvidenceRow[]
    },
  })
}
```

- [ ] **Step 4: invalidar `source_evidence`** — em `src/features/onboarding/useAddGmailSources.ts`, no `onSuccess`, acrescentar:

```ts
      queryClient.invalidateQueries({ queryKey: ['source_evidence'] })
```

- [ ] **Step 5: rodar + build** (`npm test -- useSourceEvidence useAddGmailSources && npm run build`).

- [ ] **Step 6: commit** — `git add src/features/programas/useSourceEvidence.* src/features/onboarding/useAddGmailSources.ts && git commit -m "feat(programas): useSourceEvidence + invalida source_evidence no add"`

---

## Task 3: `buildPrograms` (puro) + `useMyPrograms`

**Files:** Create `src/features/programas/buildPrograms.ts`, `buildPrograms.test.ts`, `useMyPrograms.ts`.

**Interfaces:**
- `Program = { itemId, sourceId, brand, tier, items: SourceItem[], logo, provenance:'gmail'|'manual', when, from }`
- `ProgramsSummary = { total, gmailCount, manualCount, lastFound: string, account }`
- `buildPrograms(itemIds, sources, evidence): { programs, summary }` — **ordenado** por `source.sort_order` depois brand; **dedup** por `source_item_id`; `tierLabel` correto; `relTime` com plural certo.
- `useMyPrograms(userId?)`.

- [ ] **Step 1: teste** (fixtures com `kind` válido; relógio fixo p/ relTime)

```ts
// src/features/programas/buildPrograms.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildPrograms } from './buildPrograms'
import type { Source } from '../onboarding/types'
import type { EvidenceRow } from './useSourceEvidence'

const sources: Source[] = [
  { id: 's1', kind: 'card', name: 'Nubank', logo_url: null, sort_order: 1,
    source_items: [{ id: 'gold', label: 'Gold', sort_order: 1 }, { id: 'plat', label: 'Platinum', sort_order: 2 }] },
  { id: 's2', kind: 'loyalty', name: 'Spotify', logo_url: '/l/spotify.svg', sort_order: 2,
    source_items: [{ id: 'prem', label: 'Premium', sort_order: 1 }] },
]

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-19T00:00:00Z')) })
afterEach(() => vi.useRealTimers())

describe('buildPrograms', () => {
  it('proveniência gmail vem da evidência do source_id; ordena por sort_order', () => {
    const evidence: EvidenceRow[] = [{ source_id: 's1', email_from: 'a@nubank.com.br', email_date: null, created_at: '2026-07-16T00:00:00Z', gmail_account: 'me@gmail.com' }]
    const { programs, summary } = buildPrograms(['prem', 'plat'], sources, evidence)
    expect(programs.map((p) => p.sourceId)).toEqual(['s1', 's2']) // Nubank (sort 1) antes de Spotify (sort 2)
    const nu = programs.find((p) => p.sourceId === 's1')!
    expect(nu.provenance).toBe('gmail'); expect(nu.tier).toBe('Platinum'); expect(nu.items).toHaveLength(2)
    expect(nu.when).toBe('há 3 dias')
    expect(programs.find((p) => p.sourceId === 's2')!.provenance).toBe('manual')
    expect(summary).toMatchObject({ total: 2, gmailCount: 1, manualCount: 1, account: 'me@gmail.com', lastFound: 'há 3 dias' })
  })
  it('dedup por item + ignora item inexistente', () => {
    const { programs } = buildPrograms(['plat', 'plat', 'fantasma'], sources, [])
    expect(programs).toHaveLength(1)
  })
  it('single-tier não exibe rótulo de tier placeholder', () => {
    const s: Source[] = [{ id: 's3', kind: 'carrier', name: 'Vivo', logo_url: null, sort_order: 3, source_items: [{ id: 'v', label: '—', sort_order: 1 }] }]
    const { programs } = buildPrograms(['v'], s, [])
    expect(programs[0].tier).toBe('')
  })
})
```

- [ ] **Step 2: rodar → falhar**.

- [ ] **Step 3: implementar**

```ts
// src/features/programas/buildPrograms.ts
import type { Source, SourceItem } from '../onboarding/types'
import type { EvidenceRow } from './useSourceEvidence'

export interface Program {
  itemId: string; sourceId: string; brand: string; tier: string
  items: SourceItem[]; logo: string | null
  provenance: 'gmail' | 'manual'; when: string; from: string
}
export interface ProgramsSummary { total: number; gmailCount: number; manualCount: number; lastFound: string; account: string }

function relTime(ms: number): string {
  const days = Math.floor((Date.now() - ms) / 86400000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  if (days < 30) { const w = Math.floor(days / 7); return `há ${w} semana${w > 1 ? 's' : ''}` }
  if (days < 365) { const m = Math.floor(days / 30); return `há ${m} ${m > 1 ? 'meses' : 'mês'}` }
  const y = Math.floor(days / 365); return `há ${y} ano${y > 1 ? 's' : ''}`
}
function tierLabel(item: SourceItem, multi: boolean): string {
  const l = item.label?.trim()
  if (!multi || !l || l === '—') return ''
  return l
}

export function buildPrograms(itemIds: string[], sources: Source[], evidence: EvidenceRow[]): { programs: Program[]; summary: ProgramsSummary } {
  const bySource = new Map<string, { from: string; at: number }>()
  let lastAt = 0, account = ''
  for (const e of evidence) {
    const at = new Date(e.created_at).getTime()
    const prev = bySource.get(e.source_id)
    if (!prev || at > prev.at) bySource.set(e.source_id, { from: e.email_from, at })
    if (at > lastAt) { lastAt = at; account = e.gmail_account }
  }

  const seen = new Set<string>()
  const programs: Program[] = []
  for (const itemId of itemIds) {
    if (seen.has(itemId)) continue
    seen.add(itemId)
    const source = sources.find((s) => s.source_items.some((it) => it.id === itemId))
    if (!source) continue
    const item = source.source_items.find((it) => it.id === itemId)!
    const ev = bySource.get(source.id)
    programs.push({
      itemId, sourceId: source.id, brand: source.name,
      tier: tierLabel(item, source.source_items.length > 1),
      items: source.source_items, logo: source.logo_url,
      provenance: ev ? 'gmail' : 'manual',
      when: ev ? relTime(ev.at) : '', from: ev?.from ?? '',
    })
  }
  programs.sort((a, b) => {
    const sa = sources.find((s) => s.id === a.sourceId)?.sort_order ?? 0
    const sb = sources.find((s) => s.id === b.sourceId)?.sort_order ?? 0
    return sa - sb || a.brand.localeCompare(b.brand)
  })

  const gmailCount = programs.filter((p) => p.provenance === 'gmail').length
  return { programs, summary: { total: programs.length, gmailCount, manualCount: programs.length - gmailCount, lastFound: lastAt ? relTime(lastAt) : '', account } }
}
```

```ts
// src/features/programas/useMyPrograms.ts
import { useUserSources } from '../onboarding/useUserSources'
import { useSources } from '../onboarding/useSources'
import { useSourceEvidence } from './useSourceEvidence'
import { buildPrograms } from './buildPrograms'

export function useMyPrograms(userId: string | undefined) {
  const itemsQ = useUserSources(userId)
  const sourcesQ = useSources()
  const evidenceQ = useSourceEvidence(userId)
  const flatSources = (sourcesQ.data ?? []).flatMap((g) => g.sources)
  const { programs, summary } = buildPrograms(itemsQ.data ?? [], flatSources, evidenceQ.data ?? [])
  return {
    programs, summary,
    isLoading: itemsQ.isLoading || sourcesQ.isLoading || evidenceQ.isLoading,
    error: itemsQ.error || sourcesQ.error || evidenceQ.error,
    refetch: () => { void itemsQ.refetch(); void sourcesQ.refetch(); void evidenceQ.refetch() },
  }
}
```

- [ ] **Step 4: rodar + build**. **Step 5: commit** — `git add src/features/programas/buildPrograms.* src/features/programas/useMyPrograms.ts && git commit -m "feat(programas): buildPrograms (proveniência, ordenação, dedup) + useMyPrograms"`

---

## Task 4: `ProgramSheet` (versões inline + remover, acessível)

**Files:** Create `src/features/programas/ProgramSheet.tsx`, `ProgramSheet.test.tsx`.

**Interfaces:** `ProgramSheet({ program, onPickTier, onRemove, onClose, busy })`. Reusa `recommendedItemId` de `../onboarding/gmail/TierSheet` (mesma regra "Mais completo"). Fecha por scrim, **Escape**, e foca o painel ao abrir. `busy` desabilita as ações durante a mutação.

- [ ] **Step 1: testes**

```tsx
// src/features/programas/ProgramSheet.test.tsx
import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProgramSheet } from './ProgramSheet'
import type { Program } from './buildPrograms'

const multi: Program = { itemId: 'plat', sourceId: 's1', brand: 'Nubank', tier: 'Platinum',
  items: [{ id: 'gold', label: 'Gold', sort_order: 1 }, { id: 'plat', label: 'Platinum', sort_order: 2 }],
  logo: null, provenance: 'gmail', when: 'há 3 dias', from: 'a@nubank.com.br' }
const single: Program = { itemId: 'prem', sourceId: 's2', brand: 'Spotify', tier: 'Premium',
  items: [{ id: 'prem', label: 'Premium', sort_order: 1 }], logo: null, provenance: 'manual', when: '', from: '' }

it('multi-tier troca ao tocar na versão', () => {
  const onPickTier = vi.fn()
  render(<ProgramSheet program={multi} onPickTier={onPickTier} onRemove={vi.fn()} onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /Gold/ }))
  expect(onPickTier).toHaveBeenCalledWith('gold')
})
it('single-tier só tem Remover; Escape fecha', () => {
  const onRemove = vi.fn(), onClose = vi.fn()
  render(<ProgramSheet program={single} onPickTier={vi.fn()} onRemove={onRemove} onClose={onClose} />)
  expect(screen.queryByRole('button', { name: /Premium/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Remover do radar/ }))
  expect(onRemove).toHaveBeenCalled()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).toHaveBeenCalled()
})
```

- [ ] **Step 2: rodar → falhar**.

- [ ] **Step 3: implementar** (reusa `recommendedItemId`; Escape via `useEffect`; painel com `tabIndex=-1` + `ref.focus()`)

```tsx
// src/features/programas/ProgramSheet.tsx
import { useEffect, useRef } from 'react'
import type { Program } from './buildPrograms'
import { formatBRL } from '../benefits/estimatedValue'
import { recommendedItemId } from '../onboarding/gmail/TierSheet'

export function ProgramSheet({
  program, onPickTier, onRemove, onClose, busy = false,
}: {
  program: Program
  onPickTier: (itemId: string) => void
  onRemove: () => void
  onClose: () => void
  busy?: boolean
}) {
  const multi = program.items.length > 1
  const title = multi ? `Qual o seu ${program.brand}?` : `${program.brand}${program.tier ? ' ' + program.tier : ''}`
  const sub = program.provenance === 'gmail' ? `Encontrado no Gmail · ${program.from}` : 'Adicionado manualmente'
  const recId = multi ? recommendedItemId(program.items) : ''
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="ob-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ob-sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div className="ob-sheet-panel" ref={panel} tabIndex={-1}>
        <div className="ob-sheet-grip" aria-hidden="true" />
        <h3 className="ob-sheet-title">{title}</h3>
        <p className="ob-sheet-sub">{sub}</p>
        <div className="ob-sheet-list">
          {multi ? program.items.map((it) => {
            const on = it.id === program.itemId
            const isRec = it.id === recId
            return (
              <button key={it.id} type="button" className={'ob-sheet-item' + (on ? ' on' : '')} aria-pressed={on} disabled={busy} onClick={() => onPickTier(it.id)}>
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
                  {it.estValueBrl ? <span className="ob-sheet-item-est"><span className="ob-sheet-approx">≈</span>{formatBRL(it.estValueBrl)}<span className="ob-sheet-year">/ano</span></span> : null}
                  <span className="ob-sheet-radio" aria-hidden="true" />
                </span>
              </button>
            )
          }) : null}
          {multi ? <div className="prg-sheet-div" /> : null}
          <button type="button" className="prg-remove" disabled={busy} onClick={onRemove}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
            Remover do radar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: rodar + build**. **Step 5: commit** — `git add src/features/programas/ProgramSheet.* && git commit -m "feat(programas): ProgramSheet (versões inline + remover, Escape/foco, recommendedItemId reusado)"`

---

## Task 5: `MeusProgramas` (tela) + CSS

**Files:** Create `src/features/programas/MeusProgramas.tsx`, `programas.css`, `MeusProgramas.test.tsx`; Modify `src/index.css`.

**Interfaces:** Consome `useMyPrograms`, `useUserSources`, `useSaveUserSources`, `ProgramSheet`, `useSession`, `useNavigate`. Tela default de `/programas`.

- [ ] **Step 1: testes** (mocks; remover/trocar → `save` com conjunto recomputado+dedup; erro mostra alerta)

```tsx
// src/features/programas/MeusProgramas.test.tsx
import { it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders as render } from '../../test/renderWithProviders'
import { MeusProgramas } from './MeusProgramas'
import type { Program } from './buildPrograms'

const save = vi.fn(async () => {})
vi.mock('../onboarding/useSaveUserSources', () => ({ useSaveUserSources: () => ({ mutateAsync: save }) }))
vi.mock('../auth/AuthProvider', () => ({ useSession: () => ({ session: { user: { id: 'u1' } } }) }))
const nav = vi.fn()
vi.mock('react-router-dom', async (o) => ({ ...(await o() as object), useNavigate: () => nav }))
vi.mock('../onboarding/useUserSources', () => ({ useUserSources: () => ({ data: ['plat', 'prem'] }) }))
const programs: Program[] = [
  { itemId: 'plat', sourceId: 's1', brand: 'Nubank', tier: 'Platinum', items: [{ id: 'gold', label: 'Gold', sort_order: 1 }, { id: 'plat', label: 'Platinum', sort_order: 2 }], logo: null, provenance: 'gmail', when: 'há 3 dias', from: 'a@nubank.com.br' },
  { itemId: 'prem', sourceId: 's2', brand: 'Spotify', tier: 'Premium', items: [{ id: 'prem', label: 'Premium', sort_order: 1 }], logo: null, provenance: 'manual', when: '', from: '' },
]
vi.mock('./useMyPrograms', () => ({ useMyPrograms: () => ({ programs, summary: { total: 2, gmailCount: 1, manualCount: 1, lastFound: 'há 3 dias', account: 'me@gmail.com' }, isLoading: false, error: null, refetch: vi.fn() }) }))

beforeEach(() => { save.mockClear(); nav.mockClear() })

it('mostra resumo e lista', () => {
  render(<MeusProgramas />)
  expect(screen.getByText(/Você tem 2 programas/)).toBeInTheDocument()
  expect(screen.getByText(/1 via Gmail/)).toBeInTheDocument()
})
it('remover recomputa sem o item', async () => {
  render(<MeusProgramas />)
  fireEvent.click(screen.getByRole('button', { name: /Opções de Nubank/ }))
  fireEvent.click(screen.getByRole('button', { name: /Remover do radar/ }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(['prem']))
})
it('trocar tier recomputa trocando o item (dedup)', async () => {
  render(<MeusProgramas />)
  fireEvent.click(screen.getByRole('button', { name: /Opções de Nubank/ }))
  fireEvent.click(screen.getByRole('button', { name: /Gold/ }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(['gold', 'prem']))
})
it('ações navegam', () => {
  render(<MeusProgramas />)
  fireEvent.click(screen.getByRole('button', { name: /Procurar no Gmail/ }))
  expect(nav).toHaveBeenCalledWith('/onboarding?method=gmail')
  fireEvent.click(screen.getByRole('button', { name: /Do catálogo/ }))
  expect(nav).toHaveBeenCalledWith('/onboarding?mode=edit')
})
it('erro na mutação mostra alerta', async () => {
  save.mockRejectedValueOnce(new Error('x'))
  render(<MeusProgramas />)
  fireEvent.click(screen.getByRole('button', { name: /Opções de Spotify/ }))
  fireEvent.click(screen.getByRole('button', { name: /Remover do radar/ }))
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
})
```

- [ ] **Step 2: rodar → falhar**.

- [ ] **Step 3: implementar a tela** (saving/error, guarda de concorrência, dedup, sheet fica aberto durante a mutação)

```tsx
// src/features/programas/MeusProgramas.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../auth/AuthProvider'
import { useMyPrograms } from './useMyPrograms'
import { useUserSources } from '../onboarding/useUserSources'
import { useSaveUserSources } from '../onboarding/useSaveUserSources'
import { ProgramSheet } from './ProgramSheet'
import { PageState, Skeleton } from '../../ui'

export function MeusProgramas() {
  const { session } = useSession()
  const uid = session?.user.id
  const { programs, summary, isLoading, error, refetch } = useMyPrograms(uid)
  const currentIds = useUserSources(uid).data ?? []
  const save = useSaveUserSources()
  const navigate = useNavigate()
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [opError, setOpError] = useState(false)

  async function apply(nextIds: string[]) {
    if (busy) return
    setBusy(true); setOpError(false)
    try {
      await save.mutateAsync([...new Set(nextIds)]) // dedup: id repetido violaria a PK no replace
      setSheetId(null)
    } catch {
      setOpError(true)
    } finally {
      setBusy(false)
    }
  }
  const remove = (itemId: string) => apply(currentIds.filter((id) => id !== itemId))
  const swapTier = (oldId: string, newId: string) => (oldId === newId ? setSheetId(null) : apply(currentIds.map((id) => (id === oldId ? newId : id))))

  if (isLoading) return <div className="app-page"><Skeleton height="120px" radius="16px" /><Skeleton height="52px" radius="12px" /><Skeleton height="200px" radius="14px" /></div>
  if (error) return <div className="app-page"><PageState title="Não foi possível carregar seus programas" action={{ label: 'Tentar novamente', onClick: () => refetch() }} /></div>

  const sheetProg = sheetId ? programs.find((p) => p.itemId === sheetId) : null

  return (
    <div className="app-page programas-page">
      <header><h1>Programas</h1></header>

      <section className="prg-summary">
        <span className="prg-count">Você tem {summary.total} programa{summary.total === 1 ? '' : 's'}</span>
        {summary.total > 0 ? (
          <span className="prg-prov">
            {summary.gmailCount ? <span className="prg-chip g">{summary.gmailCount} via Gmail</span> : null}
            {summary.manualCount ? <span className="prg-chip m">{summary.manualCount} manua{summary.manualCount === 1 ? 'l' : 'is'}</span> : null}
          </span>
        ) : null}
        {summary.lastFound ? <span className="prg-sub">Último via Gmail {summary.lastFound}{summary.account ? ` · ${summary.account}` : ''}</span> : null}
      </section>

      <div className="prg-actions">
        <button type="button" className="prg-act p" onClick={() => navigate('/onboarding?method=gmail')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11a2 2 0 0 1-2 2H8l-4 3V5Z" /><circle cx="11" cy="11" r="3" /><path d="m14.5 14.5 2 2" /></svg>
          Procurar no Gmail
        </button>
        <button type="button" className="prg-act g" onClick={() => navigate('/onboarding?mode=edit')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Do catálogo
        </button>
      </div>

      {opError ? <p role="alert" aria-live="assertive" className="prg-error">Não foi possível atualizar. Tente de novo.</p> : null}

      {programs.length === 0 ? (
        <div className="prg-empty">Nada aqui ainda. Use <b>Procurar no Gmail</b> ou <b>Do catálogo</b> para começar.</div>
      ) : (
        <>
          <p className="lbl">Seus programas</p>
          <div className="review-list">
            {programs.map((p) => (
              <div key={p.itemId} className="review-item">
                <span className="review-item-mark" aria-hidden="true">{p.logo ? <img src={p.logo} alt="" /> : p.brand.charAt(0).toUpperCase()}</span>
                <span className="review-item-body">
                  <strong>{p.brand}{p.tier ? ` ${p.tier}` : ''}</strong>
                  <span className="prg-meta">
                    <span className={'prg-tag ' + (p.provenance === 'gmail' ? 'g' : 'm')}>{p.provenance === 'gmail' ? 'Gmail' : 'Manual'}</span>
                    {p.provenance === 'gmail' && p.when ? <span className="prg-when">{p.when}</span> : null}
                  </span>
                </span>
                <button type="button" className="prg-more" aria-label={`Opções de ${p.brand}`} onClick={() => setSheetId(p.itemId)}>⋯</button>
              </div>
            ))}
          </div>
        </>
      )}

      {sheetProg ? (
        <ProgramSheet program={sheetProg} busy={busy}
          onPickTier={(itemId) => swapTier(sheetProg.itemId, itemId)}
          onRemove={() => remove(sheetProg.itemId)}
          onClose={() => { if (!busy) setSheetId(null) }} />
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: CSS** — `src/features/programas/programas.css` **só** com `prg-*`/`.lbl` (as `.review-*`/`.ob-sheet*` já são globais via `index.css` que importa `onboarding.css`). E adicionar ao `src/index.css` a linha `@import './features/programas/programas.css';` (mesmo padrão dos outros).

```css
/* src/features/programas/programas.css */
.programas-page { display: grid; gap: var(--s5); }
.programas-page header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -.03em; }
.programas-page .lbl { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0; }
.prg-summary { display: grid; gap: 9px; padding: 15px 16px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); }
.prg-count { font-size: 15px; font-weight: 800; color: var(--ink); }
.prg-prov { display: inline-flex; gap: 6px; flex-wrap: wrap; }
.prg-chip { font-size: 10.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; border: 1px solid var(--line); }
.prg-chip.g { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); background: var(--accent-soft); }
.prg-chip.m { color: var(--ink-2); }
.prg-sub { font-size: 12px; color: var(--muted); }
.prg-actions { display: flex; gap: 8px; }
.prg-act { flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 12px; border-radius: 12px; font: inherit; font-weight: 700; font-size: 13.5px; cursor: pointer; border: 1px solid transparent; }
.prg-act.p { background: var(--accent); color: var(--accent-ink); }
.prg-act.g { background: transparent; color: var(--ink); border-color: var(--line); }
.prg-act:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.prg-error { margin: 0; font-size: 13px; color: var(--warn); font-weight: 600; }
.prg-meta { display: flex; align-items: center; gap: 6px; }
.prg-tag { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px; }
.prg-tag.g { color: var(--accent); background: var(--accent-soft); }
.prg-tag.m { color: var(--ink-2); background: var(--surface-2); border: 1px solid var(--line); }
.prg-when { font-size: 11px; color: var(--muted); }
.prg-more { flex: none; width: 30px; height: 30px; border-radius: 9px; border: 1px solid var(--line); background: transparent; color: var(--muted); font-size: 16px; font-weight: 800; cursor: pointer; line-height: 1; }
.prg-more:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.prg-empty { padding: 26px 16px; text-align: center; color: var(--ink-2); font-size: 13.5px; border: 1px dashed var(--line); border-radius: 14px; }
.prg-sheet-div { height: 1px; background: var(--line); margin: 4px 2px 10px; }
.prg-remove { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 13px 14px; border-radius: 15px; border: 1px solid var(--line); background: transparent; color: var(--warn); font: inherit; font-weight: 700; cursor: pointer; }
.prg-remove:disabled { opacity: .6; cursor: not-allowed; }
.prg-remove:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

- [ ] **Step 5: rodar + build** (`npm test -- MeusProgramas && npm run build`). **Step 6: commit** — `git add src/features/programas/MeusProgramas.* src/features/programas/programas.css src/index.css && git commit -m "feat(programas): tela Meus programas (erro/pending/dedup) + css"`

---

## Task 6: Rota `/programas` + nav + testes de rota

**Files:** Modify `src/router.tsx`, `src/features/layout/{BottomNav,AppLayout}.tsx`, `src/features/layout/{BottomNav,AppLayout}.test.tsx`, `src/router.test.tsx`.

- [ ] **Step 1:** em `router.tsx` importar `MeusProgramas` e adicionar sob `AppLayout` (entre `/buscar` e `/perfil`): `{ path: '/programas', element: <MeusProgramas /> },`.
- [ ] **Step 2:** em `BottomNav.tsx` e `AppLayout.tsx` trocar o item "Programas": `{ to: '/programas', label: 'Programas', Icon: ProgramasIcon },`.
- [ ] **Step 3:** atualizar/adicionar asserções de **href**:
  - `BottomNav.test.tsx`: `expect(screen.getByRole('link', { name: /programas/i })).toHaveAttribute('href', '/programas')`.
  - `AppLayout.test.tsx`: adicionar asserção explícita `expect(screen.getByRole('link', { name: /programas/i })).toHaveAttribute('href', '/programas')` (hoje só conta links).
  - `Perfil.test.tsx` "editar meus programas" permanece `/onboarding?mode=edit` — NÃO mexer.
- [ ] **Step 4:** `router.test.tsx` — adicionar um caso que renderiza `/programas` sob `AppLayout` e acha o header "Programas" (mockar hooks de dados como os outros testes de rota fazem; se `router.test.tsx` não existir/for trivial, criar teste focado `MeusProgramas` já cobre a tela — então este passo é: garantir que a rota está registrada via um teste de smoke de `router` OU pular se o arquivo não testa rotas hoje; decidir ao ler o arquivo).
- [ ] **Step 5:** `npm test -- BottomNav AppLayout router && npm run build`. **Commit** — `git add src/router.tsx src/router.test.tsx src/features/layout/ && git commit -m "feat(programas): rota /programas + nav aponta pra ela (+asserts de href)"`

---

## Task 7: `OnboardingPage` honra `?method=gmail` (re-scan)

**Files:** Modify `src/features/onboarding/OnboardingPage.tsx`, `OnboardingPage.test.tsx`.

**Interfaces:** `/onboarding?method=gmail` começa em `gmail-consent` (se `gmail.available`); **todas as saídas do re-scan voltam a `/programas`** — inclusive **zero achados** e **Gmail indisponível** (não caem mais no `ManualWizard`). Corrige a **TDZ** (mover `useGmailAuth()` pra antes do `useState`).

- [ ] **Step 1: teste** (usa os mocks já existentes de `useGmailAuth`/`gmailScan` no arquivo)

```tsx
// adicionar em OnboardingPage.test.tsx
it('?method=gmail começa no consent (Gmail disponível)', () => {
  renderWithProviders(<OnboardingPage />, { route: '/onboarding?method=gmail' })
  expect(screen.getByRole('heading', { name: /Conectar seu Gmail/ })).toBeInTheDocument()
})
```
(Se houver mock configurável de `gmailScan` retornando `{findings:[], partial:false}`, adicionar também um caso de **zero achados → estado "nada novo"** com um botão "Voltar a Programas"; caso o mock seja fixo, cobrir zero-achados só no manual/e2e e anotar.)

- [ ] **Step 2: rodar → falhar**.

- [ ] **Step 3: implementar** — reordenar hooks e tratar saídas do re-scan. **Mover `const gmail = useGmailAuth()` para ANTES do `useState<Screen>`**, e:

```tsx
  const editing = params.get('mode') === 'edit'
  const rescan = params.get('method') === 'gmail'
  const gmail = useGmailAuth()                       // <-- movido pra cá (antes do estado)
  const initialScreen = (): Screen =>
    editing ? 'manual' : rescan ? (gmail.available ? 'gmail-consent' : 'gmail-none') : 'welcome'
  const [screen, setScreen] = useState<Screen>(initialScreen)
  // ...
  useEffect(() => { setScreen(initialScreen()) }, [editing, rescan, gmail.available])
```
- Adicionar `'gmail-none'` ao tipo `Screen`.
- `connectAndScan`: no re-scan, **zero achados** vai pra `'gmail-none'` (não `'manual'`): `if (result.findings.length === 0) { setScreen(rescan ? 'gmail-none' : 'manual'); return }`.
- Renderizar `'gmail-none'`: uma tela simples ("Nada novo no seu Gmail" / "Não foi possível conectar ao Gmail") com botão **Voltar aos meus programas** → `navigate('/programas')` e um **Tentar de novo** → `setScreen('gmail-consent')` (se `gmail.available`).
- Saídas do fluxo no re-scan → `/programas`:
  - `GmailConsent onBack`: `rescan ? () => navigate('/programas') : () => setScreen('method')`.
  - `Vasculhando`/`RevisarGmail onBack`: `rescan ? () => setScreen('gmail-consent') : () => setScreen('method')`.
  - `gmail-done` `RadarMontado onView`: `() => navigate(rescan ? '/programas' : '/alertas?from=onboarding')`.

```tsx
  if (screen === 'gmail-none') {
    const msg = gmail.available ? 'Nada novo no seu Gmail desta vez.' : 'Conexão com o Gmail indisponível.'
    return (
      <div className="ob-state">
        <PageState title={msg} action={gmail.available ? { label: 'Procurar de novo', onClick: () => setScreen('gmail-consent') } : undefined} />
        <button className="btn ghost" type="button" onClick={() => navigate('/programas')}>Voltar aos meus programas</button>
      </div>
    )
  }
```
(Importar `PageState` de `../../ui` no `OnboardingPage`.)

- [ ] **Step 4: rodar + build + suíte** (`npm test -- OnboardingPage && npm run build && npm test`). **Commit** — `git add src/features/onboarding/OnboardingPage.* && git commit -m "feat(gmail): re-scan via ?method=gmail — saídas p/ /programas, zero/indisponível tratados, corrige TDZ"`

---

## Task 8: E2E — `/programas` no gate visual + navegação

**Files:** Modify `tests/e2e/app-layout.spec.ts`.

- [ ] **Step 1:** adicionar `/programas` ao loop de telas do gate visual (mobile/desktop, claro/escuro) que verifica ausência de overflow horizontal + estrutura, seguindo o padrão das outras rotas em `app-layout.spec.ts`. Adicionar um teste que **clica "Programas"** (sidebar e bottom nav), confirma a URL `/programas` e o header "Programas".
- [ ] **Step 2:** rodar `npx playwright test app-layout` (4 projetos) → verde. Se o ambiente não rodar e2e, deixar o spec correto por inspeção e sinalizar.
- [ ] **Step 3: commit** — `git add tests/e2e/app-layout.spec.ts && git commit -m "test(e2e): /programas no gate visual + navegação da nav"`

---

## Self-Review (contra a spec + review do Codex)

- Exclusividade de tier por marca (Codex #1) → **Task 1** (migration 0021 + testes). ✔
- Proveniência via `source_evidence` + rótulo honesto → Tasks 2/3/5. ✔
- "Última busca" corrigida → "Último via Gmail" (Task 5). ✔
- Bugs de código: TDZ (T7), `.test.tsx` (T2), `kind` válido (T3), `tierLabel`/`relTime` (T3), `@import` (T5, agora `index.css`), "Mais completo" reusado (T4), erro/pending (T5). ✔
- Robustez: dedup no write (T5), ordenação (T3), invalidação `source_evidence` (T2), Escape/foco (T4), concorrência (T5 `busy`). ✔
- Saídas do re-scan (zero/indisponível) → `/programas` (T7). ✔
- Testes: href asserts + rota (T6), casos `?method=gmail` (T7), e2e `/programas` (T8). ✔

**Deixado consciente (não-bloqueante):** proveniência é por marca (não por seleção) — o rótulo "Encontrado no Gmail" reflete isso honestamente; modelar por-item ficaria pra depois. "Do catálogo" ainda conclui no Painel (o wizard não muda) — melhoria opcional (`from=programas`) fora deste escopo. Duplicatas de tier **pré-existentes** em dados antigos aparecem 2x até um re-scan/troca colapsá-las (a 0021 impede novas).

## Deploy (quando for pro ar)
- Aplicar a **0021** em prod (via `psql -U supabase_admin` no container, como a 0020) **antes** do bundle novo — é `create or replace`, seguro/idempotente. Depois push `main` → deploy (auto flaky → fallback `application-deploy`). Front sem env nova.
