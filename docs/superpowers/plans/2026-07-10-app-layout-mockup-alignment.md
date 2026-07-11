# Alinhamento visual do app aos mockups - Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alinhar shell, Painel, Busca, Detalhe, Perfil e onboarding do app aos mockups aprovados, com dados reais, estados completos e paridade responsiva em tema claro e escuro.

**Architecture:** Executar fatias verticais na ordem shell -> Painel -> Busca -> Detalhe -> Perfil -> onboarding. Preservar hooks e contratos Supabase; usar `src/ui` e tokens existentes; manter estilos compartilhados em `src/ui/layout.css` e estilos de tela junto da feature. Fechar com um gate Playwright em quatro combinacoes de viewport/tema.

**Tech Stack:** React 18, TypeScript, React Router, TanStack Query, Supabase, CSS com tokens de `src/ui/ds.css`, Vitest, Testing Library e Playwright.

## Global Constraints

- Fonte visual: `docs/mockups/design_handoff_mockups/*.dc.html`; nao copiar fixtures ou runtime dos mockups para producao.
- Escopo de rotas: `/painel`, `/buscar`, `/beneficio/:id`, `/perfil`, `/onboarding` e `/onboarding?mode=edit`.
- Fora de escopo: `/admin/*`, Gmail real, Alertas, backend, schema, migrations, RPCs, Edge Functions e taxonomia.
- Gmail aparece como `Em breve`, semanticamente indisponivel e sem navegacao/escrita.
- Mobile-first: base em `390 x 844`; desktop e expansao aditiva em `1440 x 900`.
- Tema claro e escuro devem usar apenas tokens existentes para superficies, texto, bordas e estados.
- Preservar os hooks de dados atuais; mutations existentes continuam sendo a unica via de escrita.
- Loading, erro recuperavel, vazio e conteudo sao obrigatorios onde aplicaveis.
- Cada task termina com teste focado, `npm run build` e commit proprio.
- Nao considerar fidelidade aprovada sem screenshots nos quatro cenarios e verificacao de overflow.

---

## File Structure

- `src/ui/PageState.tsx` - estado vazio/erro compartilhado com acao opcional.
- `src/ui/layout.css` - shell, containers de pagina, navegacao e estados compartilhados.
- `src/features/layout/AppLayout.tsx` - sidebar desktop e area principal.
- `src/features/painel/Painel.tsx` / `painel.css` / teste - estados do radar.
- `src/features/busca/Search.tsx` / `search.css` / teste - busca e resultados.
- `src/features/detalhe/BenefitDetail.tsx` / `benefit-detail.css` / teste - detalhe completo.
- `src/features/perfil/Perfil.tsx` / `perfil.css` / teste - conta e preferencias.
- `src/features/onboarding/ManualWizard.tsx` - wizard atual extraido sem mudar persistencia.
- `src/features/onboarding/OnboardingIntro.tsx` - Boas-vindas e escolha de metodo.
- `src/features/onboarding/OnboardingPage.tsx` - orquestracao por tela e `mode=edit`.
- `playwright.config.ts` e `tests/e2e/app-layout.spec.ts` - gate visual real.

---

### Task 1: Estado de pagina e shell responsivo

**Files:**
- Create: `src/ui/PageState.tsx`
- Create: `src/ui/PageState.test.tsx`
- Modify: `src/ui/index.ts`
- Modify: `src/ui/layout.css`
- Modify: `src/features/layout/AppLayout.tsx`
- Create: `src/features/layout/AppLayout.test.tsx`

**Interfaces:**
- Produces: `PageState(props: { title: string; description?: string; action?: { label: string; onClick: () => void }; children?: ReactNode })`.
- Produces CSS contracts: `.app-page`, `.app-page-wide`, `.page-state`, `.page-state-actions`, `.app-brand-mark`.
- Preserves: `BottomNav` items `Painel`, `Buscar`, `Perfil`.

- [ ] **Step 1: Write failing tests**

Create `src/ui/PageState.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PageState } from './PageState'

describe('PageState', () => {
  it('renders heading, description and recovery action', () => {
    const retry = vi.fn()
    render(<PageState title="Nao foi possivel carregar" description="Confira sua conexao." action={{ label: 'Tentar novamente', onClick: retry }} />)
    expect(screen.getByRole('heading', { name: /nao foi possivel carregar/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
```

Create `src/features/layout/AppLayout.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/renderWithProviders'
import { AppLayout } from './AppLayout'

describe('AppLayout', () => {
  it('exposes the same destinations in sidebar and bottom navigation', () => {
    renderWithProviders(
      <Routes><Route element={<AppLayout />}><Route path="/painel" element={<h1>Painel teste</h1>} /></Route></Routes>,
      { route: '/painel' },
    )
    expect(screen.getByRole('main')).toHaveTextContent('Painel teste')
    expect(screen.getAllByRole('link', { name: /painel/i })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: /buscar/i })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: /perfil/i })).toHaveLength(2)
    expect(screen.getAllByRole('navigation', { name: /principal/i })).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run red**

Run: `npm test -- PageState AppLayout`

Expected: FAIL because `PageState` and the new shell contract do not exist.

- [ ] **Step 3: Implement `PageState`**

```tsx
import type { ReactNode } from 'react'
import { Button } from './Button'

export interface PageStateProps {
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  children?: ReactNode
}

export function PageState({ title, description, action, children }: PageStateProps) {
  return (
    <section className="page-state">
      {children ? <div className="page-state-visual" aria-hidden="true">{children}</div> : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action ? <div className="page-state-actions"><Button onClick={action.onClick}>{action.label}</Button></div> : null}
    </section>
  )
}
```

Append to `src/ui/index.ts`:

```ts
export * from './PageState'
```

- [ ] **Step 4: Replace `AppLayout.tsx`**

```tsx
import { Outlet, NavLink } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { PainelIcon, SearchIcon, PerfilIcon, ThemeIcon } from './navIcons'
import { toggleTheme } from '../../ui/theme'

const links = [
  { to: '/painel', label: 'Painel', Icon: PainelIcon },
  { to: '/buscar', label: 'Buscar', Icon: SearchIcon },
  { to: '/perfil', label: 'Perfil', Icon: PerfilIcon },
]

