# Mapa de Benefícios M4 — Perfil + PWA Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status de execução (auditado em 2026-07-10):** implementação concluída no repositório (`29545a8` a `64dbc67`). Perfil, edição de fontes e artefatos PWA estão presentes e o build cumulativo foi aprovado. Os checklists abaixo permanecem como roteiro histórico.

**Goal:** O usuário consegue editar suas fontes (varredura pré-preenchida), transformar a conta anônima em permanente por magic link (e-mail), e instalar o app como PWA.

**Architecture:** `/onboarding` passa a dobrar como editor: pré-carrega a seleção atual (`user_sources`) no reducer. Nova tela `/perfil` mostra o estado da conta (anônima vs. com e-mail) e oferece o link mágico via `supabase.auth.updateUser({ email })`. PWA via `vite-plugin-pwa` (manifest + service worker autoUpdate). Bottom nav ganha o terceiro item (Perfil).

**Tech Stack:** React 18, TS, Vite, Tailwind, TanStack Query, React Router, Supabase, `vite-plugin-pwa`. Vitest + Testing Library.

**Pré-requisito:** M1+M2+M3 na `main`. Supabase local rodando. `.env.local`. Deploy/SMTP de produção é M5 (não entra aqui; o magic link local cai no Mailpit do Supabase em http://127.0.0.1:54324).

**Referência:** spec `docs/superpowers/specs/2026-06-13-mapa-de-beneficios-mvp-design.md`.

**Decisões M4:** upgrade = magic link (e-mail) só; deploy adiado pro M5; ícone PWA = SVG simples (PNG p/ iOS fica como polish no M5).

---

## Estrutura de arquivos (M4)

```
src/features/onboarding/selection.ts            # MODIFICA: ação 'set'
src/features/onboarding/selection.test.ts        # MODIFICA: caso 'set'
src/features/onboarding/useUserSources.ts        # CRIA: ids já selecionados
src/features/onboarding/OnboardingPage.tsx       # MODIFICA: pré-preenche seleção
src/features/onboarding/OnboardingPage.test.tsx  # MODIFICA: mocks novos + teste de prefill
src/features/onboarding/useSaveUserSources.ts    # MODIFICA: invalida ['user_sources']
src/features/perfil/useLinkEmail.ts              # CRIA: mutation magic link
src/features/perfil/Perfil.tsx (+test)           # CRIA: tela de perfil
src/features/layout/BottomNav.tsx                # MODIFICA: + Perfil
src/features/layout/BottomNav.test.tsx           # MODIFICA: + Perfil
src/router.tsx                                    # MODIFICA: rota /perfil sob AppLayout
public/icon.svg                                  # CRIA: ícone do app
index.html                                       # MODIFICA: icon + apple-touch
vite.config.ts                                   # MODIFICA: VitePWA
```

---

## Task 1: Editar fontes — reducer 'set' + useUserSources + onboarding pré-preenchido

**Files:**
- Modify: `src/features/onboarding/selection.ts` (+ `.test.ts`), `OnboardingPage.tsx` (+ `.test.tsx`), `useSaveUserSources.ts`
- Create: `src/features/onboarding/useUserSources.ts`

- [ ] **Step 1: Caso de teste 'set' (falha)**

Add to `src/features/onboarding/selection.test.ts` inside the describe:
```ts
  it('set substitui o estado pelos ids fornecidos', () => {
    let s = new Set(['x'])
    s = selectionReducer(s, { type: 'set', ids: ['a', 'b'] })
    expect([...s].sort()).toEqual(['a', 'b'])
  })
```

- [ ] **Step 2: Rodar — ver falhar**

Run: `npm test -- src/features/onboarding/selection.test.ts` → FAIL (no 'set').

- [ ] **Step 3: Adicionar ação 'set'**

Edit `src/features/onboarding/selection.ts`:
```ts
export type SelectionState = Set<string>

export type SelectionAction =
  | { type: 'toggle'; itemId: string }
  | { type: 'set'; ids: string[] }
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
    case 'set':
      return new Set(action.ids)
    case 'reset':
      return new Set()
  }
}
```

- [ ] **Step 4: Rodar — ver passar**

Run: `npm test -- src/features/onboarding/selection.test.ts` → PASS.

- [ ] **Step 5: Hook `useUserSources`**

Create `src/features/onboarding/useUserSources.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export function useUserSources(userId: string | undefined) {
  return useQuery({
    queryKey: ['user_sources', userId],
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('user_sources').select('source_item_id')
      if (error) throw error
      return (data ?? []).map((r) => r.source_item_id as string)
    },
  })
}
```

- [ ] **Step 6: Invalidar ['user_sources'] no save**

Edit `src/features/onboarding/useSaveUserSources.ts` `onSuccess` para incluir:
```ts
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_benefits'] })
      queryClient.invalidateQueries({ queryKey: ['has_onboarded'] })
      queryClient.invalidateQueries({ queryKey: ['user_sources'] })
    },
```

- [ ] **Step 7: Atualizar o teste do OnboardingPage (mocks novos + prefill)**

Replace `src/features/onboarding/OnboardingPage.test.tsx` with:
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

vi.mock('../auth/AuthProvider', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}))

