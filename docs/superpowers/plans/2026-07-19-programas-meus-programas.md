# Programas → Meus programas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Substituir a tela "Programas" (hoje = wizard de onboarding em `?mode=edit`) por uma tela **"Meus programas"**: lista dos programas do usuário na linguagem do Revisar, com proveniência Gmail/manual, gestão por item (trocar tier / remover) e dois pontos de entrada (re-scan Gmail / catálogo).

**Architecture:** Front-only. Nova rota `/programas` sob `AppLayout`. Um hook compõe `user_sources` × catálogo (`useSources`) × `source_evidence` (leitura nova) numa lista de programas com proveniência. Gestão reusa a RPC `replace_user_sources` (recomputa o conjunto). Re-scan reusa o fluxo Gmail via novo parâmetro `?method=gmail` no `OnboardingPage`.

**Tech Stack:** React + TS, TanStack Query v5, React Router, Vitest + Testing Library. Supabase (só leitura nova em `source_evidence`; nenhuma migration/RPC nova).

## Global Constraints

- **Spec:** `docs/superpowers/specs/2026-07-19-programas-meus-programas-design.md`.
- **Sem migration, sem RPC nova.** Gestão via `replace_user_sources(item_ids)` (RPC existente); leitura de `source_evidence` (RLS own-rows já existe).
- **Proveniência:** `source_id` em `source_evidence` do usuário ⇒ `gmail` (com `email_from` + "há X" via `created_at`); senão ⇒ `manual`.
- **Re-scan é aditivo/idempotente** (RPC `add_gmail_sources`), roda sob o mesmo `user_id`.
- **Linguagem visual:** reusar tokens/classes existentes (`.review-item`, `.ob-sheet*`, `.app-page`). pt-BR. Termo "programas de benefícios".
- **Vitest ≠ tsc:** `npm test` não roda tsc → rodar `npm run build` p/ checar tipos.
- Copiar valores/assinaturas exatas do plano (nada de placeholder).

---

## File Structure

**Criar:**
- `src/features/programas/buildPrograms.ts` — pura: `(itemIds, sources, evidence) → { programs, summary }`.
- `src/features/programas/buildPrograms.test.ts`.
- `src/features/programas/useSourceEvidence.ts` — lê `source_evidence` (own-rows).
- `src/features/programas/useMyPrograms.ts` — compõe os 3 hooks.
- `src/features/programas/ProgramSheet.tsx` — bottom sheet do ⋯ (tiers multi + remover).
- `src/features/programas/ProgramSheet.test.tsx`.
- `src/features/programas/MeusProgramas.tsx` — a tela.
- `src/features/programas/MeusProgramas.test.tsx`.
- `src/features/programas/programas.css`.

**Modificar:**
- `src/router.tsx` — rota `/programas` sob `AppLayout`.
- `src/features/layout/BottomNav.tsx` + `AppLayout.tsx` — "Programas" → `/programas`.
- `src/features/layout/BottomNav.test.tsx` (e AppLayout test se houver) — asserção do novo `to`.
- `src/features/onboarding/OnboardingPage.tsx` — honrar `?method=gmail` (start em `gmail-consent`; saídas → `/programas`).
- `src/features/onboarding/OnboardingPage.test.tsx` — casos do `?method=gmail`.
- `src/index.css` (ou onde os CSS de feature são importados) — importar `programas.css` **se** o projeto não importa CSS via componente. (Verificar: `perfil.css` é importado dentro de `Perfil.tsx` via `import './perfil.css'` — seguir o mesmo padrão e importar `programas.css` dentro de `MeusProgramas.tsx`. Então NÃO tocar index.css.)

---

## Task 1: `useSourceEvidence` hook

**Files:**
- Create: `src/features/programas/useSourceEvidence.ts`
- Create: `src/features/programas/useSourceEvidence.test.ts`

**Interfaces:**
- Produces: `EvidenceRow = { source_id: string; email_from: string; email_date: string | null; created_at: string; gmail_account: string }`; `useSourceEvidence(userId?: string)` → TanStack query retornando `EvidenceRow[]`.