export function AppLayout() {
  return (
    <div className="app">
      <aside className="side" aria-label="Navegacao principal">
        <div className="brand"><span className="app-brand-mark" aria-hidden="true" />Mapa de Benefícios</div>
        <nav aria-label="Principal">
          {links.map(({ to, label, Icon }) => <NavLink key={to} to={to}><Icon />{label}</NavLink>)}
        </nav>
        <button className="btn ghost side-theme" type="button" onClick={() => toggleTheme()}><ThemeIcon /> Tema</button>
      </aside>
      <main className="main"><Outlet /></main>
      <BottomNav />
    </div>
  )
}
```

- [ ] **Step 5: Replace `src/ui/layout.css`**

```css
.app { min-height: 100dvh; background: var(--bg); }
.side { display: none; }
.main { min-width: 0; }
.app-page { width: 100%; max-width: 480px; margin: 0 auto; padding: var(--s5) var(--s4) 112px; }
.app-page-wide { max-width: 1040px; }
.app-brand-mark { width: 30px; height: 30px; border-radius: 9px; background: var(--accent); display: inline-block; flex: none; }
.tabbar { position: fixed; inset: auto 0 0; z-index: 20; padding: var(--s2) var(--s4) calc(var(--s2) + env(safe-area-inset-bottom)); background: color-mix(in srgb, var(--surface) 92%, transparent); backdrop-filter: blur(12px); border-top: 1px solid var(--line); }
.tabbar .nav { border: 0; border-radius: 0; background: transparent; padding: 0; }
.passes { display: grid; gap: var(--s3); grid-template-columns: minmax(0, 1fr); }
.page-state { min-height: 260px; display: grid; place-content: center; justify-items: center; text-align: center; padding: var(--s8) var(--s4); }
.page-state-visual { margin-bottom: var(--s4); }
.page-state h2 { margin: 0; font-size: var(--fz-h2); }
.page-state p { max-width: 34ch; margin: var(--s2) 0 0; color: var(--ink-2); line-height: var(--lh-body); }
.page-state-actions { width: min(100%, 280px); margin-top: var(--s5); }
.page-state-actions .btn { margin: 0; }

@media (min-width: 960px) {
  .app { display: grid; grid-template-columns: 256px minmax(0, 1fr); }
  .side { display: flex; flex-direction: column; position: sticky; top: 0; height: 100dvh; padding: var(--s6) var(--s4); border-right: 1px solid var(--line); background: var(--surface); }
  .side .brand { display: flex; align-items: center; gap: var(--s3); margin-bottom: var(--s5); font-size: var(--fz-title); font-weight: 800; }
  .side nav { display: grid; gap: var(--s2); }
  .side a { display: flex; align-items: center; gap: var(--s3); padding: 11px var(--s3); border-radius: var(--r-sm); color: var(--ink-2); text-decoration: none; font-weight: 600; }
  .side a:hover { background: var(--surface-2); color: var(--ink); }
  .side a[aria-current="page"] { background: var(--accent-soft); color: var(--accent); }
  .side a:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
  .side a svg { width: 20px; height: 20px; }
  .side-theme { width: auto; margin: auto 0 0; }
  .app-page { max-width: 720px; padding: var(--s8); }
  .app-page-wide { max-width: 1120px; }
  .tabbar { display: none; }
  .passes { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: var(--s4); }
}
```

- [ ] **Step 6: Verify and commit**

```bash
npm test -- PageState AppLayout BottomNav && npm run build
git add src/ui/PageState.tsx src/ui/PageState.test.tsx src/ui/index.ts src/ui/layout.css src/features/layout/AppLayout.tsx src/features/layout/AppLayout.test.tsx
git commit -m "feat(app-ui): establish responsive app shell and page states"
```

Expected: focused tests PASS; build exits 0.

---

### Task 2: Painel with complete states

**Files:**
- Modify: `src/features/painel/Painel.tsx`
- Modify: `src/features/painel/Painel.test.tsx`
- Modify: `src/ui/HeroRadar.tsx`
- Create: `src/features/painel/painel.css`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `PageState`, `HeroRadar`, `CategoryChips`, `BenefitCard`, `useMyBenefits`.
- Produces: loading/error/empty/populated/filter-empty with retry through `refetch`.

- [ ] **Step 1: Add failing tests**

Extend the query mock with `refetch` and add:

```tsx
const refetch = vi.fn()
let result: { data: MyBenefit[] | undefined; isLoading: boolean; error: unknown; refetch: typeof refetch }

it('shows stable loading', () => {
  result = { data: undefined, isLoading: true, error: null, refetch }
  renderWithProviders(<Painel />)
  expect(screen.getByLabelText(/carregando seu radar/i)).toBeInTheDocument()
})

it('retries query error', () => {
  result = { data: undefined, isLoading: false, error: new Error('down'), refetch }
  renderWithProviders(<Painel />)
  fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
  expect(refetch).toHaveBeenCalledTimes(1)
})

it('empty radar exposes manual setup and disabled Gmail', () => {
  result = { data: [], isLoading: false, error: null, refetch }
  renderWithProviders(<Painel />)
  expect(screen.getByRole('link', { name: /adicionar programas/i })).toHaveAttribute('href', '/onboarding?mode=edit')
  expect(screen.getByRole('button', { name: /gmail.*em breve/i })).toBeDisabled()
})

it('can clear a category with no results', () => {
  result = { data: [mk({ id: '1', title: 'Cinema', category: 'experience' })], isLoading: false, error: null, refetch }
  renderWithProviders(<Painel />)
  fireEvent.click(screen.getByRole('button', { name: /viagem/i }))
  fireEvent.click(screen.getByRole('button', { name: /limpar filtro/i }))
  expect(screen.getByText('Cinema')).toBeInTheDocument()
})
```

- [ ] **Step 2: Run red**

Run: `npm test -- Painel`

Expected: FAIL on loading label, retry and empty actions.

- [ ] **Step 3: Implement the complete `Painel` state machine**

First replace `src/ui/HeroRadar.tsx` so the primary radar visual uses a solid token surface and no decorative orb:

```tsx
import type * as React from 'react'

export interface HeroRadarProps {
  count?: number | string
  value?: React.ReactNode
  label?: string
  caption?: React.ReactNode
}

export function HeroRadar({ count = 0, value, label = 'Seu radar', caption }: HeroRadarProps) {
  return (
    <section className="hero-radar" aria-label={label}>
      <p className="lbl">{label}</p>
      <strong>{count}</strong>
      {caption ? <div>{caption}</div> : value != null ? <div>benefícios ativos · <b>{value}</b> em valor estimado/ano</div> : null}
    </section>
  )
}
```

Use this exact branch order in `Painel.tsx`:

```tsx
const { data, isLoading, error, refetch } = useMyBenefits(session?.user.id)

