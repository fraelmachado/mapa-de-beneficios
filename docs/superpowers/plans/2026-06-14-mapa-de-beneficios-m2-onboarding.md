# Mapa de Benefícios M2 — App shell + auth anônimo + onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status de execução (auditado em 2026-07-10):** implementação concluída no repositório (`f6893f1` a `4f164f8`). O fluxo está coberto pela suíte cumulativa aprovada. Os checklists abaixo permanecem como roteiro histórico e não foram marcados retroativamente.

**Goal:** App PWA navegável onde o usuário entra (sessão anônima Supabase), faz a varredura em 3 passos selecionando o que possui, e cai num painel que já mostra a contagem real de benefícios cruzados.

**Architecture:** SPA React com React Router (rotas) e TanStack Query (estado de servidor: cache/loading/error). Auth anônimo do Supabase cria um usuário real no primeiro acesso; o perfil é criado pelo trigger do M1. O onboarding lê `sources`/`source_items` (catálogo M1), coleta a seleção em estado local, e grava em `user_sources`. Um `/painel` mínimo lê a view `my_benefits` (contagem distinta) — o painel completo é o M3.

**Tech Stack:** React 18, TypeScript, Vite, Tailwind, TanStack Query v5, React Router v6, Supabase JS, Vitest + Testing Library.

**Pré-requisito:** M1 mergeado na `main` (Supabase local com migrations 0001–0004 + seed). Docker/OrbStack rodando. `.env.local` presente.

**Referência:** spec `docs/superpowers/specs/2026-06-13-mapa-de-beneficios-mvp-design.md`; M1 plan `docs/superpowers/plans/2026-06-13-mapa-de-beneficios-m1-foundation.md`.

---

## Estrutura de arquivos (criada/modificada no M2)

```
supabase/config.toml                       # MODIFICA: enable_anonymous_sign_ins = true
src/
  main.tsx                                 # MODIFICA: QueryClientProvider + AuthProvider + RouterProvider
  lib/queryClient.ts                       # CRIA: QueryClient compartilhado
  router.tsx                               # CRIA: definição de rotas
  test/renderWithProviders.tsx             # CRIA: util de teste (Query + Router + Auth)
  features/
    auth/
      auth.ts                              # CRIA: ensureAnonymousSession()
      AuthProvider.tsx                     # CRIA: contexto de sessão + useSession()
    onboarding/
      types.ts                             # CRIA: tipos Source/SourceItem
      groupSources.ts                      # CRIA: pura — agrupa por kind
      groupSources.test.ts                 # CRIA
      selection.ts                         # CRIA: pura — reducer de seleção
      selection.test.ts                    # CRIA
      useSources.ts                        # CRIA: query do catálogo
      useSaveUserSources.ts                # CRIA: mutation grava user_sources
      OnboardingPage.tsx                   # CRIA: fluxo 3 passos + progresso
      TransitionScreen.tsx                 # CRIA: "cruzando dados…"
      OnboardingPage.test.tsx              # CRIA: teste de componente (mocks)
    benefits/
      useMyBenefitsCount.ts               # CRIA: contagem distinta de my_benefits
    bootstrap/
      BootstrapRoute.tsx                   # CRIA: "/" decide onboarding vs painel
      useHasOnboarded.ts                   # CRIA: query user_sources count
    painel/
      PainelPlaceholder.tsx                # CRIA: painel mínimo (contagem)
tests/
  auth_anon.integration.test.ts           # CRIA: anon sign-in habilitado (Supabase real)
  onboarding_save.integration.test.ts     # CRIA: salvar seleção e contar benefícios (real)
```

---

## Task 1: Dependências + providers + roteamento base

**Files:**
- Modify: `src/main.tsx`
- Create: `src/lib/queryClient.ts`, `src/router.tsx`, `src/test/renderWithProviders.tsx`
- Test: `src/router.test.tsx`

- [ ] **Step 1: Instalar deps**

Run:
```bash
npm install @tanstack/react-query react-router-dom
```

- [ ] **Step 2: QueryClient compartilhado**

Create `src/lib/queryClient.ts`:
```ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
  },
})
```

- [ ] **Step 3: Rotas**

