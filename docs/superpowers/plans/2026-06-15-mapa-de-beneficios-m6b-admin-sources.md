# Mapa de Benefícios M6b — Admin de Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status de execução (auditado em 2026-07-10):** implementação concluída no repositório (`28c31a9` a `7a97fd1`). CRUD de fontes e variantes está coberto por testes de componente e integração aprovados; produção não foi reauditada nesta rodada.

**Goal:** O admin cria/edita/remove fontes (`sources`), suas variantes (`source_items`) e os campos de alinhamento Pluggy, com upload de logo — substituindo o seed por curadoria real.

**Architecture:** Rota `/admin/sources` sob o `AdminGuard`+`AdminLayout` (M6a). Hooks TanStack Query usando a sessão autenticada do admin (RLS já permite escrita só admin, M1). Fonte e variantes são operações separadas (CRUD por linha) — sem transação aninhada. Logo via `ImageUpload` (M6a).

**Tech Stack:** React 18, TS, Vite, Tailwind, TanStack Query, React Router, Supabase, Vitest + Testing Library.

**Pré-requisitos:** M6a na `main` (admin auth/guard/layout/rotas, `ImageUpload`/`uploadAsset`, bucket `assets`). `tests/helpers/clients.ts` tem `adminClient` (cliente autenticado como admin), `userClient`. Tipos do schema em `src/lib/database.types.ts` (com campos Pluggy do 0007).

**Referência:** spec `docs/superpowers/specs/2026-06-15-mapa-de-beneficios-m6-admin-design.md`.

---

## Estrutura de arquivos (M6b)

```
src/features/admin/sources/types.ts                 # CRIA: tipos de form
src/features/admin/sources/useAdminSources.ts       # CRIA: list + mutations de sources
src/features/admin/sources/useSourceItems.ts        # CRIA: mutations de source_items
src/features/admin/sources/SourceForm.tsx (+test)   # CRIA: form de fonte
src/features/admin/sources/SourceItemsEditor.tsx (+test) # CRIA: editor de variantes
src/features/admin/sources/AdminSources.tsx (+test) # CRIA: página (lista + form)
src/router.tsx                                       # MODIFICA: rota /admin/sources
tests/admin_sources.integration.test.ts             # CRIA: CRUD admin via RLS
```

---

## Task 1: Integração — CRUD de sources/source_items sob RLS admin

**Files:**
- Create: `tests/admin_sources.integration.test.ts`

- [ ] **Step 1: Teste de integração (admin CRUD; não-admin negado)**

Create `tests/admin_sources.integration.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { adminClient, userClient } from './helpers/clients'

describe('admin sources CRUD (RLS)', () => {
  it('admin cria/edita fonte + variante com campos Pluggy; remove', async () => {
    const { client: admin } = await adminClient()

    const { data: src, error: e1 } = await admin
      .from('sources')
      .insert({
        kind: 'card', name: 'Banco Teste', sort_order: 10, active: true,
        connector_type: 'PERSONAL_BANK', pluggy_connector_id: 123456,
        institution_url: 'https://bt.test', primary_color: '#123456',
      })
      .select()
      .single()
    expect(e1).toBeNull()
    expect(src!.country).toBe('BR')

    const { error: e2 } = await admin.from('sources').update({ name: 'Banco Teste 2' }).eq('id', src!.id)
    expect(e2).toBeNull()

    const { data: item, error: e3 } = await admin
      .from('source_items')
      .insert({
        source_id: src!.id, label: 'Black', sort_order: 1,
        card_brand: 'VISA', card_level: 'BLACK', pluggy_product: 'CREDIT_CARDS',
      })
      .select()
      .single()
    expect(e3).toBeNull()
    expect(item!.card_level).toBe('BLACK')

    await admin.from('sources').delete().eq('id', src!.id)
  })

  it('não-admin não consegue criar fonte', async () => {
    const { client: user } = await userClient()
    const { error } = await user.from('sources').insert({ kind: 'card', name: 'Hacker', sort_order: 1 })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Rodar — ver passar (valida RLS/colunas; sem código novo)**

Run: `npm test -- tests/admin_sources.integration.test.ts`
Expected: PASS (admin CRUD ok; não-admin negado). Confirma que a base + RLS + colunas Pluggy suportam o admin.

- [ ] **Step 3: Commit**

```bash
git add tests/admin_sources.integration.test.ts
git commit -m "test: integração CRUD de sources sob RLS admin"
```

---

## Task 2: Tipos + hooks de sources

**Files:**
- Create: `src/features/admin/sources/types.ts`, `useAdminSources.ts`, `useSourceItems.ts`

- [ ] **Step 1: Tipos de form**

Create `src/features/admin/sources/types.ts`:
```ts
import type { SourceKind } from '../../onboarding/types'

