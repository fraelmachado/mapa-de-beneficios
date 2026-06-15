# Benefy M6c — Admin de Benefits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O admin cria/edita/remove benefícios com todos os campos, define quais variantes (`source_items`) destravam cada um (`benefit_sources`) e gerencia os locais (`benefit_locations`), com upload de banner.

**Architecture:** Rota `/admin/benefits` sob `AdminGuard`+`AdminLayout`. Hooks TanStack Query com a sessão admin (RLS M1). O vínculo benefício↔variantes é editado como multi-select no form e salvo por "replace" (delete+insert). Locais são CRUD por linha (só em benefício existente). Reusa `useAdminSources` (M6b) pra montar o seletor de variantes e `ImageUpload` (M6a) pro banner.

**Tech Stack:** React 18, TS, Vite, Tailwind, TanStack Query, React Router, Supabase, Vitest + Testing Library.

**Pré-requisitos:** M6a + M6b na `main`. `src/features/benefits/types.ts` exporta `BenefitCategory`. `src/features/admin/sources/useAdminSources.ts` exporta `useAdminSources` (sources com source_items). `ImageUpload` em `src/features/admin/upload/ImageUpload.tsx`. Test helpers `adminClient`/`userClient`.

**Referência:** spec `docs/superpowers/specs/2026-06-15-benefy-m6-admin-design.md`.

---

## Estrutura de arquivos (M6c)

```
src/features/admin/benefits/types.ts                    # CRIA
src/features/admin/benefits/useAdminBenefits.ts         # CRIA: list + save + delete
src/features/admin/benefits/useBenefitSources.ts        # CRIA: replace do vínculo
src/features/admin/benefits/useBenefitLocations.ts      # CRIA: save/delete locais
src/features/admin/benefits/BenefitSourcesEditor.tsx (+test)   # CRIA: multi-select
src/features/admin/benefits/BenefitForm.tsx (+test)     # CRIA: form (campos + banner + vínculo)
src/features/admin/benefits/BenefitLocationsEditor.tsx (+test) # CRIA: geo
src/features/admin/benefits/AdminBenefits.tsx (+test)   # CRIA: página
src/router.tsx                                           # MODIFICA: rota /admin/benefits
tests/admin_benefits.integration.test.ts                # CRIA
```

---

## Task 1: Integração — CRUD benefits + benefit_sources + benefit_locations (RLS)

**Files:**
- Create: `tests/admin_benefits.integration.test.ts`

- [ ] **Step 1: Teste de integração**

Create `tests/admin_benefits.integration.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { adminClient, userClient } from './helpers/clients'

describe('admin benefits CRUD (RLS)', () => {
  it('admin cria benefício, vincula variante (via seed) e adiciona local; remove', async () => {
    const { client: admin } = await adminClient()
    const BLACK = 'aaaaaaa1-0000-0000-0000-000000000001' // Itaú Black do seed

    const { data: ben, error: e1 } = await admin
      .from('benefits')
      .insert({ title: 'Benefício Admin', summary: 's', category: 'compras', scope: 'nacional' })
      .select()
      .single()
    expect(e1).toBeNull()

    const { error: e2 } = await admin
      .from('benefit_sources')
      .insert({ benefit_id: ben!.id, source_item_id: BLACK })
    expect(e2).toBeNull()

    const { error: e3 } = await admin.from('benefit_locations').insert({
      benefit_id: ben!.id, name: 'Loja Centro', lat: -23.5, lng: -46.6, city: 'SP', uf: 'SP',
    })
    expect(e3).toBeNull()

    await admin.from('benefits').delete().eq('id', ben!.id)
  })

  it('não-admin não cria benefício', async () => {
    const { client: user } = await userClient()
    const { error } = await user.from('benefits').insert({ title: 'x', summary: 'y', category: 'compras' })
    expect(error).not.toBeNull()
  })
})
```