Create `src/router.tsx`:
```tsx
import { createBrowserRouter } from 'react-router-dom'
import { BootstrapRoute } from './features/bootstrap/BootstrapRoute'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { PainelPlaceholder } from './features/painel/PainelPlaceholder'

export const router = createBrowserRouter([
  { path: '/', element: <BootstrapRoute /> },
  { path: '/onboarding', element: <OnboardingPage /> },
  { path: '/painel', element: <PainelPlaceholder /> },
])
```
NOTA: este arquivo só compila depois das Tasks 5/7 (que criam os componentes importados). Por isso o teste desta task (Step 6) NÃO importa `router.tsx`; ele valida o QueryClient. `router.tsx` é finalizado e exercitado na Task 7.

- [ ] **Step 4: Util de teste com providers**

Create `src/test/renderWithProviders.tsx`:
```tsx
import { ReactElement, ReactNode } from 'react'
import { render } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </QueryClientProvider>
  )
  return render(ui, { wrapper })
}
```

- [ ] **Step 5: Falha primeiro — teste do QueryClient**

Create `src/router.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { queryClient } from './lib/queryClient'

describe('infra', () => {
  it('expõe um QueryClient configurado', () => {
    expect(queryClient).toBeDefined()
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(false)
  })
})
```

- [ ] **Step 6: Rodar — ver passar**

Run: `npm test -- src/router.test.tsx`
Expected: PASS (o módulo queryClient existe e está configurado).

- [ ] **Step 7: Atualizar `main.tsx`**

Replace `src/main.tsx`:
```tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from 'react-router-dom'
import { queryClient } from './lib/queryClient'
import { AuthProvider } from './features/auth/AuthProvider'
import { router } from './router'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>,
)
```
NOTA: `main.tsx` importa `AuthProvider` (Task 2) e `router` (Tasks 5/7). NÃO rode `npm run build` ao fim desta task — o build só volta a passar na Task 7. O teste desta task (Step 6) não depende desses imports.

- [ ] **Step 8: Commit**

```bash
git add src/lib/queryClient.ts src/router.tsx src/test/renderWithProviders.tsx src/router.test.tsx src/main.tsx package.json package-lock.json
git commit -m "feat: providers (TanStack Query + Router) e util de teste"
```

---

## Task 2: Auth anônimo (config + provider)

**Files:**
- Modify: `supabase/config.toml`
- Create: `src/features/auth/auth.ts`, `src/features/auth/AuthProvider.tsx`
- Test: `tests/auth_anon.integration.test.ts`

- [ ] **Step 1: Habilitar anonymous sign-ins**

Edit `supabase/config.toml` linha ~178: troque
```
enable_anonymous_sign_ins = false
```
por
```
enable_anonymous_sign_ins = true
```

- [ ] **Step 2: Reiniciar o Supabase (config de auth só recarrega no restart)**

Run:
```bash
npx supabase stop
npx supabase start
```
(`db reset` NÃO recarrega config de auth — tem que ser stop/start.)

- [ ] **Step 3: Teste de integração que falha — anon sign-in**

Create `tests/auth_anon.integration.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL!
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!

describe('auth anônimo', () => {
  it('permite sign-in anônimo e cria usuário', async () => {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await client.auth.signInAnonymously()
    expect(error).toBeNull()
    expect(data.user?.id).toBeTruthy()
    expect(data.user?.is_anonymous).toBe(true)
  })
})
```

- [ ] **Step 4: Rodar — ver passar** (config já reiniciada no Step 2)

Run: `npm test -- tests/auth_anon.integration.test.ts`
Expected: PASS. Se falhar com "Anonymous sign-ins are disabled", o restart do Step 2 não pegou — rode `npx supabase stop && npx supabase start` de novo.

- [ ] **Step 5: Helper de sessão**

Create `src/features/auth/auth.ts`:
```ts
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

// Garante uma sessão: usa a existente ou cria uma anônima.
export async function ensureAnonymousSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  if (data.session) return data.session
  const { data: signIn, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  return signIn.session
}
```

- [ ] **Step 6: AuthProvider + useSession**

Create `src/features/auth/AuthProvider.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { ensureAnonymousSession } from './auth'

type AuthState = { session: Session | null; loading: boolean }

const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    ensureAnonymousSession()
      .then((s) => {
        if (active) setSession(s)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (active) setSession(s)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>
}

export function useSession(): AuthState {
  return useContext(AuthContext)
}
```

- [ ] **Step 7: Commit**

