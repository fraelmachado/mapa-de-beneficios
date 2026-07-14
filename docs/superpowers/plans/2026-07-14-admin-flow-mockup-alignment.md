# Fluxo do Admin — Alinhamento aos Mockups (Spec 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestilizar todas as telas do Admin (Login, Painel, Programas, Benefícios, Discovery) para bater com os mockups do Claude Design, responsivo e mantendo o CRUD real.

**Architecture:** Casca responsiva (`AdminAppShell` + `AdminNav`) com container query única a 760px (sidebar↔tabbar, tabela↔cards, `<dialog>` modal↔bottom-sheet). Programas funde Discovery de forma fina: abas Pendentes/Ativos/Rejeitados sobre dados reais (`discovery_candidates` + `sources`), "Revisar" abre o cascade real. Reuso do `ds.css` + primitivos estendidos aditivamente.

**Tech Stack:** React 18 + TS + Vite + React Router + TanStack Query + Supabase JS; Vitest + Testing Library (unit); Playwright (e2e, 4 projetos mobile/desktop × light/dark).

**Spec:** `docs/superpowers/specs/2026-07-13-admin-flow-mockup-alignment-design.md` (decisões autoritativas D1–D14).

## Global Constraints

- **Fonte de verdade visual:** `docs/mockups/design_handoff_mockups/Admin App.dc.html` (login/painel/programas/benefícios/modais) + `Admin Discovery.dc.html` (cascade). `Admin.dc.html`/`Admin Mobile.dc.html` são superados.
- **Design tokens:** só `var(--…)` do `src/ui/ds.css`. Chrome admin via tokens novos `--admin-side-bg/-ink/-hover`, `--admin-line`, `--admin-backdrop` (D14). Proibido hex/rgb literal fora desses tokens. Dark mode via `[data-theme="dark"]`.
- **Responsivo:** `@container (min-width: 760px)` sobre `.aa-root { container-type: inline-size }`. Colunas de tabela fluidas (`minmax(0,1fr)` + truncar); overflow só dentro do container da tabela; **página nunca rola na horizontal**. Shell `min-height:100dvh`, sidebar `sticky`, tabbar `fixed` (D9).
- **CRUD real preservado.** Exceções conscientes: coluna `rejection_reason` (D4); confirmação de exclusão (D11); modal de criação permanece aberto após criar (D7).
- **Nada finge dado real.** Campos de robô inexistentes (confiança%/estimativa) são **omitidos**, não placeholder (D1/D5).
- **Reuso:** `Button`, `Input`, `Chip`, `SegmentedControl`, `PageState`, `Skeleton` (estendidos aditivamente sem quebrar o app). `AdminNav` é própria (NavLink), não o `Nav` genérico (D10). Rótulos de `source_category` reusam `SOURCE_CATEGORY_META` (`src/features/onboarding/categoryMeta.ts`).
- `npm test` NÃO roda tsc → cada task roda `npm run build` para checar tipos.
- Overlays via `<dialog>` nativo; foco-preso/Escape testados só em Playwright; jsdom usa polyfill mínimo (D10/D12).

---

## Task 1: Fundação de dados, tipos e tokens

**Files:**
- Create: `supabase/migrations/0017_discovery_rejection_reason.sql`
- Modify: `src/features/admin/discovery/types.ts` (add `rejection_reason`)
- Modify: `src/lib/database.types.ts` (regen ou add manual da coluna)
- Create: `src/features/admin/discovery/useSourceCandidates.ts`
- Modify: `src/features/admin/discovery/useDiscovery.ts` (reject/reconsider)
- Modify: `src/features/admin/benefits/useAdminBenefits.ts` + `src/features/admin/benefits/types.ts` (SELECT + tipo)
- Modify: `src/ui/ds.css` (tokens `--admin-*`)
- Modify: `src/test-setup.ts` (polyfill `<dialog>`)
- Test: `src/features/admin/discovery/useSourceCandidates.test.ts`

**Interfaces:**
- Produces: `useSourceCandidates(status: 'pending'|'rejected')` → query de candidatos-fonte; `useCandidateSubtree(sourceFingerprint: string|null)` → `{ data: DiscoveryCandidate[] }` (fonte + descendentes cross-job); `useRejectCandidate()` → `mutate({ candidateId, reason })`; `useReconsiderCandidate()` → `mutate({ candidateId })`; `DiscoveryCandidate.rejection_reason: string | null`; `BenefitRow.benefit_source`, `BenefitRow.created_at`, e `benefit_sources[].source_items.sources.name` (nome da fonte via join aninhado — Task 7 deriva daí).

- [ ] **Step 1: Migration da coluna**

Create `supabase/migrations/0017_discovery_rejection_reason.sql`:
```sql
-- D4: motivo de rejeição de candidato de discovery (UPDATE direto sob RLS admin de 0015).
alter table discovery_candidates add column rejection_reason text;
```

