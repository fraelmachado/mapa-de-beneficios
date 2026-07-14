# Fluxo do Admin — Alinhamento aos Mockups (Spec 2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reestilizar todas as telas do Admin (Login, Painel, Programas, Benefícios, Discovery) para bater com os mockups do Claude Design, responsivo e mantendo o CRUD real.

**Architecture:** Casca responsiva (`AdminAppShell` + `AdminNav`) com container query única a 760px (sidebar↔tabbar, tabela↔cards, `<dialog>` modal↔bottom-sheet). Programas funde Discovery de forma fina: abas Pendentes/Ativos/Rejeitados sobre dados reais, "Revisar" abre o cascade real. Reuso do `ds.css` + primitivos estendidos aditivamente.

**Tech Stack:** React 18 + TS + Vite + React Router + TanStack Query + Supabase JS; Vitest + Testing Library; Playwright (4 projetos mobile/desktop × light/dark).

**Spec:** `docs/superpowers/specs/2026-07-13-admin-flow-mockup-alignment-design.md` (decisões D1–D14). Revisado após 2 passadas Codex sobre este plano.

## Global Constraints

- **Fonte visual:** `docs/mockups/design_handoff_mockups/Admin App.dc.html` + `Admin Discovery.dc.html`. As regras estruturais/responsivas do CSS estão explícitas neste plano (D9); o polimento fino de paddings/sombras segue o mockup.
- **Tokens:** só `var(--…)`. Chrome admin via `--admin-side-bg/-ink/-hover`, `--admin-line`, `--admin-backdrop`. Sem hex/rgb literal fora desses tokens. Dark via `[data-theme="dark"]`.
- **Responsivo:** `@container (min-width: 760px)` sobre `.aa-root { container-type: inline-size }`. Colunas de tabela `minmax(0,1fr)` + truncar; overflow só no container da tabela; **página nunca rola na horizontal**. Shell `min-height:100dvh`, sidebar `sticky`, tabbar `fixed` (D9).
- **CRUD real preservado.** Exceções: coluna `rejection_reason` (D4); confirmação de exclusão (D11); modal de criação permanece aberto pós-criação (D7).
- **Nada finge dado real** — confiança%/estimativa omitidos (D1/D5).
- **Reuso** (estendido aditivamente): `Button`, `Input`, `Chip`, `SegmentedControl`, `PageState`, `Skeleton`. `AdminNav` própria (NavLink), não o `Nav` genérico (D10). Rótulos de categoria via `SOURCE_CATEGORY_META` / `categoryMeta()` (`src/features/onboarding/categoryMeta.ts`).
- `npm test` NÃO roda tsc → cada task roda `npm run build`.
- `<dialog>` nativo; foco-preso/Escape testados em Playwright; jsdom usa polyfill mínimo.

---

## Task 1: Fundação de dados, tipos e tokens

**Files:**
- Create: `supabase/migrations/0017_discovery_rejection_reason.sql`
- Modify: `src/features/admin/discovery/types.ts`, `src/lib/database.types.ts`
- Create: `src/features/admin/discovery/useSourceCandidates.ts` + test
- Modify: `src/features/admin/discovery/useDiscovery.ts`, `src/features/admin/discovery/AdminDiscovery.tsx` (manter compilando)
- Modify: `src/features/admin/benefits/useAdminBenefits.ts`, `src/features/admin/benefits/types.ts`
- Modify: `src/ui/ds.css`, `src/test-setup.ts`

**Interfaces (Produces):** `useSourceCandidates(status)`; `useCandidateSubtree(fp)`; `useRejectCandidate()` → `mutate({candidateId,reason})`; `useReconsiderCandidate()` → `mutate({candidateId})`; `DiscoveryCandidate.rejection_reason: string|null`; `BenefitRow.benefit_source`, `BenefitRow.created_at`; `benefit_sources[].source_items.sources.name`.

- [ ] **Step 1: Migration.** Create `supabase/migrations/0017_discovery_rejection_reason.sql`:
```sql
-- D4: motivo de rejeição (UPDATE direto sob a RLS admin de 0015).
alter table discovery_candidates add column rejection_reason text;
```

- [ ] **Step 2: Aplicar + regerar tipos.** Run: `npx -y supabase@2.95.0 db reset` então `npm run gen:types`. Expected: `database.types.ts` passa a ter `rejection_reason` em `discovery_candidates`. (Se `gen:types` falhar, editar `database.types.ts` à mão: add `rejection_reason: string | null` ao Row e `rejection_reason?: string | null` a Insert/Update de `discovery_candidates`.)

- [ ] **Step 3: Tipo de domínio.** Em `src/features/admin/discovery/types.ts`, no `interface DiscoveryCandidate`, após `review_status`, adicionar: `  rejection_reason: string | null`.

- [ ] **Step 4: Teste de `useSourceCandidates` (red).** Create `src/features/admin/discovery/useSourceCandidates.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const order = vi.fn()
const eqStatus = vi.fn(() => ({ order }))
const eqEntity = vi.fn(() => ({ eq: eqStatus }))
const select = vi.fn(() => ({ eq: eqEntity }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: () => ({ select }) } }))
import { useSourceCandidates } from './useSourceCandidates'

const wrap = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}
beforeEach(() => { order.mockReset(); eqStatus.mockClear(); eqEntity.mockClear(); select.mockClear() })

describe('useSourceCandidates', () => {
  it('filtra entity_type=source + review_status, ordenado por created_at', async () => {
    order.mockResolvedValue({ data: [{ id: 'c1' }], error: null })
    const { result } = renderHook(() => useSourceCandidates('pending'), { wrapper: wrap() })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(select).toHaveBeenCalledWith('*')
    expect(eqEntity).toHaveBeenCalledWith('entity_type', 'source')
    expect(eqStatus).toHaveBeenCalledWith('review_status', 'pending')
  })
})
```
Run: `npx vitest run src/features/admin/discovery/useSourceCandidates.test.ts` → FAIL.