```bash
git add supabase/config.toml src/features/auth/ tests/auth_anon.integration.test.ts
git commit -m "feat: auth anônimo (config + AuthProvider/useSession)"
```

---

## Task 3: Catálogo — tipos, agrupamento e hook de query

**Files:**
- Create: `src/features/onboarding/types.ts`, `groupSources.ts`, `groupSources.test.ts`, `useSources.ts`

- [ ] **Step 1: Tipos**

Create `src/features/onboarding/types.ts`:
```ts
export type SourceKind = 'card' | 'carrier' | 'loyalty' | 'cpf'

export interface SourceItem {
  id: string
  label: string
  sort_order: number
}

export interface Source {
  id: string
  kind: SourceKind
  name: string
  logo_url: string | null
  sort_order: number
  source_items: SourceItem[]
}

export type GroupedSources = Record<SourceKind, Source[]>
```

- [ ] **Step 2: Teste da função pura de agrupamento (falha primeiro)**

Create `src/features/onboarding/groupSources.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { groupSourcesByKind } from './groupSources'
import type { Source } from './types'

const sources: Source[] = [
  { id: 's2', kind: 'carrier', name: 'Claro', logo_url: null, sort_order: 2, source_items: [{ id: 'i3', label: 'Pós', sort_order: 1 }] },
  { id: 's1', kind: 'card', name: 'Itaú', logo_url: null, sort_order: 1, source_items: [
    { id: 'i2', label: 'Platinum', sort_order: 2 },
    { id: 'i1', label: 'Black', sort_order: 1 },
  ] },
]

describe('groupSourcesByKind', () => {
  it('agrupa por kind e ordena sources e items por sort_order', () => {
    const g = groupSourcesByKind(sources)
    expect(Object.keys(g)).toContain('card')
    expect(Object.keys(g)).toContain('carrier')
    expect(g.card[0].name).toBe('Itaú')
    expect(g.card[0].source_items.map((i) => i.label)).toEqual(['Black', 'Platinum'])
  })

  it('retorna grupos vazios ausentes como undefined-safe', () => {
    const g = groupSourcesByKind([])
    expect(g.card ?? []).toEqual([])
  })
})
```

- [ ] **Step 3: Rodar — ver falhar**

Run: `npm test -- src/features/onboarding/groupSources.test.ts`
Expected: FAIL (módulo groupSources não existe).

- [ ] **Step 4: Implementar agrupamento**

Create `src/features/onboarding/groupSources.ts`:
```ts
import type { GroupedSources, Source } from './types'

export function groupSourcesByKind(sources: Source[]): GroupedSources {
  const out = {} as GroupedSources
  const ordered = [...sources].sort((a, b) => a.sort_order - b.sort_order)
  for (const s of ordered) {
    const withSortedItems: Source = {
      ...s,
      source_items: [...s.source_items].sort((a, b) => a.sort_order - b.sort_order),
    }
    ;(out[s.kind] ??= []).push(withSortedItems)
  }
  return out
}
```

- [ ] **Step 5: Rodar — ver passar**

Run: `npm test -- src/features/onboarding/groupSources.test.ts`
Expected: PASS.

- [ ] **Step 6: Hook de query do catálogo**

Create `src/features/onboarding/useSources.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { groupSourcesByKind } from './groupSources'
import type { Source } from './types'

export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sources')
        .select('id, kind, name, logo_url, sort_order, source_items(id, label, sort_order)')
        .eq('active', true)
      if (error) throw error
      return groupSourcesByKind((data ?? []) as unknown as Source[])
    },
  })
}
```

- [ ] **Step 7: Build sanity (tipos compilam)**

Run: `npm run build`
Expected: FALHA esperada se as Tasks 5/7 ainda não existirem (imports de router). Se falhar APENAS por imports ainda inexistentes de `OnboardingPage`/`PainelPlaceholder`/`BootstrapRoute`/`AuthProvider`, tudo bem — esses vêm nas próximas tasks. NÃO crie stubs; apenas confirme que os arquivos DESTA task não têm erros de tipo rodando `npx tsc --noEmit 2>&1 | grep -i onboarding/ || echo "sem erros nos arquivos desta task"`.

- [ ] **Step 8: Commit**

```bash
git add src/features/onboarding/types.ts src/features/onboarding/groupSources.ts src/features/onboarding/groupSources.test.ts src/features/onboarding/useSources.ts
git commit -m "feat: catálogo — tipos, agrupamento por kind e hook useSources"
```