if (isLoading) {
  return <div className="app-page app-page-wide radar-loading" aria-label="Carregando seu radar"><Skeleton height="132px" radius="18px" /><Skeleton variant="pass" /><Skeleton variant="pass" /></div>
}
if (error) {
  return <div className="app-page"><PageState title="Não foi possível carregar seu radar" description="Confira sua conexão e tente novamente." action={{ label: 'Tentar novamente', onClick: () => void refetch() }} /></div>
}

const all = data ?? []
const visible = filterBenefits(all, { category, text: '' })

if (all.length === 0) {
  return (
    <div className="app-page radar-page">
      <p className="lbl">Seu radar de benefícios</p>
      <PageState title="Nenhum benefício no seu radar ainda" description="Adicione seus programas para revelar seus benefícios."><span className="radar-empty-mark">0</span></PageState>
      <div className="radar-empty-actions"><Link className="btn" to="/onboarding?mode=edit">Adicionar programas</Link><button className="btn ghost" type="button" disabled>Conectar Gmail - Em breve</button></div>
    </div>
  )
}
```

Use this populated body:

```tsx
return (
  <div className="app-page app-page-wide radar-page">
    <p className="lbl">Seu radar de benefícios</p>
    <HeroRadar count={all.length} label="Seu radar" caption={`${all.length} benefício${all.length === 1 ? '' : 's'} ativo${all.length === 1 ? '' : 's'}`} />
    <div className="radar-filters"><CategoryChips selected={category} onChange={setCategory} /></div>
    {visible.length === 0
      ? <PageState title="Nenhum benefício nesta categoria" description="Escolha outra categoria." action={{ label: 'Limpar filtro', onClick: () => setCategory(null) }} />
      : <div className="passes">{visible.map((benefit) => <BenefitCard key={benefit.id} benefit={benefit} />)}</div>}
  </div>
)
```

Imports added: `Link`, `PageState`, `Skeleton`, and `./painel.css`.

- [ ] **Step 4: Add `painel.css`**

```css
.radar-page > .lbl { margin-bottom: var(--s2); }
.hero-radar { padding: var(--s5); border-radius: 18px; background: var(--ink); color: var(--surface); }
.hero-radar .lbl { margin-bottom: 5px; color: color-mix(in srgb, var(--surface) 78%, transparent); }
.hero-radar > strong { display: block; font-size: var(--fz-display); line-height: 1; }
.hero-radar > div { margin-top: var(--s1); font-size: var(--fz-sm); }
.radar-filters { margin: var(--s5) 0 var(--s3); }
.radar-loading { display: grid; gap: var(--s4); }
.radar-empty-mark { width: 96px; height: 96px; display: grid; place-items: center; border-radius: 28px; background: var(--accent-soft); color: var(--accent); font-size: var(--fz-display); font-weight: 800; }
.radar-empty-actions { width: min(100%, 320px); margin: calc(-1 * var(--s5)) auto 0; }
.radar-empty-actions .btn { text-decoration: none; }
```

Insert `@import './features/painel/painel.css';` with the other imports at the top of `src/index.css`, before every `@tailwind` directive.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- Painel && npm run build
git add src/features/painel/Painel.tsx src/features/painel/Painel.test.tsx src/features/painel/painel.css src/ui/HeroRadar.tsx src/index.css
git commit -m "feat(app-ui): align radar states with approved mockups"
```

---

### Task 3: Complete recoverable search

**Files:**
- Modify: `src/features/busca/Search.tsx`
- Modify: `src/features/busca/Search.test.tsx`
- Modify: `src/features/benefits/filterBenefits.ts`
- Modify: `src/features/benefits/filterBenefits.test.ts`
- Create: `src/features/busca/search.css`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: `useMyBenefits`, `filterBenefits`, `CategoryChips`, `BenefitCard`, `PageState`, `Skeleton`.
- Produces: clear action, result count and distinct empty/error states.

- [ ] **Step 1: Add failing tests**

Extend the query mock with `refetch`, then add:

```tsx
it('clears an active text query', () => {
  renderWithProviders(<Search />)
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'cine' } })
  fireEvent.click(screen.getByRole('button', { name: /limpar busca/i }))
  expect(screen.getByRole('searchbox')).toHaveValue('')
  expect(screen.getByText('Sala VIP')).toBeInTheDocument()
})

it('shows result count', () => {
  renderWithProviders(<Search />)
  fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'cine' } })
  expect(screen.getByText(/1 resultado/i)).toBeInTheDocument()
})

it('retries a failed query', () => {
  result = { data: undefined, isLoading: false, error: new Error('down'), refetch }
  renderWithProviders(<Search />)
  fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
  expect(refetch).toHaveBeenCalledTimes(1)
})
```

Add to `src/features/benefits/filterBenefits.test.ts`:

```ts
it('searches provider names from origins and via', () => {
  const item = base({ title: 'Beneficio sem marca no titulo', partner_name: null, origins: [{ provider: 'Nubank', category: 'bank_card' }], via: ['Ultravioleta'] })
  expect(filterBenefits([item], { category: null, text: 'nubank' })).toEqual([item])
  expect(filterBenefits([item], { category: null, text: 'ultravioleta' })).toEqual([item])
})
```

- [ ] **Step 2: Run red**

Run: `npm test -- Search filterBenefits`

Expected: FAIL on clear, count, retry and provider-name matching.

- [ ] **Step 3: Expand the pure search haystack**

Replace the haystack in `filterBenefits.ts`:

```ts
const providers = b.origins.map((origin) => origin.provider).join(' ')
const haystack = `${b.title} ${b.summary} ${b.partner_name ?? ''} ${providers} ${b.via.join(' ')}`.toLowerCase()
```

- [ ] **Step 4: Replace `Search.tsx`**