- [ ] **Step 5: Implementar `useSourceCandidates` + `useCandidateSubtree`.** Create `src/features/admin/discovery/useSourceCandidates.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import type { DiscoveryCandidate, DiscoveryReviewStatus } from './types'

// D2: candidatos-fonte de TODOS os jobs por status. fingerprint é UNIQUE global — sem dedupe manual.
export function useSourceCandidates(status: DiscoveryReviewStatus) {
  return useQuery({
    queryKey: ['source_candidates', status],
    queryFn: async (): Promise<DiscoveryCandidate[]> => {
      const { data, error } = await supabase
        .from('discovery_candidates').select('*')
        .eq('entity_type', 'source').eq('review_status', status)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as DiscoveryCandidate[]
    },
  })
}

// D3: subárvore de uma fonte por parent_fingerprint, cross-job (não filtra job_id). BFS 2 níveis.
export function useCandidateSubtree(sourceFingerprint: string | null) {
  return useQuery({
    queryKey: ['candidate_subtree', sourceFingerprint],
    enabled: !!sourceFingerprint,
    queryFn: async (): Promise<DiscoveryCandidate[]> => {
      const all: DiscoveryCandidate[] = []
      const root = await supabase.from('discovery_candidates').select('*').eq('fingerprint', sourceFingerprint!)
      if (root.error) throw root.error
      all.push(...((root.data ?? []) as unknown as DiscoveryCandidate[]))
      let frontier = all.map((r) => r.fingerprint)
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
Run o teste → PASS.

- [ ] **Step 6: reject/reconsider + invalidação do subtree no promote (D4 + fix Codex).** Em `src/features/admin/discovery/useDiscovery.ts`:
  - Em `usePromoteCandidate`, adicionar ao `onSuccess`: `qc.invalidateQueries({ queryKey: ['candidate_subtree'] })` e `qc.invalidateQueries({ queryKey: ['source_candidates'] })`.
  - Substituir `useRejectCandidate` (sem `jobId`) e adicionar `useReconsiderCandidate`:
```ts
export function useRejectCandidate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ candidateId, reason }: { candidateId: string; reason: string }) => {
      const { error } = await supabase.from('discovery_candidates')
        .update({ review_status: 'rejected', rejection_reason: reason } as never).eq('id', candidateId)
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
      const { error } = await supabase.from('discovery_candidates')
        .update({ review_status: 'pending', rejection_reason: null } as never).eq('id', candidateId)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['source_candidates'] })
      qc.invalidateQueries({ queryKey: ['discovery_candidates'] })
    },
  })
}
```
  - Em `AdminDiscovery.tsx` (só manter compilando aqui; comportamento completo na Task 6): `const reject = useRejectCandidate()` e a chamada vira `onReject={(id) => reject.mutate({ candidateId: id, reason: '' })}`.

- [ ] **Step 7: SELECT/tipo de benefícios (D6/D8 + fix Codex do BenefitInput).**
  - `useAdminBenefits.ts` `SELECT` passa a: `'id, title, summary, category, scope, uf, steps, partner_name, valid_until, image_url, action_url, action_label, active, benefit_source, created_at, benefit_sources(source_item_id, source_items(sources(name))), benefit_locations(id, benefit_id, name, lat, lng, address, city, uf, radius_m, active)'`
  - `benefits/types.ts`: adicionar ao `BenefitRow`: `  benefit_source: 'issuer' | 'card_network' | 'partner' | 'mixed' | null` e `  created_at: string`; trocar o shape de `benefit_sources` para `{ source_item_id: string; source_items: { sources: { name: string } | null } | null }[]`. **`BenefitInput` passa a excluir `benefit_source` e `created_at`** (o form não os edita): `export type BenefitInput = Omit<BenefitRow, 'id' | 'benefit_sources' | 'benefit_locations' | 'benefit_source' | 'created_at'>`.

- [ ] **Step 8: Tokens (D14).** Em `src/ui/ds.css`, no `:root` E no `[data-theme="dark"]` (mesmos valores — sidebar escura nos dois temas), adicionar:
```css
  --admin-side-bg: #0f1013;
  --admin-side-ink: #e7e8ec;
  --admin-side-hover: #1b1d22;
  --admin-line: var(--line);
  --admin-backdrop: color-mix(in srgb, #0f1013 46%, transparent);
```

- [ ] **Step 9: Polyfill `<dialog>`.** Em `src/test-setup.ts`, ao final:
```ts
if (typeof HTMLDialogElement !== 'undefined' && !HTMLDialogElement.prototype.showModal) {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.show = function () { this.open = true }
  HTMLDialogElement.prototype.close = function (v?: string) {
    this.open = false; if (v !== undefined) this.returnValue = v
    this.dispatchEvent(new Event('close'))
  }
}
```

- [ ] **Step 10: Build + commit.** Run: `npx vitest run src/features/admin/discovery && npm run build` (build DEVE passar isolado — `BenefitInput` corrigido garante isso). Commit:
```bash
git add supabase/migrations/0017_discovery_rejection_reason.sql src/features/admin/discovery/ src/features/admin/benefits/ src/lib/database.types.ts src/ui/ds.css src/test-setup.ts
git commit -m "feat(admin): data foundation — rejection_reason, source-candidate/subtree hooks, benefit SELECT, tokens, dialog polyfill"
```

---

## Task 2: Primitivos estendidos + AdminSheet + Toast + ConfirmDelete

**Files:** Modify `src/ui/{Button,Input,SegmentedControl}.tsx`; Create `src/ui/AdminSheet.tsx` (+test), `src/ui/Toast.tsx` (+test), `src/features/admin/ConfirmDelete.tsx` (+test), `src/features/admin/admin.css` (base do overlay).

**Interfaces (Produces):** `Button` aceita `className?`,`ariaLabel?`; `Input` aceita `id?`,`required?`,`disabled?`,`className?`; `SegmentedOption` aceita `count?:number`; `<AdminSheet open title onClose wide? closeOnBackdrop?>`; `useToast()`+`<ToastHost/>`; `<ConfirmDelete open title message onConfirm onCancel/>`.

- [ ] **Step 1: Button aditivo.** `ButtonProps` ganha `className?: string; ariaLabel?: string`. No componente: `const cls = ['btn', variant==='ink'?'ink':variant==='ghost'?'ghost':'', className].filter(Boolean).join(' ')`; `<button ... aria-label={ariaLabel}>`.

- [ ] **Step 2: Input aditivo.** `InputProps` ganha `id?: string; required?: boolean; disabled?: boolean; className?: string`. `<label className={['input', className].filter(Boolean).join(' ')}>`; repassar `id`/`required`/`disabled` ao `<input>`.

- [ ] **Step 3: SegmentedControl badge.** `SegmentedOption` ganha `count?: number`. Após `{opt.label}`: `{typeof opt.count === 'number' ? <span className="n">{opt.count}</span> : null}`.

- [ ] **Step 4: AdminSheet (red).** Create `src/ui/AdminSheet.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AdminSheet } from './AdminSheet'

