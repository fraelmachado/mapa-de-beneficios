# P2 — Reskin v3 "passe" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status de execução (auditado em 2026-07-10):** implementação concluída no repositório (`20bbde8` a `432c197`). Design system, componentes, telas, responsividade e tema estão presentes; suíte cumulativa e build aprovados. Publicação atual em produção não foi reauditada.

**Goal:** Aplicar o design system v3 "passe" (importado do Claude Design) às telas atuais do app, consumindo dados reais do Supabase.

**Architecture:** O design system real está em `design-system-source/` (tokens em `styles.css`; componentes React em `COMPONENTS_SOURCE.txt`; shell em `PAINEL_TEMPLATE_REFERENCE.txt`). Integramos os tokens via uma folha global importada no `index.css` e recriamos os componentes como TSX tipado em `src/ui/`. As telas existentes (`src/features/**`) passam a compor esses componentes, com um adaptador puro `toPassProps()` mapeando `MyBenefit` → props do `Pass`. Coexiste com Tailwind v3 (classes do DS são `.pass/.chip/.btn/.nav/.row/.input/.alert/.check/.seg/.sk`, sem colisão com utilitários).

**Tech Stack:** Vite + React 18 + TypeScript + Tailwind v3, Supabase, TanStack Query, React Router, Vitest + Testing Library.

## Global Constraints

- **Branch:** trabalhar em `feat/p2-reskin` (já criada a partir de `develop`).
- **Gate de tipos:** `npm test` (vitest) NÃO faz type-check — rodar `npm run build` (= `tsc && vite build`) ao final de cada task; só considerar a task pronta com build verde. (ver [[mapa-de-beneficios-vitest-no-typecheck]])
- **Não regredir:** os 117 testes atuais devem continuar verdes (`npm test`).
- **Fonte do visual:** `design-system-source/styles.css` é a fonte de verdade (cores, tipografia Onest, espaçamento, raios, dark mode). Não inventar tokens.
- **Dados reais:** o mockup/template é ilustrativo (números/cópia não são baseline). Consumir `useMyBenefits`, `useBenefit`, etc.
- **Categorias:** o app tem 16 `BenefitCategory`; o DS tem 6 cores. Usar o mapa em Task 3 (`categoryToDsCat`). Nunca passar uma `BenefitCategory` crua como `category` do `Pass`.
- **Acessibilidade/estados:** preservar estados de loading/erro/empty já existentes nas telas.

---

## File Structure

**Criar:**
- `src/ui/ds.css` — folha global do DS (cópia de `design-system-source/styles.css`, importada no `index.css`).
- `src/ui/Pass.tsx`, `Chip.tsx`, `Button.tsx`, `Nav.tsx`, `HeroRadar.tsx`, `Input.tsx`, `SegmentedControl.tsx`, `Row.tsx`, `Checklist.tsx`, `Skeleton.tsx`, `Alert.tsx` — componentes TSX tipados (de `COMPONENTS_SOURCE.txt`).
- `src/ui/index.ts` — barrel export.
- `src/features/benefits/toPassProps.ts` (+ `.test.ts`) — adaptador `MyBenefit` → `PassProps` + mapa de categoria.

**Modificar:**
- `src/index.css` — importar `ds.css`, aplicar fonte/bg/ink no body.
- `tailwind.config.js` — expor os tokens do DS no theme (cores/raios) para uso pontual com utilitários.
- `index.html` — `<html>` ganha tema inicial (já há PWA; só garantir `lang` e nada que conflite).
- `src/features/painel/Painel.tsx`, `benefits/BenefitCard.tsx`, `benefits/CategoryChips.tsx`, `busca/Search.tsx`, `detalhe/BenefitDetail.tsx`, `layout/AppLayout.tsx`, `layout/BottomNav.tsx`, `perfil/Perfil.tsx`, `onboarding/OnboardingPage.tsx` (+ seus testes).

---