```tsx
import { useState } from 'react'
import './search.css'
import { useSession } from '../auth/AuthProvider'
import { useMyBenefits } from '../benefits/useMyBenefits'
import { filterBenefits } from '../benefits/filterBenefits'
import { BenefitCard } from '../benefits/BenefitCard'
import { CategoryChips } from '../benefits/CategoryChips'
import { PageState, Skeleton } from '../../ui'
import type { BenefitCategory } from '../benefits/types'

export function Search() {
  const { session } = useSession()
  const { data, isLoading, error, refetch } = useMyBenefits(session?.user.id)
  const [text, setText] = useState('')
  const [category, setCategory] = useState<BenefitCategory | null>(null)
  const all = data ?? []
  const results = filterBenefits(all, { category, text })
  const filtering = text.trim().length > 0 || category !== null

  return (
    <div className="app-page app-page-wide search-page">
      <header><p className="lbl">Seu catálogo</p><h1>Buscar</h1><p>Encontre benefícios por nome, programa ou categoria.</p></header>
      <label className="search-field"><span aria-hidden="true">⌕</span><input type="search" value={text} onChange={(event) => setText(event.target.value)} placeholder="buscar benefício, programa..." aria-label="Buscar benefício" />{text ? <button type="button" onClick={() => setText('')} aria-label="Limpar busca">×</button> : null}</label>
      <CategoryChips selected={category} onChange={setCategory} />
      {filtering && !isLoading && !error ? <p className="search-count">{results.length} resultado{results.length === 1 ? '' : 's'}</p> : null}
      {isLoading ? <div aria-label="Carregando resultados"><Skeleton variant="pass" /><Skeleton variant="pass" /></div> : null}
      {error ? <PageState title="Não foi possível buscar" action={{ label: 'Tentar novamente', onClick: () => void refetch() }} /> : null}
      {!isLoading && !error && all.length === 0 ? <PageState title="Seu catálogo ainda está vazio" description="Adicione programas no Perfil para começar." /> : null}
      {!isLoading && !error && all.length > 0 && results.length === 0 ? <PageState title="Nada encontrado" description="Tente outro termo ou remova os filtros." action={{ label: 'Limpar filtros', onClick: () => { setText(''); setCategory(null) } }} /> : null}
      {!isLoading && !error && results.length > 0 ? <div className="passes">{results.map((benefit) => <BenefitCard key={benefit.id} benefit={benefit} />)}</div> : null}
    </div>
  )
}
```

- [ ] **Step 5: Add `search.css`**

```css
.search-page { display: grid; gap: var(--s3); }
.search-page header h1 { margin: 0; font-size: var(--fz-h1); }
.search-page header p:last-child { margin: var(--s2) 0 0; color: var(--ink-2); }
.search-field { display: flex; align-items: center; gap: var(--s3); padding: var(--s3); border: 1px solid var(--line); border-radius: 13px; background: var(--surface); }
.search-field:focus-within { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.search-field input { min-width: 0; flex: 1; border: 0; outline: 0; background: transparent; color: var(--ink); font: inherit; }
.search-field button { border: 0; background: transparent; color: var(--muted); font-size: 20px; cursor: pointer; }
.search-count { margin: 0; color: var(--muted); font-size: var(--fz-sm); }
```

Insert `@import './features/busca/search.css';` with the other imports at the top of `src/index.css`, before every `@tailwind` directive.

- [ ] **Step 6: Verify and commit**

```bash
npm test -- Search filterBenefits && npm run build
git add src/features/busca/Search.tsx src/features/busca/Search.test.tsx src/features/busca/search.css src/features/benefits/filterBenefits.ts src/features/benefits/filterBenefits.test.ts src/index.css
git commit -m "feat(app-ui): align benefit search states and controls"
```

---

### Task 4: Detail loading, retry and mockup composition

**Files:**
- Modify: `src/features/detalhe/BenefitDetail.tsx`
- Modify: `src/features/detalhe/BenefitDetail.test.tsx`
- Create: `src/features/detalhe/benefit-detail.css`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: existing `useBenefit` return `{ benefit, related, isLoading, error, refetch }`.
- Preserves: safe URL validation, source transparency and related benefits.

- [ ] **Step 1: Add failing loading and retry tests**

Extend the mocked query result with `refetch` and add:

```tsx
it('renders stable detail loading', () => {
  result = { data: undefined, isLoading: true, error: null, refetch }
  renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
  expect(screen.getByLabelText(/carregando beneficio/i)).toBeInTheDocument()
})

it('retries detail error', () => {
  result = { data: undefined, isLoading: false, error: new Error('down'), refetch }
  renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
  fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
  expect(refetch).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run red**

Run: `npm test -- BenefitDetail`

Expected: FAIL on loading label and retry.

- [ ] **Step 3: Update the three early states**

Add `import './benefit-detail.css'` and import `PageState`, `Skeleton`. Replace early returns:

```tsx
if (isLoading) return <div className="detail-page detail-loading" aria-label="Carregando benefício"><Skeleton height="24px" width="90px" /><Skeleton height="38px" /><Skeleton variant="pass" /></div>
if (error) return <div className="detail-page"><PageState title="Não foi possível carregar este benefício" action={{ label: 'Tentar novamente', onClick: () => void refetch() }} /></div>
if (!benefit) return <div className="detail-page"><Link to="/painel" className="detail-back">← Voltar</Link><PageState title="Benefício não encontrado" description="Ele pode ter sido removido do seu radar." /></div>
```

Replace the success return with this complete composition:

```tsx
return (
  <article className="detail-page">
    <Link to="/painel" className="detail-back">← Voltar</Link>
    <header className="detail-header">
      <span className="tag" style={tagStyle}>{catLabel}</span>
      <h1>{benefit.title}</h1>
      {benefit.via.length > 0 ? <span className="chip">via&nbsp;<b>{benefit.via.join(', ')}</b></span> : null}
      {benefit.summary ? <p>{benefit.summary}</p> : null}
    </header>
    <Alert><b>Confirme antes de usar.</b> A cobertura depende do produto elegivel e das regras oficiais, que podem mudar.</Alert>
    {steps.length > 0 ? <section><p className="lbl">Como usar</p><Checklist items={steps.map((label) => ({ label }))} /></section> : null}
    {actionUrl ? <a href={actionUrl} target="_blank" rel="noreferrer" className="btn ink">{benefit.action_label ?? 'Resgatar benefício'} ↗</a> : null}
    {sourceUrl ? (
      <section>
        <p className="lbl">Fonte oficial</p>
        <a className="row" href={sourceUrl} target="_blank" rel="noreferrer">
          <span className="detail-source"><span aria-hidden="true">{sourceLabel(benefit.source_name, sourceUrl).charAt(0).toUpperCase()}</span>{sourceLabel(benefit.source_name, sourceUrl)}</span>
          <span className="muted" aria-hidden="true">↗</span>
        </a>
        {collectedAt ? <p className="detail-date"><i />Informações coletadas em {collectedAt}</p> : null}
      </section>
    ) : null}
    {related.length > 0 ? (
      <section>
        <p className="lbl">Da mesma fonte</p>
        {related.map((item) => <Link key={item.id} className="row" to={`/beneficio/${item.id}`}>{item.title}<span className="muted" aria-hidden="true">→</span></Link>)}
      </section>
    ) : null}
  </article>
)
```

- [ ] **Step 4: Add `benefit-detail.css`**

```css
.detail-page { width: 100%; max-width: 680px; margin: 0 auto; padding: var(--s5) var(--s4) var(--s10); display: grid; gap: var(--s5); }
.detail-back { width: fit-content; color: var(--ink-2); font-size: var(--fz-sm); font-weight: 700; text-decoration: none; }
.detail-header { display: grid; gap: var(--s3); }
.detail-header .tag, .detail-header .chip { width: fit-content; }
.detail-header h1 { margin: 0; font-size: clamp(28px, 5vw, 40px); line-height: 1.08; overflow-wrap: anywhere; }
.detail-header p { margin: 0; color: var(--ink-2); line-height: var(--lh-body); }
.detail-page section > .lbl { margin-bottom: var(--s2); }
.detail-page .btn { margin: 0; text-decoration: none; }
.detail-source { display: flex; align-items: center; gap: var(--s3); min-width: 0; overflow-wrap: anywhere; }
.detail-source > span { width: 28px; height: 28px; flex: none; display: grid; place-items: center; border-radius: 8px; background: var(--accent-soft); color: var(--accent); font-weight: 800; }
.detail-date { display: flex; align-items: center; gap: 7px; margin: var(--s1) var(--s1) 0; color: var(--muted); font-size: var(--fz-xs); }
.detail-date i { width: 6px; height: 6px; border-radius: 50%; background: var(--ok); }
.detail-loading { min-height: 100dvh; align-content: start; }
@media (min-width: 960px) { .detail-page { padding: var(--s8); } }
```

Insert `@import './features/detalhe/benefit-detail.css';` with the other imports at the top of `src/index.css`, before every `@tailwind` directive.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- BenefitDetail && npm run build
git add src/features/detalhe/BenefitDetail.tsx src/features/detalhe/BenefitDetail.test.tsx src/features/detalhe/benefit-detail.css src/index.css
git commit -m "feat(app-ui): align benefit detail with transparency mockup"
```
---

