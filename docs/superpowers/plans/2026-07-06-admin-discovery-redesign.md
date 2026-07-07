# Redesign da tela `/admin/discovery` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir a UI de revisão do discovery (`/admin/discovery`) para a hierarquia de cards aninhados aprovada no mockup do Claude Design, reusando `src/ui`/`ds.css` e os hooks existentes — sem tocar em backend, schema ou hooks de dados.

**Architecture:** Reescreve dois componentes de apresentação (`AdminDiscovery.tsx`, `CandidateTree.tsx`), adiciona um helper puro de apresentação (`discoveryMeta.ts`) e uma folha de estilo `discovery.css` (classes `.dv-*` transcritas do mockup, usando tokens do DS). A fonte de dados (`useDiscovery.ts` hooks + RPC `promote_discovery_candidate`) permanece intocada. É um redesenho **fiel ao mockup** `Admin Discovery.dc.html`.

**Tech Stack:** React 18 + TypeScript, Vite, `@tanstack/react-query` (já fiado nos hooks), CSS com tokens do DS (`ds.css`). Vitest + Testing Library.

**Design source (fonte da verdade visual):** [`docs/mockups/design_handoff_mockups/Admin Discovery.dc.html`](../../mockups/design_handoff_mockups/Admin%20Discovery.dc.html). Não é pixel-copy: é estrutura + fluxo com o nosso DS. Regra do fluxo (ver `FLUXO-Design-e-Code.md`): mudança visual começa no mockup, não no código.

## Global Constraints

- **Zero backend novo.** Não alterar migrations, `promote_discovery_candidate`, `discover.ts`, nem `useDiscovery.ts`/`types.ts`. Só apresentação.
- **Reaproveitar obrigatoriamente:** `ds.css` (classes `.tag`, `.pill`, `.new`, `.input`, `.row`, tokens `--c-*`, `--s*`, `--fz-*`, `--radius`, `--surface`, `--ok`, `--warn`, `--muted`), e os mapas de categoria já existentes: `categoryToDsCat` (`src/features/benefits/toPassProps.ts`), `CATEGORIES` (`src/features/benefits/types.ts`), `SOURCE_CATEGORY_META` (`src/features/onboarding/categoryMeta.ts`). **Não** reinventar cores/labels.
- **Mobile-first** (regra central do produto — reforçada pelo user): **projetar/estilizar o mobile primeiro** (é o caso base do CSS); desktop é só a expansão responsiva via `@container (min-width:760px)`. Nada de estilo base pensado pra desktop. As ações de cada nó empilham **abaixo** no mobile e vão pra **direita** no desktop. Toda regra em `@container` é aditiva sobre a base mobile — nunca o contrário.
- **Terminologia nova (copy):** dentro desta tela, "fonte/source" na UI é **"Programa"**; "variante/source_item" é **"Variante"**. (Ids internos/DB — `sources`, `source_items`, `entity_type` — não mudam.) Não fazer varredura de copy fora desta tela.
- **Aprovação granular, nó a nó, top-down:** o botão Aprovar de uma variante fica **desabilitado** até o Programa pai estar aprovado (ou já existir no catálogo); o de um benefício, até a Variante pai estar aprovada. Rejeitar é sempre habilitado enquanto pendente.
- **Estados por nó:** `pendente` (mostra Aprovar/Rejeitar) · `aprovado` (badge verde, ações somem) · `rejeitado` (nó esmaecido + badge).
- **Type-check:** `npm test` NÃO roda `tsc`. Rodar `npm run build` pra pegar quebra de tipo.
- **Test DB:** hooks são mockados nos testes de componente (sem DB). O padrão de teste de componente admin usa `@testing-library/react` (`render`, `screen`, `fireEvent`) — ver `src/features/admin/benefits/AdminBenefits.test.tsx`.

## Escopo (o que muda e o que NÃO muda)

**Muda (só apresentação):**
- `src/features/admin/discovery/CandidateTree.tsx` — reescrito para cards aninhados.
- `src/features/admin/discovery/AdminDiscovery.tsx` — reescrito (header + fila de jobs + wrapper de container).
- `src/features/admin/discovery/CandidateTree.test.tsx` — atualizado para a nova estrutura.
- Novos: `src/features/admin/discovery/discoveryMeta.ts` (+ teste), `src/features/admin/discovery/discovery.css`.

**NÃO muda (fora de escopo):**
- Hooks (`useDiscovery.ts`), tipos (`types.ts`), RPC, schema, `discover.ts`.
- O **shell admin** (`AdminLayout.tsx` sidebar/tabbar do mockup) — a sidebar escura + tabbar do mockup é uma mudança de shell que afetaria TODAS as telas admin. Fica como **follow-up separado**. Esta tela reusa o `AdminLayout` atual (header simples) e só reconstrói o conteúdo da página. O container query do reflow de ações fica escopado num wrapper próprio (`.dv-root`), não depende do shell.
- Edição inline ("Editar e aprovar") — permanece follow-up; o hook `useUpdateCandidatePayload` continua não-fiado.

---

## File Structure