- [ ] **Step 1: Escrever o teste (mock do supabase)**

```ts
// src/features/programas/useSourceEvidence.test.ts
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const rows = [{ source_id: 's1', email_from: 'a@nubank.com.br', email_date: '2026-07-01T00:00:00Z', created_at: '2026-07-16T00:00:00Z', gmail_account: 'me@gmail.com' }]
const select = vi.fn(async () => ({ data: rows, error: null }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ select }) } }))

import { useSourceEvidence } from './useSourceEvidence'

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useSourceEvidence', () => {
  it('lê as evidências do usuário', async () => {
    const { result } = renderHook(() => useSourceEvidence('u1'), { wrapper: wrap() })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data![0].source_id).toBe('s1')
    expect(select).toHaveBeenCalledWith('source_id, email_from, email_date, created_at, gmail_account')
  })
})
```

- [ ] **Step 2: Rodar para ver falhar** — `npm test -- useSourceEvidence` → FAIL.

- [ ] **Step 3: Implementar**

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

// RLS own-rows já filtra por auth.uid(); userId só namespaceia o cache.
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

- [ ] **Step 4: Rodar + build** — `npm test -- useSourceEvidence && npm run build` → PASS + limpo.

- [ ] **Step 5: Commit**

```bash
git add src/features/programas/useSourceEvidence.ts src/features/programas/useSourceEvidence.test.ts
git commit -m "feat(programas): useSourceEvidence (leitura own-rows da proveniência)"
```

---

## Task 2: `buildPrograms` (puro) + `useMyPrograms`

**Files:**
- Create: `src/features/programas/buildPrograms.ts`
- Create: `src/features/programas/buildPrograms.test.ts`
- Create: `src/features/programas/useMyPrograms.ts`

**Interfaces:**
- Consumes: `Source`/`SourceItem` (`../onboarding/types`), `EvidenceRow` (Task 1), `useUserSources`, `useSources`, `useSourceEvidence`.
- Produces:
  - `Program = { itemId, sourceId, brand, tier, items: SourceItem[], logo: string|null, provenance: 'gmail'|'manual', when: string, from: string }`
  - `ProgramsSummary = { total, gmailCount, manualCount, lastScan: string, account: string }`
  - `buildPrograms(itemIds: string[], sources: Source[], evidence: EvidenceRow[]): { programs: Program[]; summary: ProgramsSummary }`
  - `useMyPrograms(userId?: string)` → `{ programs, summary, isLoading, error, refetch }`.

- [ ] **Step 1: Escrever o teste da função pura**

```ts
// src/features/programas/buildPrograms.test.ts
import { describe, it, expect } from 'vitest'
import { buildPrograms } from './buildPrograms'
import type { Source } from '../onboarding/types'
import type { EvidenceRow } from './useSourceEvidence'

const sources: Source[] = [
  { id: 's1', kind: 'card', name: 'Nubank', logo_url: null, sort_order: 1,
    source_items: [{ id: 'gold', label: 'Gold', sort_order: 1 }, { id: 'plat', label: 'Platinum', sort_order: 2 }] },
  { id: 's2', kind: 'retail', name: 'Spotify', logo_url: '/l/spotify.svg', sort_order: 2,
    source_items: [{ id: 'prem', label: 'Premium', sort_order: 1 }] },
]
const evidence: EvidenceRow[] = [
  { source_id: 's1', email_from: 'a@nubank.com.br', email_date: '2026-07-01T00:00:00Z', created_at: new Date().toISOString(), gmail_account: 'me@gmail.com' },
]

describe('buildPrograms', () => {
  it('marca proveniência gmail quando há evidência do source_id', () => {
    const { programs, summary } = buildPrograms(['plat', 'prem'], sources, evidence)
    const nu = programs.find((p) => p.sourceId === 's1')!
    const sp = programs.find((p) => p.sourceId === 's2')!
    expect(nu.provenance).toBe('gmail')
    expect(nu.tier).toBe('Platinum')
    expect(nu.items).toHaveLength(2)
    expect(sp.provenance).toBe('manual')
    expect(summary.total).toBe(2)
    expect(summary.gmailCount).toBe(1)
    expect(summary.manualCount).toBe(1)
    expect(summary.account).toBe('me@gmail.com')
  })

  it('ignora item que não existe mais no catálogo', () => {
    const { programs } = buildPrograms(['fantasma'], sources, [])
    expect(programs).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Rodar para ver falhar** — `npm test -- buildPrograms` → FAIL.

- [ ] **Step 3: Implementar a função pura + o hook**

```ts
// src/features/programas/buildPrograms.ts
import type { Source, SourceItem } from '../onboarding/types'
import type { EvidenceRow } from './useSourceEvidence'