## Task 1: Fundamentos — tokens, fonte, dark mode

**Files:**
- Create: `src/ui/ds.css` (conteúdo = `design-system-source/styles.css`)
- Modify: `src/index.css`, `tailwind.config.js`
- Test: `src/ui/tokens.test.ts`

**Interfaces:**
- Produces: classes globais `.pass/.chip/.btn/.nav/.row/.input/.alert/.check/.seg/.sk` e custom properties `--bg/--ink/--accent/--c-*` disponíveis em todo o app; helper `setTheme(theme)` opcional adiado para Task 5.

- [ ] **Step 1: Copiar a folha do DS**

`cp design-system-source/styles.css src/ui/ds.css` (é a fonte de verdade; manter sincronizada com `design-system-source/`).

- [ ] **Step 2: Importar no index.css e aplicar base**

No topo de `src/index.css`, antes das diretivas Tailwind:
```css
@import './ui/ds.css';
```
Garantir que o `body` use os tokens (o `ds.css` já define `body { font-family: var(--font); background: var(--bg); color: var(--ink) }`). Se houver regras antigas de bg/cor no `index.css` que conflitem (ex.: `background:#fff`), removê-las.

- [ ] **Step 3: Expor tokens no Tailwind (uso pontual)**

Em `tailwind.config.js`, no `theme.extend`:
```js
colors: {
  bg: 'var(--bg)', surface: 'var(--surface)', ink: 'var(--ink)',
  'ink-2': 'var(--ink-2)', muted: 'var(--muted)', line: 'var(--line)',
  accent: 'var(--accent)',
  cat: {
    airport: 'var(--c-airport)', seguro: 'var(--c-seguro)', viagem: 'var(--c-viagem)',
    cashback: 'var(--c-cashback)', compras: 'var(--c-compras)', pontos: 'var(--c-pontos)',
  },
},
fontFamily: { sans: ['Onest', 'system-ui', 'sans-serif'] },
borderRadius: { ds: '20px', 'ds-sm': '14px', 'ds-xs': '10px' },
```

- [ ] **Step 4: Teste de fumaça dos tokens**

```ts
// src/ui/tokens.test.ts
import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

describe('ds.css', () => {
  const css = readFileSync(new URL('./ds.css', import.meta.url), 'utf8')
  it('define os tokens-chave', () => {
    expect(css).toContain('--accent: #2B44FF')
    expect(css).toContain('--c-pontos: #E5447E')
    expect(css).toContain("[data-theme=\"dark\"]")
  })
  it('define as classes de componente', () => {
    for (const cls of ['.pass', '.chip', '.btn', '.nav', '.seg']) expect(css).toContain(cls)
  })
})
```

- [ ] **Step 5: Rodar testes + build**

Run: `npm test -- tokens && npm run build`
Expected: PASS + build verde.

- [ ] **Step 6: Commit**

```bash
git add src/ui/ds.css src/index.css tailwind.config.js src/ui/tokens.test.ts
git commit -m "feat(p2): integra tokens do design system v3 (ds.css + tailwind)"
```

---

## Task 2: Primitivos de UI (TSX tipado)

Converter os blocos de `design-system-source/COMPONENTS_SOURCE.txt` (que usam `React.createElement`) para **TSX tipado** em `src/ui/`. Os tipos das props já estão nos blocos `.d.ts` de cada componente — copiá-los como `interface` exportada. As classes CSS já existem (Task 1), então cada componente só monta a marcação.

**Files:**
- Create: `src/ui/Button.tsx`, `Chip.tsx`, `Input.tsx`, `Row.tsx`, `Alert.tsx`, `Checklist.tsx`, `Skeleton.tsx`, `SegmentedControl.tsx`, `Nav.tsx`, `HeroRadar.tsx`, `src/ui/index.ts`
- Test: `src/ui/Button.test.tsx`, `src/ui/Chip.test.tsx` (smoke por componente)