### Task 5: Profile sections and explicit edit mode

**Files:**
- Modify: `src/features/perfil/Perfil.tsx`
- Modify: `src/features/perfil/Perfil.test.tsx`
- Create: `src/features/perfil/perfil.css`
- Modify: `src/index.css`

**Interfaces:**
- Consumes: session, `useLinkEmail`, `toggleTheme`.
- Produces: `/onboarding?mode=edit` and form states that preserve email on failure.

- [ ] **Step 1: Add failing tests**

Replace the static hook mock with:

```tsx
let linkState: { mutateAsync: typeof linkMutate; isPending: boolean; isError: boolean }
vi.mock('./useLinkEmail', () => ({ useLinkEmail: () => linkState }))

beforeEach(() => {
  linkMutate.mockReset()
  linkMutate.mockResolvedValue(undefined)
  linkState = { mutateAsync: linkMutate, isPending: false, isError: false }
})
```

Update the edit assertion and add failure/pending tests:

```tsx
expect(screen.getByRole('link', { name: /editar meus programas/i })).toHaveAttribute('href', '/onboarding?mode=edit')

it('keeps email after failed request', async () => {
  sessionValue = { session: { user: { id: 'u1', is_anonymous: true, email: null } }, loading: false }
  linkMutate.mockRejectedValue(new Error('smtp down'))
  renderWithProviders(<Perfil />)
  const input = screen.getByRole('textbox', { name: /e-mail/i })
  fireEvent.change(input, { target: { value: 'a@b.com' } })
  fireEvent.click(screen.getByRole('button', { name: /salvar meu acesso/i }))
  await waitFor(() => expect(linkMutate).toHaveBeenCalled())
  expect(input).toHaveValue('a@b.com')
  expect(screen.getByText(/não foi possível enviar/i)).toBeInTheDocument()
})

it('disables submit while pending', () => {
  sessionValue = { session: { user: { id: 'u1', is_anonymous: true, email: null } }, loading: false }
  linkState.isPending = true
  renderWithProviders(<Perfil />)
  expect(screen.getByRole('button', { name: /enviando/i })).toBeDisabled()
})
```

- [ ] **Step 2: Run red**

Run: `npm test -- Perfil`

Expected: FAIL on edit URL, visible error and pending label.

- [ ] **Step 3: Replace `Perfil.tsx`**

```tsx
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import './perfil.css'
import { useSession } from '../auth/AuthProvider'
import { useLinkEmail } from './useLinkEmail'
import { Button } from '../../ui/Button'
import { toggleTheme } from '../../ui/theme'

export function Perfil() {
  const { session } = useSession()
  const user = session?.user
  const isAnon = user?.is_anonymous ?? true
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const link = useLinkEmail()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitError(false)
    try {
      await link.mutateAsync(email)
      setSent(true)
    } catch {
      setSubmitError(true)
    }
  }

  return (
    <div className="app-page profile-page">
      <header><p className="lbl">Conta e preferências</p><h1>Seu perfil</h1></header>
      <section className="profile-identity"><span className="profile-avatar" aria-hidden="true">{(user?.email ?? 'V').charAt(0).toUpperCase()}</span><div><strong>{isAnon ? 'Visitante' : user?.email}</strong><span>{isAnon ? 'sessão anônima' : 'conta vinculada'}</span></div></section>
      {isAnon ? <section><p className="lbl">Garanta seu acesso</p>{sent ? <div className="profile-confirmation" role="status">Enviamos um link de confirmação para <strong>{email}</strong>.</div> : <form onSubmit={submit} className="profile-form"><p>Sua conta é temporária. Adicione um e-mail para não perder seus benefícios.</p><label className="lbl" htmlFor="email">E-mail</label><label className="input"><input id="email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="voce@email.com" /></label>{submitError ? <p className="profile-error">Não foi possível enviar. Tente de novo.</p> : null}<Button type="submit" disabled={link.isPending}>{link.isPending ? 'Enviando...' : 'Salvar meu acesso'}</Button></form>}</section> : null}
      <section><p className="lbl">Seus programas</p><Link className="row" to="/onboarding?mode=edit">Editar meus programas<span className="muted" aria-hidden="true">→</span></Link></section>
      <section><p className="lbl">Preferências</p><button className="row profile-row-button" type="button" onClick={() => toggleTheme()}>Tema claro ou escuro<span className="muted" aria-hidden="true">◑</span></button></section>
    </div>
  )
}
```

- [ ] **Step 4: Add `perfil.css`**