- [ ] **Step 2: Rodar — ver passar**

Run: `npm test -- tests/admin_benefits.integration.test.ts`
Expected: PASS (admin CRUD do benefício + vínculo + local; não-admin negado).

- [ ] **Step 3: Commit**

```bash
git add tests/admin_benefits.integration.test.ts
git commit -m "test: integração CRUD de benefits/benefit_sources/locations sob RLS admin"
```

---

## Task 2: Tipos + hooks

**Files:**
- Create: `src/features/admin/benefits/types.ts`, `useAdminBenefits.ts`, `useBenefitSources.ts`, `useBenefitLocations.ts`

- [ ] **Step 1: Tipos**

Create `src/features/admin/benefits/types.ts`:
```ts
import type { BenefitCategory } from '../../benefits/types'

export type BenefitScope = 'nacional' | 'regional' | 'pontual'

export interface BenefitLocationRow {
  id: string
  benefit_id: string
  name: string
  lat: number
  lng: number
  address: string | null
  city: string | null
  uf: string | null
  radius_m: number | null
  active: boolean
}

export interface BenefitRow {
  id: string
  title: string
  summary: string
  category: BenefitCategory
  scope: BenefitScope
  uf: string | null
  steps: string | null
  partner_name: string | null
  valid_until: string | null
  image_url: string | null
  action_url: string | null
  action_label: string | null
  active: boolean
  benefit_sources: { source_item_id: string }[]
  benefit_locations: BenefitLocationRow[]
}

export type BenefitInput = Omit<BenefitRow, 'id' | 'benefit_sources' | 'benefit_locations'>
export type BenefitLocationInput = Omit<BenefitLocationRow, 'id'>
```

- [ ] **Step 2: `useAdminBenefits.ts`**

Create `src/features/admin/benefits/useAdminBenefits.ts`:
```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import type { BenefitInput, BenefitRow } from './types'

const SELECT =
  'id, title, summary, category, scope, uf, steps, partner_name, valid_until, image_url, action_url, action_label, active, benefit_sources(source_item_id), benefit_locations(id, benefit_id, name, lat, lng, address, city, uf, radius_m, active)'

export function useAdminBenefits() {
  return useQuery({
    queryKey: ['admin_benefits'],
    queryFn: async (): Promise<BenefitRow[]> => {
      const { data, error } = await supabase.from('benefits').select(SELECT).order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as BenefitRow[]
    },
  })
}

export function useSaveBenefit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: BenefitInput & { id?: string }) => {
      const { id, ...fields } = input
      const q = id
        ? supabase.from('benefits').update(fields as never).eq('id', id)
        : supabase.from('benefits').insert(fields as never)
      const { data, error } = await q.select('id').single()
      if (error) throw error
      return (data as { id: string }).id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_benefits'] })
      qc.invalidateQueries({ queryKey: ['my_benefits'] })
    },
  })
}

export function useDeleteBenefit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('benefits').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_benefits'] })
      qc.invalidateQueries({ queryKey: ['my_benefits'] })
    },
  })
}
```

- [ ] **Step 3: `useBenefitSources.ts` (replace do vínculo)**

Create `src/features/admin/benefits/useBenefitSources.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'

// Substitui o conjunto de variantes que destravam um benefício.
export function useSaveBenefitSources() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ benefitId, sourceItemIds }: { benefitId: string; sourceItemIds: string[] }) => {
      const del = await supabase.from('benefit_sources').delete().eq('benefit_id', benefitId)
      if (del.error) throw del.error
      if (sourceItemIds.length) {
        const rows = sourceItemIds.map((source_item_id) => ({ benefit_id: benefitId, source_item_id }))
        const { error } = await supabase.from('benefit_sources').insert(rows)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_benefits'] })
      qc.invalidateQueries({ queryKey: ['my_benefits'] })
    },
  })
}
```

- [ ] **Step 4: `useBenefitLocations.ts`**