const saveMutate = vi.fn()
vi.mock('./useSaveUserSources', () => ({
  useSaveUserSources: () => ({ mutateAsync: saveMutate, isPending: false }),
}))

let existing: { data: string[] | undefined; isLoading: boolean }
vi.mock('./useUserSources', () => ({
  useUserSources: () => existing,
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
  existing = { data: [], isLoading: false }
})

import { OnboardingPage } from './OnboardingPage'

describe('OnboardingPage', () => {
  it('navega pelos 3 passos, salva a seleção e vai pro painel', async () => {
    renderWithProviders(<OnboardingPage />)
    fireEvent.click(screen.getByText('Itaú'))
    fireEvent.click(screen.getByRole('button', { name: /black/i }))
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))
    fireEvent.click(screen.getByText('Claro'))
    fireEvent.click(screen.getByRole('button', { name: /pós/i }))
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith(expect.arrayContaining(['i1', 'i2'])))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/painel'), { timeout: 2500 })
  })

  it('pré-preenche a seleção existente (modo edição) e salva sem nova escolha', async () => {
    existing = { data: ['i1', 'i2'], isLoading: false }
    renderWithProviders(<OnboardingPage />)
    // avança sem tocar em nada
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith(expect.arrayContaining(['i1', 'i2'])))
  })
})
```

- [ ] **Step 8: Rodar — ver falhar** (prefill ainda não existe)

Run: `npm test -- src/features/onboarding/OnboardingPage.test.tsx` → o caso de prefill FALHA.

- [ ] **Step 9: Pré-preencher no OnboardingPage**

Edit `src/features/onboarding/OnboardingPage.tsx`. Adicione imports e a inicialização a partir de `useUserSources`. Mudanças:
- Trocar a primeira linha de imports do React: `import { useEffect, useReducer, useRef, useState } from 'react'`
- Adicionar imports:
```tsx
import { useSession } from '../auth/AuthProvider'
import { useUserSources } from './useUserSources'
```
- No início do componente, antes do `useReducer`:
```tsx
  const { session } = useSession()
  const { data: existing, isLoading: loadingExisting } = useUserSources(session?.user.id)
```
- Logo após o `useReducer(selectionReducer, new Set<string>())` e os demais `useState`, adicionar a inicialização única:
```tsx
  const inited = useRef(false)
  useEffect(() => {
    if (!inited.current && existing) {
      dispatch({ type: 'set', ids: existing })
      inited.current = true
    }
  }, [existing])
```
- Ajustar o guard de loading para também esperar `loadingExisting`:
```tsx
  if (isLoading || loadingExisting) return <p className="p-6">Carregando…</p>
```
Mantenha todo o resto igual (passos, save, transição).

- [ ] **Step 10: Rodar — ver passar**

Run: `npm test -- src/features/onboarding/OnboardingPage.test.tsx` → ambos PASS.

- [ ] **Step 11: Suíte + scoped typecheck**

Run: `npm test` (tudo verde) e `npx tsc --noEmit 2>&1 | grep -iE "onboarding/(useUserSources|OnboardingPage|selection)" || echo "ok"`.

- [ ] **Step 12: Commit**

```bash
git add src/features/onboarding/selection.ts src/features/onboarding/selection.test.ts src/features/onboarding/useUserSources.ts src/features/onboarding/OnboardingPage.tsx src/features/onboarding/OnboardingPage.test.tsx src/features/onboarding/useSaveUserSources.ts
git commit -m "feat: editar fontes — onboarding pré-preenchido (reducer set + useUserSources)"
```

---

## Task 2: Upgrade de conta por magic link + tela de Perfil

**Files:**
- Create: `src/features/perfil/useLinkEmail.ts`, `src/features/perfil/Perfil.tsx` (+ `.test.tsx`)

- [ ] **Step 1: Mutation de link de e-mail**

Create `src/features/perfil/useLinkEmail.ts`:
```ts
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// Linka um e-mail à conta (anônima) atual; o Supabase envia um link de confirmação.
export function useLinkEmail() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.updateUser({ email })
      if (error) throw error
    },
  })
}
```

- [ ] **Step 2: Teste do Perfil (falha)**

Create `src/features/perfil/Perfil.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'

let sessionValue: { session: unknown; loading: boolean }
vi.mock('../auth/AuthProvider', () => ({
  useSession: () => sessionValue,
}))