- [ ] **Step 2: Aplicar + regerar tipos**

Run: `npx -y supabase@2.95.0 db reset` (aplica migrations + seed).
Run: `npx -y supabase@2.95.0 gen types typescript --local > src/lib/database.types.ts`
Expected: build limpo; `discovery_candidates` passa a ter `rejection_reason: string | null` em `database.types.ts`. (Se o `gen types` não estiver disponível, adicionar a coluna manualmente ao tipo `discovery_candidates` Row/Insert/Update em `database.types.ts`.)

- [ ] **Step 3: Atualizar o tipo de domínio**

Em `src/features/admin/discovery/types.ts`, adicionar ao `interface DiscoveryCandidate` (após `review_status`):
```ts
  rejection_reason: string | null
```

- [ ] **Step 4: Escrever o teste de `useSourceCandidates` (falha)**

Create `src/features/admin/discovery/useSourceCandidates.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const order = vi.fn()
const eq2 = vi.fn(() => ({ order }))
const eq1 = vi.fn(() => ({ eq: eq2 }))
const select = vi.fn(() => ({ eq: eq1 }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: () => ({ select }) } }))

import { useSourceCandidates } from './useSourceCandidates'

function wrap() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}
beforeEach(() => { order.mockReset(); eq1.mockClear(); eq2.mockClear(); select.mockClear() })

describe('useSourceCandidates', () => {
  it('filtra por entity_type=source e review_status, ordenado por created_at', async () => {
    order.mockResolvedValue({ data: [{ id: 'c1', entity_type: 'source', review_status: 'pending' }], error: null })
    const { result } = renderHook(() => useSourceCandidates('pending'), { wrapper: wrap() })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(select).toHaveBeenCalledWith('*')
    expect(eq1).toHaveBeenCalledWith('entity_type', 'source')
    expect(eq2).toHaveBeenCalledWith('review_status', 'pending')
  })
})
```

- [ ] **Step 5: Run red**

Run: `npx vitest run src/features/admin/discovery/useSourceCandidates.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 6: Implementar `useSourceCandidates`**

Create `src/features/admin/discovery/useSourceCandidates.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import type { DiscoveryCandidate, DiscoveryReviewStatus } from './types'

// D2: candidatos-fonte de TODOS os jobs por status. fingerprint é UNIQUE global (0015),
// então cada linha já é distinta — sem dedupe manual.
export function useSourceCandidates(status: DiscoveryReviewStatus) {
  return useQuery({
    queryKey: ['source_candidates', status],
    queryFn: async (): Promise<DiscoveryCandidate[]> => {
      const { data, error } = await supabase
        .from('discovery_candidates')
        .select('*')
        .eq('entity_type', 'source')
        .eq('review_status', status)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as DiscoveryCandidate[]
    },
  })
}
```

- [ ] **Step 7: Run green**

Run: `npx vitest run src/features/admin/discovery/useSourceCandidates.test.ts`
Expected: PASS.

- [ ] **Step 8: `useCandidateSubtree` (fonte + descendentes cross-job)**

Add em `src/features/admin/discovery/useSourceCandidates.ts`:
```ts
// D3: monta a subárvore de uma fonte por parent_fingerprint, atravessando jobs
// (NÃO filtra por job_id). BFS por camada: fonte → variantes → benefícios.
export function useCandidateSubtree(sourceFingerprint: string | null) {
  return useQuery({
    queryKey: ['candidate_subtree', sourceFingerprint],
    enabled: !!sourceFingerprint,
    queryFn: async (): Promise<DiscoveryCandidate[]> => {
      const all: DiscoveryCandidate[] = []
      let frontier = [sourceFingerprint!]
      // nível 0: a própria fonte
      const root = await supabase.from('discovery_candidates').select('*').eq('fingerprint', sourceFingerprint!)
      if (root.error) throw root.error
      all.push(...((root.data ?? []) as unknown as DiscoveryCandidate[]))
      // níveis 1..2: filhos por parent_fingerprint
      for (let depth = 0; depth < 2 && frontier.length; depth += 1) {
        const kids = await supabase.from('discovery_candidates').select('*').in('parent_fingerprint', frontier)
        if (kids.error) throw kids.error
        const rows = (kids.data ?? []) as unknown as DiscoveryCandidate[]
        all.push(...rows)
        frontier = rows.map((r) => r.fingerprint)
      }
      return all
    },
  })
}
```

- [ ] **Step 9: Reescrever reject + adicionar reconsider (D4)**

Em `src/features/admin/discovery/useDiscovery.ts`, substituir `useRejectCandidate` por (e remover o param `jobId`):
```ts
export function useRejectCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ candidateId, reason }: { candidateId: string; reason: string }) => {
      const { error } = await supabase
        .from('discovery_candidates')
        .update({ review_status: 'rejected', rejection_reason: reason } as never)
        .eq('id', candidateId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['source_candidates'] })
      qc.invalidateQueries({ queryKey: ['discovery_candidates'] })
      qc.invalidateQueries({ queryKey: ['candidate_subtree'] })
    },
  })
}