**Interfaces:**
- Produces: `Button`, `Chip`, `Input`, `Row`, `Alert`, `Checklist`, `Skeleton`, `SegmentedControl`, `Nav`, `HeroRadar` com as props dos `.d.ts` em `COMPONENTS_SOURCE.txt`. Barrel `src/ui/index.ts` reexporta todos + `Pass` (Task 3).

- [ ] **Step 1: Converter cada primitivo para TSX**

Para cada componente acima, criar `src/ui/<Nome>.tsx`: copiar a `interface <Nome>Props` do `.d.ts` correspondente em `COMPONENTS_SOURCE.txt`, e reescrever o corpo `React.createElement(...)` como JSX equivalente (mesmas classes, mesmas props, mesma estrutura). Exemplo (Chip), convertendo o bloco `Chip.jsx`:
```tsx
// src/ui/Chip.tsx
export interface ChipProps {
  children?: React.ReactNode
  category?: 'airport' | 'seguro' | 'viagem' | 'cashback' | 'compras' | 'pontos'
  active?: boolean
  onClick?: (e: React.MouseEvent) => void
}
export function Chip({ children, category, active = false, onClick }: ChipProps) {
  return (
    <button className={'chip' + (active ? ' on' : '')} type="button" aria-pressed={active} onClick={onClick}>
      {category ? <i className={`cat-${category}`} /> : null}
      {category ? ' ' : null}
      {children}
    </button>
  )
}
```
Repetir para Button, Input, Row, Alert, Checklist, Skeleton, SegmentedControl, Nav, HeroRadar — seguindo 1:1 o respectivo bloco em `COMPONENTS_SOURCE.txt` (HeroRadar mantém os `style` inline do source).

- [ ] **Step 2: Barrel export**

```ts
// src/ui/index.ts
export * from './Button'; export * from './Chip'; export * from './Input'
export * from './Row'; export * from './Alert'; export * from './Checklist'
export * from './Skeleton'; export * from './SegmentedControl'; export * from './Nav'
export * from './HeroRadar'; export * from './Pass'
```
(`./Pass` é criado na Task 3 — adicionar a linha já aqui; o build dessa task pode omitir a linha do Pass e adicioná-la na Task 3 se preferir manter cada task verde isoladamente.)

- [ ] **Step 3: Smoke tests (2 representativos)**

```tsx
// src/ui/Chip.test.tsx
import { render, screen } from '@testing-library/react'
import { Chip } from './Chip'
it('renderiza chip ativo com aria-pressed', () => {
  render(<Chip category="viagem" active>Viagem</Chip>)
  const b = screen.getByRole('button', { name: /viagem/i })
  expect(b).toHaveAttribute('aria-pressed', 'true')
  expect(b).toHaveClass('chip', 'on')
})
```
```tsx
// src/ui/Button.test.tsx
import { render, screen } from '@testing-library/react'
import { Button } from './Button'
it('aplica a variante ghost', () => {
  render(<Button variant="ghost">Ok</Button>)
  expect(screen.getByRole('button', { name: 'Ok' })).toHaveClass('btn', 'ghost')
})
```

- [ ] **Step 4: Testes + build**

Run: `npm test -- src/ui && npm run build`
Expected: PASS + build verde (tipos das props corretos).

- [ ] **Step 5: Commit**

```bash
git add src/ui
git commit -m "feat(p2): primitivos de UI do DS v3 em src/ui (TSX tipado)"
```

---

## Task 3: Pass + adaptador `toPassProps` (núcleo)

**Files:**
- Create: `src/ui/Pass.tsx`, `src/features/benefits/toPassProps.ts`
- Test: `src/features/benefits/toPassProps.test.ts`

**Interfaces:**
- Consumes: `MyBenefit` (`src/features/benefits/types.ts`) — campos `category`, `via[]`, `summary`, `title`, `benefit_source`, `origins[]`, `networks[]`, `partner_name`.
- Produces: `Pass(props: PassProps)` (props do bloco `Pass.d.ts`); `toPassProps(b: MyBenefit): PassProps` e `categoryToDsCat(c: BenefitCategory): DsCat`.