---

## Task 4: Reducer de seleção (lógica pura)

**Files:**
- Create: `src/features/onboarding/selection.ts`, `selection.test.ts`

- [ ] **Step 1: Teste que falha**

Create `src/features/onboarding/selection.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { selectionReducer, type SelectionState } from './selection'

describe('selectionReducer', () => {
  it('adiciona e remove um item ao alternar', () => {
    let s: SelectionState = new Set()
    s = selectionReducer(s, { type: 'toggle', itemId: 'a' })
    expect(s.has('a')).toBe(true)
    s = selectionReducer(s, { type: 'toggle', itemId: 'a' })
    expect(s.has('a')).toBe(false)
  })

  it('mantém múltiplos itens', () => {
    let s: SelectionState = new Set()
    s = selectionReducer(s, { type: 'toggle', itemId: 'a' })
    s = selectionReducer(s, { type: 'toggle', itemId: 'b' })
    expect([...s].sort()).toEqual(['a', 'b'])
  })

  it('reset limpa tudo', () => {
    let s: SelectionState = new Set(['a', 'b'])
    s = selectionReducer(s, { type: 'reset' })
    expect(s.size).toBe(0)
  })

  it('é imutável (não muta o estado de entrada)', () => {
    const s: SelectionState = new Set(['a'])
    const next = selectionReducer(s, { type: 'toggle', itemId: 'b' })
    expect(s.has('b')).toBe(false)
    expect(next.has('b')).toBe(true)
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**

Run: `npm test -- src/features/onboarding/selection.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar reducer**

Create `src/features/onboarding/selection.ts`:
```ts
export type SelectionState = Set<string>

export type SelectionAction =
  | { type: 'toggle'; itemId: string }
  | { type: 'reset' }

export function selectionReducer(
  state: SelectionState,
  action: SelectionAction,
): SelectionState {
  switch (action.type) {
    case 'toggle': {
      const next = new Set(state)
      if (next.has(action.itemId)) next.delete(action.itemId)
      else next.add(action.itemId)
      return next
    }
    case 'reset':
      return new Set()
  }
}
```

- [ ] **Step 4: Rodar — ver passar**

Run: `npm test -- src/features/onboarding/selection.test.ts`
Expected: PASS (4 casos).

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/selection.ts src/features/onboarding/selection.test.ts
git commit -m "feat: reducer de seleção do onboarding"
```

---

## Task 5: Mutation de gravação + tela de transição + página de onboarding

**Files:**
- Create: `src/features/onboarding/useSaveUserSources.ts`, `TransitionScreen.tsx`, `OnboardingPage.tsx`, `OnboardingPage.test.tsx`
- Test: `src/features/onboarding/OnboardingPage.test.tsx`

- [ ] **Step 1: Mutation que grava user_sources**

Create `src/features/onboarding/useSaveUserSources.ts`:
```ts
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { queryClient } from '../../lib/queryClient'

// Regrava a seleção do usuário: limpa as anteriores e insere as novas.
export function useSaveUserSources() {
  return useMutation({
    mutationFn: async (itemIds: string[]) => {
      const { data: u, error: userErr } = await supabase.auth.getUser()
      if (userErr || !u.user) throw userErr ?? new Error('sem usuário')
      const userId = u.user.id
      const del = await supabase.from('user_sources').delete().eq('user_id', userId)
      if (del.error) throw del.error
      if (itemIds.length) {
        const rows = itemIds.map((id) => ({ user_id: userId, source_item_id: id }))
        const { error } = await supabase.from('user_sources').insert(rows)
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_benefits_count'] })
      queryClient.invalidateQueries({ queryKey: ['has_onboarded'] })
    },
  })
}
```

- [ ] **Step 2: Tela de transição**

Create `src/features/onboarding/TransitionScreen.tsx`:
```tsx
export function TransitionScreen() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <div
        className="h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-700"
        role="status"
        aria-label="Carregando"
      />
      <p className="text-lg font-medium text-slate-700">Cruzando seus dados com nossa base…</p>
      <p className="text-sm text-slate-500">Buscando benefícios escondidos pra você.</p>
    </div>
  )
}
```

- [ ] **Step 3: Teste de componente que falha (com mocks)**

Create `src/features/onboarding/OnboardingPage.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { GroupedSources } from './types'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

