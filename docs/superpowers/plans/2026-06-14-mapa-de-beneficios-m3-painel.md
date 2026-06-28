# Mapa de Benefícios M3 — Painel completo (dashboard, detalhe, busca) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O usuário vê seus benefícios cruzados num painel real: saudação + contagem, destaque, chips de categoria e feed; abre o detalhe de cada benefício (fontes "via", passo-a-passo, ação); e busca por texto/categoria. Navegação inferior entre Painel e Buscar.

**Architecture:** Uma única query React Query `useMyBenefits(userId)` traz todos os benefícios do usuário (view `my_benefits`, agora 1 linha por benefício com `via text[]`). Painel, Busca e Detalhe derivam desse resultado cacheado (filtro client-side). Rotas `/painel` e `/buscar` ficam sob um `AppLayout` com `BottomNav`; `/beneficio/:id` é tela cheia com voltar.

**Tech Stack:** React 18, TS, Vite, Tailwind, TanStack Query v5, React Router, Supabase. Vitest + Testing Library.

**Pré-requisito:** M1+M2+hardening na `main`. Supabase local rodando. `.env.local` presente. `npm run gen:types` disponível.

**Referência:** spec `docs/superpowers/specs/2026-06-13-mapa-de-beneficios-mvp-design.md`.

**Decisões M3:** view `my_benefits` deduplicada (1 linha/benefício, `via` = array); busca client-side; Perfil adiado pro M4; destaque = primeiro do feed.

---

## Estrutura de arquivos (M3)

```
supabase/migrations/0006_my_benefits_dedup.sql   # CRIA: view 1 linha/benefício, via text[]
src/lib/database.types.ts                          # REGENERA
src/router.tsx                                      # MODIFICA: layout + rotas painel/buscar/detalhe
src/features/benefits/
  types.ts                                          # CRIA: MyBenefit, categorias
  useMyBenefits.ts                                  # CRIA: query principal (lista do usuário)
  useMyBenefits.integration.test.ts (em tests/)     # via array
  BenefitCard.tsx (+test)                            # CRIA: card do feed
  CategoryChips.tsx (+test)                          # CRIA: filtro de categorias
  filterBenefits.ts (+test)                          # CRIA: pura — filtro texto+categoria
  useBenefit.ts                                      # CRIA: deriva 1 benefício por id
src/features/painel/
  Painel.tsx (+test)                                 # CRIA: dashboard (substitui PainelPlaceholder)
src/features/detalhe/
  BenefitDetail.tsx (+test)                          # CRIA: tela de detalhe
src/features/busca/
  Search.tsx (+test)                                 # CRIA: tela de busca
src/features/layout/
  AppLayout.tsx                                       # CRIA: Outlet + BottomNav
  BottomNav.tsx (+test)                               # CRIA: nav inferior
tests/my_benefits_dedup.integration.test.ts          # CRIA
```

Arquivos removidos: `src/features/painel/PainelPlaceholder.tsx` (+test) — substituídos por `Painel.tsx`. `src/features/benefits/useMyBenefitsCount.ts` (+ uso) — a contagem passa a ser `useMyBenefits().data.length`.

---

## Task 1: View `my_benefits` deduplicada (via text[]) + hook useMyBenefits

**Files:**
- Create: `supabase/migrations/0006_my_benefits_dedup.sql`, `src/features/benefits/types.ts`, `src/features/benefits/useMyBenefits.ts`, `tests/my_benefits_dedup.integration.test.ts`
- Modify: `src/lib/database.types.ts` (regen)

- [ ] **Step 1: Teste de integração que falha (via como array, 1 linha/benefício)**