export interface SourceRow {
  id: string
  kind: SourceKind
  name: string
  logo_url: string | null
  sort_order: number
  active: boolean
  connector_type: string | null
  pluggy_connector_id: number | null
  institution_url: string | null
  primary_color: string | null
  country: string
  source_items: SourceItemRow[]
}

export interface SourceItemRow {
  id: string
  source_id: string
  label: string
  sort_order: number
  card_brand: string | null
  card_level: string | null
  pluggy_product: string | null
}

export type SourceInput = Omit<SourceRow, 'id' | 'source_items'>
export type SourceItemInput = Omit<SourceItemRow, 'id'>
```

- [ ] **Step 2: Hooks de sources `useAdminSources.ts`**

Create `src/features/admin/sources/useAdminSources.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import type { SourceInput, SourceRow } from './types'

const SELECT =
  'id, kind, name, logo_url, sort_order, active, connector_type, pluggy_connector_id, institution_url, primary_color, country, source_items(id, source_id, label, sort_order, card_brand, card_level, pluggy_product)'

export function useAdminSources() {
  return useQuery({
    queryKey: ['admin_sources'],
    queryFn: async (): Promise<SourceRow[]> => {
      const { data, error } = await supabase.from('sources').select(SELECT).order('sort_order')
      if (error) throw error
      return (data ?? []) as unknown as SourceRow[]
    },
  })
}

export function useSaveSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SourceInput & { id?: string }) => {
      const { id, ...fields } = input
      const q = id
        ? supabase.from('sources').update(fields).eq('id', id)
        : supabase.from('sources').insert(fields)
      const { data, error } = await q.select('id').single()
      if (error) throw error
      return data.id as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_sources'] })
      qc.invalidateQueries({ queryKey: ['sources'] })
    },
  })
}

export function useDeleteSource() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sources').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_sources'] })
      qc.invalidateQueries({ queryKey: ['sources'] })
    },
  })
}
```

- [ ] **Step 3: Hooks de source_items `useSourceItems.ts`**

Create `src/features/admin/sources/useSourceItems.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import type { SourceItemInput } from './types'

export function useSaveSourceItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SourceItemInput & { id?: string }) => {
      const { id, ...fields } = input
      const q = id
        ? supabase.from('source_items').update(fields).eq('id', id)
        : supabase.from('source_items').insert(fields)
      const { error } = await q
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_sources'] })
      qc.invalidateQueries({ queryKey: ['sources'] })
    },
  })
}

export function useDeleteSourceItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('source_items').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_sources'] })
      qc.invalidateQueries({ queryKey: ['sources'] })
    },
  })
}
```

- [ ] **Step 4: Scoped typecheck + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "admin/sources/(types|useAdminSources|useSourceItems)" || echo "sem erros"`.
```bash
git add src/features/admin/sources/types.ts src/features/admin/sources/useAdminSources.ts src/features/admin/sources/useSourceItems.ts
git commit -m "feat: hooks admin de sources e source_items"
```

---

## Task 3: SourceForm (formulário da fonte)

**Files:**
- Create: `src/features/admin/sources/SourceForm.tsx` (+ `.test.tsx`)

- [ ] **Step 1: Teste do SourceForm (falha)**

Create `src/features/admin/sources/SourceForm.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
vi.mock('../upload/ImageUpload', () => ({
  ImageUpload: ({ onChange }: { onChange: (u: string) => void }) => (
    <button type="button" onClick={() => onChange('https://cdn.test/logo.png')}>mock-upload</button>
  ),
}))
import { SourceForm } from './SourceForm'

describe('SourceForm', () => {
  it('preenche e submete os campos (inclui Pluggy + logo)', () => {
    const onSubmit = vi.fn()
    render(<SourceForm initial={null} onSubmit={onSubmit} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Itaú' } })
    fireEvent.change(screen.getByLabelText(/tipo \(kind\)/i), { target: { value: 'card' } })
    fireEvent.change(screen.getByLabelText(/connector_type/i), { target: { value: 'PERSONAL_BANK' } })
    fireEvent.click(screen.getByRole('button', { name: /mock-upload/i }))
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Itaú', kind: 'card', connector_type: 'PERSONAL_BANK',
        logo_url: 'https://cdn.test/logo.png', country: 'BR', active: true,
      }),
    )
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**, depois implementar.

Create `src/features/admin/sources/SourceForm.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { ImageUpload } from '../upload/ImageUpload'
import type { SourceInput, SourceRow } from './types'
import type { SourceKind } from '../../onboarding/types'