export interface Program {
  itemId: string
  sourceId: string
  brand: string
  tier: string
  items: SourceItem[]
  logo: string | null
  provenance: 'gmail' | 'manual'
  when: string
  from: string
}
export interface ProgramsSummary {
  total: number
  gmailCount: number
  manualCount: number
  lastScan: string
  account: string
}

function relTime(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (days <= 0) return 'hoje'
  if (days === 1) return 'ontem'
  if (days < 7) return `há ${days} dias`
  if (days < 30) return `há ${Math.floor(days / 7)} sem`
  return `há ${Math.floor(days / 30)} meses`
}

// rótulo de tier só quando é significativo (marca multi-tier ou label real)
function tierLabel(item: SourceItem, multi: boolean): string {
  const l = item.label?.trim()
  if (!l || l === '—') return ''
  return multi ? l : l
}

export function buildPrograms(itemIds: string[], sources: Source[], evidence: EvidenceRow[]): { programs: Program[]; summary: ProgramsSummary } {
  // evidência mais recente por source_id
  const bySource = new Map<string, { from: string; at: number }>()
  let lastAt = 0
  let account = ''
  for (const e of evidence) {
    const at = new Date(e.created_at).getTime()
    const prev = bySource.get(e.source_id)
    if (!prev || at > prev.at) bySource.set(e.source_id, { from: e.email_from, at })
    if (at > lastAt) { lastAt = at; account = e.gmail_account }
  }

  const programs: Program[] = []
  for (const itemId of itemIds) {
    const source = sources.find((s) => s.source_items.some((it) => it.id === itemId))
    if (!source) continue
    const item = source.source_items.find((it) => it.id === itemId)!
    const ev = bySource.get(source.id)
    programs.push({
      itemId,
      sourceId: source.id,
      brand: source.name,
      tier: tierLabel(item, source.source_items.length > 1),
      items: source.source_items,
      logo: source.logo_url,
      provenance: ev ? 'gmail' : 'manual',
      when: ev ? relTime(new Date(ev.at).toISOString()) : '',
      from: ev?.from ?? '',
    })
  }

  const gmailCount = programs.filter((p) => p.provenance === 'gmail').length
  return {
    programs,
    summary: {
      total: programs.length,
      gmailCount,
      manualCount: programs.length - gmailCount,
      lastScan: lastAt ? relTime(new Date(lastAt).toISOString()) : '',
      account,
    },
  }
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
    programs,
    summary,
    isLoading: itemsQ.isLoading || sourcesQ.isLoading || evidenceQ.isLoading,
    error: itemsQ.error || sourcesQ.error || evidenceQ.error,
    refetch: () => { void itemsQ.refetch(); void sourcesQ.refetch(); void evidenceQ.refetch() },
  }
}
```

> Nota: `useSources` retorna `CategoryGroup[]`; `g.sources` são `Source` já enriquecidos (com `source_items`). `buildPrograms` usa `source.source_items` (id/label).

- [ ] **Step 4: Rodar + build** — `npm test -- buildPrograms && npm run build` → PASS + limpo.

- [ ] **Step 5: Commit**

```bash
git add src/features/programas/buildPrograms.ts src/features/programas/buildPrograms.test.ts src/features/programas/useMyPrograms.ts
git commit -m "feat(programas): buildPrograms (proveniência) + useMyPrograms"
```

---

## Task 3: `ProgramSheet` (⋯ — versões inline + remover)

**Files:**
- Create: `src/features/programas/ProgramSheet.tsx`
- Create: `src/features/programas/ProgramSheet.test.tsx`

**Interfaces:**
- Consumes: `Program` (Task 2), `formatBRL` (`../benefits/estimatedValue`).
- Produces: `ProgramSheet({ program, onPickTier, onRemove, onClose })`. `onPickTier(itemId: string)`, `onRemove()`, `onClose()`. Multi-tier (`items.length > 1`) mostra as versões (tocar → `onPickTier`); sempre mostra "Remover do radar" (`onRemove`).

- [ ] **Step 1: Escrever os testes**

```tsx
// src/features/programas/ProgramSheet.test.tsx
import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProgramSheet } from './ProgramSheet'
import type { Program } from './buildPrograms'