Create `src/features/admin/benefits/useBenefitLocations.ts`:
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import type { BenefitLocationInput } from './types'

export function useSaveBenefitLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: BenefitLocationInput & { id?: string }) => {
      const { id, ...fields } = input
      const q = id
        ? supabase.from('benefit_locations').update(fields as never).eq('id', id)
        : supabase.from('benefit_locations').insert(fields as never)
      const { error } = await q
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin_benefits'] }),
  })
}

export function useDeleteBenefitLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('benefit_locations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin_benefits'] }),
  })
}
```

- [ ] **Step 5: Scoped typecheck + commit**

Run: `npx tsc --noEmit 2>&1 | grep -iE "admin/benefits/(types|useAdminBenefits|useBenefitSources|useBenefitLocations)" || echo "sem erros"`.
```bash
git add src/features/admin/benefits/types.ts src/features/admin/benefits/useAdminBenefits.ts src/features/admin/benefits/useBenefitSources.ts src/features/admin/benefits/useBenefitLocations.ts
git commit -m "feat: hooks admin de benefits, vínculo e locais"
```

---

## Task 3: BenefitSourcesEditor (multi-select de variantes)

**Files:**
- Create: `src/features/admin/benefits/BenefitSourcesEditor.tsx` (+ `.test.tsx`)

- [ ] **Step 1: Teste (falha)**

Create `src/features/admin/benefits/BenefitSourcesEditor.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BenefitSourcesEditor } from './BenefitSourcesEditor'
import type { SourceRow } from '../sources/types'

const sources: SourceRow[] = [
  { id: 's1', kind: 'card', name: 'Itaú', logo_url: null, sort_order: 1, active: true,
    connector_type: null, pluggy_connector_id: null, institution_url: null, primary_color: null, country: 'BR',
    source_items: [
      { id: 'i1', source_id: 's1', label: 'Black', sort_order: 1, card_brand: null, card_level: null, pluggy_product: null },
      { id: 'i2', source_id: 's1', label: 'Platinum', sort_order: 2, card_brand: null, card_level: null, pluggy_product: null },
    ] },
]

