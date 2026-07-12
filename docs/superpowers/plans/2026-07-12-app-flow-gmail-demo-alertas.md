# Conclusão do Fluxo do App — Gmail Prévia + Alertas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Completar o Fluxo do App (9/12 → 12/12) adicionando o caminho de descoberta Gmail Prévia (Vasculhando + Revisar Gmail → Radar montado) e a tela de Alertas, tudo visual + mock.

**Architecture:** React 18 + React Router + TanStack Query + Supabase. O onboarding é orquestrado por estado em `OnboardingPage`; o caminho Gmail é um scan cosmético que "acha" um subconjunto determinístico do catálogo real, revisa, e salva a **união** com os programas existentes (não destrutivo), passando pelo **Radar montado** (igual ao manual) antes de Alertas. Alertas é rota de tela cheia com preferências em `localStorage`.

**Tech Stack:** React, TypeScript, react-router-dom, @tanstack/react-query, Supabase JS, Vitest + Testing Library, Playwright.

Spec: `docs/superpowers/specs/2026-07-12-app-flow-gmail-demo-alertas-design.md`.

## Global Constraints

- Só tokens de `src/ui/ds.css`. Tinta sobre accent usa `var(--accent-ink)` (nunca `#fff` avulso). Exceção única: logos de marca (ex.: glifo do Gmail) mantêm suas cores oficiais.
- **Limitação aceita (mock):** o merge de save é read-merge-replace no cliente (`useSaveUserSources` = RPC `replace_user_sources`); uma escrita concorrente entre a leitura e o replace poderia ser sobrescrita. Aceitável no onboarding single-user sem backend novo. `ponytail:` upgrade path = RPC de merge server-side quando o backend existir. Fora de escopo desta etapa.
- Animações decorativas atrás de `@media (prefers-reduced-motion: reduce)`.
- Honestidade: nenhuma copy afirma que lemos o e-mail; tudo é "prévia/demonstração".
- Persistência via `useSaveUserSources` (RPC `replace_user_sources`) — o Gmail salva **união(existentes, incluídos)**; nunca substitui destrutivamente, e só com `useUserSources` carregado.
- Valores em R$ = placeholder `nº × 180/ano`, rotulados "estimado".
- Ambos os caminhos (manual e Gmail) terminam em **Radar montado → /alertas?from=onboarding → /painel**.
- Mobile-first (390×844); desktop aditivo; tema claro e escuro.
- `npm test` NÃO roda tsc — rodar `npm run build` ao fim de cada task. Cada task termina com suíte e build **verdes**.

---

## File Structure

- `src/features/onboarding/OnboardingIntro.tsx` (modificar) — Método: card Gmail "Prévia" + `onGmail`.
- `src/features/alertas/useAlertPrefs.ts` (criar) — storage `mb-alerts` + recuperação.
- `src/features/alertas/Alertas.tsx` (criar) — opt-in, modos onboarding/edição, `aria-live`.
- `src/features/alertas/alertas.css` (criar) — estilos + toggles.
- `src/features/perfil/Perfil.tsx` (modificar) — linha "Alertas".
- `src/features/onboarding/ManualWizard.tsx` (modificar) — `onView` do Radar montado por modo (edit → /painel; onboarding → /alertas).
- `src/features/onboarding/RadarMontado.tsx` (**inalterado**) — já recebe `groups` + `onView` por prop; reutilizado no caminho Gmail via `OnboardingPage`.
- `src/features/onboarding/demoFindings.ts` (criar) — helper puro D3.
- `src/features/onboarding/Vasculhando.tsx` (criar) — scan cosmético.
- `src/features/onboarding/RevisarGmail.tsx` (criar) — revisar achados, merge D1; `onDone(incluídos)`.
- `src/features/onboarding/OnboardingPage.tsx` (modificar) — estados Gmail, `useSources`, loading/erro/vazio sem bloquear o manual, Radar montado do Gmail.
- `src/features/onboarding/onboarding.css` (modificar) — keyframes `mb-sweep`/`mb-ping`/`mb-pop` + estilos scan/review.
- `src/router.tsx` (modificar) — rota `/alertas` (tela cheia, fora do `AppLayout`).
- `src/index.css` (modificar) — `@import` de `alertas.css`.
- `tests/e2e/app-layout.spec.ts` (modificar) — atualizar teste antigo (Gmail "Prévia") + cenário do caminho Gmail.

**Ordem/dependências:** T1 (Método) → T2 (storage) → T3 (Alertas+rota) → T4 (Perfil, **dep. T3**) → T5 (RadarMontado onView, **dep. rota /alertas da T3**) → T6 (helper) → T7 (Vasculhando) → T8 (Revisar, **dep. T6**) → T9 (orquestração, **dep. T1/T6/T7/T8**) → T10 (E2E, **dep. tudo**).

---

### Task 1: Método — card Gmail "Prévia"

**Files:**
- Modify: `src/features/onboarding/OnboardingIntro.tsx`, `src/features/onboarding/OnboardingPage.tsx`
- Test: `src/features/onboarding/OnboardingPage.test.tsx`

**Interfaces:**
- Produces: `MethodStep({ onManual: () => void; onBack?: () => void; onGmail: () => void })` — card Gmail sem `disabled`, badge "Prévia", `onClick={onGmail}`.

- [ ] **Step 1: Update the existing flow test (keeps suite green after impl)**

Em `OnboardingPage.test.tsx`, no teste `goes from welcome to method and manual wizard`, trocar a asserção do Gmail:

```tsx
// ANTES: expect(screen.getByRole('button', { name: /gmail.*em breve/i })).toBeDisabled()
expect(screen.getByRole('button', { name: /conectar gmail.*prévia/i })).toBeEnabled()
```

Adicionar um teste focado do `MethodStep` (import `{ MethodStep }` de `./OnboardingIntro`):