const multi: Program = {
  itemId: 'plat', sourceId: 's1', brand: 'Nubank', tier: 'Platinum',
  items: [{ id: 'gold', label: 'Gold', sort_order: 1 }, { id: 'plat', label: 'Platinum', sort_order: 2 }],
  logo: null, provenance: 'gmail', when: 'há 3 dias', from: 'a@nubank.com.br',
}
const single: Program = {
  itemId: 'prem', sourceId: 's2', brand: 'Spotify', tier: 'Premium',
  items: [{ id: 'prem', label: 'Premium', sort_order: 1 }], logo: null, provenance: 'manual', when: '', from: '',
}

it('multi-tier: mostra versões e troca ao tocar', () => {
  const onPickTier = vi.fn()
  render(<ProgramSheet program={multi} onPickTier={onPickTier} onRemove={vi.fn()} onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /Gold/ }))
  expect(onPickTier).toHaveBeenCalledWith('gold')
})

it('sempre tem Remover; single-tier não mostra troca de versão', () => {
  const onRemove = vi.fn()
  render(<ProgramSheet program={single} onPickTier={vi.fn()} onRemove={onRemove} onClose={vi.fn()} />)
  expect(screen.queryByRole('button', { name: /Premium/ })).toBeNull() // sem seletor de versão
  fireEvent.click(screen.getByRole('button', { name: /Remover do radar/ }))
  expect(onRemove).toHaveBeenCalled()
})
```

- [ ] **Step 2: Rodar para ver falhar** — `npm test -- ProgramSheet` → FAIL.

- [ ] **Step 3: Implementar** (reusa classes `.ob-sheet*` de `onboarding.css`)

```tsx
// src/features/programas/ProgramSheet.tsx
import type { Program } from './buildPrograms'
import { formatBRL } from '../benefits/estimatedValue'