const saveMutate = vi.fn()
vi.mock('./useSaveUserSources', () => ({
  useSaveUserSources: () => ({ mutateAsync: saveMutate, isPending: false }),
}))

const grouped: GroupedSources = {
  card: [
    { id: 's1', kind: 'card', name: 'Itaú', logo_url: null, sort_order: 1, source_items: [
      { id: 'i1', label: 'Black', sort_order: 1 },
    ] },
  ],
  carrier: [
    { id: 's2', kind: 'carrier', name: 'Claro', logo_url: null, sort_order: 1, source_items: [
      { id: 'i2', label: 'Pós', sort_order: 1 },
    ] },
  ],
  loyalty: [
    { id: 's3', kind: 'loyalty', name: 'Livelo', logo_url: null, sort_order: 1, source_items: [
      { id: 'i3', label: '—', sort_order: 1 },
    ] },
  ],
  cpf: [],
} as GroupedSources
vi.mock('./useSources', () => ({
  useSources: () => ({ data: grouped, isLoading: false, error: null }),
}))

beforeEach(() => {
  navigateMock.mockReset()
  saveMutate.mockReset()
  saveMutate.mockResolvedValue(undefined)
})

import { OnboardingPage } from './OnboardingPage'

describe('OnboardingPage', () => {
  it('navega pelos 3 passos, salva a seleção e vai pro painel', async () => {
    renderWithProviders(<OnboardingPage />)

    // Passo 1: cartões
    fireEvent.click(screen.getByText('Itaú'))
    fireEvent.click(screen.getByRole('button', { name: /black/i }))
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))

    // Passo 2: operadora
    fireEvent.click(screen.getByText('Claro'))
    fireEvent.click(screen.getByRole('button', { name: /pós/i }))
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))

    // Passo 3: fidelidade -> concluir
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))

    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith(expect.arrayContaining(['i1', 'i2'])))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/painel'))
  })
})
```

- [ ] **Step 4: Rodar — ver falhar**

Run: `npm test -- src/features/onboarding/OnboardingPage.test.tsx`
Expected: FAIL (OnboardingPage não existe).

- [ ] **Step 5: Implementar a página de onboarding**

Create `src/features/onboarding/OnboardingPage.tsx`:
```tsx
import { useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSources } from './useSources'
import { selectionReducer } from './selection'
import { useSaveUserSources } from './useSaveUserSources'
import { TransitionScreen } from './TransitionScreen'
import type { Source, SourceKind } from './types'

const STEPS: { kinds: SourceKind[]; title: string; cta: string }[] = [
  { kinds: ['card'], title: 'Quais cartões ou bancos você usa?', cta: 'Avançar' },
  { kinds: ['carrier'], title: 'Qual sua operadora?', cta: 'Avançar' },
  { kinds: ['loyalty', 'cpf'], title: 'Programas de fidelidade?', cta: 'Concluir' },
]