Create `tests/my_benefits_dedup.integration.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { userClient } from './helpers/clients'

const BLACK = 'aaaaaaa1-0000-0000-0000-000000000001'
const PLATINUM = 'aaaaaaa1-0000-0000-0000-000000000002'
// Cinemark (benefício 2 do seed) é destravado por Black E Platinum
const CINEMARK = 'd0000001-0000-0000-0000-000000000002'

describe('my_benefits dedup', () => {
  it('retorna 1 linha por benefício com via agregando as fontes', async () => {
    const { client, id } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [BLACK, PLATINUM] })

    const { data, error } = await client.from('my_benefits').select('id, via')
    expect(error).toBeNull()

    // Cinemark aparece UMA vez, com 2 fontes no array
    const rows = (data ?? []).filter((r) => r.id === CINEMARK)
    expect(rows.length).toBe(1)
    expect((rows[0].via as string[]).sort()).toEqual(['Black/Infinite', 'Platinum'])
    void id
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**

Run: `npm test -- tests/my_benefits_dedup.integration.test.ts`
Expected: FAIL (hoje a view traz 2 linhas e `via` é string, não array).

- [ ] **Step 3: Migration da view deduplicada**

Create `supabase/migrations/0006_my_benefits_dedup.sql`:
```sql
-- Redefine my_benefits: 1 linha por benefício; via agrega as fontes (text[]).
drop view if exists my_benefits;

create view my_benefits with (security_invoker = true) as
select
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
  array_agg(distinct si.label order by si.label) as via
from benefits b
join benefit_sources bs on bs.benefit_id = b.id
join source_items si on si.id = bs.source_item_id
join user_sources us on us.source_item_id = si.id
where us.user_id = auth.uid() and b.active
group by b.id;

grant select on my_benefits to authenticated;
```

- [ ] **Step 4: Aplicar + regenerar tipos**

Run:
```bash
npx supabase db reset
npm run gen:types
```
Confirme que `src/lib/database.types.ts` agora tipa `my_benefits.via` como `string[]` (grep `via`).

- [ ] **Step 5: Rodar — ver passar**

Run: `npm test -- tests/my_benefits_dedup.integration.test.ts`
Expected: PASS.

- [ ] **Step 6: Tipos do domínio**

Create `src/features/benefits/types.ts`:
```ts
export type BenefitCategory =
  | 'viagem'
  | 'entretenimento'
  | 'saude'
  | 'seguros'
  | 'compras'

export interface MyBenefit {
  id: string
  title: string
  summary: string
  category: BenefitCategory
  scope: string
  uf: string | null
  steps: string | null
  partner_name: string | null
  valid_until: string | null
  image_url: string | null
  action_url: string | null
  action_label: string | null
  created_at: string
  via: string[]
}

export const CATEGORIES: { key: BenefitCategory; label: string; emoji: string }[] = [
  { key: 'viagem', label: 'Viagem', emoji: '✈️' },
  { key: 'entretenimento', label: 'Lazer', emoji: '🎬' },
  { key: 'saude', label: 'Saúde', emoji: '💊' },
  { key: 'seguros', label: 'Seguros', emoji: '🛡️' },
  { key: 'compras', label: 'Compras', emoji: '🛍️' },
]
```

- [ ] **Step 7: Hook `useMyBenefits`**

Create `src/features/benefits/useMyBenefits.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { MyBenefit } from './types'

export function useMyBenefits(userId: string | undefined) {
  return useQuery({
    queryKey: ['my_benefits', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyBenefit[]> => {
      const { data, error } = await supabase
        .from('my_benefits')
        .select(
          'id, title, summary, category, scope, uf, steps, partner_name, valid_until, image_url, action_url, action_label, created_at, via',
        )
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as MyBenefit[]
    },
  })
}
```

- [ ] **Step 8: Atualizar invalidações no save hook**

Edit `src/features/onboarding/useSaveUserSources.ts` — no `onSuccess`, troque a invalidação de `['my_benefits_count']` por `['my_benefits']` (e mantenha `['has_onboarded']`):
```ts
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_benefits'] })
      queryClient.invalidateQueries({ queryKey: ['has_onboarded'] })
    },
```

- [ ] **Step 9: Build sanity (parcial — Painel/rotas ainda referenciam PainelPlaceholder até a Task 6)**

Run: `npx tsc --noEmit 2>&1 | grep -iE "features/benefits/(types|useMyBenefits)" || echo "sem erros de tipo nos arquivos desta task"`
Expected: "sem erros de tipo nos arquivos desta task".

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/0006_my_benefits_dedup.sql src/lib/database.types.ts src/features/benefits/types.ts src/features/benefits/useMyBenefits.ts src/features/onboarding/useSaveUserSources.ts tests/my_benefits_dedup.integration.test.ts
git commit -m "feat: view my_benefits deduplicada (via text[]) + hook useMyBenefits"
```