export function useReconsiderCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ candidateId }: { candidateId: string }) => {
      const { error } = await supabase
        .from('discovery_candidates')
        .update({ review_status: 'pending', rejection_reason: null } as never)
        .eq('id', candidateId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['source_candidates'] })
      qc.invalidateQueries({ queryKey: ['discovery_candidates'] })
    },
  })
}
```
Atualizar o caller atual em `AdminDiscovery.tsx`: `useRejectCandidate(jobId)` → `useRejectCandidate()` e `reject.mutate(id)` → `reject.mutate({ candidateId: id, reason: '' })` (o motivo real entra na Task 6; aqui só manter compilando).

- [ ] **Step 10: Estender SELECT/tipo de benefícios (D6/D8)**

Em `src/features/admin/benefits/useAdminBenefits.ts`, trocar `SELECT` por:
```ts
const SELECT =
  'id, title, summary, category, scope, uf, steps, partner_name, valid_until, image_url, action_url, action_label, active, benefit_source, created_at, benefit_sources(source_item_id, source_items(sources(name))), benefit_locations(id, benefit_id, name, lat, lng, address, city, uf, radius_m, active)'
```
Em `src/features/admin/benefits/types.ts`, adicionar ao `BenefitRow`:
```ts
  benefit_source: 'issuer' | 'card_network' | 'partner' | 'mixed' | null
  created_at: string
```
E ajustar o shape de `benefit_sources` para `{ source_item_id: string; source_items: { sources: { name: string } | null } | null }[]`. `BenefitInput` continua `Omit<BenefitRow, 'id' | 'benefit_sources' | 'benefit_locations' | 'created_at'>`.

- [ ] **Step 11: Tokens de chrome (D14)**

Em `src/ui/ds.css`, no bloco `:root` (light), adicionar:
```css
  --admin-side-bg: #0f1013;
  --admin-side-ink: #e7e8ec;
  --admin-side-hover: #1b1d22;
  --admin-line: var(--line);
  --admin-backdrop: color-mix(in srgb, #0f1013 46%, transparent);
```
E no bloco `[data-theme="dark"]`, repetir os mesmos (sidebar escura nos dois temas) — `--admin-line` aponta pra `var(--line)` do tema dark.

- [ ] **Step 12: Polyfill de `<dialog>` no jsdom (D12)**

Em `src/test-setup.ts`, adicionar ao final:
```ts
// jsdom não implementa <dialog>.showModal()/close() — polyfill mínimo p/ abrir/fechar.
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.show = function () { this.open = true }
  HTMLDialogElement.prototype.close = function (v?: string) {
    this.open = false
    if (v !== undefined) this.returnValue = v
    this.dispatchEvent(new Event('close'))
  }
}
```

- [ ] **Step 13: Build + commit**

Run: `npx vitest run src/features/admin/discovery/useSourceCandidates.test.ts && npm run build`
Expected: testes PASS; build 0.
```bash
git add supabase/migrations/0017_discovery_rejection_reason.sql src/features/admin/discovery/ src/features/admin/benefits/ src/lib/database.types.ts src/ui/ds.css src/test-setup.ts
git commit -m "feat(admin): data foundation — rejection_reason, source-candidate hooks, benefit SELECT, admin tokens, dialog polyfill"
```

---

## Task 2: Primitivos estendidos + AdminSheet + Toast + confirm-delete

**Files:**
- Modify: `src/ui/Button.tsx`, `src/ui/Input.tsx`, `src/ui/SegmentedControl.tsx`
- Create: `src/ui/AdminSheet.tsx` + `src/features/admin/admin.css` (bloco base + `.aa-dialog`/overlay)
- Create: `src/ui/Toast.tsx`
- Create: `src/features/admin/ConfirmDelete.tsx`
- Test: `src/ui/AdminSheet.test.tsx`, `src/features/admin/ConfirmDelete.test.tsx`

**Interfaces:**
- Consumes: tokens `--admin-*` (Task 1).
- Produces: `Button` aceita `className?`, `ariaLabel?`; `Input` aceita `id?`, `required?`, `disabled?`; `SegmentedOption` aceita `count?: number`; `<AdminSheet open onClose title wide?>`; `<Toast>` + `useToast()`; `<ConfirmDelete open title message onConfirm onCancel />`.

- [ ] **Step 1: Estender Button (aditivo)**

Em `src/ui/Button.tsx`, adicionar props e repassar:
```ts
export interface ButtonProps {
  children?: React.ReactNode
  variant?: 'primary' | 'ink' | 'ghost'
  disabled?: boolean
  type?: 'button' | 'submit' | 'reset'
  onClick?: (e: React.MouseEvent) => void
  icon?: React.ReactNode
  className?: string
  ariaLabel?: string
}
```
No componente: `const cls = ['btn', variant === 'ink' ? 'ink' : variant === 'ghost' ? 'ghost' : '', className].filter(Boolean).join(' ')` e no `<button>` adicionar `aria-label={ariaLabel}`.

- [ ] **Step 2: Estender Input (aditivo)**

Em `src/ui/Input.tsx`, adicionar `id?: string; required?: boolean; disabled?: boolean` ao `InputProps` e repassar ao `<input>`.

- [ ] **Step 3: Estender SegmentedControl (badge de contagem)**

Em `src/ui/SegmentedControl.tsx`, adicionar `count?: number` ao `SegmentedOption`; no botão, após `{opt.label}`:
```tsx
{typeof opt.count === 'number' ? <span className="n">{opt.count}</span> : null}
```

- [ ] **Step 4: Teste do AdminSheet (falha)**

Create `src/ui/AdminSheet.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AdminSheet } from './AdminSheet'