```css
.profile-page { display: grid; gap: var(--s6); }
.profile-page header h1 { margin: 0; font-size: var(--fz-h1); }
.profile-identity { display: flex; align-items: center; gap: var(--s3); padding: var(--s4) 0; border-bottom: 1px solid var(--line); }
.profile-avatar { width: 48px; height: 48px; display: grid; place-items: center; border-radius: 14px; background: var(--accent); color: var(--accent-ink); font-size: var(--fz-title); font-weight: 800; }
.profile-identity div { display: grid; gap: 2px; }
.profile-identity span:last-child { color: var(--muted); font-size: var(--fz-xs); }
.profile-form { display: grid; gap: var(--s2); }
.profile-form > p { margin: 0 0 var(--s2); color: var(--ink-2); line-height: var(--lh-body); }
.profile-error { margin: 0; color: var(--warn); }
.profile-confirmation { padding: var(--s4); border: 1px solid color-mix(in srgb, var(--ok) 36%, var(--line)); border-radius: var(--r-sm); background: color-mix(in srgb, var(--ok) 10%, var(--surface)); color: var(--ink-2); }
.profile-row-button { width: 100%; font-family: inherit; text-align: left; }
```

Insert `@import './features/perfil/perfil.css';` with the other imports at the top of `src/index.css`, before every `@tailwind` directive.

- [ ] **Step 5: Verify and commit**

```bash
npm test -- Perfil && npm run build
git add src/features/perfil/Perfil.tsx src/features/perfil/Perfil.test.tsx src/features/perfil/perfil.css src/index.css
git commit -m "feat(app-ui): align profile account and preferences"
```

---

### Task 6: Extract the manual wizard without behavior change

**Files:**
- Create from move: `src/features/onboarding/ManualWizard.tsx`
- Create from move: `src/features/onboarding/ManualWizard.test.tsx`
- Replace: `src/features/onboarding/OnboardingPage.tsx`

**Interfaces:**
- Produces: `ManualWizard()` with the existing data, gates, selection and persistence behavior.
- Produces a temporary `OnboardingPage()` passthrough so router/build remain green.

- [ ] **Step 1: Move the test to the new unit**

Move `src/features/onboarding/OnboardingPage.test.tsx` to `src/features/onboarding/ManualWizard.test.tsx`. Change:

```tsx
import { ManualWizard } from './ManualWizard'
```

Replace every `<OnboardingPage />` with `<ManualWizard />` and rename the describe title to `ManualWizard`.

- [ ] **Step 2: Run red**

Run: `npm test -- ManualWizard`

Expected: FAIL because `./ManualWizard` does not exist.

- [ ] **Step 3: Move implementation and preserve route component**

Move `src/features/onboarding/OnboardingPage.tsx` to `src/features/onboarding/ManualWizard.tsx`. Change only:

```tsx
export function ManualWizard() {
```

Create `src/features/onboarding/OnboardingPage.tsx`:

```tsx
import { ManualWizard } from './ManualWizard'

export function OnboardingPage() {
  return <ManualWizard />
}
```

- [ ] **Step 4: Verify and commit**

```bash
npm test -- ManualWizard && npm run build
git add -A src/features/onboarding
git commit -m "refactor(onboarding): isolate the persisted manual wizard"
```

Expected: migrated wizard tests PASS; build exits 0.

---

### Task 7: Welcome, method selection and edit mode

**Files:**
- Create: `src/features/onboarding/OnboardingIntro.tsx`
- Modify: `src/features/onboarding/OnboardingPage.tsx`
- Create: `src/features/onboarding/OnboardingPage.test.tsx`
- Modify: `src/features/onboarding/onboarding.css`

**Interfaces:**
- Produces: `WelcomeStep({ onContinue })`, `MethodStep({ onManual })`.
- `OnboardingPage` uses `useSearchParams`; `mode=edit` mounts `ManualWizard` directly.

- [ ] **Step 1: Write failing flow tests**

```tsx
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.mock('./ManualWizard', () => ({ ManualWizard: () => <div>Wizard manual real</div> }))
import { OnboardingPage } from './OnboardingPage'

describe('OnboardingPage flow', () => {
  it('goes from welcome to method and manual wizard', () => {
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' })
    expect(screen.getByRole('heading', { name: /benefícios que você já tem/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /começar/i }))
    expect(screen.getByRole('heading', { name: /como você quer começar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /gmail.*em breve/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /adicionar manualmente/i }))
    expect(screen.getByText('Wizard manual real')).toBeInTheDocument()
  })

  it('opens manual wizard directly in edit mode', () => {
    renderWithProviders(<OnboardingPage />, { route: '/onboarding?mode=edit' })
    expect(screen.getByText('Wizard manual real')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /começar/i })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run red**

Run: `npm test -- OnboardingPage`

Expected: FAIL because welcome/method screens do not exist.

- [ ] **Step 3: Create `OnboardingIntro.tsx`**

```tsx
import { Button } from '../../ui/Button'

export function WelcomeStep({ onContinue }: { onContinue: () => void }) {
  return <main className="ob-intro"><div className="ob-intro-card"><span className="ob-intro-mark" aria-hidden="true">M</span><p className="lbl">Mapa de Benefícios</p><h1>Benefícios que você já tem, finalmente no seu radar.</h1><p>Conte quais programas fazem parte da sua rotina. A gente organiza tudo em um só lugar.</p><Button onClick={onContinue}>Começar</Button></div></main>
}

export function MethodStep({ onManual }: { onManual: () => void }) {
  return <main className="ob-intro"><div className="ob-intro-card"><p className="lbl">Primeiro passo</p><h1>Como você quer começar?</h1><p>Escolha a forma de montar seu radar.</p><div className="ob-methods"><button type="button" className="ob-method" onClick={onManual}><strong>Adicionar manualmente</strong><span>Escolha seus programas e variantes.</span></button><button type="button" className="ob-method" disabled><strong>Conectar Gmail - Em breve</strong><span>A descoberta automática chegará em uma próxima etapa.</span></button></div></div></main>
}
```

- [ ] **Step 4: Replace `OnboardingPage.tsx`**

```tsx
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ManualWizard } from './ManualWizard'
import { MethodStep, WelcomeStep } from './OnboardingIntro'

type Screen = 'welcome' | 'method' | 'manual'