const linkMutate = vi.fn()
vi.mock('./useLinkEmail', () => ({
  useLinkEmail: () => ({ mutateAsync: linkMutate, isPending: false, isError: false }),
}))

import { Perfil } from './Perfil'

beforeEach(() => {
  linkMutate.mockReset()
  linkMutate.mockResolvedValue(undefined)
})

describe('Perfil', () => {
  it('conta anônima: envia magic link ao salvar o e-mail', async () => {
    sessionValue = { session: { user: { id: 'u1', is_anonymous: true, email: null } }, loading: false }
    renderWithProviders(<Perfil />)
    fireEvent.change(screen.getByRole('textbox', { name: /e-mail/i }), { target: { value: 'a@b.com' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar meu acesso/i }))
    await waitFor(() => expect(linkMutate).toHaveBeenCalledWith('a@b.com'))
    expect(await screen.findByText(/enviamos um link/i)).toBeInTheDocument()
  })

  it('conta com e-mail: mostra o e-mail e não mostra o formulário', () => {
    sessionValue = { session: { user: { id: 'u1', is_anonymous: false, email: 'x@y.com' } }, loading: false }
    renderWithProviders(<Perfil />)
    expect(screen.getByText(/x@y.com/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /salvar meu acesso/i })).not.toBeInTheDocument()
  })

  it('tem link para editar as fontes', () => {
    sessionValue = { session: { user: { id: 'u1', is_anonymous: true, email: null } }, loading: false }
    renderWithProviders(<Perfil />)
    expect(screen.getByRole('link', { name: /editar minhas fontes/i })).toHaveAttribute('href', '/onboarding')
  })
})
```

- [ ] **Step 3: Rodar — ver falhar**, depois implementar `src/features/perfil/Perfil.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../auth/AuthProvider'
import { useLinkEmail } from './useLinkEmail'

export function Perfil() {
  const { session } = useSession()
  const user = session?.user
  const isAnon = user?.is_anonymous ?? true
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const link = useLinkEmail()

  async function submit(e: FormEvent) {
    e.preventDefault()
    await link.mutateAsync(email)
    setSent(true)
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-24">
      <h1 className="text-2xl font-bold text-slate-900">Perfil</h1>

      {isAnon ? (
        sent ? (
          <p className="rounded-xl bg-slate-100 p-4 text-slate-700">
            Enviamos um link de confirmação para <strong>{email}</strong>. Abra seu e-mail para
            garantir seu acesso.
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3">
            <p className="text-sm text-slate-600">
              Sua conta é temporária. Adicione um e-mail para não perder seus benefícios ao trocar
              de aparelho.
            </p>
            <label className="text-sm font-medium text-slate-700" htmlFor="email">
              E-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3"
            />
            {link.isError && (
              <p className="text-sm text-red-600">Não foi possível enviar. Tente de novo.</p>
            )}
            <button
              type="submit"
              disabled={link.isPending}
              className="rounded-lg bg-slate-800 px-4 py-3 font-medium text-white disabled:opacity-60"
            >
              Salvar meu acesso
            </button>
          </form>
        )
      ) : (
        <p className="rounded-xl bg-slate-100 p-4 text-slate-700">
          Conectado como <strong>{user?.email}</strong>.
        </p>
      )}

      <Link to="/onboarding" className="text-slate-700 underline">
        Editar minhas fontes
      </Link>
    </div>
  )
}
```

- [ ] **Step 4: Rodar — ver passar**

Run: `npm test -- src/features/perfil/Perfil.test.tsx` → PASS (3).

- [ ] **Step 5: Commit**

```bash
git add src/features/perfil/useLinkEmail.ts src/features/perfil/Perfil.tsx src/features/perfil/Perfil.test.tsx
git commit -m "feat: tela de Perfil + upgrade de conta por magic link"
```

---

## Task 3: Perfil na navegação + rota

**Files:**
- Modify: `src/features/layout/BottomNav.tsx` (+ `.test.tsx`), `src/router.tsx`

- [ ] **Step 1: Atualizar o teste do BottomNav (falha)**

Replace `src/features/layout/BottomNav.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import { BottomNav } from './BottomNav'