- [ ] **Step 1: Criar `src/ui/Pass.tsx`**

Converter o bloco `Pass.jsx` de `COMPONENTS_SOURCE.txt` para TSX, com `export interface PassProps` igual ao `Pass.d.ts`. Manter os mapas `CAT` e `ORIGIN`, a `--cat` via `style`, a borda `.edge`, o picote `.perf`, o pill de origem e o `.go`. O `category` é tipado como `DsCat` (ver Step 2).

- [ ] **Step 2: Escrever o teste do adaptador (falha primeiro)**

```ts
// src/features/benefits/toPassProps.test.ts
import { describe, it, expect } from 'vitest'
import { toPassProps, categoryToDsCat } from './toPassProps'
import type { MyBenefit } from './types'

const base: MyBenefit = {
  id: '1', title: 'Sala VIP GRU', summary: '2 acessos/mês', category: 'airport',
  scope: 'national', uf: null, steps: null, partner_name: null, valid_until: null,
  image_url: null, action_url: null, action_label: null, created_at: '', source_url: null,
  source_name: null, observed_at: null, benefit_source: 'issuer',
  origins: [{ provider: 'Nubank', category: 'bank_card' }], networks: [], via: ['Nubank Ultravioleta'],
}

describe('categoryToDsCat', () => {
  it('mapeia as 16 categorias do app nas 6 do DS', () => {
    expect(categoryToDsCat('airport')).toBe('airport')
    expect(categoryToDsCat('concierge')).toBe('airport')
    expect(categoryToDsCat('travel')).toBe('viagem')
    expect(categoryToDsCat('miles')).toBe('viagem')
    expect(categoryToDsCat('insurance')).toBe('seguro')
    expect(categoryToDsCat('security')).toBe('seguro')
    expect(categoryToDsCat('cashback')).toBe('cashback')
    expect(categoryToDsCat('investback')).toBe('cashback')
    expect(categoryToDsCat('points')).toBe('pontos')
    expect(categoryToDsCat('shopping')).toBe('compras')
    expect(categoryToDsCat('restaurant')).toBe('compras')
    expect(categoryToDsCat('other')).toBe('compras') // default neutro
  })
})

describe('toPassProps', () => {
  it('mapeia título, via, desc e categoria', () => {
    const p = toPassProps(base)
    expect(p.title).toBe('Sala VIP GRU')
    expect(p.via).toBe('Nubank Ultravioleta')
    expect(p.desc).toBe('2 acessos/mês')
    expect(p.category).toBe('airport')
  })
  it('deriva originType/originLabel de benefit_source + origins', () => {
    const p = toPassProps(base)
    expect(p.originType).toBe('emissor')
    expect(p.originLabel).toContain('Nubank')
  })
  it('usa a bandeira (networks) quando benefit_source = card_network', () => {
    const p = toPassProps({ ...base, benefit_source: 'card_network', networks: [{ brand: 'Visa', level: 'Infinite' }] })
    expect(p.originType).toBe('bandeira')
    expect(p.originLabel).toMatch(/Visa/)
  })
})
```

- [ ] **Step 3: Rodar — deve falhar**

Run: `npm test -- toPassProps`
Expected: FAIL ("toPassProps is not a function").

- [ ] **Step 4: Implementar o adaptador**