describe('AdminSheet', () => {
  it('renderiza o título e o conteúdo quando open', () => {
    render(<AdminSheet open title="Remover item?" onClose={() => {}}><p>corpo</p></AdminSheet>)
    expect(screen.getByRole('heading', { name: /remover item/i })).toBeInTheDocument()
    expect(screen.getByText('corpo')).toBeInTheDocument()
  })
  it('dispara onClose no evento close do dialog (Escape)', () => {
    const onClose = vi.fn()
    const { container } = render(<AdminSheet open title="X" onClose={onClose}><p>c</p></AdminSheet>)
    const dialog = container.querySelector('dialog')!
    fireEvent(dialog, new Event('close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 5: Run red** → `npx vitest run src/ui/AdminSheet.test.tsx` FAIL.

- [ ] **Step 6: Implementar AdminSheet**

Create `src/ui/AdminSheet.tsx`:
```tsx
import { useEffect, useRef, type ReactNode } from 'react'

export function AdminSheet({ open, title, onClose, wide, closeOnBackdrop = true, children }: {
  open: boolean; title: string; onClose: () => void; wide?: boolean; closeOnBackdrop?: boolean; children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  useEffect(() => {
    const d = ref.current
    if (!d) return
    const onCloseEvt = () => onClose()
    d.addEventListener('close', onCloseEvt)
    return () => d.removeEventListener('close', onCloseEvt)
  }, [onClose])
  return (
    <dialog ref={ref} className={'aa-dialog' + (wide ? ' aa-wide' : '')} aria-label={title}
      onClick={closeOnBackdrop ? (e) => { if (e.target === ref.current) onClose() } : undefined}>
      <div className="aa-grip" aria-hidden="true" />
      <h2 className="aa-dialog-title">{title}</h2>
      {children}
    </dialog>
  )
}
```
(A estilização sheet↔modal via `@container` vem no CSS da Task 3; aqui só a estrutura + a11y.)

- [ ] **Step 7: Run green** → PASS.

- [ ] **Step 8: Toast**

Create `src/ui/Toast.tsx` com um provider simples e `useToast()` que empilha mensagens, cada uma num `<div role="status" aria-live="polite" className="aa-toast">`, auto-dismiss em 3200ms, respeitando `prefers-reduced-motion` (sem animação de entrada quando reduzido). Teste mínimo: `Toast.test.tsx` renderiza uma mensagem via `useToast().show('Salvo')` e afirma `getByRole('status')` com o texto.

- [ ] **Step 9: ConfirmDelete + teste**

Create `src/features/admin/ConfirmDelete.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDelete } from './ConfirmDelete'

describe('ConfirmDelete', () => {
  it('só chama onConfirm ao confirmar', () => {
    const onConfirm = vi.fn(); const onCancel = vi.fn()
    render(<ConfirmDelete open title="Remover item?" message="Remove também 2 variantes." onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByText(/remove também 2 variantes/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i })); expect(onConfirm).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /remover/i })); expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
```
Create `src/features/admin/ConfirmDelete.tsx`: usa `AdminSheet` (`closeOnBackdrop` true), título + `message`, botões `Cancelar` (ghost) e `Remover` (`className="danger"`).

- [ ] **Step 10: Build + commit**

Run: `npx vitest run src/ui src/features/admin/ConfirmDelete.test.tsx && npm run build`
```bash
git add src/ui/ src/features/admin/admin.css src/features/admin/ConfirmDelete.tsx src/features/admin/ConfirmDelete.test.tsx
git commit -m "feat(admin): extend primitives + native-dialog AdminSheet, Toast, ConfirmDelete"
```

---

## Task 3: AdminAppShell + AdminNav + AdminList/Row + StatGrid

**Files:**
- Create: `src/features/admin/AdminAppShell.tsx`, `src/features/admin/AdminNav.tsx`, `src/features/admin/AdminList.tsx`, `src/features/admin/StatGrid.tsx`
- Modify: `src/features/admin/AdminLayout.tsx` (vira thin wrapper que renderiza `AdminAppShell`) ou substituir seu uso em `src/router.tsx`
- Modify: `src/features/admin/AdminGuard.tsx` (estados via `PageState`/`Skeleton`)
- Modify: `src/features/admin/admin.css` (blocos `.aa-root/.aa-shell/.aa-side/.aa-tabbar/.aa-navbtn/.aa-main` + `@container`)
- Test: `src/features/admin/AdminNav.test.tsx`, `src/features/admin/AdminList.test.tsx`

**Interfaces:**
- Consumes: tokens `--admin-*`; `NavLink` (react-router-dom).
- Produces: `<AdminAppShell>` (usa `<Outlet/>`); `<AdminNav items={[{to,label,icon,badge?}]} pendingCount?/>`; `<AdminList columns rows renderRow>`; `<StatGrid stats={[{label,value}]}/>`.

- [ ] **Step 1: Teste do AdminNav (falha)**

Create `src/features/admin/AdminNav.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminNav } from './AdminNav'

describe('AdminNav', () => {
  it('marca o item ativo por rota e mostra badge de pendentes', () => {
    render(<MemoryRouter initialEntries={['/admin/sources']}><AdminNav pendingCount={3} /></MemoryRouter>)
    const active = screen.getByRole('link', { name: /programas/i })
    expect(active).toHaveAttribute('aria-current', 'page')
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /painel/i })).toHaveAttribute('href', '/admin')
  })
})
```

- [ ] **Step 2: Run red** → FAIL.

- [ ] **Step 3: Implementar AdminNav**

Create `src/features/admin/AdminNav.tsx`: lista fixa de itens (`/admin` Painel, `/admin/sources` Programas, `/admin/benefits` Benefícios, `/admin/discovery` Discovery), cada um `NavLink` com `className="aa-navbtn"` e `end` no `/admin`; o item Programas (ou Discovery) recebe `<span className="aa-navcount">{pendingCount}</span>` quando `pendingCount>0`. Ícones inline (SVGs do mockup). NavLink já aplica `aria-current="page"` no ativo.

- [ ] **Step 4: Run green** → PASS.

- [ ] **Step 5: AdminAppShell**

Create `src/features/admin/AdminAppShell.tsx`: `<div className="aa-root"><div className="aa-shell"><aside className="aa-side">…brand + <AdminNav pendingCount={usa useSourceCandidates('pending').data?.length} /> + logout</aside><main className="aa-main"><Outlet/></main></div><nav className="aa-tabbar"><AdminNav …/></nav></div>`. Logout chama `supabase.auth.signOut()` e navega a `/admin/login`. `pendingCount` degrada a 0 se a query falhar (D13) — usar `data?.length ?? 0` e não propagar erro.

- [ ] **Step 6: AdminList + StatGrid + teste**

Create `src/features/admin/AdminList.test.tsx` afirmando que `AdminList` renderiza `role="table"` com uma `role="row"` por item e chama `renderRow`. Create `src/features/admin/AdminList.tsx` (contêiner `.aa-list` com `role="table"`, cada linha `.aa-lrow role="row"`; colunas fluidas no CSS) e `src/features/admin/StatGrid.tsx` (`.aa-statgrid` com tiles `.aa-stat`).

- [ ] **Step 7: CSS da casca (portar do mockup)**

Em `src/features/admin/admin.css`, portar **verbatim** do bloco `<style>` de `docs/mockups/design_handoff_mockups/Admin App.dc.html` as regras de: `.aa-root`, `.aa-shell`, `.aa-side`, `.aa-brand`, `.aa-navbtn`, `.aa-navcount`, `.aa-side-foot`, `.aa-main`, `.aa-tabbar`, `.aa-head/.aa-eyebrow/.aa-h1`, `.aa-statgrid/.aa-stat/.aa-stat-k/.aa-stat-v`, `.aa-areagrid/.aa-area*`, `.aa-list/.aa-lrow/.aa-cell-*`, `.aa-dialog/.aa-overlay/.aa-grip/.aa-wide`, `.aa-toast`, `.aa-seg .n`, e o bloco `@container (min-width: 760px)`. **Trocar** toda cor literal pelos tokens (`#0f1013`→`var(--admin-side-bg)`, textos da sidebar→`var(--admin-side-ink)`, hover→`var(--admin-side-hover)`, backdrop `rgba()`→`var(--admin-backdrop)`); colunas da tabela viram `minmax(0,1fr)` + `overflow` no container (D9). Importar `admin.css` em `src/index.css`.

- [ ] **Step 8: Ligar no router + AdminGuard**

Em `src/router.tsx`, trocar `element: <AdminLayout />` por `element: <AdminAppShell />` (mantendo as rotas filhas). Em `AdminGuard.tsx`, trocar os `<p>` crus por `Skeleton` (loading) e `PageState` (não-admin/erro).

- [ ] **Step 9: Build + commit**

Run: `npx vitest run src/features/admin && npm run build`
```bash
git add src/features/admin/ src/router.tsx src/index.css
git commit -m "feat(admin): responsive AppShell + AdminNav + AdminList + StatGrid"
```

---

## Task 4: Login + Painel do catálogo

**Files:**
- Modify: `src/features/admin/AdminLogin.tsx`, `src/features/admin/AdminHome.tsx`
- Modify: `src/features/admin/admin.css` (`.aa-login`)
- Create: `src/features/admin/useAdminStats.ts` + test
- Test: `src/features/admin/AdminHome.test.tsx`

**Interfaces:**
- Consumes: `StatGrid`, `useSourceCandidates`, `useAdminSources`, `useAdminBenefits`.
- Produces: `useAdminStats()` → `{ programas, beneficios, pendentes, novos }` (contagens reais; `novos` = benefícios com `created_at` < 14 dias).

- [ ] **Step 1: Teste de `useAdminStats` (falha)** — `AdminHome.test.tsx` mocka os 3 hooks e afirma que os 4 números aparecem, e que "novos" conta só `created_at` nos últimos 14 dias. (Escrever o teste com datas fixas passadas via mock, não `Date.now()` real — usar `vi.setSystemTime`.)

- [ ] **Step 2: Run red** → FAIL.

- [ ] **Step 3: Implementar `useAdminStats`** — deriva de `useAdminSources().data.length`, `useAdminBenefits().data` (total + filtro `created_at` >= agora-14d), `useSourceCandidates('pending').data.length`. Degrada a 0 em erro/loading.

- [ ] **Step 4: Reskin AdminHome** — eyebrow "Bem-vinda" + h1; `<StatGrid stats={[{label:'Programas',...},{label:'Benefícios'},{label:'Pendentes'},{label:'Novos'}]} />` + `.aa-areagrid` com 2 cards (`Link` a `/admin/sources` e `/admin/benefits`). Estados via `Skeleton`/`PageState`.

- [ ] **Step 5: Reskin AdminLogin** — envolver em `.aa-login` (portar CSS do mockup: gradiente radial, card ≤400px, brand), reusando `Input` (agora com `id`/`required`) e `Button`. Wiring `signInWithPassword` inalterado. Rodapé "Instalável como app".

- [ ] **Step 6: Green + build + commit**

Run: `npx vitest run src/features/admin/AdminHome.test.tsx && npm run build`
```bash
git add src/features/admin/ && git commit -m "feat(admin): reskin login + catalog dashboard with real stats"
```

---

## Task 5: Programas — aba Ativos (CRUD de fontes)

**Files:**
- Modify: `src/features/admin/sources/AdminSources.tsx` (casca + abas + Ativos)
- Modify: `src/features/admin/sources/SourceForm.tsx` (estilo mockup + modal permanece aberto)
- Modify: `src/features/admin/admin.css` (`.aa-brow`, `.aa-avatar`, `.aa-robo`, `.aa-batch`, `.aa-empty`)
- Test: `src/features/admin/sources/AdminSources.test.tsx` (ajustar existentes + novos)

**Interfaces:**
- Consumes: `SegmentedControl` (com `count`), `AdminList`, `AdminSheet`, `ConfirmDelete`, `useToast`, `SOURCE_CATEGORY_META`, `useAdminSources`/`useSaveSource`/`useDeleteSource`.
- Produces: tela Programas com estado de aba `'pending'|'active'|'rejected'` (Ativos implementado aqui; Pendentes/Rejeitados na Task 6, com placeholder de aba vazia até lá).

- [ ] **Step 1: Teste de aba + confirm-delete (falha)** — afirmar: renderiza `SegmentedControl` com 3 abas; na aba Ativos, lista as fontes reais; clicar "Remover" **não** deleta direto — abre `ConfirmDelete`; confirmar chama `deleteSource`. Editar abre `AdminSheet` com `SourceForm`. (Mockar os hooks de sources.)

- [ ] **Step 2: Run red** → FAIL.

- [ ] **Step 3: Reescrever AdminSources** — estado `tab` (default `'active'`); header + "Novo programa"; `SegmentedControl` (counts: ativos = sources.length, pendentes/rejeitados via `useSourceCandidates` — Task 6 preenche, aqui pode ser 0). Aba Ativos: `AdminList` das fontes reais, cada linha com avatar-inicial + nome + pill(`categoryMeta(kind→source_category).label` via `SOURCE_CATEGORY_META`) + ações Editar (abre `AdminSheet`+`SourceForm`) / Remover (abre `ConfirmDelete` com mensagem de cascade — usar contagem real se `useAdminSources` já traz `source_items`/vínculos, senão aviso genérico). Abas Pendentes/Rejeitados: render placeholder "em breve" que a Task 6 substitui.

- [ ] **Step 4: SourceForm no modal + permanece aberto (D7)** — `SourceForm` estilizado com `.aa-fieldlbl`/`.input`/`.aa-select`; ao criar (sem id), após salvar **não** fechar o `AdminSheet` — trocar para o modo edição do registro recém-criado (revelando `SourceItemsEditor`). Campos avançados (Pluggy/logo/país) atrás de um `<details>` "Mais opções".

- [ ] **Step 5: Green + build + commit**

Run: `npx vitest run src/features/admin/sources && npm run build`
```bash
git add src/features/admin/sources/ src/features/admin/admin.css && git commit -m "feat(admin): reskin Programas (Ativos CRUD, tabs, confirm-delete, modal form)"
```

---

## Task 6: Programas — Pendentes/Rejeitados + Revisar (cascade)

**Files:**
- Modify: `src/features/admin/sources/AdminSources.tsx` (abas Pendentes/Rejeitados)
- Create: `src/features/admin/sources/RejectDialog.tsx`
- Modify: `src/features/admin/discovery/AdminDiscovery.tsx` + `CandidateTree.tsx` (aceitar subtree; motivo)
- Modify: `src/features/admin/discovery/discovery.css` (720→760)
- Test: `src/features/admin/sources/AdminSources.discovery.test.tsx`

**Interfaces:**
- Consumes: `useSourceCandidates`, `useCandidateSubtree`, `useRejectCandidate`, `useReconsiderCandidate`, `CandidateTree`.
- Produces: abas Pendentes/Rejeitados funcionais; "Revisar" navega ao cascade filtrado por fingerprint.

- [ ] **Step 1: Teste (falha)** — Pendentes lista candidatos-fonte reais (mock `useSourceCandidates('pending')`) com `.aa-robo` (origem de `provenance.source_url`, "visto pela 1ª vez há X" de `created_at`); "Rejeitar" abre `RejectDialog`, confirmar com motivo chama `useRejectCandidate.mutate({candidateId, reason})`; aba Rejeitados mostra motivo + "Reconsiderar" chama `useReconsiderCandidate`. "Revisar" chama `navigate('/admin/discovery?fp=<fingerprint>')`.

- [ ] **Step 2: Run red** → FAIL.

- [ ] **Step 3: Implementar abas** — na aba Pendentes/Rejeitados, `AdminList` sobre `useSourceCandidates(status)`; linha com `.aa-robo`; degradação graciosa se erro (D13: render `PageState` "Discovery indisponível", não quebra). `RejectDialog` = `AdminSheet` com textarea de motivo → `mutate({candidateId, reason})`.

- [ ] **Step 4: Drill-in cascade** — `AdminDiscovery` lê `?fp=` (via `useSearchParams`); se presente, usa `useCandidateSubtree(fp)` e passa o array a `CandidateTree` (que já monta a árvore por `parent_fingerprint`); sem `fp`, mantém o modo fila-de-jobs atual. Reconciliar `discovery.css` `@container (min-width: 720px)` → `760px`.

- [ ] **Step 5: Green + build + commit**

Run: `npx vitest run src/features/admin && npm run build`
```bash
git add src/features/admin/ && git commit -m "feat(admin): Programas Pendentes/Rejeitados wired to discovery + cascade drill-in"
```

---

## Task 7: Benefícios

**Files:**
- Modify: `src/features/admin/benefits/AdminBenefits.tsx`, `BenefitForm.tsx`
- Modify: `src/features/admin/admin.css` (reusa `.aa-list`; toolbar)
- Test: `src/features/admin/benefits/AdminBenefits.test.tsx` (ajustar + novos)

**Interfaces:**
- Consumes: `AdminList`, `AdminSheet`, `ConfirmDelete`, `Chip`, `Input`, `useToast`, `useAdminBenefits` (SELECT estendido), `.pill.iss/.brand/.part`.
- Produces: tela Benefícios reskinada.

- [ ] **Step 1: Teste (falha)** — lista mostra título + badge `new` quando `created_at`<14d; pill de origem por `benefit_source` (issuer→Emissor etc., mixed→Misto); nome da fonte via `benefit_sources[].source_items.sources.name`; toolbar busca filtra por título; chips filtram por categoria; Remover abre `ConfirmDelete`.

- [ ] **Step 2: Run red** → FAIL.

- [ ] **Step 3: Implementar** — mapa `BENEFIT_SOURCE_LABEL = { issuer:'Emissor', card_network:'Bandeira', partner:'Parceiro', mixed:'Misto' }` e classe `{issuer:'iss', card_network:'brand', partner:'part', mixed:'part'}`; toolbar `.input.aa-search` (state de busca) + `.chips` (reusar `Chip`, categorias de benefícios); `AdminList`; Editar/Remover (confirm). Form no `AdminSheet` com campos atuais + `<details>` "Mais opções" (scope/uf/steps/valid_until/image/action/locais); multi-fonte e locais preservados; modal permanece aberto após criar (D7); erro de mutation exibido; botão desabilita durante `isPending` (anti duplo-submit).

- [ ] **Step 4: Green + build + commit**

Run: `npx vitest run src/features/admin/benefits && npm run build`
```bash
git add src/features/admin/benefits/ src/features/admin/admin.css && git commit -m "feat(admin): reskin Benefícios (list, toolbar, origem/fonte/novo, modal form)"
```

---

## Task 8: Gate visual Playwright do admin + global-setup

**Files:**
- Modify: `playwright.config.ts` (globalSetup + baseURL admin)
- Create: `tests/e2e/global-setup.ts`, `tests/e2e/admin-layout.spec.ts`
- Create: `tests/e2e/admin.helpers.ts` (login helper)

**Interfaces:**
- Consumes: padrão de `tests/helpers/clients.ts` (service_role via `SUPABASE_SERVICE_ROLE_KEY`).
- Produces: usuário admin idempotente + specs e2e do admin nos 4 projetos.

- [ ] **Step 1: global-setup provisiona admin**

Create `tests/e2e/global-setup.ts`:
```ts
import { createClient } from '@supabase/supabase-js'
export const ADMIN_EMAIL = 'admin-e2e@test.dev'
export const ADMIN_PASSWORD = 'admin-e2e-123'
export default async function globalSetup() {
  const url = process.env.VITE_SUPABASE_URL!
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  // idempotente: cria se não existir
  const { data: created } = await admin.auth.admin.createUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true })
  let id = created?.user?.id
  if (!id) {
    const { data: list } = await admin.auth.admin.listUsers()
    id = list.users.find((u) => u.email === ADMIN_EMAIL)?.id
  }
  if (id) await admin.from('profiles').update({ is_admin: true }).eq('id', id)
}
```
Em `playwright.config.ts`: `globalSetup: './tests/e2e/global-setup.ts'` e garantir que `.env.local`/`.env.test` exponham `SUPABASE_SERVICE_ROLE_KEY` ao processo do Playwright (documentar no topo do spec).

- [ ] **Step 2: login helper** — `tests/e2e/admin.helpers.ts`: `loginAdmin(page)` navega a `/admin/login`, preenche email/senha (constantes de `global-setup`), submete, espera `/admin`.

- [ ] **Step 3: Spec e2e do admin**

Create `tests/e2e/admin-layout.spec.ts`: por projeto (mobile/desktop × light/dark) — login → `/admin` (StatGrid visível, sem overflow); `/admin/sources` (3 abas; desktop tem `.aa-side` visível + `.aa-tabbar` oculta; mobile inverso); abrir "Novo programa" → `<dialog>` visível, Escape fecha; `/admin/benefits` (toolbar + lista); `/admin/discovery`. Assert `assertNoHorizontalOverflow` em cada tela (reusar helper de `app-layout.spec.ts`). Screenshots por tela.

- [ ] **Step 4: Rodar o gate**

Run: `npx -y supabase@2.95.0 status` (Supabase no ar) e `npm run test:visual -- tests/e2e/admin-layout.spec.ts` (ou incluir no `test:visual`).
Expected: todos os cenários PASS nos 4 projetos, sem overflow. Se algo faltar dado, ajustar seed/global-setup e repetir.

- [ ] **Step 5: Commit**

```bash
git add playwright.config.ts tests/e2e/
git commit -m "test(admin): e2e visual gate + admin global-setup across 4 projects"
```

---

## Notas de execução
- **Ordem obrigatória:** Task 1 (dados/tokens) antes de tudo; 2 (primitivos/overlay) e 3 (casca) antes das telas 4–7; 8 por último.
- **Cada task roda `npm run build`** (único type-check).
- **`supabase db reset`** entre execuções se os testes de integração poluírem o catálogo local.
- **Migrations 0014–0017** entram em prod só no deploy `develop→main` (D13) — fora do escopo deste plano.