const KINDS: SourceKind[] = ['card', 'carrier', 'loyalty', 'cpf']

export function SourceForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: SourceRow | null
  onSubmit: (input: SourceInput) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<SourceKind>(initial?.kind ?? 'card')
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0)
  const [active, setActive] = useState(initial?.active ?? true)
  const [logoUrl, setLogoUrl] = useState<string | null>(initial?.logo_url ?? null)
  const [connectorType, setConnectorType] = useState(initial?.connector_type ?? '')
  const [pluggyId, setPluggyId] = useState<string>(initial?.pluggy_connector_id?.toString() ?? '')
  const [institutionUrl, setInstitutionUrl] = useState(initial?.institution_url ?? '')
  const [primaryColor, setPrimaryColor] = useState(initial?.primary_color ?? '')
  const [country, setCountry] = useState(initial?.country ?? 'BR')

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      name,
      kind,
      sort_order: Number(sortOrder) || 0,
      active,
      logo_url: logoUrl,
      connector_type: connectorType || null,
      pluggy_connector_id: pluggyId ? Number(pluggyId) : null,
      institution_url: institutionUrl || null,
      primary_color: primaryColor || null,
      country: country || 'BR',
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
      <label className="text-sm font-medium" htmlFor="s-name">Nome</label>
      <input id="s-name" required value={name} onChange={(e) => setName(e.target.value)} className="rounded border px-2 py-1" />

      <label className="text-sm font-medium" htmlFor="s-kind">Tipo (kind)</label>
      <select id="s-kind" value={kind} onChange={(e) => setKind(e.target.value as SourceKind)} className="rounded border px-2 py-1">
        {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>

      <label className="text-sm font-medium" htmlFor="s-order">Ordem</label>
      <input id="s-order" type="number" value={sortOrder} onChange={(e) => setSortOrder(Number(e.target.value))} className="rounded border px-2 py-1" />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo
      </label>

      <span className="text-sm font-medium">Logo</span>
      <ImageUpload folder="sources" value={logoUrl} onChange={setLogoUrl} />

      <fieldset className="mt-2 rounded border border-slate-100 p-3">
        <legend className="text-xs text-slate-500">Open Finance / Pluggy</legend>
        <label className="text-sm font-medium" htmlFor="s-ct">connector_type</label>
        <input id="s-ct" value={connectorType} onChange={(e) => setConnectorType(e.target.value)} className="mb-2 w-full rounded border px-2 py-1" placeholder="PERSONAL_BANK / TELECOMMUNICATION / DIGITAL_ECONOMY" />
        <label className="text-sm font-medium" htmlFor="s-pid">pluggy_connector_id</label>
        <input id="s-pid" type="number" value={pluggyId} onChange={(e) => setPluggyId(e.target.value)} className="mb-2 w-full rounded border px-2 py-1" />
        <label className="text-sm font-medium" htmlFor="s-iu">institution_url</label>
        <input id="s-iu" value={institutionUrl} onChange={(e) => setInstitutionUrl(e.target.value)} className="mb-2 w-full rounded border px-2 py-1" />
        <label className="text-sm font-medium" htmlFor="s-pc">primary_color</label>
        <input id="s-pc" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="mb-2 w-full rounded border px-2 py-1" placeholder="#0f172a" />
        <label className="text-sm font-medium" htmlFor="s-country">country</label>
        <input id="s-country" value={country} onChange={(e) => setCountry(e.target.value)} className="w-full rounded border px-2 py-1" />
      </fieldset>

      <div className="mt-2 flex gap-2">
        <button type="submit" className="rounded bg-slate-800 px-4 py-2 text-white">Salvar</button>
        <button type="button" onClick={onCancel} className="rounded border px-4 py-2">Cancelar</button>
      </div>
    </form>
  )
}
```
Run `npm test -- src/features/admin/sources/SourceForm.test.tsx` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/admin/sources/SourceForm.tsx src/features/admin/sources/SourceForm.test.tsx
git commit -m "feat: SourceForm (campos da fonte + Pluggy + logo)"
```

---

## Task 4: SourceItemsEditor (variantes)

**Files:**
- Create: `src/features/admin/sources/SourceItemsEditor.tsx` (+ `.test.tsx`)

- [ ] **Step 1: Teste do editor (falha)**