export function OnboardingPage() {
  const [params] = useSearchParams()
  const editing = params.get('mode') === 'edit'
  const [screen, setScreen] = useState<Screen>(editing ? 'manual' : 'welcome')
  if (screen === 'manual') return <ManualWizard />
  if (screen === 'method') return <MethodStep onManual={() => setScreen('manual')} />
  return <WelcomeStep onContinue={() => setScreen('method')} />
}
```

- [ ] **Step 5: Append intro CSS**

```css
.ob-intro { min-height: 100dvh; display: grid; align-items: center; padding: var(--s6) var(--s4); background: var(--bg); }
.ob-intro-card { width: 100%; max-width: 520px; margin: 0 auto; }
.ob-intro-mark { width: 58px; height: 58px; display: grid; place-items: center; margin-bottom: var(--s6); border-radius: 18px; background: var(--accent); color: var(--accent-ink); font-size: 24px; font-weight: 800; }
.ob-intro h1 { max-width: 14ch; margin: var(--s2) 0 var(--s3); font-size: clamp(32px, 8vw, 48px); line-height: 1.05; }
.ob-intro-card > p:not(.lbl) { max-width: 44ch; margin: 0 0 var(--s6); color: var(--ink-2); line-height: var(--lh-body); }
.ob-intro .btn { max-width: 320px; }
.ob-methods { display: grid; gap: var(--s3); }
.ob-method { display: grid; gap: var(--s1); width: 100%; padding: var(--s5); border: 1px solid var(--line); border-radius: var(--r-sm); background: var(--surface); color: var(--ink); text-align: left; cursor: pointer; }
.ob-method span { color: var(--ink-2); }
.ob-method:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.ob-method:disabled { cursor: not-allowed; opacity: .62; }
@media (min-width: 720px) { .ob-intro-card { padding: var(--s8); border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface); box-shadow: var(--shadow); } }
```

- [ ] **Step 6: Verify and commit**

```bash
npm test -- OnboardingPage ManualWizard Perfil router && npm run build
git add src/features/onboarding/OnboardingIntro.tsx src/features/onboarding/OnboardingPage.tsx src/features/onboarding/OnboardingPage.test.tsx src/features/onboarding/onboarding.css
git commit -m "feat(onboarding): add welcome and discovery method flow"
```

---

### Task 8: Recoverable manual-wizard data states

**Files:**
- Modify: `src/features/onboarding/ManualWizard.tsx`
- Modify: `src/features/onboarding/ManualWizard.test.tsx`
- Modify: `src/features/onboarding/onboarding.css`

**Interfaces:**
- Consumes: `refetch` from `useSources` and `useUserSources`.
- Produces: stable loading, retryable read error, unavailable-catalog state and selection preservation after save failure.

- [ ] **Step 1: Make query mocks mutable and add failing tests**

In `ManualWizard.test.tsx`, replace the `useSources` and `useUserSources` mocks with:

```tsx
const refetchSources = vi.fn()
const refetchExisting = vi.fn()
let sourceResult: { data: CategoryGroup[] | undefined; isLoading: boolean; error: unknown; refetch: typeof refetchSources }
let existingResult: { data: string[] | undefined; isLoading: boolean; error: unknown; refetch: typeof refetchExisting }

vi.mock('./useSources', () => ({ useSources: () => sourceResult }))
vi.mock('./useUserSources', () => ({ useUserSources: () => existingResult }))

beforeEach(() => {
  refetchSources.mockReset()
  refetchExisting.mockReset()
  sourceResult = { data: [bankGroup, loyaltyGroup], isLoading: false, error: null, refetch: refetchSources }
  existingResult = { data: [], isLoading: false, error: null, refetch: refetchExisting }
})
```

Adapt existing assignments from `groups = value` to `sourceResult.data = value` and from `existing = value` to `existingResult = { ...existingResult, ...value }`. Add:

```tsx
it('shows stable loading and retries both read queries', () => {
  sourceResult.isLoading = true
  const view = renderWithProviders(<ManualWizard />)
  expect(screen.getByLabelText(/carregando seus programas/i)).toBeInTheDocument()
  view.unmount()
  sourceResult = { ...sourceResult, isLoading: false, error: new Error('down') }
  renderWithProviders(<ManualWizard />)
  fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
  expect(refetchSources).toHaveBeenCalledTimes(1)
  expect(refetchExisting).toHaveBeenCalledTimes(1)
})

it('keeps gates and selection after save failure', async () => {
  sourceResult.data = [bankGroup]
  saveMutate.mockRejectedValueOnce(new Error('write failed'))
  renderWithProviders(<ManualWizard />)
  fireEvent.click(screen.getByRole('button', { name: /^tenho$/i }))
  const item = screen.getByRole('button', { name: /black/i })
  fireEvent.click(item)
  fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
  expect(await screen.findByText(/não foi possível salvar/i)).toBeInTheDocument()
  expect(item).toHaveAttribute('aria-pressed', 'true')
})
```

- [ ] **Step 2: Run red**

Run: `npm test -- ManualWizard`

Expected: FAIL on loading label, retry actions and save-preservation assertion.

- [ ] **Step 3: Refactor query destructuring and early states**

At the start of `ManualWizard`, replace query destructuring with:

```tsx
const existingQuery = useUserSources(session?.user.id)
const sourcesQuery = useSources()
const existing = existingQuery.data
const groups = sourcesQuery.data
```

Replace the loading/error/empty early returns with:

```tsx
if (sourcesQuery.isLoading || existingQuery.isLoading) {
  return <div className="ob-state" aria-label="Carregando seus programas"><Skeleton height="28px" /><Skeleton height="180px" radius="18px" /><Skeleton height="52px" radius="13px" /></div>
}
if (sourcesQuery.error || existingQuery.error) {
  return <div className="ob-state"><PageState title="Não foi possível carregar seus programas" action={{ label: 'Tentar novamente', onClick: () => { void sourcesQuery.refetch(); void existingQuery.refetch() } }} /></div>
}
const steps: CategoryGroup[] = groups ?? []
if (steps.length === 0) {
  return <div className="ob-state"><PageState title="Nenhum programa disponível" description="O catálogo ainda não possui programas para esta etapa." /></div>
}
```

Import `PageState` and `Skeleton` from `../../ui`. Keep `saveError` rendered inside the wizard and do not reset `selected`, `gates` or `step` in the save catch branch.

- [ ] **Step 4: Add the state-shell CSS**

```css
.ob-state { width: 100%; max-width: 520px; min-height: 100dvh; margin: 0 auto; padding: var(--s6) var(--s4); display: grid; align-content: center; gap: var(--s4); }
```

- [ ] **Step 5: Verify and commit**

```bash
npm test -- ManualWizard && npm run build
git add src/features/onboarding/ManualWizard.tsx src/features/onboarding/ManualWizard.test.tsx src/features/onboarding/onboarding.css
git commit -m "feat(onboarding): add recoverable wizard states"
```

---

### Task 9: Playwright visual gate and final verification

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.gitignore`
- Create: `playwright.config.ts`
- Create: `tests/e2e/app-layout.spec.ts`
- Modify: `docs/mockups/design_handoff_mockups/README.md`
- Modify: `docs/superpowers/plans/README.md`

