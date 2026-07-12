# Conclusão do Fluxo do App — Gmail Prévia + Alertas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar o Fluxo do App (9/12 → 12/12) adicionando o caminho de descoberta Gmail Prévia (Vasculhando + Revisar Gmail) e a tela de Alertas, tudo visual + mock, sem Gmail nem motor de alertas reais.

**Architecture:** React 18 + React Router + TanStack Query + Supabase. O onboarding é orquestrado por estado em `OnboardingPage`; o caminho Gmail é um scan cosmético que "acha" um subconjunto determinístico do catálogo real e salva a **união** com os programas existentes (não destrutivo). Alertas é uma rota de tela cheia com preferências em `localStorage`.

**Tech Stack:** React, TypeScript, react-router-dom, @tanstack/react-query, Supabase JS, Vitest + Testing Library, Playwright.

Spec: `docs/superpowers/specs/2026-07-12-app-flow-gmail-demo-alertas-design.md`.

## Global Constraints

- Só tokens de `src/ui/ds.css` para superfícies/texto/bordas/estados; sem cor hardcoded exceto gradientes de marca já aprovados.
- Animações decorativas atrás de `@media (prefers-reduced-motion: reduce)`.
- Honestidade: nenhuma copy afirma que lemos o e-mail; tudo é "prévia/demonstração".
- Persistência via `useSaveUserSources` (RPC `replace_user_sources`) — o Gmail salva **união(existentes, incluídos)**; nunca substitui destrutivamente.
- Valores em R$ = placeholder `nº de programas × 180/ano`, rotulados "estimado".
- Mobile-first (390×844); desktop aditivo; tema claro e escuro.
- `npm test` NÃO roda tsc — rodar `npm run build` para checar tipos ao fim de cada task.

---

## File Structure

- `src/features/onboarding/OnboardingIntro.tsx` (modificar) — Método: card Gmail "Prévia" + `onGmail`.
- `src/features/alertas/useAlertPrefs.ts` (criar) — hook `localStorage` `mb-alerts` com recuperação.
- `src/features/alertas/Alertas.tsx` (criar) — tela de opt-in, modos onboarding/edição.
- `src/features/alertas/alertas.css` (criar) — estilos da tela + toggles.
- `src/features/perfil/Perfil.tsx` (modificar) — linha "Alertas".
- `src/features/onboarding/RadarMontado.tsx` (modificar) — `onView` já é prop; conteúdo inalterado.
- `src/features/onboarding/ManualWizard.tsx` (modificar) — `onView` do RadarMontado por modo (edit → /painel; onboarding → /alertas).
- `src/features/onboarding/demoFindings.ts` (criar) — helper puro D3.
- `src/features/onboarding/Vasculhando.tsx` (criar) — scan cosmético.
- `src/features/onboarding/RevisarGmail.tsx` (criar) — revisar achados, merge D1.
- `src/features/onboarding/OnboardingPage.tsx` (modificar) — estados `gmail-scan`/`gmail-review`, `useSources`, fallback D4, wiring.
- `src/features/onboarding/onboarding.css` (modificar) — keyframes `mb-sweep`/`mb-ping`/`mb-pop` + estilos das telas.
- `src/router.tsx` (modificar) — rota `/alertas` (tela cheia).
- `src/index.css` (modificar) — `@import` de `alertas.css`.
- `tests/e2e/app-layout.spec.ts` (modificar) — cenário do caminho Gmail.
- `supabase/seed.sql` (verificar) — invariante ≥1 fonte com ≥1 item na 1ª categoria.

---

### Task 1: Método — card Gmail "Prévia"

**Files:**
- Modify: `src/features/onboarding/OnboardingIntro.tsx`
- Test: `src/features/onboarding/OnboardingPage.test.tsx` (ajustar), `src/features/onboarding/MethodStep` coberto lá

**Interfaces:**
- Produces: `MethodStep({ onManual: () => void; onBack?: () => void; onGmail: () => void })`. O card Gmail deixa de ser `disabled`, badge vira "Prévia" e `onClick={onGmail}`.

- [ ] **Step 1: Update the flow test to expect the enabled Gmail preview card**

Em `src/features/onboarding/OnboardingPage.test.tsx`, no teste `goes from welcome to method and manual wizard`, trocar a asserção do Gmail desabilitado:

```tsx
// ANTES: expect(screen.getByRole('button', { name: /gmail.*em breve/i })).toBeDisabled()
expect(screen.getByRole('button', { name: /conectar gmail.*prévia/i })).toBeEnabled()
```

- [ ] **Step 2: Run red**

Run: `npx vitest run src/features/onboarding/OnboardingPage.test.tsx`
Expected: FAIL (ainda existe "Em breve"/disabled).

- [ ] **Step 3: Enable the Gmail card in `MethodStep`**

Em `OnboardingIntro.tsx`, mudar a assinatura de `MethodStep` e o card Gmail:

```tsx
export function MethodStep({ onManual, onBack, onGmail }: { onManual: () => void; onBack?: () => void; onGmail: () => void }) {
```

Trocar o `<button ... disabled>` do Gmail por um card clicável (remover `disabled`, badge "Prévia", `onClick={onGmail}`), mantendo `ob-option-gmail`, aurora e twinkles:

```tsx
<button type="button" className="ob-option ob-option-gmail" onClick={onGmail}>
  <span className="ob-option-fx" aria-hidden="true">
    <span className="ob-aurora ob-aurora-1" />
    <span className="ob-aurora ob-aurora-2" />
    <TwinkleStar size={13} style={{ top: 13, right: 54 }} />
    <TwinkleStar size={9} style={{ top: 32, right: 42, color: 'var(--c-pontos)' }} />
    <TwinkleStar size={9} style={{ left: 46, top: 9, color: 'var(--c-cashback)' }} />
  </span>
  <span className="ob-option-row">
    <span className="ob-option-icon gmail"><GmailGlyph /></span>
    <span className="ob-option-body">
      <span className="ob-option-titles">
        <strong>Conectar Gmail</strong>
        <span className="ob-badge-magic">Prévia</span>
      </span>
      <p>Uma demonstração de como a descoberta automática vai funcionar — com seus programas do catálogo. Nada é lido do seu e-mail.</p>
      <span className="ob-tags">
        <span className="ob-tag">Mais rápido</span>
        <span className="ob-tag">Você revisa antes de salvar</span>
      </span>
    </span>
    <span className="ob-option-radio" aria-hidden="true" />
  </span>
</button>
```

- [ ] **Step 4: Run green**