Create `src/features/admin/sources/SourceItemsEditor.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const saveItem = vi.fn()
const deleteItem = vi.fn()
vi.mock('./useSourceItems', () => ({
  useSaveSourceItem: () => ({ mutateAsync: saveItem, isPending: false }),
  useDeleteSourceItem: () => ({ mutateAsync: deleteItem, isPending: false }),
}))

import { SourceItemsEditor } from './SourceItemsEditor'
import type { SourceItemRow } from './types'

const items: SourceItemRow[] = [
  { id: 'i1', source_id: 's1', label: 'Black', sort_order: 1, card_brand: 'VISA', card_level: 'BLACK', pluggy_product: 'CREDIT_CARDS' },
]

beforeEach(() => {
  saveItem.mockReset(); saveItem.mockResolvedValue(undefined)
  deleteItem.mockReset(); deleteItem.mockResolvedValue(undefined)
})

describe('SourceItemsEditor', () => {
  it('lista variantes e adiciona uma nova', async () => {
    render(<SourceItemsEditor sourceId="s1" items={items} />)
    expect(screen.getByText('Black')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/nova variante/i), { target: { value: 'Platinum' } })
    fireEvent.click(screen.getByRole('button', { name: /adicionar/i }))
    await waitFor(() => expect(saveItem).toHaveBeenCalledWith(expect.objectContaining({ source_id: 's1', label: 'Platinum' })))
  })

  it('remove uma variante', async () => {
    render(<SourceItemsEditor sourceId="s1" items={items} />)
    fireEvent.click(screen.getByRole('button', { name: /remover Black/i }))
    await waitFor(() => expect(deleteItem).toHaveBeenCalledWith('i1'))
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**, depois implementar.

Create `src/features/admin/sources/SourceItemsEditor.tsx`:
```tsx
import { useState } from 'react'
import { useSaveSourceItem, useDeleteSourceItem } from './useSourceItems'
import type { SourceItemRow } from './types'

export function SourceItemsEditor({ sourceId, items }: { sourceId: string; items: SourceItemRow[] }) {
  const save = useSaveSourceItem()
  const del = useDeleteSourceItem()
  const [label, setLabel] = useState('')
  const [brand, setBrand] = useState('')
  const [level, setLevel] = useState('')

  async function add() {
    if (!label.trim()) return
    await save.mutateAsync({
      source_id: sourceId,
      label: label.trim(),
      sort_order: items.length + 1,
      card_brand: brand || null,
      card_level: level || null,
      pluggy_product: null,
    })
    setLabel(''); setBrand(''); setLevel('')
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-100 p-3">
      <h3 className="mb-2 text-sm font-semibold">Variantes</h3>
      <ul className="flex flex-col gap-1">
        {items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1">{it.label}{it.card_level ? ` · ${it.card_brand ?? ''} ${it.card_level}` : ''}</span>
            <button type="button" aria-label={`remover ${it.label}`} onClick={() => del.mutateAsync(it.id)} className="text-red-600">×</button>
          </li>
        ))}
        {items.length === 0 && <li className="text-xs text-slate-400">Nenhuma variante.</li>}
      </ul>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs">Nova variante
          <input aria-label="nova variante" value={label} onChange={(e) => setLabel(e.target.value)} className="block rounded border px-2 py-1" />
        </label>
        <label className="text-xs">brand
          <input aria-label="card_brand" value={brand} onChange={(e) => setBrand(e.target.value)} className="block rounded border px-2 py-1" placeholder="VISA" />
        </label>
        <label className="text-xs">level
          <input aria-label="card_level" value={level} onChange={(e) => setLevel(e.target.value)} className="block rounded border px-2 py-1" placeholder="BLACK" />
        </label>
        <button type="button" onClick={add} className="rounded bg-slate-700 px-3 py-1 text-sm text-white">Adicionar</button>
      </div>
    </div>
  )
}
```
Run `npm test -- src/features/admin/sources/SourceItemsEditor.test.tsx` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/admin/sources/SourceItemsEditor.tsx src/features/admin/sources/SourceItemsEditor.test.tsx
git commit -m "feat: SourceItemsEditor (CRUD de variantes)"
```

---

## Task 5: Página AdminSources + rota + fechamento

**Files:**
- Create: `src/features/admin/sources/AdminSources.tsx` (+ `.test.tsx`)
- Modify: `src/router.tsx`

- [ ] **Step 1: Teste da página (falha)**