export function ProgramSheet({
  program, onPickTier, onRemove, onClose,
}: {
  program: Program
  onPickTier: (itemId: string) => void
  onRemove: () => void
  onClose: () => void
}) {
  const multi = program.items.length > 1
  const title = multi ? `Qual o seu ${program.brand}?` : `${program.brand}${program.tier ? ' ' + program.tier : ''}`
  const sub = program.provenance === 'gmail' ? `Encontrado no Gmail · ${program.from}` : 'Adicionado manualmente'
  const best = multi ? program.items.reduce((a, b) => (b.estValueBrl ?? 0) > (a.estValueBrl ?? 0) ? b : a) : null

  return (
    <div className="ob-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ob-sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div className="ob-sheet-panel">
        <div className="ob-sheet-grip" aria-hidden="true" />
        <h3 className="ob-sheet-title">{title}</h3>
        <p className="ob-sheet-sub">{sub}</p>
        <div className="ob-sheet-list">
          {multi ? program.items.map((it) => {
            const on = it.id === program.itemId
            const isBest = it.id === best?.id
            return (
              <button key={it.id} type="button" className={'ob-sheet-item' + (on ? ' on' : '')} aria-pressed={on} onClick={() => onPickTier(it.id)}>
                <span className="ob-sheet-item-main">
                  <span className="ob-sheet-item-head">
                    <span className="ob-sheet-item-name">{it.label}</span>
                    {isBest && (it.benefitCount ?? 0) > 0 ? <span className="ob-sheet-badge">Mais completo</span> : null}
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
          <button type="button" className="prg-remove" onClick={onRemove}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
            Remover do radar
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar + build** — `npm test -- ProgramSheet && npm run build`.

- [ ] **Step 5: Commit**

```bash
git add src/features/programas/ProgramSheet.tsx src/features/programas/ProgramSheet.test.tsx
git commit -m "feat(programas): ProgramSheet (⋯ — versões inline + remover)"
```

---

## Task 4: `MeusProgramas` (tela) + `programas.css`

**Files:**
- Create: `src/features/programas/MeusProgramas.tsx`
- Create: `src/features/programas/programas.css`
- Create: `src/features/programas/MeusProgramas.test.tsx`

**Interfaces:**
- Consumes: `useMyPrograms` (Task 2), `useSaveUserSources` (`../onboarding/useSaveUserSources`), `useUserSources`, `ProgramSheet` (Task 3), `useSession`, `useNavigate`.
- Produces: `MeusProgramas` (default screen de `/programas`).

- [ ] **Step 1: Escrever os testes**

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

const programs: Program[] = [
  { itemId: 'plat', sourceId: 's1', brand: 'Nubank', tier: 'Platinum', items: [{ id: 'gold', label: 'Gold', sort_order: 1 }, { id: 'plat', label: 'Platinum', sort_order: 2 }], logo: null, provenance: 'gmail', when: 'há 3 dias', from: 'a@nubank.com.br' },
  { itemId: 'prem', sourceId: 's2', brand: 'Spotify', tier: 'Premium', items: [{ id: 'prem', label: 'Premium', sort_order: 1 }], logo: null, provenance: 'manual', when: '', from: '' },
]
vi.mock('./useMyPrograms', () => ({ useMyPrograms: () => ({ programs, summary: { total: 2, gmailCount: 1, manualCount: 1, lastScan: 'há 3 dias', account: 'me@gmail.com' }, isLoading: false, error: null, refetch: vi.fn() }) }))
vi.mock('../onboarding/useUserSources', () => ({ useUserSources: () => ({ data: ['plat', 'prem'] }) }))

beforeEach(() => { save.mockClear(); nav.mockClear() })

it('mostra resumo e a lista', () => {
  render(<MeusProgramas />)
  expect(screen.getByText(/Você tem 2 programas/)).toBeInTheDocument()
  expect(screen.getByText(/1 via Gmail/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Nubank/ })).toBeInTheDocument()
})

it('remover recomputa o conjunto sem o item', async () => {
  render(<MeusProgramas />)
  fireEvent.click(screen.getByRole('button', { name: /Opções de Nubank/ }))
  fireEvent.click(screen.getByRole('button', { name: /Remover do radar/ }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(['prem']))
})

it('ações navegam pros fluxos', () => {
  render(<MeusProgramas />)
  fireEvent.click(screen.getByRole('button', { name: /Procurar no Gmail/ }))
  expect(nav).toHaveBeenCalledWith('/onboarding?method=gmail')
  fireEvent.click(screen.getByRole('button', { name: /Do catálogo/ }))
  expect(nav).toHaveBeenCalledWith('/onboarding?mode=edit')
})
```

- [ ] **Step 2: Rodar para ver falhar** — `npm test -- MeusProgramas` → FAIL.

- [ ] **Step 3: Implementar a tela**

```tsx
// src/features/programas/MeusProgramas.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './programas.css'
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

  async function remove(itemId: string) {
    setSheetId(null)
    await save.mutateAsync(currentIds.filter((id) => id !== itemId))
  }
  async function swapTier(oldItemId: string, newItemId: string) {
    setSheetId(null)
    if (oldItemId === newItemId) return
    await save.mutateAsync(currentIds.map((id) => (id === oldItemId ? newItemId : id)))
  }

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
        {summary.lastScan ? <span className="prg-sub">Última busca no Gmail {summary.lastScan}{summary.account ? ` · ${summary.account}` : ''}</span> : null}
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
        <ProgramSheet
          program={sheetProg}
          onPickTier={(itemId) => swapTier(sheetProg.itemId, itemId)}
          onRemove={() => remove(sheetProg.itemId)}
          onClose={() => setSheetId(null)}
        />
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Escrever o CSS** (reusa tokens; `.review-*` já existe em `onboarding.css`, mas essa tela não importa `onboarding.css` — replicar as regras `.review-item*` necessárias aqui OU importar. Decisão: **importar `../onboarding/onboarding.css`** no topo do `programas.css` via `@import` para reusar `.review-item`/`.ob-sheet`, e adicionar só as classes `prg-*`/`lbl`.)

```css
/* src/features/programas/programas.css */
@import '../onboarding/onboarding.css';

.programas-page { display: grid; gap: var(--s5); }
.programas-page header h1 { margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -.03em; }
.lbl { font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); margin: 0; }

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

.prg-meta { display: flex; align-items: center; gap: 6px; }
.prg-tag { font-size: 10px; font-weight: 700; padding: 2px 7px; border-radius: 999px; }
.prg-tag.g { color: var(--accent); background: var(--accent-soft); }
.prg-tag.m { color: var(--ink-2); background: var(--surface-2); border: 1px solid var(--line); }
.prg-when { font-size: 11px; color: var(--muted); }
.prg-more { flex: none; width: 30px; height: 30px; border-radius: 9px; border: 1px solid var(--line); background: transparent; color: var(--muted); font-size: 16px; font-weight: 800; cursor: pointer; line-height: 1; }
.prg-more:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.prg-empty { padding: 26px 16px; text-align: center; color: var(--ink-2); font-size: 13.5px; border: 1px dashed var(--line); border-radius: 14px; }

.prg-remove { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 13px 14px; border-radius: 15px; border: 1px solid var(--line); background: transparent; color: var(--warn); font: inherit; font-weight: 700; cursor: pointer; }
.prg-remove:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
```

> Se o `@import` de `onboarding.css` causar duplicação/ordem estranha no build, a alternativa é o `MeusProgramas.tsx` importar ambos: `import '../onboarding/onboarding.css'` e `import './programas.css'`. Verificar no `npm run build` + no render.

- [ ] **Step 5: Rodar + build** — `npm test -- MeusProgramas && npm run build`.

- [ ] **Step 6: Commit**

```bash
git add src/features/programas/MeusProgramas.tsx src/features/programas/programas.css src/features/programas/MeusProgramas.test.tsx
git commit -m "feat(programas): tela Meus programas (lista + resumo + ações + ⋯)"
```

---

## Task 5: Rota `/programas` + nav

**Files:**
- Modify: `src/router.tsx`
- Modify: `src/features/layout/BottomNav.tsx`, `src/features/layout/AppLayout.tsx`
- Modify: `src/features/layout/BottomNav.test.tsx` (+ AppLayout test se existir)

**Interfaces:**
- Consumes: `MeusProgramas` (Task 4).

- [ ] **Step 1: Rota sob AppLayout** — em `src/router.tsx`, importar e adicionar:

```tsx
import { MeusProgramas } from './features/programas/MeusProgramas'
// ...dentro do children de AppLayout, entre /buscar e /perfil:
      { path: '/programas', element: <MeusProgramas /> },
```

- [ ] **Step 2: Nav aponta pra /programas** — em `BottomNav.tsx` e `AppLayout.tsx`, trocar o item "Programas":

```tsx
// de:
{ to: '/onboarding?mode=edit', label: 'Programas', Icon: ProgramasIcon },
// para:
{ to: '/programas', label: 'Programas', Icon: ProgramasIcon },
```

- [ ] **Step 3: Atualizar o teste da nav** — em `BottomNav.test.tsx`, a asserção que espera `/onboarding?mode=edit` para "Programas" passa a esperar `/programas`:

```tsx
expect(screen.getByRole('link', { name: /programas/i })).toHaveAttribute('href', '/programas')
```
(Se `AppLayout.test.tsx` tiver asserção equivalente, atualizar também. `Perfil.test.tsx` "editar meus programas" permanece `/onboarding?mode=edit` — NÃO mexer.)

- [ ] **Step 4: Rodar + build** — `npm test -- BottomNav AppLayout && npm run build`.

- [ ] **Step 5: Commit**

```bash
git add src/router.tsx src/features/layout/
git commit -m "feat(programas): rota /programas + nav 'Programas' aponta pra ela"
```

---

## Task 6: `OnboardingPage` honra `?method=gmail`

**Files:**
- Modify: `src/features/onboarding/OnboardingPage.tsx`
- Modify: `src/features/onboarding/OnboardingPage.test.tsx`

**Interfaces:**
- Produces: `/onboarding?method=gmail` começa em `gmail-consent` (se `gmail.available`, senão `manual`); saídas do fluxo (voltar do consent, concluir) navegam pra `/programas`.

- [ ] **Step 1: Escrever o teste**

```tsx
// adicionar em OnboardingPage.test.tsx (segue os mocks já existentes de useGmailAuth/gmailScan)
it('?method=gmail começa na tela de consent (Gmail disponível)', () => {
  renderWithProviders(<OnboardingPage />, { route: '/onboarding?method=gmail' })
  expect(screen.getByRole('heading', { name: /Conectar seu Gmail/ })).toBeInTheDocument()
})
```

- [ ] **Step 2: Rodar para ver falhar** — `npm test -- OnboardingPage` → FAIL (começa em welcome).

- [ ] **Step 3: Implementar** — em `OnboardingPage.tsx`:

```tsx
// após `const editing = ...`:
  const rescan = params.get('method') === 'gmail'
  const initial: Screen = editing ? 'manual' : rescan ? (gmail.available ? 'gmail-consent' : 'manual') : 'welcome'
  const [screen, setScreen] = useState<Screen>(initial)
  // ...
  // o efeito que sincroniza screen com editing passa a considerar rescan:
  useEffect(() => { setScreen(editing ? 'manual' : rescan ? (gmail.available ? 'gmail-consent' : 'manual') : 'welcome') }, [editing, rescan, gmail.available])

  // saída do fluxo: helper
  const exitReview = () => navigate(rescan ? '/programas' : '/alertas?from=onboarding')
```

E ajustar as navegações de saída:
- `gmail-consent` onBack: `rescan ? () => navigate('/programas') : () => setScreen('method')`.
- `gmail-scan`/`gmail-review` onBack: `rescan ? () => setScreen('gmail-consent') : () => setScreen('method')`.
- `gmail-done` `RadarMontado onView`: `exitReview` (`/programas` no rescan).

> `gmail.available` já está no escopo (via `useGmailAuth()`), então `initial`/efeito podem lê-lo. Como `useState(initial)` roda no 1º render com `gmail.available` já resolvido (env é síncrono), o start fica correto; o efeito cobre mudanças.

- [ ] **Step 4: Rodar + build + suíte** — `npm test -- OnboardingPage && npm run build && npm test`.

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/OnboardingPage.tsx src/features/onboarding/OnboardingPage.test.tsx
git commit -m "feat(gmail): re-scan via /onboarding?method=gmail (start no consent, saída p/ /programas)"
```

---

## Self-Review (checagem contra a spec)

- Tela Programas = lista + resumo + proveniência + ações → Tasks 2, 4. ✔
- Proveniência via `source_evidence` (sem migration) → Tasks 1, 2. ✔
- ⋯ versões inline + remover (1 folha) → Task 3. ✔
- Gestão via `replace_user_sources` (remover/trocar) → Task 4 (usa `useSaveUserSources`). ✔
- Re-scan `?method=gmail` (start consent, saída /programas) → Task 6. ✔
- Nav "Programas" → `/programas` → Task 5. ✔
- Sem migration/RPC nova; front-only. ✔

**Placeholders:** a decisão do `@import` vs import duplo no CSS (Task 4 Step 4) tem as duas opções + como validar — não é placeholder, é contingência.
**Consistência de tipos:** `Program`/`ProgramsSummary` (Task 2) usados igual em 3/4; `EvidenceRow` (1) consumido em 2; `useSaveUserSources(itemIds)` já existe (assinatura `string[]`).
**Ponto de atenção:** `useUserSources` é chamado tanto no `useMyPrograms` quanto direto no `MeusProgramas` (pra ter `currentIds` na hora de recomputar) — mesma query key, TanStack deduplica; ok.