Run: `npx vitest run src/features/onboarding/OnboardingPage.test.tsx`
Expected: o teste do card Gmail passa. (O restante do fluxo pode falhar por falta de `onGmail` no `OnboardingPage` — será ligado na Task 9; se falhar só por isso, seguir.)

Nota: nesta task o `OnboardingPage` ainda passa `onGmail` inexistente. Passar `onGmail={() => {}}` temporário no `OnboardingPage` para compilar:

```tsx
if (screen === 'method') {
  return <MethodStep onManual={() => setScreen('manual')} onBack={() => setScreen('welcome')} onGmail={() => {}} />
}
```

- [ ] **Step 5: Build + commit**

```bash
npm run build
git add src/features/onboarding/OnboardingIntro.tsx src/features/onboarding/OnboardingPage.tsx src/features/onboarding/OnboardingPage.test.tsx
git commit -m "feat(onboarding): enable Gmail preview card in method step"
```

---

### Task 2: `useAlertPrefs` — preferências em localStorage

**Files:**
- Create: `src/features/alertas/useAlertPrefs.ts`
- Test: `src/features/alertas/useAlertPrefs.test.ts`

**Interfaces:**
- Produces:
  - `type AlertPrefs = { v: 1; optIn: boolean; novos: boolean; prazo: boolean; resumo: boolean }`
  - `const DEFAULT_PREFS: AlertPrefs` = `{ v: 1, optIn: false, novos: true, prazo: true, resumo: false }`
  - `function readAlertPrefs(): AlertPrefs` — lê `localStorage['mb-alerts']`, com try/catch e checagem de `v===1`; fallback defaults.
  - `function writeAlertPrefs(p: AlertPrefs): void` — grava; try/catch silencioso.
  - `function useAlertPrefs(): { prefs: AlertPrefs; set: (patch: Partial<AlertPrefs>) => void }` — estado local inicializado de `readAlertPrefs`, `set` mescla + grava.

- [ ] **Step 1: Write the failing test**

Create `src/features/alertas/useAlertPrefs.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { readAlertPrefs, writeAlertPrefs, DEFAULT_PREFS } from './useAlertPrefs'

beforeEach(() => localStorage.clear())

describe('alert prefs storage', () => {
  it('returns defaults when nothing stored', () => {
    expect(readAlertPrefs()).toEqual(DEFAULT_PREFS)
  })
  it('round-trips written prefs', () => {
    writeAlertPrefs({ v: 1, optIn: true, novos: false, prazo: true, resumo: true })
    expect(readAlertPrefs()).toEqual({ v: 1, optIn: true, novos: false, prazo: true, resumo: true })
  })
  it('falls back to defaults on invalid JSON', () => {
    localStorage.setItem('mb-alerts', '{not json')
    expect(readAlertPrefs()).toEqual(DEFAULT_PREFS)
  })
  it('falls back to defaults on wrong version', () => {
    localStorage.setItem('mb-alerts', JSON.stringify({ v: 99, optIn: true }))
    expect(readAlertPrefs()).toEqual(DEFAULT_PREFS)
  })
})
```

- [ ] **Step 2: Run red**

Run: `npx vitest run src/features/alertas/useAlertPrefs.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implement the hook + storage**

Create `src/features/alertas/useAlertPrefs.ts`:

```ts
import { useState } from 'react'

export interface AlertPrefs {
  v: 1
  optIn: boolean
  novos: boolean
  prazo: boolean
  resumo: boolean
}

export const DEFAULT_PREFS: AlertPrefs = { v: 1, optIn: false, novos: true, prazo: true, resumo: false }

const KEY = 'mb-alerts'

export function readAlertPrefs(): AlertPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw)
    if (!parsed || parsed.v !== 1) return DEFAULT_PREFS
    return {
      v: 1,
      optIn: !!parsed.optIn,
      novos: !!parsed.novos,
      prazo: !!parsed.prazo,
      resumo: !!parsed.resumo,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

export function writeAlertPrefs(p: AlertPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // storage indisponível — mock, ignora
  }
}

export function useAlertPrefs() {
  const [prefs, setPrefs] = useState<AlertPrefs>(() => readAlertPrefs())
  function set(patch: Partial<AlertPrefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch }
      writeAlertPrefs(next)
      return next
    })
  }
  return { prefs, set }
}
```

- [ ] **Step 4: Run green**

Run: `npx vitest run src/features/alertas/useAlertPrefs.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/alertas/useAlertPrefs.ts src/features/alertas/useAlertPrefs.test.ts
git commit -m "feat(alertas): add local alert-prefs storage hook"
```

---

### Task 3: Tela de Alertas + rota `/alertas`

**Files:**
- Create: `src/features/alertas/Alertas.tsx`
- Create: `src/features/alertas/alertas.css`
- Test: `src/features/alertas/Alertas.test.tsx`
- Modify: `src/router.tsx`, `src/index.css`

**Interfaces:**
- Consumes: `useAlertPrefs`, `useSearchParams`, `useNavigate`.
- Produces: `Alertas()` (rota `/alertas`). Modo por `searchParams.get('from') === 'onboarding'`.

- [ ] **Step 1: Write the failing test**

Create `src/features/alertas/Alertas.test.tsx`:

```tsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

import { Alertas } from './Alertas'

beforeEach(() => {
  localStorage.clear()
  navigateMock.mockReset()
})

describe('Alertas', () => {
  it('modo onboarding: "Ativar alertas" grava optIn e vai ao painel', () => {
    renderWithProviders(<Alertas />, { route: '/alertas?from=onboarding' })
    fireEvent.click(screen.getByRole('button', { name: /ativar alertas/i }))
    expect(JSON.parse(localStorage.getItem('mb-alerts')!).optIn).toBe(true)
    expect(navigateMock).toHaveBeenCalledWith('/painel')
  })

  it('modo onboarding: "Agora não" grava optIn=false e vai ao painel', () => {
    renderWithProviders(<Alertas />, { route: '/alertas?from=onboarding' })
    fireEvent.click(screen.getByRole('button', { name: /agora não/i }))
    expect(JSON.parse(localStorage.getItem('mb-alerts')!).optIn).toBe(false)
    expect(navigateMock).toHaveBeenCalledWith('/painel')
  })

  it('toggle switch alterna e persiste', () => {
    renderWithProviders(<Alertas />, { route: '/alertas?from=onboarding' })
    const resumo = screen.getByRole('switch', { name: /resumo mensal/i })
    expect(resumo).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(resumo)
    expect(resumo).toHaveAttribute('aria-checked', 'true')
    expect(JSON.parse(localStorage.getItem('mb-alerts')!).resumo).toBe(true)
  })

  it('modo edição: mostra Voltar (→ perfil), sem "Agora não"; ligar toggle deriva optIn', () => {
    renderWithProviders(<Alertas />, { route: '/alertas' })
    expect(screen.queryByRole('button', { name: /agora não/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }))
    expect(navigateMock).toHaveBeenCalledWith('/perfil')
  })
})
```

- [ ] **Step 2: Run red**

Run: `npx vitest run src/features/alertas/Alertas.test.tsx`
Expected: FAIL (componente não existe).

- [ ] **Step 3: Implement `Alertas.tsx`**

Create `src/features/alertas/Alertas.tsx`:

```tsx
import { useNavigate, useSearchParams } from 'react-router-dom'
import './alertas.css'
import { useAlertPrefs } from './useAlertPrefs'
import { Button } from '../../ui/Button'