- `src/features/admin/discovery/discoveryMeta.ts` — **puro.** Mapeia dados do candidato → apresentação: chip de categoria (label + var de cor), label de verificação, meta de status do job. Consome os mapas existentes.
- `src/features/admin/discovery/discovery.css` — classes `.dv-*` (transcritas/adaptadas do mockup), usando tokens do DS. Importado pelos componentes.
- `src/features/admin/discovery/CandidateTree.tsx` — árvore de cards aninhados (Programa → Variante → Benefício), com chips, ações, trava top-down e estados. Consome `discoveryMeta`.
- `src/features/admin/discovery/AdminDiscovery.tsx` — página: header (eyebrow "Catálogo" + h1 "Discovery" + subtítulo), form "Novo job", fila de jobs com chip de status, e a `CandidateTree` do job selecionado, tudo dentro de `.dv-root` (container).

---

## Task 1: `discoveryMeta.ts` — helpers puros de apresentação

**Files:**
- Create: `src/features/admin/discovery/discoveryMeta.ts`
- Test: `src/features/admin/discovery/discoveryMeta.test.ts`

**Interfaces:**
- Consumes: `categoryToDsCat` de `../../benefits/toPassProps`, `CATEGORIES` de `../../benefits/types`, `SOURCE_CATEGORY_META`/`categoryMeta` de `../../onboarding/categoryMeta`. Tipos `BenefitCategory`, `SourceCategory` de `../../benefits/types`.
- Produces:
  - `type ChipMeta = { label: string; colorVar: string }` — `colorVar` é um valor CSS pronto (ex.: `'var(--c-cashback)'`).
  - `benefitCategoryChip(cat: string): ChipMeta` — usa `categoryToDsCat` + `CATEGORIES`; fallback `{ label: cat, colorVar: 'var(--muted)' }` para valor desconhecido.
  - `sourceCategoryChip(cat: string): ChipMeta` — usa `SOURCE_CATEGORY_META` + `SOURCE_CAT_COLOR`; fallback `{ label: cat, colorVar: 'var(--muted)' }`.
  - `verificationLabel(status: string | null | undefined): string | null` — pt-BR; `null` se vazio/desconhecido.
  - `jobStatusMeta(status: string): { label: string; cls: string }` — mapeia status do job (`pending|processing|done|error`) → `{ label pt-BR, cls }` onde `cls ∈ {queued,running,done,error}` (casa com `discovery.css`).

- [ ] **Step 1: Write the failing test**

Create `src/features/admin/discovery/discoveryMeta.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import {
  benefitCategoryChip, sourceCategoryChip, verificationLabel, jobStatusMeta,
} from './discoveryMeta'

describe('discoveryMeta', () => {
  it('benefitCategoryChip usa label pt-BR + cor da DsCat', () => {
    // 'travel' -> DsCat 'viagem' -> var(--c-viagem); label 'Viagem'
    expect(benefitCategoryChip('travel')).toEqual({ label: 'Viagem', colorVar: 'var(--c-viagem)' })
    // 'other' -> DsCat 'compras' -> var(--c-compras); label 'Outros'
    expect(benefitCategoryChip('other')).toEqual({ label: 'Outros', colorVar: 'var(--c-compras)' })
  })

  it('benefitCategoryChip: categoria desconhecida cai no fallback muted', () => {
    expect(benefitCategoryChip('zzz')).toEqual({ label: 'zzz', colorVar: 'var(--muted)' })
  })

  it('sourceCategoryChip usa label do SOURCE_CATEGORY_META', () => {
    expect(sourceCategoryChip('corporate_benefits'))
      .toEqual({ label: 'Multibenefícios', colorVar: 'var(--c-cashback)' })
    expect(sourceCategoryChip('health'))
      .toEqual({ label: 'Planos de saúde', colorVar: 'var(--c-seguro)' })
  })

  it('verificationLabel traduz e trata vazio', () => {
    expect(verificationLabel('official_confirmed')).toBe('oficial confirmado')
    expect(verificationLabel('needs_manual_validation')).toBe('validar manualmente')
    expect(verificationLabel(null)).toBeNull()
    expect(verificationLabel('')).toBeNull()
    expect(verificationLabel('coisa_estranha')).toBeNull()
  })

  it('jobStatusMeta mapeia status do banco -> label + cls', () => {
    expect(jobStatusMeta('pending')).toEqual({ label: 'pendente', cls: 'queued' })
    expect(jobStatusMeta('processing')).toEqual({ label: 'processando', cls: 'running' })
    expect(jobStatusMeta('done')).toEqual({ label: 'concluído', cls: 'done' })
    expect(jobStatusMeta('error')).toEqual({ label: 'erro', cls: 'error' })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- discoveryMeta`
Expected: FAIL — cannot find module `./discoveryMeta`.

- [ ] **Step 3: Implement `discoveryMeta.ts`**

Create `src/features/admin/discovery/discoveryMeta.ts`:

```typescript
import { categoryToDsCat, type DsCat } from '../../benefits/toPassProps'
import { CATEGORIES, type BenefitCategory, type SourceCategory } from '../../benefits/types'
import { categoryMeta } from '../../onboarding/categoryMeta'

export interface ChipMeta {
  label: string
  colorVar: string
}

// DsCat -> variável de cor do DS (espelha o mapa CAT de src/ui/Pass.tsx).
const DSCAT_VAR: Record<DsCat, string> = {
  airport: 'var(--c-airport)',
  seguro: 'var(--c-seguro)',
  viagem: 'var(--c-viagem)',
  cashback: 'var(--c-cashback)',
  compras: 'var(--c-compras)',
  pontos: 'var(--c-pontos)',
}

// Cor por source_category (uma das 6 do DS; corporate=cashback casa com o mockup).
const SOURCE_CAT_COLOR: Record<SourceCategory, string> = {
  bank_card: 'var(--accent)',
  carrier: 'var(--c-pontos)',
  health: 'var(--c-seguro)',
  corporate_benefits: 'var(--c-cashback)',
  loyalty: 'var(--c-pontos)',
  retail: 'var(--c-compras)',
  mall: 'var(--c-viagem)',
}

const BENEFIT_LABEL = new Map(CATEGORIES.map((c) => [c.key, c.label]))

const VERIFICATION_LABEL: Record<string, string> = {
  official_confirmed: 'oficial confirmado',
  official_needs_regulation_check: 'checar regulação',
  partner_network: 'rede parceira',
  inferred_from_card_network: 'inferido da bandeira',
  needs_manual_validation: 'validar manualmente',
}

const JOB_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'pendente', cls: 'queued' },
  processing: { label: 'processando', cls: 'running' },
  done: { label: 'concluído', cls: 'done' },
  error: { label: 'erro', cls: 'error' },
}

export function benefitCategoryChip(cat: string): ChipMeta {
  const label = BENEFIT_LABEL.get(cat as BenefitCategory)
  if (!label) return { label: cat, colorVar: 'var(--muted)' }
  return { label, colorVar: DSCAT_VAR[categoryToDsCat(cat as BenefitCategory)] }
}

export function sourceCategoryChip(cat: string): ChipMeta {
  const color = SOURCE_CAT_COLOR[cat as SourceCategory]
  if (!color) return { label: cat, colorVar: 'var(--muted)' }
  return { label: categoryMeta(cat as SourceCategory).label, colorVar: color }
}

export function verificationLabel(status: string | null | undefined): string | null {
  if (!status) return null
  return VERIFICATION_LABEL[status] ?? null
}

export function jobStatusMeta(status: string): { label: string; cls: string } {
  return JOB_STATUS[status] ?? { label: status, cls: 'queued' }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- discoveryMeta`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/discovery/discoveryMeta.ts src/features/admin/discovery/discoveryMeta.test.ts
git commit -m "feat(discovery-ui): presentation helpers (category chips, verification, job status)"
```

---

## Task 2: `discovery.css` + reescrever `CandidateTree.tsx` (cards aninhados)

**Files:**
- Create: `src/features/admin/discovery/discovery.css`
- Modify (rewrite): `src/features/admin/discovery/CandidateTree.tsx`
- Modify (rewrite): `src/features/admin/discovery/CandidateTree.test.tsx`

**Interfaces:**
- Consumes: `DiscoveryCandidate` de `./types`; `benefitCategoryChip`, `sourceCategoryChip`, `verificationLabel` de `./discoveryMeta` (Task 1).
- Produces: `CandidateTree` com a MESMA assinatura de props atual — `{ candidates: DiscoveryCandidate[]; onPromote: (id: string) => void; onReject: (id: string) => void }` (não quebrar `AdminDiscovery`).

**Regras de dados (payload dos candidatos, do `flatten.ts`):**
- source: `payload = { slug, name, source_category, kind }`; chip = `sourceCategoryChip(payload.source_category)`.
- source_item: `payload = { slug, label, display_name, card_brand, card_level, product_type }`; `sub` = `[card_brand, card_level].filter(Boolean).join(' ')` (ou vazio).
- benefit: `payload = { slug, title, summary, category, ... }`; chip = `benefitCategoryChip(payload.category)`.
- `provenance = { source_url, source_name, observed_at, verification_status }` em todos; procedência = host de `source_url`.
- **Trava top-down:** montar `byFp = Map<fingerprint, candidate>`. Um nó com pai está destravado se `parent.review_status === 'approved'` OU `parent.matched_id != null` (pai já existe no catálogo). Source (sem pai) sempre destravado.

- [ ] **Step 1: Write the failing test**

Rewrite `src/features/admin/discovery/CandidateTree.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { CandidateTree } from './CandidateTree'
import type { DiscoveryCandidate } from './types'

const base = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate => ({
  id: 'x', job_id: 'j', entity_type: 'source', fingerprint: 'fp', parent_fingerprint: null,
  payload: {}, provenance: {}, match_status: 'new', matched_id: null, review_status: 'pending',
  promoted_id: null, created_at: '', ...over,
})

const tree: DiscoveryCandidate[] = [
  base({ id: 's1', entity_type: 'source', fingerprint: 'source|wellhub', payload: { name: 'Wellhub', source_category: 'corporate_benefits' }, provenance: { source_url: 'https://wellhub.com', verification_status: 'official_confirmed' } }),
  base({ id: 'i1', entity_type: 'source_item', fingerprint: 'si|wellhub|empresas', parent_fingerprint: 'source|wellhub', payload: { label: 'Wellhub para empresas' } }),
  base({ id: 'b1', entity_type: 'benefit', fingerprint: 'b|empresas|academia', parent_fingerprint: 'si|wellhub|empresas', payload: { title: 'Acesso a academias', category: 'other', summary: 'Rede de locais parceiros.' }, provenance: { source_url: 'https://wellhub.com/academias' } }),
]