```tsx
it('MethodStep: card Gmail Prévia dispara onGmail', () => {
  const onGmail = vi.fn()
  renderWithProviders(<MethodStep onManual={() => {}} onGmail={onGmail} />, { route: '/onboarding' })
  const gmail = screen.getByRole('button', { name: /conectar gmail.*prévia/i })
  expect(gmail).toBeEnabled()
  fireEvent.click(gmail)
  expect(onGmail).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run red**

Run: `npx vitest run src/features/onboarding/OnboardingPage.test.tsx`
Expected: FAIL (Gmail ainda "Em breve"/disabled; `MethodStep` sem `onGmail`).

- [ ] **Step 3: Enable the Gmail card**

Em `OnboardingIntro.tsx`:

```tsx
export function MethodStep({ onManual, onBack, onGmail }: { onManual: () => void; onBack?: () => void; onGmail: () => void }) {
```

Substituir o `<button ... disabled>` do Gmail por (sem `disabled`, badge "Prévia", `onClick={onGmail}`):

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
      <p>Uma demonstração de como a descoberta vai funcionar — com seus programas do catálogo. Nada é lido do seu e-mail.</p>
      <span className="ob-tags">
        <span className="ob-tag">Mais rápido</span>
        <span className="ob-tag">Você revisa antes de salvar</span>
      </span>
    </span>
    <span className="ob-option-radio" aria-hidden="true" />
  </span>
</button>
```

Em `OnboardingPage.tsx`, passar um `onGmail` temporário (será substituído na Task 9), mantendo a suíte verde (o teste de fluxo não clica no Gmail):

```tsx
if (screen === 'method') {
  return <MethodStep onManual={() => setScreen('manual')} onBack={() => setScreen('welcome')} onGmail={() => {}} />
}
```

- [ ] **Step 4: Run green + build**

Run: `npx vitest run src/features/onboarding/OnboardingPage.test.tsx && npm run build`
Expected: **todos** os testes do arquivo PASS; build 0. (Se algo estiver vermelho, corrigir antes de commitar — não commitar vermelho.)

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/OnboardingIntro.tsx src/features/onboarding/OnboardingPage.tsx src/features/onboarding/OnboardingPage.test.tsx
git commit -m "feat(onboarding): enable Gmail preview card in method step"
```

---

### Task 2: `useAlertPrefs` — preferências em localStorage

**Files:**
- Create: `src/features/alertas/useAlertPrefs.ts`
- Test: `src/features/alertas/useAlertPrefs.test.ts`

**Interfaces:**
- Produces: `type AlertPrefs = { v: 1; optIn: boolean; novos: boolean; prazo: boolean; resumo: boolean }`; `DEFAULT_PREFS`; `readAlertPrefs()`; `writeAlertPrefs(p)`; `useAlertPrefs()` → `{ prefs, set(patch) }`.

- [ ] **Step 1: Write the failing test**

Create `src/features/alertas/useAlertPrefs.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readAlertPrefs, writeAlertPrefs, DEFAULT_PREFS } from './useAlertPrefs'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

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
  it('falls back to defaults when localStorage throws (indisponível)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError') })
    expect(readAlertPrefs()).toEqual(DEFAULT_PREFS)
  })
  it('write swallows errors when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('SecurityError') })
    expect(() => writeAlertPrefs(DEFAULT_PREFS)).not.toThrow()
  })
})
```

- [ ] **Step 2: Run red**

Run: `npx vitest run src/features/alertas/useAlertPrefs.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implement**

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
    return { v: 1, optIn: !!parsed.optIn, novos: !!parsed.novos, prazo: !!parsed.prazo, resumo: !!parsed.resumo }
  } catch {
    return DEFAULT_PREFS
  }
}