describe('BenefitSourcesEditor', () => {
  it('marca/desmarca variantes e chama onChange', () => {
    const onChange = vi.fn()
    render(<BenefitSourcesEditor sources={sources} selected={['i1']} onChange={onChange} />)
    // i1 já marcado
    const black = screen.getByRole('checkbox', { name: /black/i })
    expect(black).toBeChecked()
    // marca Platinum
    fireEvent.click(screen.getByRole('checkbox', { name: /platinum/i }))
    expect(onChange).toHaveBeenCalledWith(['i1', 'i2'])
    // desmarca Black
    fireEvent.click(black)
    expect(onChange).toHaveBeenCalledWith([])
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**, depois implementar.

Create `src/features/admin/benefits/BenefitSourcesEditor.tsx`:
```tsx
import type { SourceRow } from '../sources/types'

export function BenefitSourcesEditor({
  sources,
  selected,
  onChange,
}: {
  sources: SourceRow[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(itemId: string) {
    onChange(selected.includes(itemId) ? selected.filter((i) => i !== itemId) : [...selected, itemId])
  }
  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <h3 className="mb-2 text-sm font-semibold">Destravado por (variantes)</h3>
      <div className="flex flex-col gap-3">
        {sources.map((s) => (
          <div key={s.id}>
            <p className="text-xs font-medium text-slate-500">{s.name}</p>
            <div className="flex flex-wrap gap-3">
              {s.source_items.map((it) => (
                <label key={it.id} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    aria-label={it.label}
                    checked={selected.includes(it.id)}
                    onChange={() => toggle(it.id)}
                  />
                  {it.label}
                </label>
              ))}
            </div>
          </div>
        ))}
        {sources.length === 0 && <p className="text-xs text-slate-400">Sem fontes cadastradas.</p>}
      </div>
    </div>
  )
}
```
Run `npm test -- src/features/admin/benefits/BenefitSourcesEditor.test.tsx` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/admin/benefits/BenefitSourcesEditor.tsx src/features/admin/benefits/BenefitSourcesEditor.test.tsx
git commit -m "feat: BenefitSourcesEditor (multi-select de variantes)"
```

---

## Task 4: BenefitForm

**Files:**
- Create: `src/features/admin/benefits/BenefitForm.tsx` (+ `.test.tsx`)

- [ ] **Step 1: Teste (falha)**

Create `src/features/admin/benefits/BenefitForm.test.tsx`:
```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
vi.mock('../upload/ImageUpload', () => ({
  ImageUpload: ({ onChange }: { onChange: (u: string) => void }) => (
    <button type="button" onClick={() => onChange('https://cdn.test/banner.png')}>mock-upload</button>
  ),
}))
import { BenefitForm } from './BenefitForm'
import type { SourceRow } from '../sources/types'

const sources: SourceRow[] = [
  { id: 's1', kind: 'card', name: 'Itaú', logo_url: null, sort_order: 1, active: true,
    connector_type: null, pluggy_connector_id: null, institution_url: null, primary_color: null, country: 'BR',
    source_items: [{ id: 'i1', source_id: 's1', label: 'Black', sort_order: 1, card_brand: null, card_level: null, pluggy_product: null }] },
]

describe('BenefitForm', () => {
  it('preenche, seleciona variante e submete', () => {
    const onSubmit = vi.fn()
    render(<BenefitForm initial={null} sources={sources} onSubmit={onSubmit} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Sala VIP' } })
    fireEvent.change(screen.getByLabelText(/resumo/i), { target: { value: 'Acesso grátis' } })
    fireEvent.change(screen.getByLabelText(/categoria/i), { target: { value: 'viagem' } })
    fireEvent.click(screen.getByRole('button', { name: /mock-upload/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /black/i }))
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ title: 'Sala VIP', summary: 'Acesso grátis', category: 'viagem', image_url: 'https://cdn.test/banner.png', active: true }),
        sourceItemIds: ['i1'],
      }),
    )
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**, depois implementar.

Create `src/features/admin/benefits/BenefitForm.tsx`:
```tsx
import { useState, type FormEvent } from 'react'
import { ImageUpload } from '../upload/ImageUpload'
import { BenefitSourcesEditor } from './BenefitSourcesEditor'
import { CATEGORIES, type BenefitCategory } from '../../benefits/types'
import type { SourceRow } from '../sources/types'
import type { BenefitInput, BenefitRow, BenefitScope } from './types'

const SCOPES: BenefitScope[] = ['nacional', 'regional', 'pontual']

export function BenefitForm({
  initial,
  sources,
  onSubmit,
  onCancel,
}: {
  initial: BenefitRow | null
  sources: SourceRow[]
  onSubmit: (payload: { input: BenefitInput; sourceItemIds: string[] }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [category, setCategory] = useState<BenefitCategory>(initial?.category ?? 'compras')
  const [scope, setScope] = useState<BenefitScope>(initial?.scope ?? 'nacional')
  const [uf, setUf] = useState(initial?.uf ?? '')
  const [steps, setSteps] = useState(initial?.steps ?? '')
  const [partner, setPartner] = useState(initial?.partner_name ?? '')
  const [validUntil, setValidUntil] = useState(initial?.valid_until ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null)
  const [actionUrl, setActionUrl] = useState(initial?.action_url ?? '')
  const [actionLabel, setActionLabel] = useState(initial?.action_label ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [sourceItemIds, setSourceItemIds] = useState<string[]>(
    initial?.benefit_sources.map((b) => b.source_item_id) ?? [],
  )

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      input: {
        title,
        summary,
        category,
        scope,
        uf: uf || null,
        steps: steps || null,
        partner_name: partner || null,
        valid_until: validUntil || null,
        image_url: imageUrl,
        action_url: actionUrl || null,
        action_label: actionLabel || null,
        active,
      },
      sourceItemIds,
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
      <label className="text-sm font-medium" htmlFor="b-title">Título</label>
      <input id="b-title" required value={title} onChange={(e) => setTitle(e.target.value)} className="rounded border px-2 py-1" />

      <label className="text-sm font-medium" htmlFor="b-summary">Resumo</label>
      <input id="b-summary" required value={summary} onChange={(e) => setSummary(e.target.value)} className="rounded border px-2 py-1" />

      <label className="text-sm font-medium" htmlFor="b-cat">Categoria</label>
      <select id="b-cat" value={category} onChange={(e) => setCategory(e.target.value as BenefitCategory)} className="rounded border px-2 py-1">
        {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>

      <label className="text-sm font-medium" htmlFor="b-scope">Abrangência</label>
      <select id="b-scope" value={scope} onChange={(e) => setScope(e.target.value as BenefitScope)} className="rounded border px-2 py-1">
        {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <label className="text-sm font-medium" htmlFor="b-uf">UF (se regional)</label>
      <input id="b-uf" value={uf} onChange={(e) => setUf(e.target.value)} className="rounded border px-2 py-1" />

      <label className="text-sm font-medium" htmlFor="b-steps">Passo a passo</label>
      <textarea id="b-steps" value={steps} onChange={(e) => setSteps(e.target.value)} className="rounded border px-2 py-1" rows={3} />

      <label className="text-sm font-medium" htmlFor="b-partner">Parceiro</label>
      <input id="b-partner" value={partner} onChange={(e) => setPartner(e.target.value)} className="rounded border px-2 py-1" />

      <label className="text-sm font-medium" htmlFor="b-valid">Validade</label>
      <input id="b-valid" type="date" value={validUntil ?? ''} onChange={(e) => setValidUntil(e.target.value)} className="rounded border px-2 py-1" />

      <span className="text-sm font-medium">Banner</span>
      <ImageUpload folder="benefits" value={imageUrl} onChange={setImageUrl} />

      <label className="text-sm font-medium" htmlFor="b-aurl">URL de ação</label>
      <input id="b-aurl" value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} className="rounded border px-2 py-1" />

      <label className="text-sm font-medium" htmlFor="b-alabel">Rótulo da ação</label>
      <input id="b-alabel" value={actionLabel} onChange={(e) => setActionLabel(e.target.value)} className="rounded border px-2 py-1" />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo
      </label>

      <BenefitSourcesEditor sources={sources} selected={sourceItemIds} onChange={setSourceItemIds} />

      <div className="mt-2 flex gap-2">
        <button type="submit" className="rounded bg-slate-800 px-4 py-2 text-white">Salvar</button>
        <button type="button" onClick={onCancel} className="rounded border px-4 py-2">Cancelar</button>
      </div>
    </form>
  )
}
```
Run `npm test -- src/features/admin/benefits/BenefitForm.test.tsx` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/admin/benefits/BenefitForm.tsx src/features/admin/benefits/BenefitForm.test.tsx
git commit -m "feat: BenefitForm (campos + banner + vínculo de variantes)"
```

---

## Task 5: BenefitLocationsEditor (geo)

**Files:**
- Create: `src/features/admin/benefits/BenefitLocationsEditor.tsx` (+ `.test.tsx`)

- [ ] **Step 1: Teste (falha)**

Create `src/features/admin/benefits/BenefitLocationsEditor.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const saveLoc = vi.fn()
const delLoc = vi.fn()
vi.mock('./useBenefitLocations', () => ({
  useSaveBenefitLocation: () => ({ mutateAsync: saveLoc, isPending: false }),
  useDeleteBenefitLocation: () => ({ mutateAsync: delLoc, isPending: false }),
}))

import { BenefitLocationsEditor } from './BenefitLocationsEditor'
import type { BenefitLocationRow } from './types'

const locations: BenefitLocationRow[] = [
  { id: 'l1', benefit_id: 'b1', name: 'GRU T2', lat: -23.4, lng: -46.4, address: null, city: 'Guarulhos', uf: 'SP', radius_m: null, active: true },
]

beforeEach(() => {
  saveLoc.mockReset(); saveLoc.mockResolvedValue(undefined)
  delLoc.mockReset(); delLoc.mockResolvedValue(undefined)
})

describe('BenefitLocationsEditor', () => {
  it('lista, adiciona e remove locais', async () => {
    render(<BenefitLocationsEditor benefitId="b1" locations={locations} />)
    expect(screen.getByText('GRU T2')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/nome do local/i), { target: { value: 'Loja Centro' } })
    fireEvent.change(screen.getByLabelText(/^lat/i), { target: { value: '-23.5' } })
    fireEvent.change(screen.getByLabelText(/^lng/i), { target: { value: '-46.6' } })
    fireEvent.click(screen.getByRole('button', { name: /adicionar local/i }))
    await waitFor(() => expect(saveLoc).toHaveBeenCalledWith(expect.objectContaining({ benefit_id: 'b1', name: 'Loja Centro', lat: -23.5, lng: -46.6 })))
    fireEvent.click(screen.getByRole('button', { name: /remover GRU T2/i }))
    await waitFor(() => expect(delLoc).toHaveBeenCalledWith('l1'))
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**, depois implementar.

Create `src/features/admin/benefits/BenefitLocationsEditor.tsx`:
```tsx
import { useState } from 'react'
import { useSaveBenefitLocation, useDeleteBenefitLocation } from './useBenefitLocations'
import type { BenefitLocationRow } from './types'

export function BenefitLocationsEditor({ benefitId, locations }: { benefitId: string; locations: BenefitLocationRow[] }) {
  const save = useSaveBenefitLocation()
  const del = useDeleteBenefitLocation()
  const [name, setName] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [city, setCity] = useState('')
  const [uf, setUf] = useState('')

  async function add() {
    if (!name.trim() || lat === '' || lng === '') return
    await save.mutateAsync({
      benefit_id: benefitId,
      name: name.trim(),
      lat: Number(lat),
      lng: Number(lng),
      address: null,
      city: city || null,
      uf: uf || null,
      radius_m: null,
      active: true,
    })
    setName(''); setLat(''); setLng(''); setCity(''); setUf('')
  }

  return (
    <div className="mt-3 rounded-lg border border-slate-100 p-3">
      <h3 className="mb-2 text-sm font-semibold">Locais (geo)</h3>
      <ul className="flex flex-col gap-1">
        {locations.map((l) => (
          <li key={l.id} className="flex items-center gap-2 text-sm">
            <span>{l.name}</span>
            <span className="text-xs text-slate-400">{l.lat}, {l.lng}{l.city ? ` · ${l.city}` : ''}</span>
            <button type="button" aria-label={`remover ${l.name}`} onClick={() => del.mutateAsync(l.id)} className="ml-auto text-red-600">×</button>
          </li>
        ))}
        {locations.length === 0 && <li className="text-xs text-slate-400">Nenhum local.</li>}
      </ul>
      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label className="text-xs">Nome do local
          <input aria-label="nome do local" value={name} onChange={(e) => setName(e.target.value)} className="block rounded border px-2 py-1" />
        </label>
        <label className="text-xs">lat
          <input aria-label="lat" value={lat} onChange={(e) => setLat(e.target.value)} className="block w-24 rounded border px-2 py-1" />
        </label>
        <label className="text-xs">lng
          <input aria-label="lng" value={lng} onChange={(e) => setLng(e.target.value)} className="block w-24 rounded border px-2 py-1" />
        </label>
        <label className="text-xs">cidade
          <input aria-label="cidade" value={city} onChange={(e) => setCity(e.target.value)} className="block rounded border px-2 py-1" />
        </label>
        <label className="text-xs">uf
          <input aria-label="uf" value={uf} onChange={(e) => setUf(e.target.value)} className="block w-16 rounded border px-2 py-1" />
        </label>
        <button type="button" onClick={add} className="rounded bg-slate-700 px-3 py-1 text-sm text-white">Adicionar local</button>
      </div>
    </div>
  )
}
```
Run `npm test -- src/features/admin/benefits/BenefitLocationsEditor.test.tsx` → PASS.

- [ ] **Step 3: Commit**

```bash
git add src/features/admin/benefits/BenefitLocationsEditor.tsx src/features/admin/benefits/BenefitLocationsEditor.test.tsx
git commit -m "feat: BenefitLocationsEditor (CRUD de locais geo)"
```

---

## Task 6: Página AdminBenefits + rota + fechamento

**Files:**
- Create: `src/features/admin/benefits/AdminBenefits.tsx` (+ `.test.tsx`)
- Modify: `src/router.tsx`

- [ ] **Step 1: Teste (falha)**

Create `src/features/admin/benefits/AdminBenefits.test.tsx`:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderWithProviders'
import type { BenefitRow } from './types'
import type { SourceRow } from '../sources/types'

const saveBenefit = vi.fn()
const saveBenefitSources = vi.fn()
vi.mock('./useAdminBenefits', () => ({
  useAdminBenefits: () => ({ data: benefits, isLoading: false, error: null }),
  useSaveBenefit: () => ({ mutateAsync: saveBenefit, isPending: false }),
  useDeleteBenefit: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('./useBenefitSources', () => ({
  useSaveBenefitSources: () => ({ mutateAsync: saveBenefitSources, isPending: false }),
}))
vi.mock('./useBenefitLocations', () => ({
  useSaveBenefitLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteBenefitLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../sources/useAdminSources', () => ({
  useAdminSources: () => ({ data: srcs, isLoading: false, error: null }),
}))
vi.mock('../upload/ImageUpload', () => ({ ImageUpload: () => <div>upload</div> }))

let benefits: BenefitRow[]
let srcs: SourceRow[]
import { AdminBenefits } from './AdminBenefits'

beforeEach(() => {
  saveBenefit.mockReset(); saveBenefit.mockResolvedValue('new-id')
  saveBenefitSources.mockReset(); saveBenefitSources.mockResolvedValue(undefined)
  srcs = []
  benefits = [
    { id: 'b1', title: 'Sala VIP', summary: 's', category: 'viagem', scope: 'pontual', uf: null, steps: null,
      partner_name: null, valid_until: null, image_url: null, action_url: null, action_label: null, active: true,
      benefit_sources: [], benefit_locations: [] },
  ]
})

describe('AdminBenefits', () => {
  it('lista os benefícios', () => {
    renderWithProviders(<AdminBenefits />)
    expect(screen.getByText('Sala VIP')).toBeInTheDocument()
  })

  it('cria novo benefício: salva e grava o vínculo', async () => {
    renderWithProviders(<AdminBenefits />)
    fireEvent.click(screen.getByRole('button', { name: /novo benefício/i }))
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Cinema' } })
    fireEvent.change(screen.getByLabelText(/resumo/i), { target: { value: '50%' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => expect(saveBenefit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cinema' })))
    await waitFor(() => expect(saveBenefitSources).toHaveBeenCalledWith({ benefitId: 'new-id', sourceItemIds: [] }))
  })
})
```

- [ ] **Step 2: Rodar — ver falhar**, depois implementar.

Create `src/features/admin/benefits/AdminBenefits.tsx`:
```tsx
import { useState } from 'react'
import { useAdminBenefits, useSaveBenefit, useDeleteBenefit } from './useAdminBenefits'
import { useSaveBenefitSources } from './useBenefitSources'
import { useAdminSources } from '../sources/useAdminSources'
import { BenefitForm } from './BenefitForm'
import { BenefitLocationsEditor } from './BenefitLocationsEditor'
import type { BenefitInput, BenefitRow } from './types'

export function AdminBenefits() {
  const { data, isLoading, error } = useAdminBenefits()
  const { data: sources } = useAdminSources()
  const save = useSaveBenefit()
  const saveLinks = useSaveBenefitSources()
  const del = useDeleteBenefit()
  const [editing, setEditing] = useState<BenefitRow | null | 'new'>(null)

  if (isLoading) return <p className="text-slate-500">Carregando…</p>
  if (error) return <p className="text-red-600">Erro ao carregar benefícios.</p>

  async function onSubmit(payload: { input: BenefitInput; sourceItemIds: string[] }) {
    const current = editing
    const id = current && current !== 'new' ? current.id : undefined
    const savedId = await save.mutateAsync({ ...payload.input, id })
    await saveLinks.mutateAsync({ benefitId: savedId, sourceItemIds: payload.sourceItemIds })
    setEditing(null)
  }

  if (editing) {
    const initial = editing === 'new' ? null : editing
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">{initial ? `Editar ${initial.title}` : 'Novo benefício'}</h1>
        <BenefitForm initial={initial} sources={sources ?? []} onSubmit={onSubmit} onCancel={() => setEditing(null)} />
        {initial && <BenefitLocationsEditor benefitId={initial.id} locations={initial.benefit_locations} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Benefícios</h1>
        <button type="button" onClick={() => setEditing('new')} className="rounded bg-slate-800 px-3 py-2 text-sm text-white">Novo benefício</button>
      </div>
      <ul className="flex flex-col gap-2">
        {(data ?? []).map((b) => (
          <li key={b.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <span className="flex-1">{b.title} <span className="text-xs text-slate-400">({b.category}{b.active ? '' : ' · inativo'})</span></span>
            <button type="button" onClick={() => setEditing(b)} className="text-sm text-slate-600">Editar</button>
            <button type="button" aria-label={`remover ${b.title}`} onClick={() => del.mutateAsync(b.id)} className="text-sm text-red-600">Remover</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
```
Run `npm test -- src/features/admin/benefits/AdminBenefits.test.tsx` → PASS (2).

- [ ] **Step 3: Wire a rota em `src/router.tsx`**

Add import: `import { AdminBenefits } from './features/admin/benefits/AdminBenefits'`
Dentro do grupo `AdminGuard → AdminLayout` children (junto de `/admin` e `/admin/sources`), adicione:
```tsx
          { path: '/admin/benefits', element: <AdminBenefits /> },
```

- [ ] **Step 4: Build + suíte**

Run: `npm run build` (PASS), `npm test` (tudo verde).

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/benefits/AdminBenefits.tsx src/features/admin/benefits/AdminBenefits.test.tsx src/router.tsx
git commit -m "feat: página AdminBenefits (form + vínculo + locais) e rota /admin/benefits"
```

---

## Definition of Done (M6c)

- [ ] `npm test` inteiro verde (integração benefits + componentes form/editores/página).
- [ ] `npm run build` compila com `/admin/benefits`.
- [ ] Admin cria/edita/remove benefícios com todos os campos + banner.
- [ ] Admin define as variantes que destravam (multi-select → `benefit_sources` replace) e gerencia locais geo.
- [ ] Não-admin negado (RLS) — testado.
- [ ] Invalidação atualiza `['admin_benefits']` e `['my_benefits']`.

**Pós-merge:** push (auto-deploy). **M6 completo** — painel admin cobre todo o catálogo. Próximos: M5 follow-ups (HTTPS subdomínio, domínio Resend) e/ou integração Pluggy.
```