describe('AdminSheet', () => {
  it('renderiza título (aria-labelledby) e conteúdo quando open', () => {
    render(<AdminSheet open title="Remover item?" onClose={() => {}}><p>corpo</p></AdminSheet>)
    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(dialog).toHaveAttribute('aria-labelledby')
    expect(screen.getByText('corpo')).toBeInTheDocument()
  })
  it('clique no backdrop chama onClose uma vez (closeOnBackdrop)', () => {
    const onClose = vi.fn()
    const { container } = render(<AdminSheet open title="X" onClose={onClose}><p>c</p></AdminSheet>)
    fireEvent.click(container.querySelector('dialog')!) // target === dialog = backdrop
    expect(onClose).toHaveBeenCalledTimes(1)
  })
  it('não fecha no backdrop quando closeOnBackdrop=false', () => {
    const onClose = vi.fn()
    const { container } = render(<AdminSheet open title="X" onClose={onClose} closeOnBackdrop={false}><p>c</p></AdminSheet>)
    fireEvent.click(container.querySelector('dialog')!)
    expect(onClose).not.toHaveBeenCalled()
  })
})
```
Run → FAIL.

- [ ] **Step 5: Implementar AdminSheet (D10: aria-labelledby, foco, sem double-close).** Create `src/ui/AdminSheet.tsx`:
```tsx
import { useEffect, useId, useRef, type ReactNode } from 'react'

export function AdminSheet({ open, title, onClose, wide, closeOnBackdrop = true, children }: {
  open: boolean; title: string; onClose: () => void; wide?: boolean; closeOnBackdrop?: boolean; children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const prev = useRef<HTMLElement | null>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current; if (!d) return
    if (open && !d.open) { prev.current = document.activeElement as HTMLElement; d.showModal() }
    else if (!open && d.open) d.close()
  }, [open])
  useEffect(() => { if (!open && prev.current) { prev.current.focus?.(); prev.current = null } }, [open])
  // onClose vem SÓ de eventos do usuário (Escape via onCancel, backdrop via onClick) — nunca do close() programático.
  return (
    <dialog
      ref={ref}
      className={'aa-dialog' + (wide ? ' aa-wide' : '')}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={closeOnBackdrop ? (e) => { if (e.target === ref.current) onClose() } : undefined}
    >
      <div className="aa-grip" aria-hidden="true" />
      <h2 id={titleId} className="aa-dialog-title">{title}</h2>
      {children}
    </dialog>
  )
}
```
Run → PASS. (Foco-preso/Escape reais ficam pro Playwright — D12.)

- [ ] **Step 6: CSS base do overlay.** Create `src/features/admin/admin.css` com o bloco de `.aa-dialog`/backdrop (importado em `src/index.css`):
```css
.aa-dialog { border: 0; padding: 20px; max-width: 100%; width: 100%; background: var(--surface); color: var(--ink);
  border-radius: 22px 22px 0 0; margin: auto auto 0; box-shadow: var(--shadow-lg); }
.aa-dialog::backdrop { background: var(--admin-backdrop); }
.aa-grip { width: 40px; height: 4px; border-radius: 999px; background: var(--line); margin: 0 auto 12px; }
.aa-dialog-title { margin: 0 0 12px; font-size: 18px; font-weight: 800; letter-spacing: -.02em; }
.aa-dialog-actions { display: flex; gap: 10px; margin-top: 16px; }
.btn.danger { background: var(--warn); color: #fff; }
@container (min-width: 760px) {
  .aa-dialog { width: 440px; border-radius: 20px; margin: auto; }
  .aa-dialog.aa-wide { width: 520px; }
  .aa-grip { display: none; }
}
@media (prefers-reduced-motion: no-preference) { .aa-dialog[open] { animation: aa-in .18s var(--ease); } }
@keyframes aa-in { from { opacity: 0; transform: translateY(8px); } }
```

- [ ] **Step 7: Toast.** Create `src/ui/Toast.tsx`: context provider + `useToast()` → `{ show(msg: string) }`; `<ToastHost/>` renderiza a fila em `<div role="status" aria-live="polite" className="aa-toast">{msg}</div>`, auto-dismiss 3200ms (via `setTimeout`; sem animação se `prefers-reduced-motion: reduce`). Test `Toast.test.tsx`: um componente que chama `useToast().show('Salvo')` num efeito e afirma `screen.getByRole('status')` com "Salvo". `.aa-toast` no `admin.css`.

- [ ] **Step 8: ConfirmDelete (red+green).** Create `src/features/admin/ConfirmDelete.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDelete } from './ConfirmDelete'
describe('ConfirmDelete', () => {
  it('só confirma no botão Remover', () => {
    const onConfirm = vi.fn(); const onCancel = vi.fn()
    render(<ConfirmDelete open title="Remover item?" message="Remove também 2 variantes e 3 vínculos." onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByText(/2 variantes e 3 vínculos/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i })); expect(onConfirm).not.toHaveBeenCalled(); expect(onCancel).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^remover$/i })); expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