```ts
// src/features/benefits/toPassProps.ts
import type { MyBenefit, BenefitCategory } from './types'
import type { PassProps } from '../../ui/Pass'

export type DsCat = 'airport' | 'seguro' | 'viagem' | 'cashback' | 'compras' | 'pontos'

const CAT_MAP: Record<BenefitCategory, DsCat> = {
  airport: 'airport', concierge: 'airport',
  travel: 'viagem', miles: 'viagem',
  insurance: 'seguro', security: 'seguro',
  cashback: 'cashback', investback: 'cashback',
  points: 'pontos',
  shopping: 'compras', restaurant: 'compras', international_purchase: 'compras',
  experience: 'compras', investment: 'compras', account_service: 'compras', other: 'compras',
}
export function categoryToDsCat(c: BenefitCategory): DsCat {
  return CAT_MAP[c] ?? 'compras'
}

const ORIGIN_MAP = { issuer: 'emissor', card_network: 'bandeira', partner: 'parceiro' } as const

export function toPassProps(b: MyBenefit): PassProps {
  const originType =
    b.benefit_source && b.benefit_source !== 'mixed' ? ORIGIN_MAP[b.benefit_source] : 'emissor'
  let originLabel = b.origins[0]?.provider ?? b.partner_name ?? b.source_name ?? ''
  if (originType === 'bandeira' && b.networks[0]) {
    originLabel = [b.networks[0].brand, b.networks[0].level].filter(Boolean).join(' ')
  }
  return {
    title: b.title,
    via: b.via[0] ?? originLabel,
    desc: b.summary,
    category: categoryToDsCat(b.category),
    originType,
    originLabel,
  }
}
```

- [ ] **Step 5: Rodar — deve passar + build**

Run: `npm test -- toPassProps && npm run build`
Expected: PASS + build verde.

- [ ] **Step 6: Commit**

```bash
git add src/ui/Pass.tsx src/features/benefits/toPassProps.ts src/features/benefits/toPassProps.test.ts src/ui/index.ts
git commit -m "feat(p2): componente Pass + adaptador MyBenefit→PassProps"
```

---

## Task 4: Reskin do Painel

**Files:**
- Modify: `src/features/painel/Painel.tsx`, `src/features/painel/Painel.test.tsx`, `src/features/benefits/BenefitCard.tsx`
- Test: reusar `Painel.test.tsx`

**Interfaces:**
- Consumes: `useMyBenefits`, `filterBenefits`, `toPassProps`, `Pass`, `HeroRadar`, `CategoryChips` (Task 5 ajusta os chips).

- [ ] **Step 1: `BenefitCard` passa a renderizar `Pass`**

Reescrever `BenefitCard` para envolver `Pass` num `Link` (ou usar `href`), mapeando via `toPassProps`:
```tsx
import { Link } from 'react-router-dom'
import { Pass } from '../../ui/Pass'
import { toPassProps } from './toPassProps'
import type { MyBenefit } from './types'
export function BenefitCard({ benefit }: { benefit: MyBenefit }) {
  return (
    <Link to={`/beneficio/${benefit.id}`} style={{ textDecoration: 'none' }}>
      <Pass {...toPassProps(benefit)} />
    </Link>
  )
}
```
Ajustar `BenefitCard.test.tsx` (asserções de classe `.pass`, título, via).

- [ ] **Step 2: Reskin do `Painel`**

Substituir o header + destaque por `HeroRadar` (count = total, label "Seu radar") e a lista por um grid `.passes`. Manter loading/erro/empty. Exemplo do corpo de retorno (manter os hooks atuais):
```tsx
return (
  <div className="mx-auto max-w-md p-4 pb-24">
    <p className="lbl" style={{ marginBottom: 2 }}>Seu radar de benefícios</p>
    <HeroRadar count={all.length} label="Benefícios ativos"
      caption={`${all.length} benefício${all.length === 1 ? '' : 's'} no seu radar`} />
    <div style={{ margin: 'var(--s5) 0 var(--s3)' }}>
      <CategoryChips selected={category} onChange={setCategory} />
    </div>
    {all.length === 0 ? (
      <p className="muted" style={{ textAlign: 'center', padding: 'var(--s8) 0' }}>
        Nenhum benefício ainda. Refaça a varredura para incluir mais fontes.
      </p>
    ) : (
      <div className="passes">
        {visible.map((b) => <BenefitCard key={b.id} benefit={b} />)}
      </div>
    )}
  </div>
)
```
Manter `highlight`/`filterBenefits` ou simplificar (decisão: manter o primeiro como primeiro do grid). Atualizar `Painel.test.tsx`: contagem no HeroRadar, presença de `.pass`, empty state.