---

## Task 2: Filtro puro + componentes BenefitCard e CategoryChips

**Files:**
- Create: `src/features/benefits/filterBenefits.ts` (+ `.test.ts`), `BenefitCard.tsx` (+ `.test.tsx`), `CategoryChips.tsx` (+ `.test.tsx`)

- [ ] **Step 1: Teste do filtro puro (falha)**

Create `src/features/benefits/filterBenefits.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { filterBenefits } from './filterBenefits'
import type { MyBenefit } from './types'

const base = (over: Partial<MyBenefit>): MyBenefit => ({
  id: 'x', title: 'T', summary: 'S', category: 'compras', scope: 'nacional',
  uf: null, steps: null, partner_name: null, valid_until: null, image_url: null,
  action_url: null, action_label: null, created_at: '', via: [], ...over,
})

const list: MyBenefit[] = [
  base({ id: '1', title: 'Sala VIP', category: 'viagem', partner_name: 'Mastercard' }),
  base({ id: '2', title: 'Cinema', category: 'entretenimento', partner_name: 'Cinemark' }),
  base({ id: '3', title: 'Farmácia', category: 'saude' }),
]

describe('filterBenefits', () => {
  it('sem filtros retorna tudo', () => {
    expect(filterBenefits(list, { category: null, text: '' })).toHaveLength(3)
  })
  it('filtra por categoria', () => {
    const r = filterBenefits(list, { category: 'viagem', text: '' })
    expect(r.map((b) => b.id)).toEqual(['1'])
  })
  it('filtra por texto no título (case-insensitive)', () => {
    expect(filterBenefits(list, { category: null, text: 'cine' }).map((b) => b.id)).toEqual(['2'])
  })
  it('filtra por texto no partner_name', () => {
    expect(filterBenefits(list, { category: null, text: 'master' }).map((b) => b.id)).toEqual(['1'])
  })
  it('combina categoria e texto', () => {
    expect(filterBenefits(list, { category: 'saude', text: 'farm' }).map((b) => b.id)).toEqual(['3'])
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**

Run: `npm test -- src/features/benefits/filterBenefits.test.ts` → FAIL.

- [ ] **Step 3: Implementar filtro**

Create `src/features/benefits/filterBenefits.ts`:
```ts
import type { BenefitCategory, MyBenefit } from './types'

export interface BenefitFilter {
  category: BenefitCategory | null
  text: string
}

export function filterBenefits(items: MyBenefit[], filter: BenefitFilter): MyBenefit[] {
  const q = filter.text.trim().toLowerCase()
  return items.filter((b) => {
    if (filter.category && b.category !== filter.category) return false
    if (!q) return true
    const haystack = `${b.title} ${b.summary} ${b.partner_name ?? ''}`.toLowerCase()
    return haystack.includes(q)
  })
}
```

- [ ] **Step 4: Rodar — ver passar**

Run: `npm test -- src/features/benefits/filterBenefits.test.ts` → PASS (5 casos).

- [ ] **Step 5: Teste do BenefitCard (falha)**

Create `src/features/benefits/BenefitCard.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import { BenefitCard } from './BenefitCard'
import type { MyBenefit } from './types'

const b: MyBenefit = {
  id: 'b1', title: 'Sala VIP em Guarulhos', summary: 'Acesso gratuito', category: 'viagem',
  scope: 'pontual', uf: null, steps: null, partner_name: 'Mastercard', valid_until: null,
  image_url: null, action_url: null, action_label: null, created_at: '', via: ['Black/Infinite'],
}