describe('BottomNav', () => {
  it('tem links para Painel, Buscar e Perfil', () => {
    renderWithProviders(<BottomNav />, { route: '/painel' })
    expect(screen.getByRole('link', { name: /painel/i })).toHaveAttribute('href', '/painel')
    expect(screen.getByRole('link', { name: /buscar/i })).toHaveAttribute('href', '/buscar')
    expect(screen.getByRole('link', { name: /perfil/i })).toHaveAttribute('href', '/perfil')
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**, depois adicionar Perfil ao `src/features/layout/BottomNav.tsx`:

No array `items`, adicione a terceira entrada:
```tsx
const items = [
  { to: '/painel', label: 'Painel', emoji: '🏠' },
  { to: '/buscar', label: 'Buscar', emoji: '🔎' },
  { to: '/perfil', label: 'Perfil', emoji: '👤' },
]
```
(Resto do arquivo igual.)

- [ ] **Step 3: Rodar — ver passar**

Run: `npm test -- src/features/layout/BottomNav.test.tsx` → PASS.

- [ ] **Step 4: Adicionar a rota /perfil**

Edit `src/router.tsx` — importe `Perfil` e adicione a rota sob o `AppLayout` (junto de painel/buscar):
```tsx
import { Perfil } from './features/perfil/Perfil'
```
e dentro de `children` do AppLayout:
```tsx
      { path: '/perfil', element: <Perfil /> },
```

- [ ] **Step 5: Build + suíte**

Run: `npm run build` (PASS) e `npm test` (tudo verde).

- [ ] **Step 6: Commit**

```bash
git add src/features/layout/BottomNav.tsx src/features/layout/BottomNav.test.tsx src/router.tsx
git commit -m "feat: Perfil na navegação inferior e rota /perfil"
```

---

## Task 4: PWA (manifest + service worker)

**Files:**
- Modify: `vite.config.ts`, `index.html`
- Create: `public/icon.svg`

NOTA: PWA é build-time; a validação é por artefatos do build, não Vitest.

- [ ] **Step 1: Instalar o plugin**

Run: `npm install -D vite-plugin-pwa`

- [ ] **Step 2: Ícone do app `public/icon.svg`**

Create `public/icon.svg` (ícone simples da marca):
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <rect width="512" height="512" rx="96" fill="#0f172a"/>
  <text x="50%" y="54%" font-family="system-ui, sans-serif" font-size="300" font-weight="700"
        fill="#ffffff" text-anchor="middle" dominant-baseline="middle">B</text>
</svg>
```

- [ ] **Step 3: Configurar VitePWA no `vite.config.ts`**

Edit `vite.config.ts` — importe e adicione o plugin (mantenha o bloco `test` existente):
```ts
/// <reference types="vitest" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Mapa de Benefícios',
        short_name: 'Mapa de Benefícios',
        description: 'Descubra os benefícios que você já tem.',
        theme_color: '#0f172a',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test-setup.ts',
  },
})
```

- [ ] **Step 4: Referenciar o ícone no `index.html`**

No `<head>` do `index.html`, adicione (e troque o favicon padrão do Vite se existir):
```html
    <link rel="icon" type="image/svg+xml" href="/icon.svg" />
    <link rel="apple-touch-icon" href="/icon.svg" />
    <meta name="theme-color" content="#0f172a" />
```
(Remova a linha `<link rel="icon" ... vite.svg />` se houver.)

- [ ] **Step 5: Build e verificar artefatos PWA**

Run:
```bash
npm run build
ls dist/ | grep -E "manifest|sw|workbox"
```
Expected: o build passa e `dist/` contém `manifest.webmanifest`, `sw.js` e arquivos `workbox-*.js`. Se o nome do manifest diferir, confirme que existe um `*.webmanifest`.

- [ ] **Step 6: Suíte completa (garantir que o plugin não quebrou os testes)**

Run: `npm test`
Expected: tudo verde (o VitePWA é inerte em modo teste).

- [ ] **Step 7: Commit**

```bash
git add vite.config.ts index.html public/icon.svg package.json package-lock.json
git commit -m "feat: PWA (manifest + service worker via vite-plugin-pwa)"
```

---

## Definition of Done (M4)

- [ ] `npm test` passa inteiro (M1–M3 + 'set' reducer + prefill + Perfil + BottomNav 3 itens).
- [ ] `npm run build` compila e emite `manifest.webmanifest` + `sw.js` (+ workbox) em `dist/`.
- [ ] `/onboarding` pré-preenche a seleção atual quando o usuário já tem fontes (modo edição).
- [ ] `/perfil`: conta anônima vê o formulário e dispara o magic link; conta com e-mail vê o e-mail; link "Editar minhas fontes" → `/onboarding`.
- [ ] Nav inferior com 3 itens (Painel/Buscar/Perfil); rota `/perfil` ativa.
- [ ] Verificação manual sugerida: `npm run dev` → Perfil → enviar e-mail → conferir o link no Mailpit (http://127.0.0.1:54324); editar fontes pré-preenchidas.

**Próximo (M5):** deploy no Dokploy — Supabase self-hosted (Docker Compose), front estático, domínio, SMTP de produção (pro magic link), secrets, e PNG de ícone p/ iOS. Brainstorm dedicado antes (decisões de domínio/SMTP/infra).
```