**Interfaces:**
- Produces scripts `test:e2e` and `test:visual`.
- Requires local Supabase at `127.0.0.1:54321` and Playwright Chromium.
- Produces screenshots under `test-results/`; no pixel baseline is committed.

- [ ] **Step 1: Install Playwright and add scripts**

```bash
npm install --save-dev @playwright/test
npx playwright install chromium
```

Add to `package.json`:

```json
"test:e2e": "playwright test",
"test:visual": "playwright test tests/e2e/app-layout.spec.ts"
```

Append to `.gitignore`:

```gitignore
test-results/
playwright-report/
```

- [ ] **Step 2: Create `playwright.config.ts`**

```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
  },
  projects: [
    { name: 'mobile-light', use: { viewport: { width: 390, height: 844 } } },
    { name: 'mobile-dark', use: { viewport: { width: 390, height: 844 } } },
    { name: 'desktop-light', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'desktop-dark', use: { viewport: { width: 1440, height: 900 } } },
  ],
})
```

- [ ] **Step 3: Create the browser gate**

```ts
import { test, expect, type Page } from '@playwright/test'

async function assertNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }))
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client)
}

test.beforeEach(async ({ page }, testInfo) => {
  const dark = testInfo.project.name.endsWith('dark')
  await page.addInitScript((theme) => localStorage.setItem('mb-theme', theme), dark ? 'dark' : 'light')
})

test('onboarding exposes manual flow and disabled Gmail', async ({ page }, testInfo) => {
  await page.goto('/onboarding')
  await expect(page.getByRole('heading', { name: /benefícios que você já tem/i })).toBeVisible()
  await page.getByRole('button', { name: /começar/i }).click()
  await expect(page.getByRole('button', { name: /gmail.*em breve/i })).toBeDisabled()
  await assertNoHorizontalOverflow(page)
  await page.screenshot({ path: `test-results/${testInfo.project.name}-onboarding.png`, fullPage: true })
  await page.getByRole('button', { name: /adicionar manualmente/i }).click()
  await expect(page.getByText(/passo 1 de/i)).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await page.screenshot({ path: `test-results/${testInfo.project.name}-wizard.png`, fullPage: true })
})

for (const route of ['/painel', '/buscar', '/perfil', '/beneficio/inexistente']) {
  test(`${route} renders without overflow`, async ({ page }, testInfo) => {
    await page.goto(route)
    await page.waitForLoadState('networkidle')
    await assertNoHorizontalOverflow(page)
    const desktop = testInfo.project.name.startsWith('desktop')
    const bottom = page.locator('.tabbar')
    const sidebar = page.locator('.side')
    const shellRoute = !route.startsWith('/beneficio/')
    if (!shellRoute) {
      await expect(bottom).toHaveCount(0)
      await expect(sidebar).toHaveCount(0)
    } else if (desktop) {
      await expect(bottom).toBeHidden()
      await expect(sidebar).toBeVisible()
    } else {
      await expect(bottom).toBeVisible()
      await expect(sidebar).toBeHidden()
    }
    const slug = route.replaceAll('/', '-') || '-root'
    await page.screenshot({ path: `test-results/${testInfo.project.name}${slug}.png`, fullPage: true })
  })
}

test('manual setup produces a populated radar and navigable detail', async ({ page }, testInfo) => {
  await page.goto('/onboarding?mode=edit')
  await expect(page.getByText(/passo 1 de/i)).toBeVisible()
  for (let step = 0; step < 20; step += 1) {
    if (step === 0) {
      await page.getByRole('button', { name: /^tenho$/i }).click()
      await page.locator('.ob-provider .chip').first().click()
    } else {
      await page.getByRole('button', { name: /n.o tenho/i }).click()
    }
    const conclude = page.getByRole('button', { name: /concluir/i })
    if (await conclude.count()) {
      await conclude.click()
      break
    }
    await page.getByRole('button', { name: /avan.ar/i }).click()
  }
  await expect(page).toHaveURL(/\/painel$/, { timeout: 10_000 })
  await expect(page.locator('.pass').first()).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await page.screenshot({ path: `test-results/${testInfo.project.name}-painel-populado.png`, fullPage: true })
  await page.locator('a[href^="/beneficio/"]').first().click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await page.screenshot({ path: `test-results/${testInfo.project.name}-detalhe-real.png`, fullPage: true })
})
```

- [ ] **Step 4: Run visual gate**

```bash
npx -y supabase@2.95.0 status
npm run test:visual
```

Expected: Supabase reports API `http://127.0.0.1:54321`; Playwright reports 24 PASS (6 scenarios x 4 projects); screenshot files exist; no overflow assertion fails.

- [ ] **Step 5: Compare screenshots and update status docs**

Compare screenshots with the matching `.dc.html`. Confirm bottom nav/mobile, sidebar/desktop, both themes, no clipping, Gmail unavailable, and fixed navigation not covering content.

Update `docs/mockups/design_handoff_mockups/README.md`: mark existing app layouts aligned; keep Admin shell, Gmail integration and Alerts as separate fronts.

Update `docs/superpowers/plans/README.md`: add this plan as `implementado localmente` only after all gates pass.

- [ ] **Step 6: Run complete verification**

```bash
npm test && npm run build && npm run test:visual && git diff --check
```

Expected: all Vitest files/tests PASS; build exits 0; Playwright 24/24 PASS; `git diff --check` has no output.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .gitignore playwright.config.ts tests/e2e/app-layout.spec.ts docs/mockups/design_handoff_mockups/README.md docs/superpowers/plans/README.md
git commit -m "test(app-ui): add responsive visual acceptance gate"
```

---

## Self-Review

**Spec coverage:**

- Shell mobile/desktop/theme -> Tasks 1 and 8.
- Painel loading/error/empty/populated/filter-empty -> Task 2.
- Busca live, clear, count and distinct states -> Task 3.
- Detalhe transparency, safe links, loading/error/not-found -> Task 4.
- Perfil account/link states/edit URL/theme -> Task 5.
- Onboarding persisted manual behavior -> Task 6.
- Welcome/method/Gmail `Em breve`/mode edit -> Task 7.
- Wizard loading/retry/empty/save preservation -> Task 8.
- Full regression and four visual combinations -> Task 9.
- No backend/schema/RPC work appears in any task.

**Type consistency:** `PageState`, `ManualWizard`, `WelcomeStep`, `MethodStep`, query `refetch`, and `/onboarding?mode=edit` use the same names across producers and consumers.

**Execution order:** Tasks are sequential. Task 1 provides shared contracts; Tasks 2-5 consume them; Task 6 isolates the wizard; Task 7 adds the flow; Task 8 closes its data states; Task 9 verifies the integrated app.