```
Create `src/features/admin/ConfirmDelete.tsx`: usa `AdminSheet` (`closeOnBackdrop` default true, onClose=onCancel), título, `<p>{message}</p>`, `<div className="aa-dialog-actions"><Button variant="ghost" onClick={onCancel}>Cancelar</Button><Button className="danger" onClick={onConfirm}>Remover</Button></div>`.

- [ ] **Step 9: Build + commit.** Run: `npx vitest run src/ui src/features/admin/ConfirmDelete.test.tsx && npm run build`. Commit `feat(admin): extend primitives + native-dialog AdminSheet, Toast, ConfirmDelete`.

---

## Task 3: AdminAppShell + AdminNav + AdminList/Row + StatGrid

**Files:** Create `src/features/admin/{AdminAppShell,AdminNav,AdminList,StatGrid}.tsx` (+ tests p/ AdminNav e AdminList); Modify `src/router.tsx`, `src/features/admin/AdminGuard.tsx`, `src/features/admin/admin.css`.

**Interfaces (Produces):** `<AdminAppShell>` (usa `<Outlet/>`); `<AdminNav pendingCount?: number/>`; `<AdminList ariaLabel rows renderRow keyOf/>`; `<StatGrid stats={{label,value}[]}/>`.

- [ ] **Step 1: AdminNav (red).** Create `src/features/admin/AdminNav.test.tsx`:
```tsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminNav } from './AdminNav'
describe('AdminNav', () => {
  it('ativo por rota + badge de pendentes no item Programas', () => {
    render(<MemoryRouter initialEntries={['/admin/sources']}><AdminNav pendingCount={3} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /programas/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /painel/i })).toHaveAttribute('href', '/admin')
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
```
Run → FAIL.

- [ ] **Step 2: Implementar AdminNav.** Create `src/features/admin/AdminNav.tsx`:
```tsx
import { NavLink } from 'react-router-dom'
const ITEMS = [
  { to: '/admin', label: 'Painel', end: true },
  { to: '/admin/sources', label: 'Programas', end: false },
  { to: '/admin/benefits', label: 'Benefícios', end: false },
  { to: '/admin/discovery', label: 'Discovery', end: false },
]
export function AdminNav({ pendingCount = 0 }: { pendingCount?: number }) {
  return (
    <>
      {ITEMS.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} className="aa-navbtn">
          <span>{it.label}</span>
          {it.to === '/admin/sources' && pendingCount > 0 ? <span className="aa-navcount">{pendingCount}</span> : null}
        </NavLink>
      ))}
    </>
  )
}
```
(Badge de pendentes fica em **Programas** — é onde a aba Pendentes vive.) Run → PASS.

- [ ] **Step 3: AdminAppShell.** Create `src/features/admin/AdminAppShell.tsx`:
```tsx
import { Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AdminNav } from './AdminNav'
import { useSourceCandidates } from './discovery/useSourceCandidates'
export function AdminAppShell() {
  const navigate = useNavigate()
  const pending = useSourceCandidates('pending') // D13: degrada — se falhar, count 0, sem quebrar
  const count = pending.data?.length ?? 0
  async function logout() { await supabase.auth.signOut(); navigate('/admin/login', { replace: true }) }
  return (
    <div className="aa-root">
      <div className="aa-shell">
        <aside className="aa-side">
          <div className="aa-brand">Mapa · Admin</div>
          <nav className="aa-sidenav"><AdminNav pendingCount={count} /></nav>
          <button type="button" className="aa-navbtn aa-side-foot" onClick={logout}>Sair</button>
        </aside>
        <main className="aa-main"><Outlet /></main>
      </div>
      <nav className="aa-tabbar"><AdminNav pendingCount={count} /></nav>
    </div>
  )
}
```

- [ ] **Step 4: AdminList + StatGrid (red+green).** Create `src/features/admin/AdminList.test.tsx` afirmando `role="table"` + uma `role="row"` por item + `renderRow` chamado. Create `AdminList.tsx`:
```tsx
import type { ReactNode } from 'react'
export function AdminList<T>({ ariaLabel, rows, keyOf, renderRow }: {
  ariaLabel: string; rows: T[]; keyOf: (r: T) => string; renderRow: (r: T) => ReactNode
}) {
  return (
    <div className="aa-list" role="table" aria-label={ariaLabel}>
      {rows.map((r) => <div className="aa-lrow" role="row" key={keyOf(r)}>{renderRow(r)}</div>)}
    </div>
  )
}
```
Create `StatGrid.tsx`: `<div className="aa-statgrid">{stats.map(s => <div className="aa-stat" key={s.label}><div className="aa-stat-v">{s.value}</div><div className="aa-stat-k">{s.label}</div></div>)}</div>`.

- [ ] **Step 5: CSS estrutural da casca (D9 — regras concretas, não "verbatim").** Em `admin.css` adicionar:
```css
.aa-root { container-type: inline-size; }
.aa-shell { min-height: 100dvh; background: var(--bg); }
.aa-side { display: none; }
.aa-main { padding: 18px 16px 92px; max-width: 720px; margin: 0 auto; }
.aa-tabbar { position: fixed; inset: auto 0 0 0; display: flex; justify-content: space-around;
  gap: 4px; padding: 8px 8px calc(8px + env(safe-area-inset-bottom)); background: var(--surface);
  border-top: 1px solid var(--line); z-index: 20; }
.aa-tabbar .aa-navbtn { flex: 1; flex-direction: column; font-size: 11px; gap: 2px; }
.aa-navbtn { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 12px;
  border: 0; background: none; color: var(--ink-2); font: inherit; text-decoration: none; cursor: pointer; }
.aa-navbtn[aria-current="page"] { color: var(--ink); font-weight: 700; }
.aa-navcount { margin-left: auto; min-width: 20px; height: 20px; padding: 0 6px; border-radius: 999px;
  background: var(--accent); color: var(--accent-ink); font-size: 11px; font-weight: 800;
  display: inline-grid; place-items: center; }
.aa-list { display: flex; flex-direction: column; gap: 8px; }
.aa-lrow { display: grid; grid-template-columns: 1fr auto; gap: 8px 12px; align-items: center;
  padding: 12px 13px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); box-shadow: var(--shadow); }