- [ ] **Step 3: Testes + build**

Run: `npm test -- painel benefits && npm run build`
Expected: PASS + build verde.

- [ ] **Step 4: Verificação visual**

Run: `npm run dev` e abrir `/painel` (com sessão anônima + onboarding); comparar com `design-system-source/PAINEL_TEMPLATE_REFERENCE.txt`. Conferir hero com gradiente, cards "passe" com borda colorida por categoria e pill de origem.

- [ ] **Step 5: Commit**

```bash
git add src/features/painel src/features/benefits/BenefitCard.tsx
git commit -m "feat(p2): reskin do Painel (HeroRadar + cards Pass)"
```

---

## Task 5: Reskin de CategoryChips + shell (AppLayout/BottomNav) + dark mode

**Files:**
- Modify: `src/features/benefits/CategoryChips.tsx` (+test), `src/features/layout/AppLayout.tsx`, `src/features/layout/BottomNav.tsx` (+test)
- Create: `src/ui/theme.ts` (+`theme.test.ts`)

**Interfaces:**
- Consumes: `Chip`, `Nav`; `categoryToDsCat` (para o ponto colorido do chip).
- Produces: `initTheme()` / `toggleTheme()` (persistem em `localStorage` `mb-theme`, setam `data-theme` no `<html>`).

- [ ] **Step 1: `CategoryChips` usa `Chip`**

Reescrever para renderizar um `Chip` por categoria (label de `CATEGORIES`), com `category` = `categoryToDsCat(key)` para o ponto colorido, `active`/`onClick` controlados. Incluir um chip "Todos" (category undefined). Ajustar o teste.

- [ ] **Step 2: Tema (TDD)**

```ts
// src/ui/theme.test.ts
import { describe, it, expect, beforeEach } from 'vitest'
import { toggleTheme, initTheme } from './theme'
beforeEach(() => { localStorage.clear(); document.documentElement.removeAttribute('data-theme') })
it('alterna e persiste o tema', () => {
  initTheme(); const first = document.documentElement.getAttribute('data-theme')
  toggleTheme()
  expect(document.documentElement.getAttribute('data-theme')).not.toBe(first)
  expect(localStorage.getItem('mb-theme')).toBeTruthy()
})
```
Implementar `src/ui/theme.ts` (espelhar `ds-base.js`/`toggleTheme` de `PAINEL_TEMPLATE_REFERENCE.txt`): `initTheme()` = salvo > sistema; `toggleTheme()` inverte e persiste.

- [ ] **Step 3: Shell responsivo**

`AppLayout`: shell com `<main>` (mobile `max-width:480px`; desktop sidebar `256px 1fr` ≥960px) + tabbar mobile fixa usando `Nav`, espelhando o CSS do `PAINEL_TEMPLATE_REFERENCE.txt` (mover o CSS de `.app/.side/.main/.tabbar/.passes` para `ds.css` ou um `layout.css` importado). `BottomNav` passa a usar o componente `Nav` (itens Painel/Buscar/Perfil com `active` por rota via `useLocation`). Adicionar botão de tema (`toggleTheme`). Chamar `initTheme()` em `main.tsx`.

- [ ] **Step 4: Testes + build**

Run: `npm test -- layout benefits theme && npm run build`
Expected: PASS + build verde.

- [ ] **Step 5: Commit**

```bash
git add src/features/benefits/CategoryChips.tsx src/features/layout src/ui/theme.ts src/ui/theme.test.ts src/main.tsx src/ui/ds.css
git commit -m "feat(p2): chips por categoria + shell responsivo + dark mode"
```

---