describe('CandidateTree', () => {
  it('renderiza a árvore Programa -> Variante -> Benefício com labels certos', () => {
    render(<CandidateTree candidates={tree} onPromote={vi.fn()} onReject={vi.fn()} />)
    expect(screen.getByText('Wellhub')).toBeInTheDocument()
    expect(screen.getByText('Wellhub para empresas')).toBeInTheDocument()
    expect(screen.getByText('Acesso a academias')).toBeInTheDocument()
    // chips traduzidos
    expect(screen.getByText('Multibenefícios')).toBeInTheDocument() // source_category
    expect(screen.getByText('Outros')).toBeInTheDocument()          // benefit category
    expect(screen.getByText('oficial confirmado')).toBeInTheDocument()
  })

  it('Aprovar o Programa chama onPromote com o id da source', () => {
    const onPromote = vi.fn()
    render(<CandidateTree candidates={tree} onPromote={onPromote} onReject={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /aprovar programa/i }))
    expect(onPromote).toHaveBeenCalledWith('s1')
  })

  it('trava top-down: Aprovar da variante fica desabilitado enquanto a source está pendente', () => {
    render(<CandidateTree candidates={tree} onPromote={vi.fn()} onReject={vi.fn()} />)
    // há um "Aprovar" (variante) e um "Aprovar" (benefício) além do "Aprovar programa"
    const variantApprove = screen.getAllByRole('button', { name: /^aprovar$/i })
    expect(variantApprove.length).toBeGreaterThan(0)
    expect(variantApprove.every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
    expect(screen.getAllByText(/aprove o programa primeiro/i).length).toBeGreaterThan(0)
  })

  it('destrava a variante quando a source está aprovada; e esconde ações da source aprovada', () => {
    const approved = tree.map((c) => c.id === 's1' ? { ...c, review_status: 'approved' as const } : c)
    render(<CandidateTree candidates={approved} onPromote={vi.fn()} onReject={vi.fn()} />)
    // source aprovada -> badge, sem "Aprovar programa"
    expect(screen.queryByRole('button', { name: /aprovar programa/i })).not.toBeInTheDocument()
    expect(screen.getByText('aprovado')).toBeInTheDocument()
    // variante agora destravada
    const variantApprove = screen.getByRole('button', { name: /^aprovar$/i })
    expect((variantApprove as HTMLButtonElement).disabled).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- CandidateTree`
Expected: FAIL — a estrutura/labels novos ainda não existem.

- [ ] **Step 3: Create `discovery.css`**

Create `src/features/admin/discovery/discovery.css` (adaptado do mockup `Admin Discovery.dc.html`, só as classes `.dv-*`; `.dv-root` é o container que substitui `.aa-root` do mockup):

```css
/* Redesign /admin/discovery — classes .dv-* transcritas do mockup
   docs/mockups/design_handoff_mockups/Admin Discovery.dc.html.
   Fonte da verdade visual é o mockup; use só tokens do ds.css. */

.dv-root { container-type: inline-size; color: var(--ink); }

.dv-sub { margin: 0 0 22px; font-size: 13.5px; color: var(--ink-2); max-width: 60ch; line-height: 1.5; }
.dv-sublbl { margin: 0 0 10px; font-size: 11px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; color: var(--muted); }

/* fila de jobs */
.dv-jobnew { display: flex; gap: 9px; margin-bottom: 12px; }
.dv-jobs { display: flex; flex-direction: column; gap: 8px; margin-bottom: 26px; }
.dv-job { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid var(--line); border-radius: 13px; background: var(--surface); cursor: pointer; font: inherit; text-align: left; width: 100%; box-shadow: var(--shadow); }
.dv-job:hover { border-color: var(--ink); }
.dv-job.on { border-color: var(--accent); box-shadow: 0 0 0 1.5px var(--accent) inset; }
.dv-jname { font-size: 14.5px; font-weight: 700; color: var(--ink); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dv-jcount { font-size: 12px; color: var(--muted); white-space: nowrap; }
.dv-jst { font-size: 11px; font-weight: 800; padding: 3px 9px; border-radius: 999px; white-space: nowrap; }
.dv-jst.done { color: var(--ok); background: color-mix(in srgb, var(--ok) 13%, var(--surface)); }
.dv-jst.running { color: var(--accent); background: color-mix(in srgb, var(--accent) 13%, var(--surface)); }
.dv-jst.queued { color: var(--muted); background: var(--surface-2); }
.dv-jst.error { color: var(--warn); background: color-mix(in srgb, var(--warn) 13%, var(--surface)); }

/* legenda + vazio */
.dv-legend { display: flex; align-items: flex-start; gap: 8px; font-size: 12.5px; color: var(--ink-2); line-height: 1.45; background: color-mix(in srgb, var(--accent) 7%, var(--surface)); border: 1px solid color-mix(in srgb, var(--accent) 24%, var(--line)); border-radius: 12px; padding: 10px 13px; margin-bottom: 14px; }
.dv-empty { padding: 34px 16px; text-align: center; color: var(--muted); font-size: 13.5px; border: 1px dashed var(--line); border-radius: 16px; }

/* nó: mobile empilha ações abaixo; desktop joga pra direita */
.dv-node { display: grid; grid-template-columns: minmax(0,1fr); grid-template-areas: "main" "act"; gap: 11px; }
.dv-node-main { grid-area: main; min-width: 0; }
.dv-node-act { grid-area: act; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.dv-title { display: flex; align-items: center; gap: 9px; flex-wrap: wrap; min-width: 0; }
.dv-kind { font-size: 9.5px; font-weight: 800; letter-spacing: .11em; text-transform: uppercase; color: var(--muted); border: 1px solid var(--line); border-radius: 6px; padding: 2px 6px; flex: none; }
.dv-nm { font-weight: 800; letter-spacing: -.01em; color: var(--ink); min-width: 0; }
.dv-chips { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; margin-top: 9px; }
.dv-verif { display: inline-flex; align-items: center; gap: 5px; font-size: 11.5px; font-weight: 700; color: var(--ok); background: color-mix(in srgb, var(--ok) 12%, var(--surface)); padding: 3px 9px; border-radius: 999px; }
.dv-link { font-size: 12px; color: var(--muted); text-decoration: none; border-bottom: 1px dashed color-mix(in srgb, var(--muted) 55%, transparent); }
.dv-link:hover { color: var(--ink); }
.dv-lock { font-size: 11px; color: var(--muted); font-style: italic; line-height: 1.3; max-width: 180px; }
.dv-badge-ok { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 800; color: var(--ok); background: color-mix(in srgb, var(--ok) 13%, var(--surface)); padding: 6px 11px; border-radius: 999px; }
.dv-badge-rej { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 800; color: var(--warn); background: color-mix(in srgb, var(--warn) 12%, var(--surface)); padding: 6px 11px; border-radius: 999px; }

/* botões */
.dv-btn-ok { padding: 8px 14px; border: 0; border-radius: 10px; background: var(--ink); color: var(--surface); font: inherit; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px; white-space: nowrap; }
.dv-btn-ok:hover { background: color-mix(in srgb, var(--ink) 85%, #fff); }
.dv-btn-ok[disabled] { opacity: .32; cursor: not-allowed; }
.dv-txtbtn { padding: 8px 13px; border: 1px solid transparent; border-radius: 10px; background: transparent; color: var(--warn); font: inherit; font-size: 13px; font-weight: 600; cursor: pointer; }
.dv-txtbtn:hover { background: color-mix(in srgb, var(--warn) 12%, transparent); }

/* programa = card grande */
.dv-src { border: 1px solid var(--line); border-radius: 16px; background: var(--surface); box-shadow: var(--shadow); padding: 16px; margin-bottom: 14px; }
.dv-src.is-approved { border-color: color-mix(in srgb, var(--ok) 45%, var(--line)); }
.dv-src.is-rejected { opacity: .5; }
.dv-node-src .dv-nm { font-size: 17px; }

/* variantes aninhadas: trilho + fundo distinto */
.dv-vars { display: flex; flex-direction: column; gap: 10px; margin-top: 14px; padding-left: 14px; border-left: 2px solid color-mix(in srgb, var(--ink) 12%, transparent); }
.dv-var { background: var(--surface-2); border: 1px solid var(--line); border-radius: 13px; padding: 13px 14px; }
.dv-var.is-approved { border-color: color-mix(in srgb, var(--ok) 40%, var(--line)); }
.dv-var.is-rejected { opacity: .5; }
.dv-node-var .dv-nm { font-size: 14.5px; }
.dv-submeta { font-size: 12px; color: var(--muted); font-weight: 600; }

/* benefícios aninhados na variante */
.dv-bens { display: flex; flex-direction: column; gap: 8px; margin-top: 11px; padding-left: 12px; border-left: 2px solid color-mix(in srgb, var(--ink) 9%, transparent); }
.dv-ben { background: var(--surface); border: 1px solid var(--line); border-radius: 11px; padding: 11px 12px; }
.dv-ben.is-approved { border-color: color-mix(in srgb, var(--ok) 38%, var(--line)); }
.dv-ben.is-rejected { opacity: .5; }
.dv-ben-title { font-size: 13.5px; font-weight: 700; color: var(--ink); line-height: 1.35; }
.dv-ben-sum { font-size: 12px; color: var(--ink-2); line-height: 1.4; }
.dv-ben-meta { display: flex; flex-wrap: wrap; gap: 7px; align-items: center; margin-top: 6px; }

@container (min-width: 760px) {
  .dv-jobs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .dv-node { grid-template-columns: minmax(0,1fr) auto; grid-template-areas: "main act"; align-items: center; gap: 16px; }
  .dv-node-act { justify-content: flex-end; }
}
```

- [ ] **Step 4: Rewrite `CandidateTree.tsx`**

Replace `src/features/admin/discovery/CandidateTree.tsx` with:

```tsx
import './discovery.css'
import type { DiscoveryCandidate } from './types'
import { benefitCategoryChip, sourceCategoryChip, verificationLabel } from './discoveryMeta'

type P = Record<string, unknown>
const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function host(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function stateCls(review: string): string {
  return review === 'approved' ? 'is-approved' : review === 'rejected' ? 'is-rejected' : ''
}

// catStyle: injeta --cat pra classe .tag do ds.css usar como cor.
const catStyle = (colorVar: string) => ({ ['--cat' as string]: colorVar }) as React.CSSProperties

function Actions({
  c, locked, lockMsg, kind, onPromote, onReject,
}: {
  c: DiscoveryCandidate
  locked: boolean
  lockMsg: string
  kind: 'programa' | 'variante' | 'beneficio'
  onPromote: (id: string) => void
  onReject: (id: string) => void
}) {
  if (c.review_status === 'approved') {
    return <span className="dv-badge-ok">✓ {kind === 'variante' ? 'aprovada' : 'aprovado'}</span>
  }
  if (c.review_status === 'rejected') {
    return <span className="dv-badge-rej">{kind === 'variante' ? 'rejeitada' : 'rejeitado'}</span>
  }
  return (
    <>
      {locked ? <span className="dv-lock">{lockMsg}</span> : null}
      <button type="button" className="dv-btn-ok" disabled={locked} onClick={() => onPromote(c.id)}>
        ✓ {kind === 'programa' ? 'Aprovar programa' : 'Aprovar'}
      </button>
      <button type="button" className="dv-txtbtn" onClick={() => onReject(c.id)}>Rejeitar</button>
    </>
  )
}

export function CandidateTree({
  candidates, onPromote, onReject,
}: {
  candidates: DiscoveryCandidate[]
  onPromote: (id: string) => void
  onReject: (id: string) => void
}) {
  const byFp = new Map(candidates.map((c) => [c.fingerprint, c]))
  const childrenOf = (fp: string | null) => candidates.filter((c) => c.parent_fingerprint === fp)

  // destravado = source (sem pai) OU pai aprovado OU pai já existente no catálogo (matched_id)
  const unlocked = (c: DiscoveryCandidate): boolean => {
    if (!c.parent_fingerprint) return true
    const parent = byFp.get(c.parent_fingerprint)
    if (!parent) return true
    return parent.review_status === 'approved' || parent.matched_id != null
  }

  const sources = candidates.filter((c) => c.entity_type === 'source')
  if (sources.length === 0) return <div className="dv-empty">Nenhum candidato neste job.</div>

  return (
    <div>
      <div className="dv-legend">
        <span>
          Aprovação em cascata, nó a nó: <b>aprove o programa primeiro</b>, depois as variantes e,
          por fim, os benefícios. Nada entra no catálogo sem aprovação.
        </span>
      </div>

      {sources.map((s) => {
        const sp = s.payload as P
        const sChip = sourceCategoryChip(str(sp.source_category))
        const sProv = s.provenance as P
        const verif = verificationLabel(str(sProv.verification_status))
        const srcUrl = str(sProv.source_url)
        return (
          <div key={s.id} className={`dv-src ${stateCls(s.review_status)}`}>
            <div className="dv-node dv-node-src">
              <div className="dv-node-main">
                <div className="dv-title">
                  <span className="dv-kind">Programa</span>
                  <span className="dv-nm">{str(sp.name) || s.fingerprint}</span>
                </div>
                <div className="dv-chips">
                  <span className="tag" style={catStyle(sChip.colorVar)}>{sChip.label}</span>
                  {s.match_status === 'new' ? <span className="new">novo</span> : null}
                  {verif ? <span className="dv-verif">✓ {verif}</span> : null}
                  {srcUrl ? <a className="dv-link" href={srcUrl} target="_blank" rel="noreferrer">{host(srcUrl)}</a> : null}
                </div>
              </div>
              <div className="dv-node-act">
                <Actions c={s} locked={false} lockMsg="" kind="programa" onPromote={onPromote} onReject={onReject} />
              </div>
            </div>

            <div className="dv-vars">
              {childrenOf(s.fingerprint).map((v) => {
                const vp = v.payload as P
                const sub = [str(vp.card_brand), str(vp.card_level)].filter(Boolean).join(' ')
                const vLocked = !unlocked(v)
                return (
                  <div key={v.id} className={`dv-var ${stateCls(v.review_status)}`}>
                    <div className="dv-node dv-node-var">
                      <div className="dv-node-main">
                        <div className="dv-title">
                          <span className="dv-kind">Variante</span>
                          <span className="dv-nm">{str(vp.label) || v.fingerprint}</span>
                          {sub ? <span className="dv-submeta">{sub}</span> : null}
                        </div>
                      </div>
                      <div className="dv-node-act">
                        <Actions c={v} locked={vLocked} lockMsg="aprove o programa primeiro" kind="variante" onPromote={onPromote} onReject={onReject} />
                      </div>
                    </div>

                    <div className="dv-bens">
                      {childrenOf(v.fingerprint).map((b) => {
                        const bp = b.payload as P
                        const bChip = benefitCategoryChip(str(bp.category))
                        const bProv = b.provenance as P
                        const bUrl = str(bProv.source_url)
                        const bLocked = !unlocked(b)
                        return (
                          <div key={b.id} className={`dv-ben ${stateCls(b.review_status)}`}>
                            <div className="dv-node dv-node-ben">
                              <div className="dv-node-main">
                                <div className="dv-ben-title">{str(bp.title) || b.fingerprint}</div>
                                <div className="dv-ben-meta">
                                  <span className="tag" style={catStyle(bChip.colorVar)}>{bChip.label}</span>
                                  <span className="dv-ben-sum">{str(bp.summary)}</span>
                                  {bUrl ? <a className="dv-link" href={bUrl} target="_blank" rel="noreferrer">{host(bUrl)}</a> : null}
                                </div>
                              </div>
                              <div className="dv-node-act">
                                <Actions c={b} locked={bLocked} lockMsg="aprove a variante primeiro" kind="beneficio" onPromote={onPromote} onReject={onReject} />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm test -- CandidateTree`
Expected: PASS (4 tests).

- [ ] **Step 6: Type-check**

Run: `npm run build`
Expected: sem erros de tipo.

- [ ] **Step 7: Commit**

```bash
git add src/features/admin/discovery/discovery.css src/features/admin/discovery/CandidateTree.tsx src/features/admin/discovery/CandidateTree.test.tsx
git commit -m "feat(discovery-ui): nested-card candidate tree with top-down lock (mockup fidelity)"
```

---

## Task 3: reescrever `AdminDiscovery.tsx` (header + fila de jobs + container)

**Files:**
- Modify (rewrite): `src/features/admin/discovery/AdminDiscovery.tsx`
- Test: `src/features/admin/discovery/AdminDiscovery.test.tsx` (novo)

**Interfaces:**
- Consumes: hooks de `./useDiscovery` (`useDiscoveryJobs`, `useCreateJob`, `useJobCandidates`, `usePromoteCandidate`, `useRejectCandidate`) — assinaturas atuais, sem mudança; `jobStatusMeta` de `./discoveryMeta`; `CandidateTree` de `./CandidateTree`; `./discovery.css`.
- Produces: componente de rota `AdminDiscovery` (default da rota `/admin/discovery`, já fiada no router).

- [ ] **Step 1: Write the failing test**

Create `src/features/admin/discovery/AdminDiscovery.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const createMutate = vi.fn()
const jobs = [
  { id: 'j1', brief: 'Wellhub', status: 'done', error: null, created_at: '' },
  { id: 'j2', brief: 'Priority Pass', status: 'processing', error: null, created_at: '' },
]

vi.mock('./useDiscovery', () => ({
  useDiscoveryJobs: () => ({ data: jobs, isLoading: false }),
  useCreateJob: () => ({ mutate: createMutate, isPending: false }),
  useJobCandidates: () => ({ data: [], isLoading: false }),
  usePromoteCandidate: () => ({ mutate: vi.fn() }),
  useRejectCandidate: () => ({ mutate: vi.fn() }),
}))

import { AdminDiscovery } from './AdminDiscovery'

describe('AdminDiscovery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mostra header, jobs e status traduzido', () => {
    render(<AdminDiscovery />)
    expect(screen.getByRole('heading', { name: 'Discovery' })).toBeInTheDocument()
    expect(screen.getByText('Wellhub')).toBeInTheDocument()
    expect(screen.getByText('concluído')).toBeInTheDocument()   // done -> concluído
    expect(screen.getByText('processando')).toBeInTheDocument() // processing -> processando
  })

  it('enfileira novo job com o texto digitado', () => {
    render(<AdminDiscovery />)
    fireEvent.change(screen.getByPlaceholderText('Novo job — ex.: Priority Pass, Wellhub…'), { target: { value: 'Alelo' } })
    fireEvent.click(screen.getByRole('button', { name: /enfileirar/i }))
    expect(createMutate).toHaveBeenCalledWith('Alelo', expect.anything())
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- AdminDiscovery`
Expected: FAIL — placeholder/estrutura novos ainda não existem.

- [ ] **Step 3: Rewrite `AdminDiscovery.tsx`**

Replace `src/features/admin/discovery/AdminDiscovery.tsx` with:

```tsx
import { useState } from 'react'
import './discovery.css'
import { CandidateTree } from './CandidateTree'
import { jobStatusMeta } from './discoveryMeta'
import {
  useCreateJob, useDiscoveryJobs, useJobCandidates, usePromoteCandidate, useRejectCandidate,
} from './useDiscovery'

export function AdminDiscovery() {
  const jobs = useDiscoveryJobs()
  const createJob = useCreateJob()
  const [brief, setBrief] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const candidates = useJobCandidates(selected)
  const promote = usePromoteCandidate(selected)
  const reject = useRejectCandidate(selected)

  const jobList = jobs.data ?? []
  const selJob = jobList.find((j) => j.id === selected) ?? null

  return (
    <div className="dv-root">
      <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
        Catálogo
      </p>
      <h1 style={{ margin: 0, fontSize: 'var(--fz-h1)', fontWeight: 800, letterSpacing: '-.03em' }}>Discovery</h1>
      <p className="dv-sub">
        Revise os candidatos propostos pelo agente antes de entrarem no catálogo. O agente nunca
        publica sozinho — nada entra no catálogo sem a sua aprovação.
      </p>

      <p className="dv-sublbl">Fila de jobs</p>
      <form
        className="dv-jobnew"
        onSubmit={(e) => {
          e.preventDefault()
          if (brief.trim()) createJob.mutate(brief.trim(), { onSuccess: () => setBrief('') })
        }}
      >
        <label className="input" style={{ flex: 1, minWidth: 0 }}>
          <input
            type="text"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Novo job — ex.: Priority Pass, Wellhub…"
            style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', font: 'inherit', fontSize: 14, color: 'var(--ink)' }}
          />
        </label>
        <button type="submit" className="dv-btn-ok" disabled={createJob.isPending}>Enfileirar</button>
      </form>

      <div className="dv-jobs">
        {jobList.map((j) => {
          const st = jobStatusMeta(j.status)
          return (
            <button key={j.id} type="button" className={`dv-job ${selected === j.id ? 'on' : ''}`} onClick={() => setSelected(j.id)}>
              <span className="dv-jname">{j.brief}</span>
              <span className={`dv-jst ${st.cls}`}>{st.label}</span>
            </button>
          )
        })}
      </div>

      {selected ? (
        <>
          <p className="dv-sublbl" style={{ margin: '0 0 10px' }}>
            Candidatos{selJob ? ` · ${selJob.brief}` : ''}
          </p>
          {candidates.isLoading ? (
            <div className="dv-empty">Carregando…</div>
          ) : (
            <CandidateTree
              candidates={candidates.data ?? []}
              onPromote={(id) => promote.mutate(id)}
              onReject={(id) => reject.mutate(id)}
            />
          )}
        </>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- AdminDiscovery`
Expected: PASS (2 tests).

- [ ] **Step 5: Full suite + build**

Run: `npm test && npm run build`
Expected: toda a suíte verde; build sem erros de tipo.

- [ ] **Step 6: Commit**

```bash
git add src/features/admin/discovery/AdminDiscovery.tsx src/features/admin/discovery/AdminDiscovery.test.tsx
git commit -m "feat(discovery-ui): redesigned Discovery page (header, job queue, container) matching mockup"
```

---

## Task 4: verificação visual no app real (gate manual)

**Files:** nenhum (verificação operacional).

Valida a coisa que testes de componente não pegam: o visual real com dados reais, mobile + desktop, claro + escuro.

- [ ] **Step 1: Subir o app**

Run: `npm run dev` (Supabase local já rodando; se precisar semear candidatos, o job Wellhub do smoke do P4 pode ter sido limpo — reenfileire e rode `npm run discover`, ou insira candidatos via service client).
Login admin: `admin@mapadebeneficios.com.br` / `admin123456`.

- [ ] **Step 2: Conferir a árvore**

Ir em `/admin/discovery`, selecionar um job com candidatos. Confirmar:
- Hierarquia óbvia: Programa (card grande) → Variantes (sub-cards com trilho) → Benefícios (linhas). Dá pra distinguir pai/filho num relance.
- Chips: categoria colorida (`.tag`), `novo`, verificação, procedência (link).

- [ ] **Step 3: Conferir o fluxo top-down**

- Aprovar de uma variante/benefício está **desabilitado** com "aprove o programa/variante primeiro" enquanto o pai está pendente.
- Aprovar o Programa → variantes destravam. Aprovar variante → benefícios destravam.
- Nó aprovado vira badge verde (ações somem); rejeitado esmaece.

- [ ] **Step 4: Responsivo + tema (mobile PRIMEIRO)**

Começar no **viewport mobile (~390px)** — é o caso principal: confirmar coluna única, ações Aprovar/Rejeitar **abaixo** dos dados de cada nó, cards e chips legíveis sem overflow horizontal. **Depois** expandir a janela cruzando 760px e confirmar a adaptação desktop (ações à **direita**, jobs em 2 colunas). Alternar tema claro/escuro em ambos — cores/contraste ok (tokens do DS cobrem os dois).

- [ ] **Step 5: Promover de verdade**

Aprovar Programa → Variante → Benefício e confirmar em `/admin/benefits` que o benefício aparece com `active=false`. (Fecha o loop de que a UI nova continua fiada no RPC real.)

---

## Self-Review

**Cobertura do design (mockup):**
- Cards aninhados Programa→Variante→Benefício → Task 2 (`.dv-src`/`.dv-vars`/`.dv-var`/`.dv-bens`/`.dv-ben`).
- Chips categoria/novo/verificação/procedência → Task 1 (helpers) + Task 2 (render).
- Aprovar/Rejeitar granular + estados aprovado/rejeitado → Task 2 (`Actions`).
- Trava top-down + micro-texto → Task 2 (`unlocked`, `dv-lock`).
- Header (eyebrow "Catálogo" + h1 "Discovery" + subtítulo) → Task 3.
- Fila de jobs + chip de status + "Novo job" → Task 1 (`jobStatusMeta`) + Task 3.
- Reflow responsivo das ações (@container 760px) → Task 2 (`discovery.css`).
- Terminologia "Programa"/"Variante" → Task 2 (`dv-kind`).

**Fora de escopo (registrado, não é gap):** shell admin (sidebar/tabbar do mockup) — afeta todas as telas admin, follow-up separado; edição inline; varredura de copy fora desta tela.

**Placeholder scan:** sem TBD/TODO; todo passo de código traz o código completo; CSS e componentes transcritos por inteiro.

**Type consistency:** `CandidateTree` mantém a assinatura `{ candidates, onPromote, onReject }` (Task 2) que o `AdminDiscovery` (Task 3) consome. `ChipMeta`/`benefitCategoryChip`/`sourceCategoryChip`/`verificationLabel`/`jobStatusMeta` definidos na Task 1 e usados nas Tasks 2–3 com as mesmas assinaturas. Payload keys (`name`, `source_category`, `label`, `card_brand`, `card_level`, `title`, `category`, `summary`) e provenance (`source_url`, `verification_status`) batem com o que `flatten.ts` grava.