describe('BenefitCard', () => {
  it('mostra título, parceiro e a fonte via, com link para o detalhe', () => {
    renderWithProviders(<BenefitCard benefit={b} />)
    expect(screen.getByText('Sala VIP em Guarulhos')).toBeInTheDocument()
    expect(screen.getByText(/Mastercard/)).toBeInTheDocument()
    expect(screen.getByText(/Black\/Infinite/)).toBeInTheDocument()
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/beneficio/b1')
  })
})
```

- [ ] **Step 6: Rodar — ver falhar**

Run: `npm test -- src/features/benefits/BenefitCard.test.tsx` → FAIL.

- [ ] **Step 7: Implementar BenefitCard**

Create `src/features/benefits/BenefitCard.tsx`:
```tsx
import { Link } from 'react-router-dom'
import type { MyBenefit } from './types'

export function BenefitCard({ benefit }: { benefit: MyBenefit }) {
  return (
    <Link
      to={`/beneficio/${benefit.id}`}
      className="block rounded-xl border border-slate-200 p-4 hover:border-slate-300"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{benefit.title}</h3>
        {benefit.partner_name && (
          <span className="shrink-0 text-xs text-slate-500">{benefit.partner_name}</span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-600">{benefit.summary}</p>
      {benefit.via.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">via {benefit.via.join(', ')}</p>
      )}
    </Link>
  )
}
```

- [ ] **Step 8: Rodar — ver passar**

Run: `npm test -- src/features/benefits/BenefitCard.test.tsx` → PASS.

- [ ] **Step 9: Teste do CategoryChips (falha)**

Create `src/features/benefits/CategoryChips.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CategoryChips } from './CategoryChips'

describe('CategoryChips', () => {
  it('renderiza "Todos" + categorias e dispara onChange', () => {
    const onChange = vi.fn()
    render(<CategoryChips selected={null} onChange={onChange} />)
    expect(screen.getByRole('button', { name: /todos/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /viagem/i }))
    expect(onChange).toHaveBeenCalledWith('viagem')
  })

  it('clicar na categoria já selecionada limpa (volta a null)', () => {
    const onChange = vi.fn()
    render(<CategoryChips selected={'viagem'} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /viagem/i }))
    expect(onChange).toHaveBeenCalledWith(null)
  })
})
```

- [ ] **Step 10: Rodar — ver falhar**, depois implementar.

Run: `npm test -- src/features/benefits/CategoryChips.test.tsx` → FAIL.

Create `src/features/benefits/CategoryChips.tsx`:
```tsx
import { CATEGORIES, type BenefitCategory } from './types'