## Task 6: Reskin de Busca, Detalhe, Perfil, Onboarding

Cada tela vira uma sub-entrega testável; aplicar os componentes do DS mantendo a lógica/dados atuais.

**Files:** `src/features/busca/Search.tsx`, `src/features/detalhe/BenefitDetail.tsx`, `src/features/perfil/Perfil.tsx`, `src/features/onboarding/OnboardingPage.tsx` (+ respectivos testes).

- [ ] **Step 1: Busca** — usar `Input` (com ícone de lupa) para o campo de texto e `CategoryChips`; resultados como `BenefitCard`/`Pass`. Atualizar `Search.test.tsx`.
- [ ] **Step 2: Build/test** — `npm test -- busca && npm run build`.
- [ ] **Step 3: Detalhe** — `BenefitDetail` usa o estilo de "passe" no topo (categoria/origem), `Checklist` para os passos (split de `steps`), `Button` (primary) para a ação (`action_url` com allowlist http(s) já existente), `Row` para metadados (fonte/data). Atualizar teste.
- [ ] **Step 4: Build/test** — `npm test -- detalhe && npm run build`.
- [ ] **Step 5: Perfil** — `Row` para itens, `Input`+`Button` para upgrade de e-mail (magic link), `Alert` para avisos. Atualizar teste.
- [ ] **Step 6: Onboarding** — passos com `SegmentedControl`/`Chip` por categoria + `Button`; manter `useSaveUserSources`/`selection`. Atualizar teste.
- [ ] **Step 7: Build/test final** — `npm test && npm run build` (todos verdes).
- [ ] **Step 8: Commit**

```bash
git add src/features/busca src/features/detalhe src/features/perfil src/features/onboarding
git commit -m "feat(p2): reskin de Busca, Detalhe, Perfil e Onboarding"
```

---

## Task 7: Admin (toque leve) + verificação final

**Files:** `src/features/admin/AdminLayout.tsx`, `AdminHome.tsx`, `AdminLogin.tsx` (+ testes conforme necessário).

- [ ] **Step 1: Aplicar `Button`/`Input`/`Row`/`Alert` nas telas admin** (sem redesenhar formulários; só trocar primitivos e tokens para o admin não destoar). Manter toda a lógica/hooks.
- [ ] **Step 2: Verificação final completa**

Run: `npm test && npm run build`
Expected: todos os testes verdes + build limpo.

- [ ] **Step 3: Verificação visual ponta-a-ponta**

`npm run dev`: percorrer Painel → Buscar → Detalhe → Perfil → Onboarding → /admin, em mobile e desktop (≥960px), claro e escuro. Comparar com o template/mockup.

- [ ] **Step 4: Commit + finalizar branch**

```bash
git add -A && git commit -m "feat(p2): reskin admin + verificação final"
```
Seguir [[mapa-de-beneficios-source-agnostic]] para o roadmap: após P2 vêm P3 (onboarding multi-step) e P4 (descoberta de catálogo, onde entra a tela "Discover" do handoff).

---

## Self-Review (cobertura do design system)

- **Tokens/dark mode** → Task 1. **Todos os componentes do DS** (Pass, Chip, Button, Nav, HeroRadar, Input, SegmentedControl, Row, Checklist, Skeleton, Alert) → Tasks 2–3. **Mapa 16→6 categorias + origem** → Task 3. **Telas** (Painel, Busca, Detalhe, Perfil, Onboarding, shell, admin) → Tasks 4–7.
- **Gate de build** em toda task (vitest não type-checa). **Dados reais** em todas as telas (hooks atuais preservados). **Sem placeholders**: o corpo dos componentes vem de `design-system-source/COMPONENTS_SOURCE.txt` (em repo) convertido para TSX; lógica nova (`toPassProps`, `theme`) com código completo acima.
- **Fora de escopo (não nesta plan):** tela "Discover" (handoff) → P4; variações/novos componentes além do DS atual.