function SourceBlock({
  source,
  selected,
  onToggle,
}: {
  source: Source
  selected: Set<string>
  onToggle: (itemId: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <button
        type="button"
        className="w-full text-left font-medium"
        onClick={() => setOpen((o) => !o)}
      >
        {source.name}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-2">
          {source.source_items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onToggle(it.id)}
              className={
                'rounded-full border px-3 py-1 text-sm ' +
                (selected.has(it.id)
                  ? 'border-slate-800 bg-slate-800 text-white'
                  : 'border-slate-300 text-slate-700')
              }
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const { data, isLoading, error } = useSources()
  const [selected, dispatch] = useReducer(selectionReducer, new Set<string>())
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const save = useSaveUserSources()

  if (isLoading) return <p className="p-6">Carregando…</p>
  if (error) return <p className="p-6 text-red-600">Erro ao carregar o catálogo.</p>
  if (saving) return <TransitionScreen />

  const current = STEPS[step]
  const sources: Source[] = current.kinds.flatMap((k) => data?.[k] ?? [])
  const isLast = step === STEPS.length - 1

  async function next() {
    if (!isLast) {
      setStep((s) => s + 1)
      return
    }
    setSaving(true)
    await save.mutateAsync([...selected])
    // pequena pausa pra sensação de "varredura"
    await new Promise((r) => setTimeout(r, 1200))
    navigate('/painel')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-slate-800 transition-all"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>
      <h1 className="text-xl font-semibold">{current.title}</h1>
      <div className="flex flex-col gap-2">
        {sources.map((s) => (
          <SourceBlock key={s.id} source={s} selected={selected} onToggle={(id) => dispatch({ type: 'toggle', itemId: id })} />
        ))}
        {sources.length === 0 && <p className="text-sm text-slate-500">Nada por aqui ainda.</p>}
      </div>
      <div className="mt-auto flex gap-2">
        {step > 0 && (
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2"
            onClick={() => setStep((s) => s - 1)}
          >
            Voltar
          </button>
        )}
        <button
          type="button"
          className="ml-auto rounded-lg bg-slate-800 px-4 py-2 text-white"
          onClick={next}
        >
          {current.cta}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Rodar — ver passar**

Run: `npm test -- src/features/onboarding/OnboardingPage.test.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/features/onboarding/useSaveUserSources.ts src/features/onboarding/TransitionScreen.tsx src/features/onboarding/OnboardingPage.tsx src/features/onboarding/OnboardingPage.test.tsx
git commit -m "feat: página de onboarding (3 passos), gravação e transição"
```

---

## Task 6: Painel placeholder + contagem de benefícios

**Files:**
- Create: `src/features/benefits/useMyBenefitsCount.ts`, `src/features/painel/PainelPlaceholder.tsx`
- Test: `tests/onboarding_save.integration.test.ts`

- [ ] **Step 1: Hook de contagem (distinta) de my_benefits**

Create `src/features/benefits/useMyBenefitsCount.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// Conta benefícios DISTINTOS (my_benefits pode trazer 1 linha por fonte).
export function useMyBenefitsCount() {
  return useQuery({
    queryKey: ['my_benefits_count'],
    queryFn: async () => {
      const { data, error } = await supabase.from('my_benefits').select('id')
      if (error) throw error
      return new Set((data ?? []).map((r) => r.id)).size
    },
  })
}
```

- [ ] **Step 2: Painel placeholder**

Create `src/features/painel/PainelPlaceholder.tsx`:
```tsx
import { useMyBenefitsCount } from '../benefits/useMyBenefitsCount'

export function PainelPlaceholder() {
  const { data: count, isLoading } = useMyBenefitsCount()
  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-3 p-6">
      <h1 className="text-2xl font-bold">
        {isLoading ? 'Carregando…' : `Você tem ${count} benefício${count === 1 ? '' : 's'} ativo${count === 1 ? '' : 's'}.`}
      </h1>
      <p className="text-slate-500">Painel completo em construção (M3).</p>
    </div>
  )
}
```

- [ ] **Step 3: Teste de integração que falha — fluxo de gravação ponta a ponta**

Create `tests/onboarding_save.integration.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const url = process.env.VITE_SUPABASE_URL!
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!

// Itaú Black do seed (destrava Sala VIP + Cinemark = 2 benefícios distintos)
const ITAU_BLACK = 'aaaaaaa1-0000-0000-0000-000000000001'

describe('fluxo de gravação do onboarding', () => {
  it('usuário anônimo grava seleção e vê a contagem de benefícios', async () => {
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: signIn, error: authErr } = await client.auth.signInAnonymously()
    expect(authErr).toBeNull()
    const userId = signIn.user!.id

    const { error: insErr } = await client
      .from('user_sources')
      .insert({ user_id: userId, source_item_id: ITAU_BLACK })
    expect(insErr).toBeNull()

    const { data, error } = await client.from('my_benefits').select('id')
    expect(error).toBeNull()
    const distinct = new Set((data ?? []).map((r) => r.id)).size
    expect(distinct).toBe(2)
  })
})
```

- [ ] **Step 4: Rodar — ver passar**

Run: `npm test -- tests/onboarding_save.integration.test.ts`
Expected: PASS (prova que anon sign-in + RLS + my_benefits funcionam juntos com o seed).

- [ ] **Step 5: Commit**

```bash
git add src/features/benefits/useMyBenefitsCount.ts src/features/painel/PainelPlaceholder.tsx tests/onboarding_save.integration.test.ts
git commit -m "feat: painel placeholder com contagem real de benefícios"
```

---

## Task 7: Bootstrap de rota (/ decide onboarding vs painel) + fechar o app

**Files:**
- Create: `src/features/bootstrap/useHasOnboarded.ts`, `src/features/bootstrap/BootstrapRoute.tsx`
- Test: `src/features/bootstrap/BootstrapRoute.test.tsx`

- [ ] **Step 1: Hook — usuário já fez onboarding?**

Create `src/features/bootstrap/useHasOnboarded.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export function useHasOnboarded(enabled: boolean) {
  return useQuery({
    queryKey: ['has_onboarded'],
    enabled,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('user_sources')
        .select('source_item_id', { count: 'exact', head: true })
      if (error) throw error
      return (count ?? 0) > 0
    },
  })
}
```

- [ ] **Step 2: Teste de componente que falha**

Create `src/features/bootstrap/BootstrapRoute.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

let sessionValue: { session: unknown; loading: boolean }
vi.mock('../auth/AuthProvider', () => ({
  useSession: () => sessionValue,
}))

let hasOnboarded: { data: boolean | undefined; isLoading: boolean }
vi.mock('./useHasOnboarded', () => ({
  useHasOnboarded: () => hasOnboarded,
}))

import { BootstrapRoute } from './BootstrapRoute'

beforeEach(() => navigateMock.mockReset())

describe('BootstrapRoute', () => {
  it('manda pro onboarding quando não há seleção', async () => {
    sessionValue = { session: { user: { id: 'x' } }, loading: false }
    hasOnboarded = { data: false, isLoading: false }
    renderWithProviders(<BootstrapRoute />)
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/onboarding', { replace: true }))
  })

  it('manda pro painel quando já fez onboarding', async () => {
    sessionValue = { session: { user: { id: 'x' } }, loading: false }
    hasOnboarded = { data: true, isLoading: false }
    renderWithProviders(<BootstrapRoute />)
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/painel', { replace: true }))
  })

  it('mostra carregando enquanto a sessão inicializa', () => {
    sessionValue = { session: null, loading: true }
    hasOnboarded = { data: undefined, isLoading: true }
    renderWithProviders(<BootstrapRoute />)
    expect(screen.getByText(/preparando/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Rodar — ver falhar**

Run: `npm test -- src/features/bootstrap/BootstrapRoute.test.tsx`
Expected: FAIL (BootstrapRoute não existe).

- [ ] **Step 4: Implementar BootstrapRoute**

Create `src/features/bootstrap/BootstrapRoute.tsx`:
```tsx
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../auth/AuthProvider'
import { useHasOnboarded } from './useHasOnboarded'

export function BootstrapRoute() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const { data: onboarded, isLoading } = useHasOnboarded(!!session)

  useEffect(() => {
    if (loading || !session || isLoading || onboarded === undefined) return
    navigate(onboarded ? '/painel' : '/onboarding', { replace: true })
  }, [loading, session, isLoading, onboarded, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-slate-500">Preparando o Mapa de Benefícios…</p>
    </div>
  )
}
```

- [ ] **Step 5: Rodar — ver passar**

Run: `npm test -- src/features/bootstrap/BootstrapRoute.test.tsx`
Expected: PASS (3 casos).

- [ ] **Step 6: Build completo (agora todos os imports do router existem)**

Run: `npm run build`
Expected: PASS (App compila ponta a ponta).

- [ ] **Step 7: Suíte inteira**

Run: `npm test`
Expected: todos os arquivos PASS (M1 + M2).

- [ ] **Step 8: Commit**

```bash
git add src/features/bootstrap/
git commit -m "feat: bootstrap de rota (onboarding vs painel) e fechamento do app M2"
```

---

## Definition of Done (M2)

- [ ] `npm test` passa inteiro (M1 + lógica/hooks/componentes do M2 + integrações anon/save).
- [ ] `npm run build` compila o app ponta a ponta.
- [ ] Anonymous sign-in habilitado e comprovado por teste de integração.
- [ ] Fluxo real comprovado: usuário anônimo → grava `user_sources` → `my_benefits` retorna a contagem correta (seed: Itaú Black = 2).
- [ ] Onboarding em 3 passos com progresso, gravação e tela de transição; `/` roteia para onboarding ou painel.
- [ ] Verificação manual sugerida (não bloqueante): `npm run dev`, abrir no navegador, passar pelo fluxo e ver a contagem no painel.

**Próximo:** plano do M3 (painel completo: dashboard, categorias, feed, detalhe do benefício, busca) — incluindo a decisão de deduplicação/agrupamento de `via` em `my_benefits`.
```