export function writeAlertPrefs(p: AlertPrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    // storage indisponível (mock) — ignora
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

- [ ] **Step 4: Run green + build + commit**

```bash
npx vitest run src/features/alertas/useAlertPrefs.test.ts && npm run build
git add src/features/alertas/useAlertPrefs.ts src/features/alertas/useAlertPrefs.test.ts
git commit -m "feat(alertas): add local alert-prefs storage hook"
```

Expected: 6 tests PASS; build 0.

---

### Task 3: Tela de Alertas + rota `/alertas`

**Files:**
- Create: `src/features/alertas/Alertas.tsx`, `src/features/alertas/alertas.css`
- Test: `src/features/alertas/Alertas.test.tsx`
- Modify: `src/router.tsx`, `src/index.css`

**Interfaces:**
- Consumes: `useAlertPrefs`, `useSearchParams`, `useNavigate`.
- Produces: `Alertas()` (rota `/alertas`); modo por `searchParams.get('from') === 'onboarding'`.

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

beforeEach(() => { localStorage.clear(); navigateMock.mockReset() })

describe('Alertas', () => {
  it('onboarding: "Ativar alertas" grava optIn e vai ao painel', () => {
    renderWithProviders(<Alertas />, { route: '/alertas?from=onboarding' })
    fireEvent.click(screen.getByRole('button', { name: /ativar alertas/i }))
    expect(JSON.parse(localStorage.getItem('mb-alerts')!).optIn).toBe(true)
    expect(navigateMock).toHaveBeenCalledWith('/painel')
  })
  it('onboarding: "Agora não" grava optIn=false e vai ao painel', () => {
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
  it('edição: sem "Agora não"; Voltar vai ao perfil; ligar toggle deriva optIn=true', () => {
    renderWithProviders(<Alertas />, { route: '/alertas' })
    expect(screen.queryByRole('button', { name: /agora não/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: /resumo mensal/i })) // liga → optIn derivado
    expect(JSON.parse(localStorage.getItem('mb-alerts')!).optIn).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }))
    expect(navigateMock).toHaveBeenCalledWith('/perfil')
  })
  it('edição: desligar todos os toggles deriva optIn=false', () => {
    // defaults: novos on, prazo on, resumo off → desligar novos e prazo
    renderWithProviders(<Alertas />, { route: '/alertas' })
    fireEvent.click(screen.getByRole('switch', { name: /novos benefícios/i }))
    fireEvent.click(screen.getByRole('switch', { name: /prazo de expiração/i }))
    expect(JSON.parse(localStorage.getItem('mb-alerts')!).optIn).toBe(false)
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
            <button key={r.key} type="button" role="switch" aria-checked={prefs[r.key]}
              className={'alerts-row' + (prefs[r.key] ? ' on' : '')} onClick={() => toggle(r.key)}>
              <span className="alerts-row-text"><strong>{r.title}</strong><span>{r.desc}</span></span>
              <span className="alerts-switch" aria-hidden="true"><span className="alerts-knob" /></span>
            </button>
          ))}
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {[prefs.novos && 'Novos benefícios', prefs.prazo && 'Prazo de expiração', prefs.resumo && 'Resumo mensal'].filter(Boolean).join(', ') || 'Nenhum alerta ativo'}
        </p>

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

(`sr-only` já é global em `ds.css` — usado em `Perfil`.)

- [ ] **Step 4: Add `alertas.css`** (idêntico ao bloco da spec)

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
.alerts-knob { position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: var(--surface); box-shadow: var(--shadow); transition: transform .18s var(--ease); }
.alerts-row.on .alerts-switch { background: var(--accent); }
.alerts-row.on .alerts-knob { transform: translateX(18px); }
.alerts-actions { margin-top: auto; padding-top: var(--s6); display: grid; gap: var(--s2); }
.alerts-actions .btn { margin: 0; }
@media (prefers-reduced-motion: reduce) { .alerts-switch, .alerts-knob { transition: none; } }
```

Adicionar em `src/index.css` (junto dos outros `@import`): `@import './features/alertas/alertas.css';`

- [ ] **Step 5: Add the route**

Em `src/router.tsx`, importar `Alertas` e adicionar ao lado de `/beneficio/:id` (tela cheia, fora do `AppLayout`):

```tsx
  { path: '/beneficio/:id', element: <BenefitDetail /> },
  { path: '/alertas', element: <Alertas /> },
```

- [ ] **Step 6: Run green + build + commit**

```bash
npx vitest run src/features/alertas/Alertas.test.tsx && npm run build
git add src/features/alertas/ src/router.tsx src/index.css
git commit -m "feat(alertas): add alerts opt-in screen and route"
```

Expected: 5 tests PASS; build 0.

---

### Task 4: Perfil — linha "Alertas"

**Files:**
- Modify: `src/features/perfil/Perfil.tsx`
- Test: `src/features/perfil/Perfil.test.tsx`

**Interfaces:** consome a rota `/alertas` (T3).

- [ ] **Step 1: Write the failing test**

Adicionar em `Perfil.test.tsx`:

```tsx
it('tem uma linha de Alertas apontando para /alertas', () => {
  sessionValue = { session: { user: { id: 'u1', is_anonymous: true, email: null } }, loading: false }
  renderWithProviders(<Perfil />)
  expect(screen.getByRole('link', { name: /alertas/i })).toHaveAttribute('href', '/alertas')
})
```

- [ ] **Step 2: Run red**

Run: `npx vitest run src/features/perfil/Perfil.test.tsx` → FAIL.

- [ ] **Step 3: Add the row**

Em `Perfil.tsx`, dentro de `.profile-rows`, entre "Editar meus programas" e o botão Tema:

```tsx
<Link className="profile-row" to="/alertas">
  <span className="profile-row-icon" aria-hidden="true">
    <svg {...stroke}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
  </span>
  <span className="profile-row-label">Alertas</span>
  <span className="profile-row-chev" aria-hidden="true">›</span>
</Link>
```

- [ ] **Step 4: Green + build + commit**

```bash
npx vitest run src/features/perfil/Perfil.test.tsx && npm run build
git add src/features/perfil/Perfil.tsx src/features/perfil/Perfil.test.tsx
git commit -m "feat(perfil): add alerts row linking to /alertas"
```

---

### Task 5: RadarMontado destino por-modo (D6) — depende da rota `/alertas` (T3)

**Files:**
- Modify: `src/features/onboarding/ManualWizard.tsx`
- Test: `src/features/onboarding/ManualWizard.test.tsx`

**Interfaces:** `ManualWizard` detecta `useSearchParams().get('mode') === 'edit'` e passa `onView` = edição → `/painel`; onboarding → `/alertas?from=onboarding`.

- [ ] **Step 1: Update tests**

No teste de sucesso (onboarding, sem `mode=edit`), trocar:

```tsx
// ANTES: expect(navigateMock).toHaveBeenCalledWith('/painel')
expect(navigateMock).toHaveBeenCalledWith('/alertas?from=onboarding')
```

Adicionar teste de edição:

```tsx
it('modo edição: "Ver meu radar" vai direto ao painel', async () => {
  sourceResult.data = [bankGroup]
  renderWithProviders(<ManualWizard />, { route: '/onboarding?mode=edit' })
  fireEvent.click(screen.getByRole('button', { name: /black/i }))
  fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
  const ver = await screen.findByRole('button', { name: /ver meu radar/i }, { timeout: 2500 })
  fireEvent.click(ver)
  expect(navigateMock).toHaveBeenCalledWith('/painel')
})
```

- [ ] **Step 2: Run red** → `npx vitest run src/features/onboarding/ManualWizard.test.tsx` FAIL.

- [ ] **Step 3: Implement**

Em `ManualWizard.tsx`:

```tsx
import { useNavigate, useSearchParams } from 'react-router-dom'
// dentro do componente:
const [params] = useSearchParams()
const editing = params.get('mode') === 'edit'
```

No render `done`:

```tsx
return <RadarMontado groups={summaryGroups} onView={() => navigate(editing ? '/painel' : '/alertas?from=onboarding')} />
```

- [ ] **Step 4: Green + build + commit**

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

**Interfaces:** `type Finding = { itemId: string; provider: string; variant: string }`; `demoFindings(groups: CategoryGroup[]): Finding[]` — 1ª categoria; 3 primeiras fontes com ≥1 item; primeiro item de cada.

- [ ] **Step 1: Write the failing test**

Create `src/features/onboarding/demoFindings.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { demoFindings } from './demoFindings'
import type { CategoryGroup } from './groupSourcesByCategory'

const g = (over: Partial<CategoryGroup> = {}): CategoryGroup => ({
  category: 'bank_card', meta: { key: 'bank_card', label: 'Bancos & cartões', icon: '🏦' }, sources: [], ...over,
})
const src = (id: string, name: string, items: { id: string; label: string }[]) => ({
  id, kind: 'card' as const, name, logo_url: null, sort_order: 1, source_category: 'bank_card' as const,
  source_items: items.map((i, idx) => ({ ...i, sort_order: idx + 1 })),
})

describe('demoFindings', () => {
  it('pega até 3 fontes, primeiro item de cada', () => {
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
  it('pula fontes sem item', () => {
    const groups = [g({ sources: [src('s1', 'SemItem', []), src('s2', 'Itaú', [{ id: 'i2', label: 'Black' }])] })]
    expect(demoFindings(groups)).toEqual([{ itemId: 'i2', provider: 'Itaú', variant: 'Black' }])
  })
  it('retorna [] sem categorias', () => { expect(demoFindings([])).toEqual([]) })
})
```

- [ ] **Step 2: Run red** → FAIL.

- [ ] **Step 3: Implement**

Create `src/features/onboarding/demoFindings.ts`:

```ts
import type { CategoryGroup } from './groupSourcesByCategory'

export interface Finding { itemId: string; provider: string; variant: string }

export function demoFindings(groups: CategoryGroup[]): Finding[] {
  const first = groups[0]
  if (!first) return []
  return first.sources
    .filter((s) => s.source_items.length > 0)
    .slice(0, 3)
    .map((s) => ({ itemId: s.source_items[0].id, provider: s.name, variant: s.source_items[0].label }))
}
```

- [ ] **Step 4: Green + commit**

```bash
npx vitest run src/features/onboarding/demoFindings.test.ts
git add src/features/onboarding/demoFindings.ts src/features/onboarding/demoFindings.test.ts
git commit -m "feat(onboarding): add deterministic demo findings helper"
```

---

### Task 7: Vasculhando — scan cosmético (D9)

**Files:**
- Create: `src/features/onboarding/Vasculhando.tsx`
- Modify: `src/features/onboarding/onboarding.css`
- Test: `src/features/onboarding/Vasculhando.test.tsx`

**Interfaces:** `Vasculhando({ count: number; onDone: () => void; onBack?: () => void })`. Count-up até `count` em 2400ms; CTA ao concluir → `onDone`. Com `prefers-reduced-motion`, conclui imediatamente.

- [ ] **Step 1: Write the failing test (determinístico via reduced-motion)**

Create `src/features/onboarding/Vasculhando.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import { Vasculhando } from './Vasculhando'

// força reduced-motion → componente conclui na hora, sem timers (determinístico)
beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('reduce'), media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('Vasculhando (reduced-motion)', () => {
  it('conclui imediatamente, sem animações, e dispara onDone', () => {
    const onDone = vi.fn()
    const { container } = renderWithProviders(<Vasculhando count={3} onDone={onDone} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    // reduced-motion → estado concluído: sweep/ping não são renderizados
    expect(container.querySelector('.scan-sweep')).toBeNull()
    expect(container.querySelector('.scan-ping')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /ver meus benefícios/i }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run red** → FAIL.

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
        {done ? <div className="scan-cta mb-rise"><Button onClick={onDone}>Ver meus benefícios →</Button></div> : null}
      </div>
    </main>
  )
}
```

- [ ] **Step 4: Add keyframes + styles to `onboarding.css`**

No bloco de animações compartilhadas, adicionar (se ainda não existirem — `mb-pop` já existe):

```css
@keyframes mb-sweep { to { transform: rotate(360deg) } }
@keyframes mb-ping { 0% { transform: scale(.6); opacity: .7 } 80%, 100% { transform: scale(2.1); opacity: 0 } }
```

Atualizar o seletor de reduced-motion existente para incluir `.scan-sweep, .scan-ping, .scan-dot`. Adicionar os estilos de `.scan-*` (bloco idêntico ao da spec/plano: `.scan-page`, `.scan-inner`, `.scan-back`, `.scan-radar`, `.scan-sweep`, `.scan-ping`, `.scan-dot(-1/-2/-3)`, `.scan-count`, `.scan-count-label`, `.scan-status`, `.scan-progress`, `.scan-cta`):

```css
.scan-page { min-height: 100dvh; display: flex; flex-direction: column; background: var(--bg); }
.scan-inner { flex: 1; width: 100%; max-width: 480px; margin: 0 auto; padding: var(--s8) var(--s5); display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; position: relative; }
.scan-back { position: absolute; top: var(--s5); left: var(--s5); }
.scan-radar { position: relative; width: 200px; height: 200px; margin-bottom: var(--s6); border-radius: 50%; border: 1.5px dashed var(--line-2); }
.scan-sweep { position: absolute; inset: 0; border-radius: 50%; background: conic-gradient(from 0deg, color-mix(in srgb, var(--accent) 34%, transparent), color-mix(in srgb, var(--accent) 4%, transparent) 32%, transparent 60%); animation: mb-sweep 2.6s linear infinite; transform-origin: center; }
.scan-ping { position: absolute; inset: 0; border-radius: 50%; border: 2px solid var(--accent); animation: mb-ping 2.6s var(--ease) infinite; }
.scan-dot { position: absolute; width: 11px; height: 11px; border-radius: 50%; transform: translate(-50%, -50%); animation: mb-pop .45s var(--ease) both; }
.scan-dot-1 { top: 34%; left: 40%; background: var(--c-airport); box-shadow: 0 0 0 4px color-mix(in srgb, var(--c-airport) 22%, transparent); }
.scan-dot-2 { top: 58%; left: 62%; background: var(--c-viagem); box-shadow: 0 0 0 4px color-mix(in srgb, var(--c-viagem) 22%, transparent); animation-delay: .3s; }
.scan-dot-3 { top: 46%; left: 30%; background: var(--c-cashback); box-shadow: 0 0 0 4px color-mix(in srgb, var(--c-cashback) 22%, transparent); animation-delay: .6s; }
.scan-count { font-size: 46px; font-weight: 800; letter-spacing: -.04em; line-height: 1; color: var(--ink); }
.scan-count-label { margin-top: 6px; font-size: 12px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }
.scan-status { margin-top: 12px; min-height: 20px; font-size: 14px; font-weight: 600; color: var(--accent); }
.scan-progress { width: min(100%, 280px); height: 6px; margin-top: var(--s5); border-radius: 999px; background: var(--line); overflow: hidden; }
.scan-progress > span { display: block; height: 100%; border-radius: 999px; background: linear-gradient(90deg, var(--accent), var(--c-viagem)); transition: width .25s var(--ease); }
.scan-cta { width: min(100%, 320px); margin-top: var(--s6); }
.scan-cta .btn { margin: 0; }
```

- [ ] **Step 5: Green + build + commit**

```bash
npx vitest run src/features/onboarding/Vasculhando.test.tsx && npm run build
git add src/features/onboarding/Vasculhando.tsx src/features/onboarding/Vasculhando.test.tsx src/features/onboarding/onboarding.css
git commit -m "feat(onboarding): add cosmetic Gmail scan screen"
```

---

### Task 8: RevisarGmail — merge não destrutivo (D1/D5); `onDone(incluídos)`

**Files:**
- Create: `src/features/onboarding/RevisarGmail.tsx`
- Modify: `src/features/onboarding/onboarding.css`
- Test: `src/features/onboarding/RevisarGmail.test.tsx`

**Interfaces:** `RevisarGmail({ findings: Finding[]; onDone: (included: Finding[]) => void; onBack?: () => void })`. Salva `união(existentes, incluídos)`; chama `onDone(incluídos)` (o caminho Gmail usa os incluídos para montar o Radar montado).

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
  it('salva a união de existentes + incluídos e chama onDone com os incluídos', async () => {
    existing = { ...existing, data: ['x9'] }
    const onDone = vi.fn()
    renderWithProviders(<RevisarGmail findings={findings} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /adicionar ao radar/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalledTimes(1))
    expect([...saveMutate.mock.calls[0][0]].sort()).toEqual(['i1', 'i2', 'x9'])
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(findings))
  })
  it('descartar um achado o remove do save e do onDone', async () => {
    const onDone = vi.fn()
    renderWithProviders(<RevisarGmail findings={findings} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /itaú black/i }))
    fireEvent.click(screen.getByRole('button', { name: /adicionar ao radar/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalled())
    expect(saveMutate.mock.calls[0][0]).not.toContain('i2')
    expect(onDone).toHaveBeenCalledWith([findings[0]])
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
  it('erro ao carregar existentes: alerta inline + retry, mantém as escolhas e não salva', () => {
    const refetch = vi.fn()
    existing = { data: undefined, isLoading: false, error: new Error('down'), refetch }
    renderWithProviders(<RevisarGmail findings={findings} onDone={vi.fn()} />)
    expect(screen.getByRole('button', { name: /nubank ultravioleta/i })).toBeInTheDocument() // lista preservada
    expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível preparar/i)
    expect(screen.getByRole('button', { name: /adicionar ao radar/i })).toBeDisabled()
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

- [ ] **Step 2: Run red** → FAIL.

- [ ] **Step 3: Implement `RevisarGmail.tsx`**

```tsx
import { useState } from 'react'
import { useUserSources } from './useUserSources'
import { useSaveUserSources } from './useSaveUserSources'
import { useSession } from '../auth/AuthProvider'
import { Button } from '../../ui/Button'
import type { Finding } from './demoFindings'

export function RevisarGmail({ findings, onDone, onBack }: { findings: Finding[]; onDone: (included: Finding[]) => void; onBack?: () => void }) {
  const { session } = useSession()
  const existingQuery = useUserSources(session?.user.id)
  const save = useSaveUserSources()
  const [included, setIncluded] = useState<Set<string>>(() => new Set(findings.map((f) => f.itemId)))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  // Erro ao carregar os existentes NÃO substitui a tela (preserva as escolhas);
  // vira alerta inline com retry e trava a CTA (não dá pra fazer merge seguro sem eles).
  const existingError = !!existingQuery.error
  const existingLoading = existingQuery.isLoading || existingQuery.data === undefined
  const includedList = findings.filter((f) => included.has(f.itemId))
  const value = `R$ ${(includedList.length * 180).toLocaleString('pt-BR')}`

  function toggle(id: string) {
    setIncluded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function submit() {
    if (includedList.length === 0 || existingLoading || saving) return
    setSaving(true); setSaveError(false)
    try {
      const merged = new Set<string>([...(existingQuery.data ?? []), ...included])
      await save.mutateAsync([...merged])
      onDone(includedList)
    } catch {
      setSaving(false); setSaveError(true)
    }
  }

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
          <p className="review-count">incluídos <b>{value}</b>/ano estimado</p>
          <div className="review-list">
            {findings.map((f) => {
              const on = included.has(f.itemId)
              return (
                <button key={f.itemId} type="button" className={'review-item' + (on ? '' : ' off')} aria-pressed={on} onClick={() => toggle(f.itemId)}>
                  <span className="review-item-mark" aria-hidden="true">{f.provider.charAt(0).toUpperCase()}</span>
                  <span className="review-item-body"><strong>{f.provider} {f.variant}</strong><span>via {f.provider}</span></span>
                  <span className={'review-check' + (on ? ' on' : '')} aria-hidden="true">{on ? '✓' : '+'}</span>
                </button>
              )
            })}
          </div>
          <p className="review-note">Prévia — nada foi lido do seu e-mail; descartar aqui só ajusta seu radar.</p>
          {existingError ? (
            <p role="alert" aria-live="assertive" className="review-error">
              Não foi possível preparar sua prévia.{' '}
              <button type="button" className="review-retry" onClick={() => void existingQuery.refetch()}>Tentar novamente</button>
            </p>
          ) : null}
          {saveError ? <p role="alert" aria-live="assertive" className="review-error">Não foi possível salvar. Tente de novo.</p> : null}
        </div>
      </div>
      <div className="ob-foot">
        <div className="ob-foot-inner">
          <div className="ob-cta">
            <Button onClick={submit} disabled={includedList.length === 0 || existingLoading || saving}>
              {saving ? 'Salvando…' : 'Adicionar ao radar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Add review styles to `onboarding.css`** (bloco `.review-*` idêntico ao da spec/plano):

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
.review-check.on { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
.review-note { margin: var(--s4) 0 0; font-size: 12px; line-height: 1.45; color: var(--ink-2); }
.review-error { margin: var(--s3) 0 0; font-size: 14px; color: var(--warn); }
.review-retry { border: 0; background: none; padding: 0; font: inherit; font-weight: 700; color: var(--warn); text-decoration: underline; cursor: pointer; }
@media (prefers-reduced-motion: reduce) { .review-item { transition: none; } }
```

- [ ] **Step 5: Green + build + commit**

```bash
npx vitest run src/features/onboarding/RevisarGmail.test.tsx && npm run build
git add src/features/onboarding/RevisarGmail.tsx src/features/onboarding/RevisarGmail.test.tsx src/features/onboarding/onboarding.css
git commit -m "feat(onboarding): add Gmail review screen with non-destructive merge"
```

Expected: 6 tests PASS.

---

### Task 9: OnboardingPage — orquestrar o caminho Gmail (D4), passando por Radar montado

**Files:**
- Modify: `src/features/onboarding/OnboardingPage.tsx`
- Test: `src/features/onboarding/OnboardingPage.test.tsx`

**Interfaces:** estados `'gmail-scan' | 'gmail-review' | 'gmail-done'`. O clique no Gmail (`startGmail`) trata catálogo carregando/erro/vazio **sem bloquear o manual**. Fluxo Gmail: scan → review → **Radar montado** (com os incluídos) → `/alertas?from=onboarding`.

- [ ] **Step 1: Add failing tests**

No `OnboardingPage.test.tsx`, adicionar mocks (garantir que `useNavigate` já está mockado como nos outros; se não, replicar o padrão) e:

```tsx
let sourcesResult: { data: unknown; isLoading: boolean; error: unknown; refetch: () => void }
vi.mock('./useSources', () => ({ useSources: () => sourcesResult }))
vi.mock('./Vasculhando', () => ({ Vasculhando: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>ver meus benefícios</button> }))
vi.mock('./RevisarGmail', () => ({ RevisarGmail: ({ onDone }: { onDone: (i: unknown[]) => void }) => <button onClick={() => onDone([{ itemId: 'i1', provider: 'Nubank', variant: 'Ultravioleta' }])}>adicionar ao radar</button> }))
vi.mock('./RadarMontado', () => ({ RadarMontado: ({ onView }: { onView: () => void }) => <button onClick={onView}>ver meu radar</button> }))
```

No `beforeEach`, inicializar catálogo com 1 fonte/1 item:

```tsx
sourcesResult = {
  data: [{ category: 'bank_card', meta: { key: 'bank_card', label: 'Bancos & cartões', icon: '🏦' },
    sources: [{ id: 's1', kind: 'card', name: 'Nubank', logo_url: null, sort_order: 1, source_category: 'bank_card', source_items: [{ id: 'i1', label: 'Ultravioleta', sort_order: 1 }] }] }],
  isLoading: false, error: null, refetch: vi.fn(),
}
```

Testes:

```tsx
it('caminho Gmail: método → scan → revisar → radar montado → alertas', () => {
  renderWithProviders(<OnboardingPage />, { route: '/onboarding' })
  fireEvent.click(screen.getByRole('button', { name: /mapear meus benefícios/i }))
  fireEvent.click(screen.getByRole('button', { name: /conectar gmail.*prévia/i }))
  fireEvent.click(screen.getByRole('button', { name: /ver meus benefícios/i }))
  fireEvent.click(screen.getByRole('button', { name: /adicionar ao radar/i }))
  fireEvent.click(screen.getByRole('button', { name: /ver meu radar/i }))
  expect(navigateMock).toHaveBeenCalledWith('/alertas?from=onboarding')
})

it('catálogo vazio no Gmail cai no wizard manual (D4)', () => {
  sourcesResult = { ...sourcesResult, data: [] }
  renderWithProviders(<OnboardingPage />, { route: '/onboarding' })
  fireEvent.click(screen.getByRole('button', { name: /mapear meus benefícios/i }))
  fireEvent.click(screen.getByRole('button', { name: /conectar gmail.*prévia/i }))
  expect(screen.getByText('Wizard manual real')).toBeInTheDocument() // mock do ManualWizard
})

it('erro no catálogo não bloqueia o caminho manual', () => {
  sourcesResult = { ...sourcesResult, data: undefined, error: new Error('down') }
  renderWithProviders(<OnboardingPage />, { route: '/onboarding' })
  fireEvent.click(screen.getByRole('button', { name: /mapear meus benefícios/i }))
  fireEvent.click(screen.getByRole('button', { name: /adicionar manualmente/i }))
  expect(screen.getByText('Wizard manual real')).toBeInTheDocument()
})

it('erro no catálogo ao entrar no Gmail: mostra retry e chama refetch', () => {
  const refetch = vi.fn()
  sourcesResult = { ...sourcesResult, data: undefined, error: new Error('down'), refetch }
  renderWithProviders(<OnboardingPage />, { route: '/onboarding' })
  fireEvent.click(screen.getByRole('button', { name: /mapear meus benefícios/i }))
  fireEvent.click(screen.getByRole('button', { name: /conectar gmail.*prévia/i }))
  fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
  expect(refetch).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 2: Run red** → FAIL.

- [ ] **Step 3: Implement orchestration**

Replace `OnboardingPage.tsx`:

```tsx
import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ManualWizard } from './ManualWizard'
import { MethodStep, WelcomeStep } from './OnboardingIntro'
import { Vasculhando } from './Vasculhando'
import { RevisarGmail } from './RevisarGmail'
import { RadarMontado, type SummaryGroup } from './RadarMontado'
import { useSources } from './useSources'
import { demoFindings, type Finding } from './demoFindings'
import { PageState, Skeleton } from '../../ui'

type Screen = 'welcome' | 'method' | 'manual' | 'gmail-scan' | 'gmail-review' | 'gmail-done'

export function OnboardingPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const editing = params.get('mode') === 'edit'
  const [screen, setScreen] = useState<Screen>(editing ? 'manual' : 'welcome')
  const [gmailFindings, setGmailFindings] = useState<Finding[]>([]) // snapshot congelado do fluxo Gmail
  const [saved, setSaved] = useState<Finding[]>([])
  const sourcesQuery = useSources()
  const groups = sourcesQuery.data ?? []
  const findings = demoFindings(groups)

  useEffect(() => { setScreen(editing ? 'manual' : 'welcome') }, [editing])

  // Catálogo vazio no caminho Gmail → wizard manual (D4). Via efeito, nunca setState no render.
  useEffect(() => {
    if (screen === 'gmail-scan' && !sourcesQuery.isLoading && !sourcesQuery.error && findings.length === 0) {
      setScreen('manual')
    }
  }, [screen, sourcesQuery.isLoading, sourcesQuery.error, findings.length])

  function startGmail() {
    // sempre entra no scan; loading/erro/vazio são tratados no próprio estado 'gmail-scan'
    if (!sourcesQuery.isLoading && !sourcesQuery.error && findings.length === 0) { setScreen('manual'); return } // D4 (atalho no clique)
    setScreen('gmail-scan')
  }

  if (screen === 'manual') return <ManualWizard />

  if (screen === 'gmail-scan') {
    if (sourcesQuery.isLoading) {
      return <div className="ob-state" role="status" aria-label="Preparando sua prévia" aria-busy="true"><Skeleton height="200px" radius="18px" /><Skeleton height="52px" radius="13px" /></div>
    }
    if (sourcesQuery.error) {
      return (
        <div className="ob-state">
          <PageState title="Não foi possível preparar sua prévia" action={{ label: 'Tentar novamente', onClick: () => void sourcesQuery.refetch() }} />
          <button className="btn ghost" type="button" onClick={() => setScreen('method')}>Voltar</button>
        </div>
      )
    }
    if (findings.length === 0) return null // efeito acima redireciona para 'manual'
    return (
      <Vasculhando
        count={findings.length}
        onDone={() => { setGmailFindings(findings); setScreen('gmail-review') }} // congela o snapshot
        onBack={() => setScreen('method')}
      />
    )
  }

  if (screen === 'gmail-review') {
    return <RevisarGmail findings={gmailFindings} onDone={(inc) => { setSaved(inc); setScreen('gmail-done') }} onBack={() => setScreen('method')} />
  }

  if (screen === 'gmail-done') {
    const groupsSummary: SummaryGroup[] = saved.length
      ? [{ label: groups[0]?.meta.label ?? 'Seus programas', items: saved.map((f) => ({ provider: f.provider, variant: f.variant })) }]
      : []
    return <RadarMontado groups={groupsSummary} onView={() => navigate('/alertas?from=onboarding')} />
  }

  if (screen === 'method') {
    return <MethodStep onManual={() => setScreen('manual')} onBack={() => setScreen('welcome')} onGmail={startGmail} />
  }

  return <WelcomeStep onContinue={() => setScreen('method')} onSkip={() => navigate('/painel')} onLogin={() => navigate('/perfil')} />
}
```

Notas: a Método nunca é bloqueada pelo catálogo (erro só aparece dentro de `'gmail-scan'`, com "Voltar" para o Método — resolve #10). `gmailFindings` congela o conjunto na transição scan→review, então `RevisarGmail` e o Radar do Gmail não dessincronizam se `sourcesQuery` reavaliar (#11). O redirect de catálogo-vazio é feito por efeito, sem `setState` durante render.

- [ ] **Step 4: Green + full onboarding suite + build**

```bash
npx vitest run src/features/onboarding && npm run build
```

Expected: todos PASS; build 0.

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/OnboardingPage.tsx src/features/onboarding/OnboardingPage.test.tsx
git commit -m "feat(onboarding): orchestrate Gmail preview path through radar to alerts"
```

---

### Task 10: Gate visual (Playwright) — atualizar antigo + cobrir Gmail + `/alertas`

**Files:**
- Modify: `tests/e2e/app-layout.spec.ts`

- [ ] **Step 1: Update the stale onboarding test (Gmail agora é "Prévia")**

No teste `onboarding exposes manual flow and disabled Gmail` (que hoje espera Gmail desabilitado), trocar a asserção e o título:

```ts
test('onboarding exposes manual flow and Gmail preview', async ({ page }, testInfo) => {
  await page.goto('/onboarding')
  await expect(page.getByRole('heading', { name: /benefícios esperando por você/i })).toBeVisible()
  await page.getByRole('button', { name: /mapear meus benefícios/i }).click()
  await expect(page.getByRole('button', { name: /conectar gmail.*prévia/i })).toBeEnabled()
  await assertNoHorizontalOverflow(page)
  await page.screenshot({ path: `test-results/${testInfo.project.name}-onboarding.png`, fullPage: true })
  await page.getByRole('button', { name: /adicionar manualmente/i }).click()
  await expect(page.getByText(/passo 1 de/i)).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await page.screenshot({ path: `test-results/${testInfo.project.name}-wizard.png`, fullPage: true })
})
```

- [ ] **Step 2: Add the Gmail-path scenario (passa por Radar montado + Alertas; prova a invariante de seed)**

```ts
test('gmail preview path: scan → review → radar → alerts → painel', async ({ page }, testInfo) => {
  const shot = (name: string) => page.screenshot({ path: `test-results/${testInfo.project.name}-${name}.png`, fullPage: true })
  await page.goto('/onboarding')
  await page.getByRole('button', { name: /mapear meus benefícios/i }).click()
  await page.getByRole('button', { name: /conectar gmail.*prévia/i }).click()
  // Vasculhando: espera o CTA de conclusão aparecer
  const verBeneficios = page.getByRole('button', { name: /ver meus benefícios/i })
  await expect(verBeneficios).toBeVisible({ timeout: 10_000 })
  await assertNoHorizontalOverflow(page)
  await shot('scan')
  await verBeneficios.click()
  // Revisar: prova que o seed produziu ≥1 achado (senão teria caído no wizard)
  await expect(page.getByRole('heading', { name: /revise o que encontramos/i })).toBeVisible()
  await expect(page.locator('.review-item').first()).toBeVisible()
  await assertNoHorizontalOverflow(page)
  await shot('revisar')
  await page.getByRole('button', { name: /adicionar ao radar/i }).click()
  // Radar montado
  await expect(page.getByRole('heading', { name: /montamos seu radar/i })).toBeVisible({ timeout: 10_000 })
  await assertNoHorizontalOverflow(page)
  await shot('radar-gmail')
  await page.getByRole('button', { name: /ver meu radar/i }).click()
  // Alertas: rota de tela cheia, sem sidebar/tabbar
  await expect(page).toHaveURL(/\/alertas/, { timeout: 10_000 })
  await expect(page.locator('.tabbar')).toHaveCount(0)
  await expect(page.locator('.side')).toHaveCount(0)
  await assertNoHorizontalOverflow(page)
  await shot('alertas')
  await page.getByRole('button', { name: /ativar alertas/i }).click()
  await expect(page).toHaveURL(/\/painel$/, { timeout: 10_000 })
})
```

- [ ] **Step 3: Run the visual gate**

```bash
npx -y supabase@2.95.0 status
npm run test:visual
```

Expected: todos os cenários PASS (antigo atualizado + novo Gmail) nos 4 projetos, sem overflow. Se o caminho Gmail cair no wizard em vez de Revisar, o seed não tem fonte na 1ª categoria → ajustar `supabase/seed.sql` e repetir.

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/app-layout.spec.ts
git commit -m "test(app-ui): cover gmail preview path and alerts in visual gate"
```

---

## Self-Review

**Spec coverage:** Método Prévia (T1); storage+recuperação incl. indisponível (T2); Alertas rota/modos/a11y switch+aria-live (T3); Perfil (T4); RadarMontado por-modo (T5); demo set (T6); Vasculhando 2400ms/reduced-motion (T7); Revisar merge+guard+CTA+estados (T8); orquestração Gmail via **Radar montado** + fallback vazio + manual nunca bloqueado (T9); E2E antigo atualizado + Gmail + `/alertas` fora do shell + invariante de seed (T10). Loop de bootstrap vazio: fora de escopo (spec).

**Correções da revisão adversarial do plano:** (1) Gmail agora passa por Radar montado; (2) clique do Gmail nunca é perdido — `startGmail` entra em `gmail-scan` que trata loading/erro; (3) nenhuma task commita vermelho; (4) teste de Vasculhando é determinístico (reduced-motion); (5/6) `aria-live` nos toggles; (7) teste de derivação de `optIn` em ambos os sentidos; (8) teste de `localStorage` indisponível; (9) `#fff` só sobre accent (padrão do DS); (10) erro de catálogo não bloqueia manual; (11) `included` inicializa dos `findings` (estáveis pós-load); (12) `onDone(incluídos: Finding[])` alimenta o Radar montado; (13) dependências de task declaradas; (14) `RadarMontado` marcado inalterado; (15) E2E antigo atualizado + fluxo real; (16) invariante de seed provada pelo E2E; (17) testes de erro/vazio/reduced-motion/rota-sem-shell adicionados.

**Correções da 3ª passada (Codex):** #5 erro de `useUserSources` vira alerta inline (`role="alert"`) + retry preservando escolhas (não substitui a tela); #11 `gmailFindings` congela o snapshot na transição scan→review; setState-in-render eliminado (catálogo-vazio via efeito); #9 `#fff` → `var(--accent-ink)`; Task 2 roda `npm run build`; teste de retry sob erro do catálogo no Gmail; teste reduced-motion agora afirma ausência de `.scan-sweep`/`.scan-ping`; locator E2E específico (`.review-item`) + screenshots de scan/revisar/radar/alertas; spec sincronizada com `gmail-done`; save não-atômico documentado como limitação aceita (fora de escopo).

**Placeholder scan:** sem TBD/TODO; código completo por passo.

**Type consistency:** `Finding` (T6) idêntico em T8/T9; `onDone(included: Finding[])` (T8) consumido em T9; `SummaryGroup` (de `RadarMontado`) usado em T9; `MethodStep.onGmail` (T1) usado em T9; `Vasculhando({count,onDone,onBack})` e `RevisarGmail({findings,onDone,onBack})` idênticos entre criação e uso.