export function CategoryChips({
  selected,
  onChange,
}: {
  selected: BenefitCategory | null
  onChange: (c: BenefitCategory | null) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={
          'shrink-0 rounded-full border px-3 py-1 text-sm ' +
          (selected === null ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 text-slate-700')
        }
      >
        Todos
      </button>
      {CATEGORIES.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChange(selected === c.key ? null : c.key)}
          className={
            'shrink-0 rounded-full border px-3 py-1 text-sm ' +
            (selected === c.key ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 text-slate-700')
          }
        >
          {c.emoji} {c.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 11: Rodar — ver passar**

Run: `npm test -- src/features/benefits/CategoryChips.test.tsx` → PASS.

- [ ] **Step 12: Commit**

```bash
git add src/features/benefits/filterBenefits.ts src/features/benefits/filterBenefits.test.ts src/features/benefits/BenefitCard.tsx src/features/benefits/BenefitCard.test.tsx src/features/benefits/CategoryChips.tsx src/features/benefits/CategoryChips.test.tsx
git commit -m "feat: filtro puro + BenefitCard + CategoryChips"
```

---

## Task 3: Página Painel (dashboard)

**Files:**
- Create: `src/features/painel/Painel.tsx` (+ `.test.tsx`)

- [ ] **Step 1: Teste do Painel (falha) — com hooks mockados**

Create `src/features/painel/Painel.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { MyBenefit } from '../benefits/types'

vi.mock('../auth/AuthProvider', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}))

let result: { data: MyBenefit[] | undefined; isLoading: boolean; error: unknown }
vi.mock('../benefits/useMyBenefits', () => ({
  useMyBenefits: () => result,
}))

const mk = (over: Partial<MyBenefit>): MyBenefit => ({
  id: 'x', title: 'T', summary: 'S', category: 'compras', scope: 'nacional', uf: null,
  steps: null, partner_name: null, valid_until: null, image_url: null, action_url: null,
  action_label: null, created_at: '', via: [], ...over,
})

import { Painel } from './Painel'

beforeEach(() => {
  result = { data: undefined, isLoading: false, error: null }
})

describe('Painel', () => {
  it('mostra a contagem e o feed', () => {
    result = {
      data: [mk({ id: '1', title: 'Sala VIP', category: 'viagem' }), mk({ id: '2', title: 'Cinema', category: 'entretenimento' })],
      isLoading: false, error: null,
    }
    renderWithProviders(<Painel />)
    expect(screen.getByText(/2 benefícios ativos/i)).toBeInTheDocument()
    expect(screen.getByText('Sala VIP')).toBeInTheDocument()
    expect(screen.getByText('Cinema')).toBeInTheDocument()
  })

  it('filtra o feed ao escolher uma categoria', () => {
    result = {
      data: [mk({ id: '1', title: 'Sala VIP', category: 'viagem' }), mk({ id: '2', title: 'Cinema', category: 'entretenimento' })],
      isLoading: false, error: null,
    }
    renderWithProviders(<Painel />)
    screen.getByRole('button', { name: /viagem/i }).click()
    expect(screen.getByText('Sala VIP')).toBeInTheDocument()
    expect(screen.queryByText('Cinema')).not.toBeInTheDocument()
  })

  it('estado vazio quando não há benefícios', () => {
    result = { data: [], isLoading: false, error: null }
    renderWithProviders(<Painel />)
    expect(screen.getByText(/nenhum benefício/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**

Run: `npm test -- src/features/painel/Painel.test.tsx` → FAIL.

- [ ] **Step 3: Implementar Painel**

Create `src/features/painel/Painel.tsx`:
```tsx
import { useState } from 'react'
import { useSession } from '../auth/AuthProvider'
import { useMyBenefits } from '../benefits/useMyBenefits'
import { filterBenefits } from '../benefits/filterBenefits'
import { BenefitCard } from '../benefits/BenefitCard'
import { CategoryChips } from '../benefits/CategoryChips'
import type { BenefitCategory } from '../benefits/types'

export function Painel() {
  const { session } = useSession()
  const { data, isLoading, error } = useMyBenefits(session?.user.id)
  const [category, setCategory] = useState<BenefitCategory | null>(null)

  if (isLoading) return <p className="p-6 text-slate-500">Carregando…</p>
  if (error) return <p className="p-6 text-red-600">Não foi possível carregar seus benefícios.</p>

  const all = data ?? []
  const highlight = category ? undefined : all[0]
  const visible = filterBenefits(all, { category, text: '' }).filter(
    (b) => b.id !== highlight?.id,
  )

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-24">
      <header>
        <h1 className="text-2xl font-bold text-slate-900">
          Você tem {all.length} benefício{all.length === 1 ? '' : 's'} ativo{all.length === 1 ? '' : 's'}.
        </h1>
      </header>

      {highlight && (
        <div className="rounded-xl bg-slate-900 p-4 text-white">
          <p className="text-xs uppercase tracking-wide text-slate-300">💡 Destaque</p>
          <p className="mt-1 font-semibold">{highlight.title}</p>
          <p className="mt-1 text-sm text-slate-200">{highlight.summary}</p>
        </div>
      )}

      <CategoryChips selected={category} onChange={setCategory} />

      {all.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-slate-500">
          Nenhum benefício encontrado. Refaça a varredura para incluir mais fontes.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map((b) => (
            <BenefitCard key={b.id} benefit={b} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Rodar — ver passar**

Run: `npm test -- src/features/painel/Painel.test.tsx` → PASS (3 casos).

- [ ] **Step 5: Commit**

```bash
git add src/features/painel/Painel.tsx src/features/painel/Painel.test.tsx
git commit -m "feat: página Painel (dashboard com destaque, chips e feed)"
```

---

## Task 4: Tela de detalhe do benefício

**Files:**
- Create: `src/features/benefits/useBenefit.ts`, `src/features/detalhe/BenefitDetail.tsx` (+ `.test.tsx`)

- [ ] **Step 1: Hook que deriva um benefício por id**

Create `src/features/benefits/useBenefit.ts`:
```ts
import { useMyBenefits } from './useMyBenefits'
import type { MyBenefit } from './types'

export function useBenefit(userId: string | undefined, id: string | undefined) {
  const q = useMyBenefits(userId)
  const benefit: MyBenefit | undefined = (q.data ?? []).find((b) => b.id === id)
  return { ...q, benefit }
}
```

- [ ] **Step 2: Teste do detalhe (falha)**

Create `src/features/detalhe/BenefitDetail.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { MyBenefit } from '../benefits/types'

vi.mock('../auth/AuthProvider', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}))
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>()
  return { ...actual, useParams: () => ({ id: 'b1' }) }
})

let result: { data: MyBenefit[] | undefined; isLoading: boolean; error: unknown }
vi.mock('../benefits/useMyBenefits', () => ({ useMyBenefits: () => result }))

const b: MyBenefit = {
  id: 'b1', title: 'Seguro Viagem', summary: 'Cobertura internacional', category: 'viagem',
  scope: 'nacional', uf: null, steps: '1. Emita a apólice\n2. Apresente o bilhete',
  partner_name: 'C6', valid_until: null, image_url: null, action_url: 'https://x.test',
  action_label: 'Emitir', created_at: '', via: ['Carbon'],
}

import { BenefitDetail } from './BenefitDetail'

beforeEach(() => {
  result = { data: [b], isLoading: false, error: null }
})

describe('BenefitDetail', () => {
  it('mostra título, via, passos e o botão de ação', () => {
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    expect(screen.getByText('Seguro Viagem')).toBeInTheDocument()
    expect(screen.getByText(/Carbon/)).toBeInTheDocument()
    expect(screen.getByText(/Emita a apólice/)).toBeInTheDocument()
    const action = screen.getByRole('link', { name: /emitir/i })
    expect(action).toHaveAttribute('href', 'https://x.test')
  })

  it('mostra "não encontrado" quando o id não está na lista', () => {
    result = { data: [], isLoading: false, error: null }
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    expect(screen.getByText(/não encontrado/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Rodar — ver falhar**

Run: `npm test -- src/features/detalhe/BenefitDetail.test.tsx` → FAIL.

- [ ] **Step 4: Implementar BenefitDetail**

Create `src/features/detalhe/BenefitDetail.tsx`:
```tsx
import { Link, useParams } from 'react-router-dom'
import { useSession } from '../auth/AuthProvider'
import { useBenefit } from '../benefits/useBenefit'

export function BenefitDetail() {
  const { id } = useParams()
  const { session } = useSession()
  const { benefit, isLoading, error } = useBenefit(session?.user.id, id)

  if (isLoading) return <p className="p-6 text-slate-500">Carregando…</p>
  if (error) return <p className="p-6 text-red-600">Erro ao carregar o benefício.</p>
  if (!benefit) {
    return (
      <div className="p-6">
        <Link to="/painel" className="text-sm text-slate-500">← Voltar</Link>
        <p className="mt-4 text-slate-700">Benefício não encontrado.</p>
      </div>
    )
  }

  const steps = (benefit.steps ?? '').split('\n').map((s) => s.trim()).filter(Boolean)

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Link to="/painel" className="text-sm text-slate-500">← Voltar</Link>
      <h1 className="text-2xl font-bold text-slate-900">{benefit.title}</h1>
      {benefit.via.length > 0 && (
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          via {benefit.via.join(', ')}
        </span>
      )}
      <p className="text-slate-700">{benefit.summary}</p>

      {steps.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold text-slate-900">Como usar</h2>
          <ol className="flex flex-col gap-1 text-sm text-slate-700">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {benefit.action_url && (
        <a
          href={benefit.action_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 rounded-lg bg-slate-800 px-4 py-3 text-center font-medium text-white"
        >
          {benefit.action_label ?? 'Resgatar benefício'}
        </a>
      )}
    </div>
  )
}
```

- [ ] **Step 5: Rodar — ver passar**

Run: `npm test -- src/features/detalhe/BenefitDetail.test.tsx` → PASS (2 casos).

- [ ] **Step 6: Commit**

```bash
git add src/features/benefits/useBenefit.ts src/features/detalhe/BenefitDetail.tsx src/features/detalhe/BenefitDetail.test.tsx
git commit -m "feat: tela de detalhe do benefício"
```

---

## Task 5: Tela de busca

**Files:**
- Create: `src/features/busca/Search.tsx` (+ `.test.tsx`)

- [ ] **Step 1: Teste da busca (falha)**

Create `src/features/busca/Search.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { MyBenefit } from '../benefits/types'

vi.mock('../auth/AuthProvider', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}))

let result: { data: MyBenefit[] | undefined; isLoading: boolean; error: unknown }
vi.mock('../benefits/useMyBenefits', () => ({ useMyBenefits: () => result }))

const mk = (over: Partial<MyBenefit>): MyBenefit => ({
  id: 'x', title: 'T', summary: 'S', category: 'compras', scope: 'nacional', uf: null,
  steps: null, partner_name: null, valid_until: null, image_url: null, action_url: null,
  action_label: null, created_at: '', via: [], ...over,
})

import { Search } from './Search'

beforeEach(() => {
  result = {
    data: [mk({ id: '1', title: 'Sala VIP', partner_name: 'Mastercard' }), mk({ id: '2', title: 'Cinema', partner_name: 'Cinemark' })],
    isLoading: false, error: null,
  }
})

describe('Search', () => {
  it('filtra ao digitar', () => {
    renderWithProviders(<Search />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'cine' } })
    expect(screen.getByText('Cinema')).toBeInTheDocument()
    expect(screen.queryByText('Sala VIP')).not.toBeInTheDocument()
  })

  it('mostra dica quando nada corresponde', () => {
    renderWithProviders(<Search />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } })
    expect(screen.getByText(/nada encontrado/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**

Run: `npm test -- src/features/busca/Search.test.tsx` → FAIL.

- [ ] **Step 3: Implementar Search**

Create `src/features/busca/Search.tsx`:
```tsx
import { useState } from 'react'
import { useSession } from '../auth/AuthProvider'
import { useMyBenefits } from '../benefits/useMyBenefits'
import { filterBenefits } from '../benefits/filterBenefits'
import { BenefitCard } from '../benefits/BenefitCard'
import { CategoryChips } from '../benefits/CategoryChips'
import type { BenefitCategory } from '../benefits/types'

export function Search() {
  const { session } = useSession()
  const { data, isLoading, error } = useMyBenefits(session?.user.id)
  const [text, setText] = useState('')
  const [category, setCategory] = useState<BenefitCategory | null>(null)

  const all = data ?? []
  const results = filterBenefits(all, { category, text })

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-24">
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Digite uma loja, produto ou benefício…"
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
      />
      <CategoryChips selected={category} onChange={setCategory} />

      {isLoading && <p className="text-slate-500">Carregando…</p>}
      {error && <p className="text-red-600">Erro ao carregar.</p>}
      {!isLoading && !error && results.length === 0 && (
        <p className="text-slate-500">Nada encontrado.</p>
      )}
      <div className="flex flex-col gap-3">
        {results.map((b) => (
          <BenefitCard key={b.id} benefit={b} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Rodar — ver passar**

Run: `npm test -- src/features/busca/Search.test.tsx` → PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/busca/Search.tsx src/features/busca/Search.test.tsx
git commit -m "feat: tela de busca (filtro texto + categoria)"
```

---

## Task 6: Layout + nav inferior + roteamento + fechamento

**Files:**
- Create: `src/features/layout/AppLayout.tsx`, `src/features/layout/BottomNav.tsx` (+ `.test.tsx`)
- Modify: `src/router.tsx`
- Delete: `src/features/painel/PainelPlaceholder.tsx`, `src/features/painel/PainelPlaceholder.test.tsx`, `src/features/benefits/useMyBenefitsCount.ts`

- [ ] **Step 1: Teste do BottomNav (falha)**

Create `src/features/layout/BottomNav.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import { BottomNav } from './BottomNav'

describe('BottomNav', () => {
  it('tem links para Painel e Buscar', () => {
    renderWithProviders(<BottomNav />, { route: '/painel' })
    expect(screen.getByRole('link', { name: /painel/i })).toHaveAttribute('href', '/painel')
    expect(screen.getByRole('link', { name: /buscar/i })).toHaveAttribute('href', '/buscar')
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**, depois implementar.

Run: `npm test -- src/features/layout/BottomNav.test.tsx` → FAIL.

Create `src/features/layout/BottomNav.tsx`:
```tsx
import { NavLink } from 'react-router-dom'

const items = [
  { to: '/painel', label: 'Painel', emoji: '🏠' },
  { to: '/buscar', label: 'Buscar', emoji: '🔎' },
]

export function BottomNav() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white">
      <div className="mx-auto flex max-w-md">
        {items.map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) =>
              'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs ' +
              (isActive ? 'text-slate-900' : 'text-slate-400')
            }
          >
            <span aria-hidden>{it.emoji}</span>
            {it.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
```

- [ ] **Step 3: Rodar — ver passar**

Run: `npm test -- src/features/layout/BottomNav.test.tsx` → PASS.

- [ ] **Step 4: AppLayout**

Create `src/features/layout/AppLayout.tsx`:
```tsx
import { Outlet } from 'react-router-dom'
import { BottomNav } from './BottomNav'

export function AppLayout() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Outlet />
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 5: Remover PainelPlaceholder e useMyBenefitsCount**

Run:
```bash
git rm src/features/painel/PainelPlaceholder.tsx src/features/painel/PainelPlaceholder.test.tsx src/features/benefits/useMyBenefitsCount.ts
```

- [ ] **Step 6: Atualizar `src/router.tsx`**

Replace `src/router.tsx`:
```tsx
import { createBrowserRouter } from 'react-router-dom'
import { BootstrapRoute } from './features/bootstrap/BootstrapRoute'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { AppLayout } from './features/layout/AppLayout'
import { Painel } from './features/painel/Painel'
import { Search } from './features/busca/Search'
import { BenefitDetail } from './features/detalhe/BenefitDetail'

export const router = createBrowserRouter([
  { path: '/', element: <BootstrapRoute /> },
  { path: '/onboarding', element: <OnboardingPage /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/painel', element: <Painel /> },
      { path: '/buscar', element: <Search /> },
    ],
  },
  { path: '/beneficio/:id', element: <BenefitDetail /> },
])
```

- [ ] **Step 7: Build completo**

Run: `npm run build`
Expected: PASS. Se houver erro de referência a `PainelPlaceholder`/`useMyBenefitsCount` em algum lugar, remova o uso (não deve haver — só o router os referenciava).

- [ ] **Step 8: Suíte inteira**

Run: `npm test`
Expected: TODOS verdes (M1 + M2 + M3). Se algum teste antigo referenciava `PainelPlaceholder`/`useMyBenefitsCount`, ele foi removido junto no Step 5 — confirme que não sobrou import quebrado.

- [ ] **Step 9: Commit**

```bash
git add src/features/layout/ src/router.tsx
git commit -m "feat: layout com nav inferior, rotas do painel/busca/detalhe e fechamento do M3"
```

---

## Definition of Done (M3)

- [ ] `npm test` passa inteiro (M1 + M2 + M3: filtro/cards/painel/detalhe/busca/nav + integração da view dedup).
- [ ] `npm run build` compila ponta a ponta.
- [ ] View `my_benefits` retorna 1 linha por benefício com `via text[]`; integração comprova agregação (Cinemark via Black+Platinum).
- [ ] Painel mostra contagem, destaque, chips e feed; categoria filtra; estado vazio tratado.
- [ ] Detalhe mostra via, passos e ação; id inexistente tratado.
- [ ] Busca filtra por texto+categoria; sem-resultado tratado.
- [ ] Nav inferior entre Painel e Buscar; detalhe é tela cheia com voltar.
- [ ] Verificação manual sugerida: `npm run dev`, onboarding → painel → abrir detalhe → buscar.

**Próximo (M4 sugerido):** Perfil (editar fontes / upgrade de conta anônima → email/Google), PWA (manifest + service worker), e deploy no Dokploy (front + Supabase self-hosted).
```