const ROWS = [
  { key: 'novos' as const, title: 'Novos benefícios', desc: 'Quando acharmos algo novo nos seus programas.' },
  { key: 'prazo' as const, title: 'Prazo de expiração', desc: 'Antes que um acesso ou promoção acabe.' },
  { key: 'resumo' as const, title: 'Resumo mensal', desc: 'Um panorama do que você deixou de usar.' },
]

export function Alertas() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const onboarding = params.get('from') === 'onboarding'
  const { prefs, set } = useAlertPrefs()

  function toggle(key: 'novos' | 'prazo' | 'resumo') {
    const next = { ...prefs, [key]: !prefs[key] }
    // modo edição: optIn derivado dos toggles; onboarding: mantém o valor atual
    const optIn = onboarding ? prefs.optIn : next.novos || next.prazo || next.resumo
    set({ [key]: next[key], optIn })
  }

  return (
    <main className="alerts-page">
      <div className="alerts-inner">
        <header className="alerts-head">
          {!onboarding ? (
            <button type="button" className="ob-back-btn" aria-label="Voltar" onClick={() => navigate('/perfil')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          ) : null}
          <span className="alerts-bell" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          </span>
          <h1>Não perca um benefício</h1>
          <p>Escolha o que quer receber. Você pode mudar depois no seu perfil.</p>
        </header>

        <div className="alerts-list">
          {ROWS.map((r) => (
            <button
              key={r.key}
              type="button"
              role="switch"
              aria-checked={prefs[r.key]}
              className={'alerts-row' + (prefs[r.key] ? ' on' : '')}
              onClick={() => toggle(r.key)}
            >
              <span className="alerts-row-text">
                <strong>{r.title}</strong>
                <span>{r.desc}</span>
              </span>
              <span className="alerts-switch" aria-hidden="true"><span className="alerts-knob" /></span>
            </button>
          ))}
        </div>

        {onboarding ? (
          <div className="alerts-actions">
            <Button onClick={() => { set({ optIn: true }); navigate('/painel') }}>Ativar alertas</Button>
            <button type="button" className="ob-secondary" onClick={() => { set({ optIn: false }); navigate('/painel') }}>Agora não</button>
          </div>
        ) : null}
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Add `alertas.css`**

Create `src/features/alertas/alertas.css`:

```css
.alerts-page { min-height: 100dvh; display: flex; flex-direction: column; background: var(--bg); }
.alerts-inner { flex: 1; width: 100%; max-width: 480px; margin: 0 auto; padding: var(--s8) var(--s5) var(--s6); display: flex; flex-direction: column; }
.alerts-head { text-align: center; }
.alerts-head .ob-back-btn { float: left; }
.alerts-bell { display: grid; place-items: center; width: 64px; height: 64px; margin: 0 auto var(--s4); border-radius: 20px; background: var(--accent-soft); color: var(--accent); }
.alerts-head h1 { margin: 0 0 8px; font-size: 25px; font-weight: 800; letter-spacing: -.03em; color: var(--ink); }
.alerts-head p { margin: 0 0 var(--s6); font-size: 14px; line-height: 1.5; color: var(--ink-2); }
.alerts-list { display: flex; flex-direction: column; gap: 10px; }
.alerts-row { display: flex; align-items: center; gap: 12px; width: 100%; padding: 14px 16px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow); text-align: left; cursor: pointer; font: inherit; color: var(--ink); }
.alerts-row:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.alerts-row-text { flex: 1; display: grid; gap: 2px; min-width: 0; }
.alerts-row-text strong { font-size: 14.5px; font-weight: 700; color: var(--ink); }
.alerts-row-text span { font-size: 12.5px; color: var(--ink-2); line-height: 1.4; }
.alerts-switch { flex: none; width: 44px; height: 26px; border-radius: 999px; background: var(--line); position: relative; transition: background .18s var(--ease); }
.alerts-knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: var(--shadow); transition: transform .18s var(--ease); }
.alerts-row.on .alerts-switch { background: var(--accent); }
.alerts-row.on .alerts-knob { transform: translateX(18px); }
.alerts-actions { margin-top: auto; padding-top: var(--s6); display: grid; gap: var(--s2); }
.alerts-actions .btn { margin: 0; }
@media (prefers-reduced-motion: reduce) { .alerts-switch, .alerts-knob { transition: none; } }
```

Adicionar em `src/index.css`, junto dos outros `@import` (antes das diretivas `@tailwind`):

```css
@import './features/alertas/alertas.css';
```

- [ ] **Step 5: Add the route**

Em `src/router.tsx`, importar e adicionar a rota de tela cheia (fora do `AppLayout`, ao lado de `/beneficio/:id`):

```tsx
import { Alertas } from './features/alertas/Alertas'
// ...
  { path: '/beneficio/:id', element: <BenefitDetail /> },
  { path: '/alertas', element: <Alertas /> },
```

- [ ] **Step 6: Run green + build + commit**

```bash
npx vitest run src/features/alertas/Alertas.test.tsx && npm run build
git add src/features/alertas/ src/router.tsx src/index.css
git commit -m "feat(alertas): add alerts opt-in screen and route"
```

Expected: 4 tests PASS; build 0.

---

### Task 4: Perfil — linha "Alertas"

**Files:**
- Modify: `src/features/perfil/Perfil.tsx`
- Test: `src/features/perfil/Perfil.test.tsx`

**Interfaces:**
- Consumes: rota `/alertas` (Task 3).
- Produces: link/linha "Alertas" apontando para `/alertas` na seção "Conta", entre "Editar meus programas" e "Tema".

- [ ] **Step 1: Write the failing test**

Adicionar em `src/features/perfil/Perfil.test.tsx` (dentro do `describe` existente):

```tsx
it('tem uma linha de Alertas apontando para /alertas', () => {
  sessionValue = { session: { user: { id: 'u1', is_anonymous: true, email: null } }, loading: false }
  renderWithProviders(<Perfil />)
  expect(screen.getByRole('link', { name: /alertas/i })).toHaveAttribute('href', '/alertas')
})
```

- [ ] **Step 2: Run red**

Run: `npx vitest run src/features/perfil/Perfil.test.tsx`
Expected: FAIL (sem link de Alertas).

- [ ] **Step 3: Add the row**

Em `Perfil.tsx`, dentro de `.profile-rows`, entre a linha "Editar meus programas" (`Link` para `/onboarding?mode=edit`) e o botão de Tema, inserir:

```tsx
<Link className="profile-row" to="/alertas">
  <span className="profile-row-icon" aria-hidden="true">
    <svg {...stroke}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
  </span>
  <span className="profile-row-label">Alertas</span>
  <span className="profile-row-chev" aria-hidden="true">›</span>
</Link>
```

(`stroke` já é o objeto de props de SVG definido no topo de `Perfil.tsx`.)

- [ ] **Step 4: Run green + build + commit**

```bash
npx vitest run src/features/perfil/Perfil.test.tsx && npm run build
git add src/features/perfil/Perfil.tsx src/features/perfil/Perfil.test.tsx
git commit -m "feat(perfil): add alerts row linking to /alertas"
```

---

### Task 5: RadarMontado destino por-caminho (D6)

**Files:**
- Modify: `src/features/onboarding/ManualWizard.tsx`
- Test: `src/features/onboarding/ManualWizard.test.tsx`

**Interfaces:**
- `RadarMontado` já aceita `onView: () => void` (inalterado).
- `ManualWizard` detecta edição via `useSearchParams().get('mode') === 'edit'` e passa `onView` = edição → `navigate('/painel')`; onboarding → `navigate('/alertas?from=onboarding')`.

- [ ] **Step 1: Update the success-flow test**

Em `ManualWizard.test.tsx`, o teste `mostra a 1ª categoria, seleciona um provedor e conclui` roda SEM `mode=edit` (onboarding). Trocar a asserção final:

```tsx
// ANTES: expect(navigateMock).toHaveBeenCalledWith('/painel')
expect(navigateMock).toHaveBeenCalledWith('/alertas?from=onboarding')
```

Adicionar um teste novo para o modo edição:

```tsx
it('modo edição: "Ver meu radar" vai direto ao painel (sem alertas)', async () => {
  sourceResult.data = [bankGroup]
  renderWithProviders(<ManualWizard />, { route: '/onboarding?mode=edit' })
  fireEvent.click(screen.getByRole('button', { name: /black/i }))
  fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
  const ver = await screen.findByRole('button', { name: /ver meu radar/i }, { timeout: 2500 })
  fireEvent.click(ver)
  expect(navigateMock).toHaveBeenCalledWith('/painel')
})
```

- [ ] **Step 2: Run red**

Run: `npx vitest run src/features/onboarding/ManualWizard.test.tsx`
Expected: FAIL (ainda navega `/painel` no onboarding).

- [ ] **Step 3: Make `onView` mode-aware**

Em `ManualWizard.tsx`, importar `useSearchParams` e computar o destino:

```tsx
import { useNavigate, useSearchParams } from 'react-router-dom'
// ... dentro do componente:
const [params] = useSearchParams()
const editing = params.get('mode') === 'edit'
```

No render do estado `done`:

```tsx
return <RadarMontado groups={summaryGroups} onView={() => navigate(editing ? '/painel' : '/alertas?from=onboarding')} />
```

- [ ] **Step 4: Run green + build + commit**

```bash
npx vitest run src/features/onboarding/ManualWizard.test.tsx && npm run build
git add src/features/onboarding/ManualWizard.tsx src/features/onboarding/ManualWizard.test.tsx
git commit -m "feat(onboarding): route to alerts after onboarding radar, painel on edit"
```

---

### Task 6: `demoFindings` — conjunto demo determinístico (D3)

**Files:**
- Create: `src/features/onboarding/demoFindings.ts`
- Test: `src/features/onboarding/demoFindings.test.ts`

**Interfaces:**
- Consumes: `CategoryGroup[]` (de `groupSourcesByCategory`).
- Produces: `type Finding = { itemId: string; provider: string; variant: string }` e `function demoFindings(groups: CategoryGroup[]): Finding[]` — 1ª categoria; as **3 primeiras fontes com ≥1 item** (ordem do array, que já vem por `sort_order`); o **primeiro item** de cada.

- [ ] **Step 1: Write the failing test**

Create `src/features/onboarding/demoFindings.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { demoFindings } from './demoFindings'
import type { CategoryGroup } from './groupSourcesByCategory'

const g = (over: Partial<CategoryGroup> = {}): CategoryGroup => ({
  category: 'bank_card',
  meta: { key: 'bank_card', label: 'Bancos & cartões', icon: '🏦' },
  sources: [],
  ...over,
})

const src = (id: string, name: string, items: { id: string; label: string }[]) => ({
  id, kind: 'card' as const, name, logo_url: null, sort_order: 1, source_category: 'bank_card' as const,
  source_items: items.map((i, idx) => ({ ...i, sort_order: idx + 1 })),
})

describe('demoFindings', () => {
  it('pega até 3 fontes da 1ª categoria, primeiro item de cada', () => {
    const groups = [g({ sources: [
      src('s1', 'Nubank', [{ id: 'i1', label: 'Ultravioleta' }, { id: 'i1b', label: 'Gold' }]),
      src('s2', 'Itaú', [{ id: 'i2', label: 'Black' }]),
      src('s3', 'Inter', [{ id: 'i3', label: 'Prime' }]),
      src('s4', 'XP', [{ id: 'i4', label: 'One' }]),
    ] })]
    expect(demoFindings(groups)).toEqual([
      { itemId: 'i1', provider: 'Nubank', variant: 'Ultravioleta' },
      { itemId: 'i2', provider: 'Itaú', variant: 'Black' },
      { itemId: 'i3', provider: 'Inter', variant: 'Prime' },
    ])
  })
  it('pula fontes sem item e usa o que houver', () => {
    const groups = [g({ sources: [
      src('s1', 'SemItem', []),
      src('s2', 'Itaú', [{ id: 'i2', label: 'Black' }]),
    ] })]
    expect(demoFindings(groups)).toEqual([{ itemId: 'i2', provider: 'Itaú', variant: 'Black' }])
  })
  it('retorna [] quando não há categorias', () => {
    expect(demoFindings([])).toEqual([])
  })
})
```

- [ ] **Step 2: Run red**

Run: `npx vitest run src/features/onboarding/demoFindings.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implement**

Create `src/features/onboarding/demoFindings.ts`:

```ts
import type { CategoryGroup } from './groupSourcesByCategory'

export interface Finding {
  itemId: string
  provider: string
  variant: string
}

export function demoFindings(groups: CategoryGroup[]): Finding[] {
  const first = groups[0]
  if (!first) return []
  return first.sources
    .filter((s) => s.source_items.length > 0)
    .slice(0, 3)
    .map((s) => ({ itemId: s.source_items[0].id, provider: s.name, variant: s.source_items[0].label }))
}
```

- [ ] **Step 4: Run green + commit**

```bash
npx vitest run src/features/onboarding/demoFindings.test.ts
git add src/features/onboarding/demoFindings.ts src/features/onboarding/demoFindings.test.ts
git commit -m "feat(onboarding): add deterministic demo findings helper"
```

---

### Task 7: Vasculhando — scan cosmético (D9)

**Files:**
- Create: `src/features/onboarding/Vasculhando.tsx`
- Modify: `src/features/onboarding/onboarding.css` (keyframes + estilos)
- Test: `src/features/onboarding/Vasculhando.test.tsx`

**Interfaces:**
- Produces: `Vasculhando({ count: number; onDone: () => void; onBack?: () => void })`. Faz o count-up até `count` em 2400ms; mostra CTA "Ver meus benefícios →" ao concluir → `onDone`. Com `prefers-reduced-motion`, mostra concluído imediatamente.

- [ ] **Step 1: Write the failing test**

Create `src/features/onboarding/Vasculhando.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import { Vasculhando } from './Vasculhando'

describe('Vasculhando', () => {
  it('conclui e dispara onDone ao clicar em Ver meus benefícios', () => {
    vi.useFakeTimers()
    const onDone = vi.fn()
    renderWithProviders(<Vasculhando count={3} onDone={onDone} />)
    act(() => { vi.advanceTimersByTime(2500) })
    fireEvent.click(screen.getByRole('button', { name: /ver meus benefícios/i }))
    expect(onDone).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })
})
```

- [ ] **Step 2: Run red**

Run: `npx vitest run src/features/onboarding/Vasculhando.test.tsx`
Expected: FAIL (componente não existe).

- [ ] **Step 3: Implement `Vasculhando.tsx`**

Create `src/features/onboarding/Vasculhando.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { Button } from '../../ui/Button'

const LABELS = ['Procurando seus programas…', 'Cruzando com o catálogo…', 'Montando seu radar…']
const DURATION = 2400

const reduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

export function Vasculhando({ count, onDone, onBack }: { count: number; onDone: () => void; onBack?: () => void }) {
  const [done, setDone] = useState(() => reduced())
  const [n, setN] = useState(() => (reduced() ? count : 0))
  const [labelIdx, setLabelIdx] = useState(0)

  useEffect(() => {
    if (reduced() || typeof requestAnimationFrame === 'undefined') { setN(count); setDone(true); return }
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / DURATION)
      setN(Math.round(count * p))
      setLabelIdx(Math.min(LABELS.length - 1, Math.floor(p * LABELS.length)))
      if (p < 1) raf = requestAnimationFrame(tick)
      else setDone(true)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [count])

  return (
    <main className="scan-page">
      <div className="scan-inner">
        {onBack ? (
          <button type="button" className="ob-back-btn scan-back" aria-label="Voltar" onClick={onBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        ) : null}
        <div className="scan-radar" aria-hidden="true">
          {!done ? <span className="scan-sweep" /> : null}
          {!done ? <span className="scan-ping" /> : null}
          <span className="scan-dot scan-dot-1" />
          <span className="scan-dot scan-dot-2" />
          <span className="scan-dot scan-dot-3" />
        </div>
        <div className="scan-count">{n}</div>
        <div className="scan-count-label">programas encontrados</div>
        <div className="scan-status" role="status">{done ? 'Pronto!' : LABELS[labelIdx]}</div>
        <div className="scan-progress"><span style={{ width: done ? '100%' : `${Math.round((n / Math.max(count, 1)) * 100)}%` }} /></div>
        {done ? (
          <div className="scan-cta mb-rise"><Button onClick={onDone}>Ver meus benefícios →</Button></div>
        ) : null}
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Add keyframes + styles to `onboarding.css`**

No bloco de animações compartilhadas de `onboarding.css`, adicionar os keyframes e incluir as classes de scan no guard de reduced-motion:

```css
@keyframes mb-sweep { to { transform: rotate(360deg) } }
@keyframes mb-ping { 0% { transform: scale(.6); opacity: .7 } 80%, 100% { transform: scale(2.1); opacity: 0 } }
@keyframes mb-pop { from { opacity: 0; transform: scale(.4) } 60% { transform: scale(1.18) } to { opacity: 1; transform: scale(1) } }
```

(Se `mb-pop` já existir de trabalho anterior, não duplicar.) Atualizar o seletor de reduced-motion existente para incluir `.scan-sweep, .scan-ping, .scan-dot`.

Adicionar os estilos da tela:

```css
.scan-page { min-height: 100dvh; display: flex; flex-direction: column; background: var(--bg); }
.scan-inner { flex: 1; width: 100%; max-width: 480px; margin: 0 auto; padding: var(--s8) var(--s5); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative; }
.scan-back { position: absolute; top: var(--s5); left: var(--s5); }
.scan-radar { position: relative; width: 200px; height: 200px; margin-bottom: var(--s6); border-radius: 50%; border: 1.5px dashed var(--line-2); }
.scan-sweep { position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(from 0deg, color-mix(in srgb, var(--accent) 34%, transparent), color-mix(in srgb, var(--accent) 4%, transparent) 32%, transparent 60%); animation: mb-sweep 2.6s linear infinite; transform-origin: center; }
.scan-ping { position: absolute; inset: 0; border-radius: 50%; border: 2px solid var(--accent); animation: mb-ping 2.6s var(--ease) infinite; }
.scan-dot { position: absolute; width: 11px; height: 11px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 4px color-mix(in srgb, var(--accent) 22%, transparent); transform: translate(-50%, -50%); animation: mb-pop .45s var(--ease) both; }
.scan-dot-1 { top: 34%; left: 40%; background: var(--c-airport); }
.scan-dot-2 { top: 58%; left: 62%; background: var(--c-viagem); animation-delay: .3s; }
.scan-dot-3 { top: 46%; left: 30%; background: var(--c-cashback); animation-delay: .6s; }
.scan-count { font-size: 46px; font-weight: 800; letter-spacing: -.04em; line-height: 1; color: var(--ink); }
.scan-count-label { margin-top: 6px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.scan-status { margin-top: 12px; min-height: 20px; font-size: 14px; font-weight: 600; color: var(--accent); }
.scan-progress { width: min(100%, 280px); height: 6px; margin-top: var(--s5); border-radius: 999px; background: var(--line); overflow: hidden; }
.scan-progress > span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--accent), var(--c-viagem)); transition: width .25s var(--ease); }
.scan-cta { width: min(100%, 320px); margin-top: var(--s6); }
.scan-cta .btn { margin: 0; }
```

- [ ] **Step 5: Run green + build + commit**

```bash
npx vitest run src/features/onboarding/Vasculhando.test.tsx && npm run build
git add src/features/onboarding/Vasculhando.tsx src/features/onboarding/Vasculhando.test.tsx src/features/onboarding/onboarding.css
git commit -m "feat(onboarding): add cosmetic Gmail scan screen"
```

---

### Task 8: RevisarGmail — revisar achados + merge não destrutivo (D1/D5)

**Files:**
- Create: `src/features/onboarding/RevisarGmail.tsx`
- Test: `src/features/onboarding/RevisarGmail.test.tsx`

**Interfaces:**
- Consumes: `Finding[]` (Task 6), `useUserSources` (existentes), `useSaveUserSources`, `useSession`.
- Produces: `RevisarGmail({ findings: Finding[]; onDone: () => void; onBack?: () => void })`. Salva `união(existentes, incluídos)` via `useSaveUserSources`, então `onDone`.

- [ ] **Step 1: Write the failing test**

Create `src/features/onboarding/RevisarGmail.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.mock('../auth/AuthProvider', () => ({ useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }) }))

const saveMutate = vi.fn()
vi.mock('./useSaveUserSources', () => ({ useSaveUserSources: () => ({ mutateAsync: saveMutate, isPending: false }) }))

let existing: { data: string[] | undefined; isLoading: boolean; error: unknown; refetch: () => void }
vi.mock('./useUserSources', () => ({ useUserSources: () => existing }))

import { RevisarGmail } from './RevisarGmail'

const findings = [
  { itemId: 'i1', provider: 'Nubank', variant: 'Ultravioleta' },
  { itemId: 'i2', provider: 'Itaú', variant: 'Black' },
]

beforeEach(() => {
  saveMutate.mockReset(); saveMutate.mockResolvedValue(undefined)
  existing = { data: [], isLoading: false, error: null, refetch: vi.fn() }
})

describe('RevisarGmail', () => {
  it('salva a união de existentes + incluídos e chama onDone', async () => {
    existing = { ...existing, data: ['x9'] }
    const onDone = vi.fn()
    renderWithProviders(<RevisarGmail findings={findings} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /adicionar ao radar/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalledTimes(1))
    expect([...saveMutate.mock.calls[0][0]].sort()).toEqual(['i1', 'i2', 'x9'])
    await waitFor(() => expect(onDone).toHaveBeenCalled())
  })

  it('descartar um achado o remove do save', async () => {
    renderWithProviders(<RevisarGmail findings={findings} onDone={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /itaú black/i })) // desmarca
    fireEvent.click(screen.getByRole('button', { name: /adicionar ao radar/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalled())
    expect(saveMutate.mock.calls[0][0]).not.toContain('i2')
  })

  it('CTA desabilitada com 0 incluídos', () => {
    renderWithProviders(<RevisarGmail findings={findings} onDone={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /nubank ultravioleta/i }))
    fireEvent.click(screen.getByRole('button', { name: /itaú black/i }))
    expect(screen.getByRole('button', { name: /adicionar ao radar/i })).toBeDisabled()
  })

  it('CTA desabilitada enquanto existentes carregam', () => {
    existing = { ...existing, data: undefined, isLoading: true }
    renderWithProviders(<RevisarGmail findings={findings} onDone={vi.fn()} />)
    expect(screen.getByRole('button', { name: /adicionar ao radar/i })).toBeDisabled()
  })

  it('erro ao carregar existentes mostra retry e não salva', () => {
    const refetch = vi.fn()
    existing = { data: undefined, isLoading: false, error: new Error('down'), refetch }
    renderWithProviders(<RevisarGmail findings={findings} onDone={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
    expect(saveMutate).not.toHaveBeenCalled()
  })

  it('mantém a seleção após falha no save', async () => {
    saveMutate.mockRejectedValueOnce(new Error('write'))
    renderWithProviders(<RevisarGmail findings={findings} onDone={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /adicionar ao radar/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível salvar/i)
    expect(screen.getByRole('button', { name: /nubank ultravioleta/i })).toHaveAttribute('aria-pressed', 'true')
  })
})
```

- [ ] **Step 2: Run red**

Run: `npx vitest run src/features/onboarding/RevisarGmail.test.tsx`
Expected: FAIL (componente não existe).

- [ ] **Step 3: Implement `RevisarGmail.tsx`**

Create `src/features/onboarding/RevisarGmail.tsx`:

```tsx
import { useState } from 'react'
import { useUserSources } from './useUserSources'
import { useSaveUserSources } from './useSaveUserSources'
import { useSession } from '../auth/AuthProvider'
import { Button } from '../../ui/Button'
import { PageState } from '../../ui'
import type { Finding } from './demoFindings'

export function RevisarGmail({ findings, onDone, onBack }: { findings: Finding[]; onDone: () => void; onBack?: () => void }) {
  const { session } = useSession()
  const existingQuery = useUserSources(session?.user.id)
  const save = useSaveUserSources()
  const [included, setIncluded] = useState<Set<string>>(() => new Set(findings.map((f) => f.itemId)))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  if (existingQuery.error) {
    return (
      <div className="ob-state">
        <PageState title="Não foi possível preparar sua prévia" action={{ label: 'Tentar novamente', onClick: () => void existingQuery.refetch() }} />
      </div>
    )
  }

  const existingLoading = existingQuery.isLoading || existingQuery.data === undefined
  const value = `R$ ${(included.size * 180).toLocaleString('pt-BR')}`

  function toggle(id: string) {
    setIncluded((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    if (included.size === 0 || existingLoading || saving) return
    setSaving(true)
    setSaveError(false)
    try {
      const merged = new Set<string>([...(existingQuery.data ?? []), ...included])
      await save.mutateAsync([...merged])
      onDone()
    } catch {
      setSaving(false)
      setSaveError(true)
    }
  }

  return (
    <div className="ob">
      <div className="ob-scroll">
        <div className="ob-card review-card">
          {onBack ? (
            <button type="button" className="ob-back-btn" aria-label="Voltar" onClick={onBack} style={{ marginBottom: 'var(--s3)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          ) : null}
          <p className="lbl" style={{ color: 'var(--ok)' }}>Descoberta concluída</p>
          <h1 className="ob-title">Revise o que encontramos</h1>
          <p className="review-count">incluídos <b>{value}</b>/ano estimado</p>

          <div className="review-list">
            {findings.map((f) => {
              const on = included.has(f.itemId)
              return (
                <button key={f.itemId} type="button" className={'review-item' + (on ? '' : ' off')} aria-pressed={on} onClick={() => toggle(f.itemId)}>
                  <span className="review-item-mark" aria-hidden="true">{f.provider.charAt(0).toUpperCase()}</span>
                  <span className="review-item-body">
                    <strong>{f.provider} {f.variant}</strong>
                    <span>via {f.provider}</span>
                  </span>
                  <span className={'review-check' + (on ? ' on' : '')} aria-hidden="true">{on ? '✓' : '+'}</span>
                </button>
              )
            })}
          </div>

          <p className="review-note">Prévia — nada foi lido do seu e-mail; descartar aqui só ajusta seu radar.</p>
          {saveError ? <p role="alert" aria-live="assertive" className="review-error">Não foi possível salvar. Tente de novo.</p> : null}
        </div>
      </div>
      <div className="ob-foot">
        <div className="ob-foot-inner">
          <div className="ob-cta">
            <Button onClick={submit} disabled={included.size === 0 || existingLoading || saving}>
              {saving ? 'Salvando…' : 'Adicionar ao radar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add review styles to `onboarding.css`**

```css
.review-count { margin: 0 0 var(--s4); font-size: 13px; font-weight: 700; color: var(--ink-2); }
.review-count b { color: var(--ink); }
.review-list { display: flex; flex-direction: column; gap: 8px; }
.review-item { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 13px; border-radius: 14px; border: 1px solid var(--line); background: var(--surface); box-shadow: var(--shadow); text-align: left; cursor: pointer; font: inherit; color: var(--ink); transition: opacity .2s var(--ease); }
.review-item.off { opacity: .5; }
.review-item:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.review-item-mark { flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 11px; background: var(--accent-soft); color: var(--accent); font-weight: 800; }
.review-item-body { flex: 1; min-width: 0; display: grid; gap: 2px; }
.review-item-body strong { font-size: 14px; font-weight: 700; color: var(--ink); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.review-item-body span { font-size: 11.5px; color: var(--muted); }
.review-check { flex: none; display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; border: 1px solid var(--line); color: var(--muted); font-weight: 800; }
.review-check.on { background: var(--accent); border-color: var(--accent); color: #fff; }
.review-note { margin: var(--s4) 0 0; font-size: 12px; line-height: 1.45; color: var(--ink-2); }
.review-error { margin: var(--s3) 0 0; font-size: 14px; color: var(--warn); }
```

- [ ] **Step 5: Run green + build + commit**

```bash
npx vitest run src/features/onboarding/RevisarGmail.test.tsx && npm run build
git add src/features/onboarding/RevisarGmail.tsx src/features/onboarding/RevisarGmail.test.tsx src/features/onboarding/onboarding.css
git commit -m "feat(onboarding): add Gmail review screen with non-destructive merge"
```

Expected: 6 tests PASS; build 0.

---

### Task 9: OnboardingPage — orquestrar o caminho Gmail (D4)

**Files:**
- Modify: `src/features/onboarding/OnboardingPage.tsx`
- Test: `src/features/onboarding/OnboardingPage.test.tsx`

**Interfaces:**
- Consumes: `MethodStep.onGmail`, `useSources`, `demoFindings`, `Vasculhando`, `RevisarGmail`.
- Produces: estados `'gmail-scan' | 'gmail-review'`. Método (não-edit) `onGmail` → carrega `useSources`; se erro → PageState retry; se `demoFindings` vazio → vai para `'manual'` (D4); senão scan → review → `navigate('/painel')` após save... (o `RadarMontado` não entra no caminho Gmail — ver nota).

**Nota de fluxo:** O caminho Gmail não passa por `RadarMontado` (esse é do Wizard). Após "Adicionar ao radar" salvar, o Gmail vai direto para `/alertas?from=onboarding` (mesmo destino pós-radar do manual), mantendo Alertas no fim dos dois caminhos.

- [ ] **Step 1: Add the failing flow test**

Em `OnboardingPage.test.tsx`, o mock de `ManualWizard` já existe. Adicionar mocks e um teste do caminho Gmail. No topo (após o mock de ManualWizard):

```tsx
vi.mock('./useSources', () => ({ useSources: () => sourcesResult }))
let sourcesResult: { data: unknown; isLoading: boolean; error: unknown; refetch: () => void }

vi.mock('./Vasculhando', () => ({ Vasculhando: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>ver meus benefícios</button> }))
vi.mock('./RevisarGmail', () => ({ RevisarGmail: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>adicionar ao radar</button> }))
```

Inicializar `sourcesResult` num `beforeEach` (adicionar se não houver):

```tsx
beforeEach(() => {
  sourcesResult = {
    data: [{ category: 'bank_card', meta: { key: 'bank_card', label: 'Bancos & cartões', icon: '🏦' },
      sources: [{ id: 's1', kind: 'card', name: 'Nubank', logo_url: null, sort_order: 1, source_category: 'bank_card', source_items: [{ id: 'i1', label: 'Ultravioleta', sort_order: 1 }] }] }],
    isLoading: false, error: null, refetch: vi.fn(),
  }
})
```

Teste:

```tsx
it('caminho Gmail: método → vasculhando → revisar → alertas', () => {
  renderWithProviders(<OnboardingPage />, { route: '/onboarding' })
  fireEvent.click(screen.getByRole('button', { name: /mapear meus benefícios/i }))
  fireEvent.click(screen.getByRole('button', { name: /conectar gmail.*prévia/i }))
  fireEvent.click(screen.getByRole('button', { name: /ver meus benefícios/i }))
  fireEvent.click(screen.getByRole('button', { name: /adicionar ao radar/i }))
  expect(navigateMock).toHaveBeenCalledWith('/alertas?from=onboarding')
})
```

(Requer `navigateMock` — o arquivo já mocka `useNavigate`? Se não, adicionar o mesmo padrão de mock de `useNavigate` usado em `ManualWizard.test.tsx`.)

- [ ] **Step 2: Run red**

Run: `npx vitest run src/features/onboarding/OnboardingPage.test.tsx`
Expected: FAIL (estados Gmail não existem).

- [ ] **Step 3: Implement orchestration in `OnboardingPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ManualWizard } from './ManualWizard'
import { MethodStep, WelcomeStep } from './OnboardingIntro'
import { Vasculhando } from './Vasculhando'
import { RevisarGmail } from './RevisarGmail'
import { useSources } from './useSources'
import { demoFindings } from './demoFindings'
import { PageState, Skeleton } from '../../ui'

type Screen = 'welcome' | 'method' | 'manual' | 'gmail-scan' | 'gmail-review'

export function OnboardingPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const editing = params.get('mode') === 'edit'
  const [screen, setScreen] = useState<Screen>(editing ? 'manual' : 'welcome')
  const sourcesQuery = useSources()
  const findings = demoFindings(sourcesQuery.data ?? [])

  useEffect(() => { setScreen(editing ? 'manual' : 'welcome') }, [editing])

  function startGmail() {
    // catálogo ainda carregando: espera (mostra scan só com dados prontos)
    if (sourcesQuery.isLoading) return
    if (sourcesQuery.error) return // erro tratado no render abaixo
    if (findings.length === 0) { setScreen('manual'); return } // D4
    setScreen('gmail-scan')
  }

  if (screen === 'manual') return <ManualWizard />

  if (screen === 'gmail-scan') {
    return <Vasculhando count={findings.length} onDone={() => setScreen('gmail-review')} onBack={() => setScreen('method')} />
  }
  if (screen === 'gmail-review') {
    return <RevisarGmail findings={findings} onDone={() => navigate('/alertas?from=onboarding')} onBack={() => setScreen('method')} />
  }

  if (screen === 'method') {
    return (
      <MethodStep
        onManual={() => setScreen('manual')}
        onBack={() => setScreen('welcome')}
        onGmail={startGmail}
      />
    )
  }

  return (
    <WelcomeStep
      onContinue={() => setScreen('method')}
      onSkip={() => navigate('/painel')}
      onLogin={() => navigate('/perfil')}
    />
  )
}
```

Tratar loading/erro do catálogo no Método (D1 owner): quando o usuário clica em Gmail com o catálogo carregando, `startGmail` faz no-op; para dar feedback, exibir estado enquanto `sourcesQuery.isLoading` após clicar. Implementação mínima aceitável para o MVP: como `useSources` é consultado no mount do `OnboardingPage`, ao chegar no Método ele já costuma estar pronto; se `sourcesQuery.error`, o Método renderiza um aviso com retry acima dos cards:

```tsx
if (screen === 'method') {
  return (
    <>
      {sourcesQuery.error ? (
        <div className="ob-state"><PageState title="Não foi possível carregar o catálogo" action={{ label: 'Tentar novamente', onClick: () => void sourcesQuery.refetch() }} /></div>
      ) : (
        <MethodStep onManual={() => setScreen('manual')} onBack={() => setScreen('welcome')} onGmail={startGmail} />
      )}
    </>
  )
}
```

(`Skeleton` importado para uso futuro; se não usar, remover do import para não quebrar lint.)

- [ ] **Step 4: Run green + full onboarding suite + build**

```bash
npx vitest run src/features/onboarding && npm run build
```

Expected: todos os testes de onboarding PASS; build 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/OnboardingPage.tsx src/features/onboarding/OnboardingPage.test.tsx
git commit -m "feat(onboarding): orchestrate Gmail preview path (scan -> review -> alerts)"
```

---

### Task 10: Gate visual (Playwright) + invariante de seed

**Files:**
- Modify: `tests/e2e/app-layout.spec.ts`
- Verify: `supabase/seed.sql`

**Interfaces:**
- Consome o app rodando (dev server) + Supabase local.

- [ ] **Step 1: Confirm the seed invariant**

Rodar e conferir que a 1ª categoria tem ≥1 fonte com ≥1 item:

```bash
grep -iE "insert into (sources|source_items)" supabase/seed.sql | head
```

Se o seed não tiver nenhuma fonte/variante, adicionar ao menos uma fonte de `bank_card` com uma variante (seguir o formato das inserções existentes no arquivo). Se já houver (esperado), seguir.

- [ ] **Step 2: Add the Gmail-path E2E scenario**

Em `tests/e2e/app-layout.spec.ts`, adicionar um teste (usa os 4 projetos já configurados):

```ts
test('gmail preview path reaches alerts and painel', async ({ page }) => {
  await page.goto('/onboarding')
  await page.getByRole('button', { name: /mapear meus benefícios/i }).click()
  await page.getByRole('button', { name: /conectar gmail.*prévia/i }).click()
  await page.getByRole('button', { name: /ver meus benefícios/i }).click({ timeout: 10_000 })
  await page.getByRole('button', { name: /adicionar ao radar/i }).click()
  await expect(page).toHaveURL(/\/alertas/, { timeout: 10_000 })
  await assertNoHorizontalOverflow(page)
  await page.getByRole('button', { name: /ativar alertas/i }).click()
  await expect(page).toHaveURL(/\/painel$/, { timeout: 10_000 })
  await assertNoHorizontalOverflow(page)
})
```

- [ ] **Step 3: Run the visual gate**

```bash
npx -y supabase@2.95.0 status
npm run test:visual
```

Expected: todos os cenários PASS (incluindo o novo caminho Gmail) nos 4 projetos; sem overflow.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/app-layout.spec.ts supabase/seed.sql
git commit -m "test(app-ui): cover gmail preview path in visual gate"
```

---

## Self-Review

**Spec coverage:**
- Método Gmail "Prévia" (D8) → Task 1.
- `useAlertPrefs` schema/recuperação (D-alertas) → Task 2.
- Alertas rota tela cheia + modos + a11y switch (D7) → Task 3.
- Perfil linha Alertas → Task 4.
- RadarMontado destino por-caminho (D6) → Task 5.
- Conjunto demo determinístico (D3) → Task 6.
- Vasculhando 2400ms + labels + reduced-motion (D2/D9) → Task 7.
- Revisar merge não destrutivo + guard de existentes + CTA 0-incluídos + estados de save (D1/D5) → Task 8.
- Orquestração + fallback catálogo vazio (D4) + owner de `useSources` → Task 9.
- Gate E2E + invariante de seed → Task 10.
- Loop de bootstrap vazio: explicitamente fora de escopo (spec) — nenhum task o cobre, por decisão.

**Placeholder scan:** sem TBD/TODO; código completo em cada passo.

**Type consistency:** `Finding { itemId, provider, variant }` (Task 6) consumido igual em Task 8 e 9; `MethodStep` ganha `onGmail` em Task 1 e é usado em Task 9; `Vasculhando({count,onDone,onBack})` e `RevisarGmail({findings,onDone,onBack})` idênticos entre Task 7/8 e Task 9; `useAlertPrefs`/`readAlertPrefs`/`writeAlertPrefs` consistentes entre Task 2 e 3.