.aa-statgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.aa-stat { padding: 14px; border: 1px solid var(--line); border-radius: 14px; background: var(--surface); }
.aa-stat-v { font-size: 26px; font-weight: 800; letter-spacing: -.03em; color: var(--ink); }
.aa-stat-k { margin-top: 2px; font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
@container (min-width: 760px) {
  .aa-shell { display: grid; grid-template-columns: 246px 1fr; }
  .aa-side { display: flex; flex-direction: column; gap: 6px; position: sticky; top: 0; height: 100dvh;
    padding: 20px 14px; background: var(--admin-side-bg); color: var(--admin-side-ink); }
  .aa-side .aa-navbtn { color: var(--admin-side-ink); }
  .aa-side .aa-navbtn:hover { background: var(--admin-side-hover); }
  .aa-side .aa-navbtn[aria-current="page"] { background: var(--admin-side-hover); }
  .aa-side-foot { margin-top: auto; }
  .aa-brand { padding: 8px 12px 16px; font-weight: 800; }
  .aa-tabbar { display: none; }
  .aa-main { padding: 32px 40px; max-width: none; }
  .aa-list { gap: 0; border: 1px solid var(--line); border-radius: 16px; overflow: hidden; background: var(--surface); }
  .aa-lrow { grid-template-columns: minmax(0,1fr) 150px 110px 170px; border: 0; border-radius: 0;
    border-bottom: 1px solid var(--line); box-shadow: none; }
  .aa-statgrid { grid-template-columns: repeat(4, 1fr); }
}
```
(Paddings/sombras finos podem ser afinados olhando `Admin App.dc.html`, mas as regras acima são a base responsiva completa.)

- [ ] **Step 6: Router + AdminGuard.** Em `src/router.tsx`, trocar `element: <AdminLayout />` por `element: <AdminAppShell />`. Em `AdminGuard.tsx`, trocar `<p className="p-6 text-slate-500">Verificando acesso…</p>` por `<div className="aa-main"><Skeleton height="120px" radius="14px" /></div>`; manter o redirect. `import './admin.css'` já vem via `src/index.css`.

- [ ] **Step 7: Build + commit.** Run: `npx vitest run src/features/admin && npm run build`. Commit `feat(admin): responsive AppShell + AdminNav + AdminList + StatGrid`.

---

## Task 4: Login + Painel do catálogo

**Files:** Modify `AdminLogin.tsx`, `AdminHome.tsx`, `admin.css`; Create `src/features/admin/useAdminStats.ts` (+ test via `AdminHome.test.tsx`).

**Interfaces (Produces):** `useAdminStats()` → `{ stats: {programas,beneficios,pendentes,novos}, isLoading, error }`.

- [ ] **Step 1: useAdminStats (red).** Create `src/features/admin/AdminHome.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
vi.mock('./sources/useAdminSources', () => ({ useAdminSources: () => ({ data: [{}, {}], isLoading: false, error: null }) }))
vi.mock('./discovery/useSourceCandidates', () => ({ useSourceCandidates: () => ({ data: [{}], isLoading: false, error: null }) }))
const recent = new Date('2026-07-10T00:00:00Z').toISOString()
const old = new Date('2026-06-01T00:00:00Z').toISOString()
vi.mock('./benefits/useAdminBenefits', () => ({ useAdminBenefits: () => ({ data: [{ created_at: recent }, { created_at: old }, { created_at: recent }], isLoading: false, error: null }) }))
import { AdminHome } from './AdminHome'
beforeEach(() => vi.setSystemTime(new Date('2026-07-14T00:00:00Z')))
afterEach(() => vi.useRealTimers())
describe('AdminHome', () => {
  it('mostra contagens reais e novos = created_at < 14 dias', () => {
    render(<MemoryRouter><AdminHome /></MemoryRouter>)
    expect(screen.getByText('Programas').previousSibling).toHaveTextContent('2')
    expect(screen.getByText('Benefícios').previousSibling).toHaveTextContent('3')
    expect(screen.getByText('Pendentes').previousSibling).toHaveTextContent('1')
    expect(screen.getByText('Novos').previousSibling).toHaveTextContent('2') // 2 recentes
  })
})
```
Run → FAIL.

- [ ] **Step 2: Implementar useAdminStats.** Create `src/features/admin/useAdminStats.ts`:
```ts
import { useAdminSources } from './sources/useAdminSources'
import { useAdminBenefits } from './benefits/useAdminBenefits'
import { useSourceCandidates } from './discovery/useSourceCandidates'

const DAY = 86_400_000
export function useAdminStats() {
  const sources = useAdminSources()
  const benefits = useAdminBenefits()
  const pending = useSourceCandidates('pending')
  const cutoff = Date.now() - 14 * DAY
  const novos = (benefits.data ?? []).filter((b) => new Date(b.created_at).getTime() >= cutoff).length
  return {
    stats: {
      programas: sources.data?.length ?? 0,
      beneficios: benefits.data?.length ?? 0,
      pendentes: pending.data?.length ?? 0, // D13: degrada a 0 se discovery indisponível
      novos,
    },
    isLoading: sources.isLoading || benefits.isLoading,
    error: sources.error || benefits.error,
  }
}
```

- [ ] **Step 3: Reskin AdminHome.** Reescrever `AdminHome.tsx`: usa `useAdminStats()`; se `isLoading` → `<Skeleton height="120px" radius="14px" />`; se `error` → `<PageState title="Não foi possível carregar o painel" />`; senão eyebrow "Bem-vinda" + `<h1 className="aa-h1">Painel do catálogo</h1>` + `<StatGrid stats={[{label:'Programas',value:stats.programas},{label:'Benefícios',value:stats.beneficios},{label:'Pendentes',value:stats.pendentes},{label:'Novos',value:stats.novos}]} />` + `.aa-areagrid` com dois `<Link className="aa-area" to="/admin/sources">` e `/admin/benefits`. CSS `.aa-h1`/`.aa-eyebrow`/`.aa-areagrid`/`.aa-area` em `admin.css` (1-col mobile / 2-col ≥760). Run o teste → PASS.

- [ ] **Step 4: Reskin AdminLogin.** Envolver o form em `<main className="aa-login"><div className="aa-login-card">…</div></main>`; usar `<Input id="email" type="email" required ariaLabel="E-mail" .../>` e senha idem; `<Button type="submit" disabled={loading}>Entrar</Button>`; erro via `<p role="alert">`; rodapé `<p className="aa-login-foot">Instalável como app</p>`. Wiring `signInWithPassword` inalterado. CSS `.aa-login`/`.aa-login-card` (gradiente radial, card centrado ≤400px) em `admin.css`.

- [ ] **Step 5: Build + commit.** Run: `npx vitest run src/features/admin/AdminHome.test.tsx && npm run build`. Commit `feat(admin): reskin login + catalog dashboard with real stats`.

---

## Task 5: Programas — aba Ativos (CRUD de fontes)

**Files:** Modify `sources/AdminSources.tsx`, `sources/SourceForm.tsx`, `sources/SourceItemsEditor.tsx`, `admin.css`; Test `sources/AdminSources.test.tsx`.

**Interfaces (Consumes):** `SegmentedControl` (com `count`), `AdminList`, `AdminSheet`, `ConfirmDelete`, `useToast`, `categoryMeta`, `useAdminSources`/`useSaveSource`/`useDeleteSource`, `useSourceCandidates` (counts das abas).

- [ ] **Step 1: Teste (red).** Reescrever `sources/AdminSources.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
const del = vi.fn(() => Promise.resolve())
vi.mock('./useAdminSources', () => ({
  useAdminSources: () => ({ data: [{ id: 's1', name: 'Nubank', kind: 'card', source_category: 'bank_card', active: true, source_items: [] }], isLoading: false, error: null }),
  useSaveSource: () => ({ mutateAsync: vi.fn(() => Promise.resolve('s1')), isPending: false }),
  useDeleteSource: () => ({ mutateAsync: del, isPending: false }),
}))
vi.mock('../discovery/useSourceCandidates', () => ({ useSourceCandidates: () => ({ data: [], isLoading: false, error: null }) }))
import { AdminSources } from './AdminSources'
beforeEach(() => del.mockClear())
describe('AdminSources — Ativos', () => {
  it('lista fontes na aba Ativos com pill de categoria', () => {
    render(<MemoryRouter><AdminSources /></MemoryRouter>)
    expect(screen.getByText('Nubank')).toBeInTheDocument()
    expect(screen.getByText(/bancos & cartões/i)).toBeInTheDocument()
  })
  it('Remover NÃO deleta direto — abre confirmação; confirmar deleta', () => {
    render(<MemoryRouter><AdminSources /></MemoryRouter>)
    fireEvent.click(screen.getByRole('button', { name: /remover nubank/i }))
    expect(del).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^remover$/i }))
    expect(del).toHaveBeenCalledWith('s1')
  })
})
```
Run → FAIL.

- [ ] **Step 2: Reescrever AdminSources.** Estrutura:
```tsx
// estado: tab ('active'|'pending'|'rejected'), editing (SourceRow | 'new' | { id: string } | null), confirmId (string|null)
const { data, isLoading, error } = useAdminSources()
const del = useDeleteSource()
const pend = useSourceCandidates('pending'); const rej = useSourceCandidates('rejected')
// header + botão "Novo programa" (aria-label no mobile)
// <SegmentedControl options={[{label:'Pendentes',value:'pending',count:pend.data?.length ?? 0},{label:'Ativos',value:'active',count:data?.length ?? 0},{label:'Rejeitados',value:'rejected',count:rej.data?.length ?? 0}]} value={tab} onChange={setTab} />
// tab==='active': <AdminList ariaLabel="Programas ativos" rows={data ?? []} keyOf={s=>s.id} renderRow={s => (
//   <><span className="aa-avatar">{s.name[0].toUpperCase()}</span><span className="aa-name">{s.name}</span>
//   <span className="pill">{categoryMeta(s.source_category).label}</span>
//   <span className="aa-act"><button aria-label={`editar ${s.name}`} onClick={()=>setEditing(s)}>Editar</button>
//   <button aria-label={`remover ${s.name}`} onClick={()=>setConfirmId(s.id)}>Remover</button></span></>)} />
// tab==='pending'|'rejected': placeholder "Preenchido na Task 6" (substituído lá).
// <ConfirmDelete open={!!confirmId} title="Remover item?" message={cascadeMsg(confirmId)} onCancel={()=>setConfirmId(null)} onConfirm={async()=>{ await del.mutateAsync(confirmId!); toast.show('Programa removido'); setConfirmId(null) }} />
// <AdminSheet open={!!editing} title={editing==='new'?'Novo programa':'Editar programa'} closeOnBackdrop={false} onClose={()=>setEditing(null)}> <SourceForm .../> {resolvedRow && <SourceItemsEditor .../>} </AdminSheet>
```
- `cascadeMsg(id)`: se a fonte tem `source_items`, "Remove também N variante(s) e os vínculos com benefícios."; senão genérico "Remove também os vínculos com benefícios." (contagem real a partir de `data.find(s=>s.id===id).source_items.length`).
- `categoryMeta` importado de `../../onboarding/categoryMeta`, chamado com `s.source_category` (NÃO `kind`).
- Estados `isLoading`→`Skeleton`, `error`→`PageState`.

- [ ] **Step 3: Modal permanece aberto pós-criação (D7 + fix Codex).** No `onSubmit`:
```tsx
async function onSubmit(input: SourceInput) {
  const cur = editing
  const id = cur && cur !== 'new' && typeof cur === 'object' ? (cur as any).id : undefined
  const savedId = await save.mutateAsync({ ...input, id })
  toast.show('Programa salvo')
  setEditing({ id: savedId }) // permanece aberto em modo edição; a lista reinvalida e resolve a row completa
}
```
No render do `AdminSheet`, resolver a row: `const resolvedRow = typeof editing === 'object' && editing && 'id' in editing ? (data ?? []).find(s => s.id === (editing as any).id) ?? null : editing === 'new' ? null : (editing as SourceRow | null)`. `SourceForm` recebe `initial={resolvedRow}`; `SourceItemsEditor` só renderiza quando `resolvedRow` existe.

- [ ] **Step 4: SourceForm estilizado + campos avançados.** Reestilizar `SourceForm.tsx` com `.aa-fieldlbl`/`.input`/`.aa-select` (trocar utilitários Tailwind); campos avançados (Pluggy/`connector_type`/`pluggy_connector_id`/`primary_color`/`country`/`logo_url`/`sort_order`) dentro de `<details className="aa-more"><summary>Mais opções</summary>…</details>`. Campos e submit inalterados (mesmo `SourceInput`). `SourceItemsEditor`: no botão remover variante, trocar delete-imediato por confirm inline leve (D11): 1º clique vira "Confirmar? / Cancelar" na própria linha; só o "Confirmar" deleta.

- [ ] **Step 5: Build + commit.** Run: `npx vitest run src/features/admin/sources && npm run build`. Commit `feat(admin): reskin Programas (Ativos CRUD, tabs, confirm-delete, modal keeps open)`.

---

## Task 6: Programas — Pendentes/Rejeitados + Revisar (cascade)

**Files:** Modify `sources/AdminSources.tsx`, `discovery/AdminDiscovery.tsx`, `discovery/discovery.css`; Create `sources/RejectDialog.tsx`; Test `sources/AdminSources.discovery.test.tsx`.

**Interfaces (Consumes):** `useSourceCandidates`, `useCandidateSubtree`, `useRejectCandidate`, `useReconsiderCandidate`, `CandidateTree`, `useNavigate`/`useSearchParams`.

- [ ] **Step 1: Teste (red).** Create `sources/AdminSources.discovery.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
const reject = vi.fn(); const reconsider = vi.fn(); const navigate = vi.fn()
vi.mock('react-router-dom', async (o) => ({ ...(await o<any>()), useNavigate: () => navigate }))
vi.mock('./useAdminSources', () => ({ useAdminSources: () => ({ data: [], isLoading: false, error: null }), useSaveSource: () => ({ mutateAsync: vi.fn(), isPending: false }), useDeleteSource: () => ({ mutateAsync: vi.fn(), isPending: false }) }))
const pendRow = { id: 'c1', fingerprint: 'fp1', entity_type: 'source', review_status: 'pending', rejection_reason: null, provenance: { source_url: 'https://nubank.com.br' }, payload: { name: 'Nubank' }, created_at: new Date().toISOString() }
vi.mock('../discovery/useSourceCandidates', () => ({
  useSourceCandidates: (s: string) => ({ data: s === 'pending' ? [pendRow] : [{ ...pendRow, review_status: 'rejected', rejection_reason: 'fora de escopo' }], isLoading: false, error: null }),
  useCandidateSubtree: () => ({ data: [], isLoading: false }),
}))
vi.mock('../discovery/useDiscovery', () => ({ useRejectCandidate: () => ({ mutate: reject }), useReconsiderCandidate: () => ({ mutate: reconsider }) }))
import { AdminSources } from './AdminSources'
beforeEach(() => { reject.mockClear(); reconsider.mockClear(); navigate.mockClear() })
describe('AdminSources — discovery', () => {
  it('Pendentes: Revisar navega ao cascade por fingerprint', () => {
    render(<MemoryRouter><AdminSources /></MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: /pendentes/i }))
    fireEvent.click(screen.getByRole('button', { name: /revisar/i }))
    expect(navigate).toHaveBeenCalledWith('/admin/discovery?fp=fp1')
  })
  it('Rejeitar grava motivo; Reconsiderar na aba Rejeitados', () => {
    render(<MemoryRouter><AdminSources /></MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: /pendentes/i }))
    fireEvent.click(screen.getByRole('button', { name: /rejeitar/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /motivo/i }), { target: { value: 'spam' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar rejei/i }))
    expect(reject).toHaveBeenCalledWith({ candidateId: 'c1', reason: 'spam' })
  })
})
```
Run → FAIL.

- [ ] **Step 2: Abas Pendentes/Rejeitados.** Na `AdminSources`, para `tab==='pending'|'rejected'`:
  - Se `useSourceCandidates(tab).error` → `<PageState title="Discovery indisponível" />` (D13, não quebra).
  - `<AdminList ariaLabel={...} rows={cands} keyOf={c=>c.id} renderRow={c => (<><span className="aa-name">{c.payload.name ?? c.fingerprint}</span><span className="aa-robo">{hostOf(c.provenance.source_url)} · visto há {relTime(c.created_at)}{c.provenance.verification_status ? <span className="pill">{c.provenance.verification_status}</span> : null}</span><span className="aa-act">{tab==='pending' ? (<><button onClick={()=>navigate(`/admin/discovery?fp=${c.fingerprint}`)}>Revisar</button><button onClick={()=>setRejecting(c.id)}>Rejeitar</button></>) : (<><span className="aa-reason">{c.rejection_reason}</span><button onClick={()=>reconsider.mutate({candidateId:c.id})}>Reconsiderar</button></>)}</span></>)} />`
  - `hostOf`/`relTime` = helpers locais puros (com teste unitário simples).
  - `<RejectDialog open={!!rejecting} onClose={()=>setRejecting(null)} onConfirm={(reason)=>{ reject.mutate({candidateId:rejecting!, reason}); setRejecting(null) }} />`.

- [ ] **Step 3: RejectDialog.** Create `sources/RejectDialog.tsx`: `AdminSheet` (closeOnBackdrop true) com `<label>Motivo<textarea aria-label="Motivo" .../></label>` e `<Button className="danger" onClick={()=>onConfirm(reason)}>Confirmar rejeição</Button>` + Cancelar.

- [ ] **Step 4: Drill-in cascade.** Em `AdminDiscovery.tsx`: `const [params] = useSearchParams(); const fp = params.get('fp')`. Se `fp`: `const sub = useCandidateSubtree(fp)`; renderizar `<CandidateTree candidates={sub.data ?? []} onPromote={(id)=>promote.mutate(id)} onReject={(id)=>reject.mutate({candidateId:id, reason:''})} />` (promote = `usePromoteCandidate(null)` — já invalida `candidate_subtree` após o fix da Task 1; reject = `useRejectCandidate()`). Sem `fp`: fluxo de jobs atual (inalterado). Reconciliar `discovery.css`: trocar `@container (min-width: 720px)` por `760px`.

- [ ] **Step 5: Build + commit.** Run: `npx vitest run src/features/admin && npm run build`. Commit `feat(admin): Programas Pendentes/Rejeitados wired to discovery + cascade drill-in`.

---

## Task 7: Benefícios

**Files:** Modify `benefits/AdminBenefits.tsx`, `benefits/BenefitForm.tsx`, `benefits/BenefitLocationsEditor.tsx`, `admin.css`; Test `benefits/AdminBenefits.test.tsx`.

- [ ] **Step 1: Teste (red).** Reescrever `benefits/AdminBenefits.test.tsx` mockando `useAdminBenefits` com uma linha `{ id:'b1', title:'Sala VIP', category:'airport', benefit_source:'issuer', created_at:<recente>, benefit_sources:[{ source_item_id:'i1', source_items:{ sources:{ name:'Nubank' } } }], benefit_locations:[], active:true, ... }` e `useAdminSources` vazio; afirmar: título visível; badge "novo" presente (created_at<14d, `vi.setSystemTime`); pill origem "Emissor" (`benefit_source==='issuer'`); texto "Nubank" (fonte); busca por título filtra; Remover abre `ConfirmDelete`. Run → FAIL.

- [ ] **Step 2: Implementar AdminBenefits.** Reescrever com casca do mockup:
```tsx
const BENEFIT_SOURCE_LABEL = { issuer: 'Emissor', card_network: 'Bandeira', partner: 'Parceiro', mixed: 'Misto' } as const
const BENEFIT_SOURCE_CLS = { issuer: 'iss', card_network: 'brand', partner: 'part', mixed: 'mixed' } as const
const isNew = (createdAt: string) => Date.now() - new Date(createdAt).getTime() < 14 * 86_400_000
const fonteNames = (b: BenefitRow) => b.benefit_sources.map((s) => s.source_items?.sources?.name).filter(Boolean).join(', ')
// state: query (busca), cat (chip), editing, confirmId
// toolbar: <Input className="aa-search" placeholder="Buscar benefício" value={query} onChange=… /> + <div className="chips">{CATEGORIES...Chip}</div>
// filtro client-side por title.includes(query) e category===cat (se cat)
// <AdminList ariaLabel="Benefícios" rows={filtered} keyOf={b=>b.id} renderRow={b => (
//   <><span className="aa-name">{b.title}{isNew(b.created_at) && <span className="new">novo</span>}</span>
//   <span className="aa-meta"><span className="tag">{categoryLabel(b.category)}</span>
//   {b.benefit_source && <span className={`pill ${BENEFIT_SOURCE_CLS[b.benefit_source]}`}>{BENEFIT_SOURCE_LABEL[b.benefit_source]}</span>}
//   <span className="aa-fonte">{fonteNames(b)}</span></span>
//   <span className="aa-act"><button aria-label={`editar ${b.title}`} onClick={()=>setEditing(b)}>Editar</button>
//   <button aria-label={`remover ${b.title}`} onClick={()=>setConfirmId(b.id)}>Remover</button></span></>)} />
// <ConfirmDelete .../> e <AdminSheet open={!!editing} closeOnBackdrop={false} wide title=…><BenefitForm .../></AdminSheet>
```
`categoryLabel` reusa `CATEGORIES` de `benefits/types`. `.pill.mixed` novo no `admin.css`: `.pill.mixed { color: var(--muted); background: color-mix(in srgb, var(--muted) 14%, var(--surface)); }` (D6 — estilo neutro pro Misto).

- [ ] **Step 3: BenefitForm no modal + progressive disclosure + anti-duplo-submit.** Reestilizar `BenefitForm.tsx` (inputs → `.input`/`.aa-fieldlbl`/`.aa-select`, sem utilitários Tailwind); mover scope/uf/steps/valid_until/image/action/`BenefitLocationsEditor` pra `<details className="aa-more"><summary>Mais opções</summary>…</details>`; manter `BenefitSourcesEditor` visível; botão Salvar `disabled` enquanto `isPending` (anti duplo-submit); exibir erro de mutation via `<p role="alert">`. Modal permanece aberto pós-criação como na Task 5 (D7): `AdminBenefits.onSubmit` faz `savedId = await save.mutateAsync(...)`, salva os vínculos/ locais, e `setEditing({ id: savedId })` resolvendo a row completa da lista reinvalidada. `BenefitLocationsEditor`: remoção de local vira confirm inline leve (D11).

- [ ] **Step 4: Build + commit.** Run: `npx vitest run src/features/admin/benefits && npm run build`. Commit `feat(admin): reskin Benefícios (list, toolbar, origem/fonte/novo, modal form)`.

---

## Task 8: Gate visual Playwright do admin + global-setup

**Files:** Modify `playwright.config.ts`, `tests/e2e/app-layout.spec.ts` (extrair helper); Create `tests/e2e/helpers.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/admin.helpers.ts`, `tests/e2e/admin-layout.spec.ts`.

- [ ] **Step 1: Extrair helper compartilhado.** Create `tests/e2e/helpers.ts`:
```ts
import { expect, type Page } from '@playwright/test'
export async function assertNoHorizontalOverflow(page: Page) {
  const d = await page.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }))
  expect(d.s).toBeLessThanOrEqual(d.c)
}
```
Em `tests/e2e/app-layout.spec.ts`, remover a função local e `import { assertNoHorizontalOverflow } from './helpers'`.

- [ ] **Step 2: global-setup idempotente (fix Codex #7).** Create `tests/e2e/global-setup.ts`:
```ts
import { config } from 'dotenv'
config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
export const ADMIN_EMAIL = 'admin-e2e@test.dev'
export const ADMIN_PASSWORD = 'admin-e2e-123'
export default async function globalSetup() {
  const url = process.env.VITE_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !service) throw new Error('global-setup: VITE_SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes (.env.local)')
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } })
  const created = await admin.auth.admin.createUser({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, email_confirm: true })
  let id = created.data?.user?.id
  if (!id) {
    if (created.error && !/already been registered|already exists/i.test(created.error.message)) throw created.error
    // já existe: pagina até achar
    for (let page = 1; !id && page <= 20; page += 1) {
      const list = await admin.auth.admin.listUsers({ page, perPage: 200 })
      if (list.error) throw list.error
      id = list.data.users.find((u) => u.email === ADMIN_EMAIL)?.id
      if (list.data.users.length < 200) break
    }
  }
  if (!id) throw new Error('global-setup: não foi possível resolver o usuário admin')
  const upd = await admin.from('profiles').update({ is_admin: true }).eq('id', id)
  if (upd.error) throw upd.error
}
```
Em `playwright.config.ts`: adicionar `globalSetup: './tests/e2e/global-setup.ts'`.

- [ ] **Step 3: login helper.** Create `tests/e2e/admin.helpers.ts`:
```ts
import { expect, type Page } from '@playwright/test'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './global-setup'
export async function loginAdmin(page: Page) {
  await page.goto('/admin/login')
  await page.getByRole('textbox', { name: /e-mail/i }).fill(ADMIN_EMAIL)
  await page.locator('input[type="password"]').fill(ADMIN_PASSWORD)
  await page.getByRole('button', { name: /entrar/i }).click()
  await expect(page).toHaveURL(/\/admin$/, { timeout: 10_000 })
}
```

- [ ] **Step 4: Spec e2e.** Create `tests/e2e/admin-layout.spec.ts` reusando o `beforeEach` de tema do `app-layout.spec.ts`: login → `/admin` (StatGrid visível, sem overflow); `/admin/sources` (3 tabs `role="tab"`; desktop `.aa-side` visível + `.aa-tabbar` oculta; mobile o inverso); abrir "Novo programa" → `dialog[open]` visível, `page.keyboard.press('Escape')` fecha (D12); `/admin/benefits` (toolbar + lista); `/admin/discovery`. `assertNoHorizontalOverflow` + screenshot por tela. (Ver `app-layout.spec.ts` para o padrão dos 4 projetos.)

- [ ] **Step 5: Rodar o gate.** Run: `npx -y supabase@2.95.0 db reset` (garante admin+seed limpos) e `npm run test:visual`. Expected: todos os cenários (app + admin) PASS nos 4 projetos, sem overflow.

- [ ] **Step 6: Commit.** `git add playwright.config.ts tests/e2e/ && git commit -m "test(admin): e2e visual gate + idempotent admin global-setup across 4 projects"`

---

## Notas de execução
- **Ordem obrigatória:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8. Cada task fecha com build verde isolado.
- **Cada task roda `npm run build`** (único type-check).
- **`supabase db reset`** entre execuções se testes de integração poluírem o catálogo local.
- **Migrations 0014–0017** entram em prod só no deploy `develop→main` (D13) — fora do escopo deste plano; UI degrada com graça se ausentes.
- **Cobertura D1–D14:** D1/D2/D3/D5 (T1+T6), D4 (T1+T6), D6 (T1+T7, incl. `.pill.mixed`), D7 (T5+T7), D8 (T1+T4+T7), D9 (T3 CSS concreto), D10 (T2 AdminSheet+AdminNav próprio), D11 (T2 ConfirmDelete + confirm inline em T5/T7), D12 (T8 Playwright + polyfill T1), D13 (degradação em T3/T5/T6), D14 (T1 tokens).