Create `src/features/admin/sources/AdminSources.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderWithProviders'
import type { SourceRow } from './types'

const saveSource = vi.fn()
vi.mock('./useAdminSources', () => ({
  useAdminSources: () => ({ data: sources, isLoading: false, error: null }),
  useSaveSource: () => ({ mutateAsync: saveSource, isPending: false }),
  useDeleteSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('./useSourceItems', () => ({
  useSaveSourceItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteSourceItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../upload/ImageUpload', () => ({ ImageUpload: () => <div>upload</div> }))

let sources: SourceRow[]
import { AdminSources } from './AdminSources'

beforeEach(() => {
  saveSource.mockReset(); saveSource.mockResolvedValue('new-id')
  sources = [
    { id: 's1', kind: 'card', name: 'Itaú', logo_url: null, sort_order: 1, active: true,
      connector_type: null, pluggy_connector_id: null, institution_url: null, primary_color: null, country: 'BR',
      source_items: [] },
  ]
})

describe('AdminSources', () => {
  it('lista as fontes', () => {
    renderWithProviders(<AdminSources />)
    expect(screen.getByText('Itaú')).toBeInTheDocument()
  })

  it('abre o form de nova fonte e salva', async () => {
    renderWithProviders(<AdminSources />)
    fireEvent.click(screen.getByRole('button', { name: /nova fonte/i }))
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Nubank' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => expect(saveSource).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nubank' })))
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**, depois implementar.

Create `src/features/admin/sources/AdminSources.tsx`:
```tsx
import { useState } from 'react'
import { useAdminSources, useSaveSource, useDeleteSource } from './useAdminSources'
import { SourceForm } from './SourceForm'
import { SourceItemsEditor } from './SourceItemsEditor'
import type { SourceInput, SourceRow } from './types'

export function AdminSources() {
  const { data, isLoading, error } = useAdminSources()
  const save = useSaveSource()
  const del = useDeleteSource()
  const [editing, setEditing] = useState<SourceRow | null | 'new'>(null)

  if (isLoading) return <p className="text-slate-500">Carregando…</p>
  if (error) return <p className="text-red-600">Erro ao carregar fontes.</p>

  async function onSubmit(input: SourceInput) {
    const current = editing
    const id = current && current !== 'new' ? current.id : undefined
    await save.mutateAsync({ ...input, id })
    setEditing(null)
  }

  if (editing) {
    const initial = editing === 'new' ? null : editing
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">{initial ? `Editar ${initial.name}` : 'Nova fonte'}</h1>
        <SourceForm initial={initial} onSubmit={onSubmit} onCancel={() => setEditing(null)} />
        {initial && <SourceItemsEditor sourceId={initial.id} items={initial.source_items} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Fontes</h1>
        <button type="button" onClick={() => setEditing('new')} className="rounded bg-slate-800 px-3 py-2 text-sm text-white">Nova fonte</button>
      </div>
      <ul className="flex flex-col gap-2">
        {(data ?? []).map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <span className="flex-1">{s.name} <span className="text-xs text-slate-400">({s.kind}{s.active ? '' : ' · inativo'})</span></span>
            <button type="button" onClick={() => setEditing(s)} className="text-sm text-slate-600">Editar</button>
            <button type="button" aria-label={`remover ${s.name}`} onClick={() => del.mutateAsync(s.id)} className="text-sm text-red-600">Remover</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```
Run `npm test -- src/features/admin/sources/AdminSources.test.tsx` → PASS (2).

- [ ] **Step 3: Wire a rota em `src/router.tsx`**

Add import:
```tsx
import { AdminSources } from './features/admin/sources/AdminSources'
```
Dentro do grupo `AdminGuard → AdminLayout` children (junto de `{ path: '/admin', element: <AdminHome /> }`), adicione:
```tsx
          { path: '/admin/sources', element: <AdminSources /> },
```

- [ ] **Step 4: Build + suíte**

Run: `npm run build` (PASS), `npm test` (tudo verde).

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/sources/AdminSources.tsx src/features/admin/sources/AdminSources.test.tsx src/router.tsx
git commit -m "feat: página AdminSources (lista + form + variantes) e rota /admin/sources"
```

---

## Definition of Done (M6b)

- [ ] `npm test` inteiro verde (integração CRUD sources + componentes form/editor/página).
- [ ] `npm run build` compila com `/admin/sources`.
- [ ] Admin lista/cria/edita/remove fontes e variantes, com campos Pluggy e upload de logo.
- [ ] Não-admin é negado (RLS) — testado.
- [ ] Invalidação atualiza tanto `['admin_sources']` quanto `['sources']` (catálogo do app).

**Pós-merge:** push (auto-deploy). **Próximo:** M6c (admin de Benefits + benefit_sources + benefit_locations).
```
