# P3 — Onboarding multi-step (híbrido) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever o onboarding de "marcar cartões" para um **wizard híbrido por categoria de fonte** ("Você tem [categoria]? → Tenho/Não tenho" → busca + provedores), consumindo dados reais e persistindo em `user_sources` (inalterado), com captura de "Outro" (provedor não-listado) para o P4.

**Architecture:** O onboarding passa a agrupar as fontes por `sources.source_category` (coluna do P1) em vez de `kind`. Cada categoria não-vazia vira uma etapa com gate "Tenho/Não tenho"; ao dizer "Tenho", revela busca + blocos de provedor (reusa `SourceBlock`/`selectionReducer`) + um campo "Outro" que grava um pedido em `source_requests` (nova tabela, só sinal de curadoria — não destrava benefício). O admin `SourceForm` ganha o campo `source_category` para curadores categorizarem fontes corretamente (fecha o follow-up do P1). A seleção continua salva via `replace_user_sources` (RPC existente). Visual com os primitivos DS do `src/ui` (P2).

**Tech Stack:** Vite + React 18 + TypeScript + Tailwind v3, Supabase (Postgres + RLS), TanStack Query, React Router, Vitest + Testing Library.

## Global Constraints

- **Branch:** trabalhar em `feat/p3-onboarding` (criar a partir de `develop`).
- **Gate de tipos:** `npm test` (vitest) NÃO faz type-check — rodar `npm run build` (= `tsc && vite build`) ao final de cada task; só considerar pronta com build verde. (ver [[mapa-de-beneficios-vitest-no-typecheck]])
- **Não regredir:** os 127 testes atuais devem continuar verdes (`npm test`).
- **Persistência inalterada:** seleção continua referenciando `source_items` e gravando via RPC `replace_user_sources`. Não mexer no mecanismo de `user_sources`.
- **Taxonomia travada (spec §2):** as 7 `source_category` e seus rótulos/ícones pt-BR são fixos: `bank_card` 🏦 "Bancos & cartões"; `carrier` 📶 "Operadoras de celular"; `health` 🩺 "Planos de saúde"; `corporate_benefits` 💼 "Multibenefícios"; `loyalty` ⭐ "Fidelidade & pontos"; `retail` 🛍️ "Varejo & assinaturas"; `mall` 🏬 "Shoppings".
- **Escopo:** só categorias **com provedores** no catálogo aparecem (sem etapas vazias). NÃO popular categorias não-bancárias (isso é P4). NÃO derrubar o default `bank_card` de `source_category` nem fazer backfill (mantém o teste `tests/source_category.integration.test.ts` intacto).
- **"Outro":** captura de demanda em `source_requests`; **não** cria `source_item` nem destrava benefício.

---

## File Structure

**Criar:**
- `src/features/onboarding/categoryMeta.ts` — `SOURCE_CATEGORY_META` (key/label/icon, ordem da taxonomia) + `categoryMeta(key)`.
- `src/features/onboarding/groupSourcesByCategory.ts` (+ `.test.ts`) — agrupa `Source[]` por `source_category`, só não-vazias, na ordem da taxonomia.
- `src/features/onboarding/useSaveSourceRequest.ts` — mutation que grava em `source_requests`.
- `supabase/migrations/0014_source_requests.sql` — tabela + RLS.
- `tests/source_requests.integration.test.ts` — RLS (insere o próprio; não spoofa; só lê os próprios).

**Modificar:**
- `src/features/onboarding/types.ts` — `Source` ganha `source_category?: SourceCategory`.
- `src/features/onboarding/useSources.ts` — seleciona `source_category`; passa a usar `groupSourcesByCategory`.
- `src/features/onboarding/OnboardingPage.tsx` (+ `.test.tsx`) — wizard híbrido.
- `src/features/admin/sources/types.ts` — `SourceRow`/`SourceInput` ganham `source_category`.
- `src/features/admin/sources/useAdminSources.ts` — SELECT inclui `source_category`.
- `src/features/admin/sources/SourceForm.tsx` (+ `.test.tsx`) — select de `source_category`.
- `src/lib/database.types.ts` — regenerado via `npm run gen:types` após a migration `0014` (inclui `source_requests`).

**Remover (código morto após o swap):**
- `src/features/onboarding/groupSources.ts` + `src/features/onboarding/groupSources.test.ts` (substituídos por `groupSourcesByCategory`; `useSources` deixa de usar `groupSourcesByKind`).

---

## Task 1: Agrupamento por `source_category` (dados, puro)

Função pura + metadados, testada isoladamente. Não toca em `OnboardingPage` ainda (build segue verde).

**Files:**
- Create: `src/features/onboarding/categoryMeta.ts`, `src/features/onboarding/groupSourcesByCategory.ts`
- Modify: `src/features/onboarding/types.ts`, `src/features/onboarding/useSources.ts`
- Test: `src/features/onboarding/groupSourcesByCategory.test.ts`

**Interfaces:**
- Consumes: `Source` (`./types`), `SourceCategory` (`../benefits/types`).
- Produces: `SOURCE_CATEGORY_META: CategoryMeta[]`, `categoryMeta(key: SourceCategory): CategoryMeta`, `groupSourcesByCategory(sources: Source[]): CategoryGroup[]` onde `CategoryGroup = { category: SourceCategory; meta: CategoryMeta; sources: Source[] }` e `CategoryMeta = { key: SourceCategory; label: string; icon: string }`.

- [ ] **Step 1: Adicionar `source_category` opcional ao `Source`**

Em `src/features/onboarding/types.ts`, importar o tipo e adicionar o campo (opcional → não quebra fixtures existentes; reflete o default do banco):
```ts
import type { SourceCategory } from '../benefits/types'

export type SourceKind = 'card' | 'carrier' | 'loyalty' | 'cpf'

export interface SourceItem {
  id: string
  label: string
  sort_order: number
}

export interface Source {
  id: string
  kind: SourceKind
  name: string
  logo_url: string | null
  sort_order: number
  source_items: SourceItem[]
  source_category?: SourceCategory
}

export type GroupedSources = Record<SourceKind, Source[]>
```
(`GroupedSources` permanece por ora; sai junto com `groupSources.ts` na Task 4.)

- [ ] **Step 2: Criar `categoryMeta.ts`**

```ts
import type { SourceCategory } from '../benefits/types'

export interface CategoryMeta {
  key: SourceCategory
  label: string
  icon: string
}

// Ordem e rótulos travados na spec §2 (Global Constraints).
export const SOURCE_CATEGORY_META: CategoryMeta[] = [
  { key: 'bank_card', label: 'Bancos & cartões', icon: '🏦' },
  { key: 'carrier', label: 'Operadoras de celular', icon: '📶' },
  { key: 'health', label: 'Planos de saúde', icon: '🩺' },
  { key: 'corporate_benefits', label: 'Multibenefícios', icon: '💼' },
  { key: 'loyalty', label: 'Fidelidade & pontos', icon: '⭐' },
  { key: 'retail', label: 'Varejo & assinaturas', icon: '🛍️' },
  { key: 'mall', label: 'Shoppings', icon: '🏬' },
]

const BY_KEY = new Map(SOURCE_CATEGORY_META.map((m) => [m.key, m]))

export function categoryMeta(key: SourceCategory): CategoryMeta {
  return BY_KEY.get(key) ?? { key, label: key, icon: '🎁' }
}
```

- [ ] **Step 3: Escrever o teste do agrupamento (falha primeiro)**

```ts
// src/features/onboarding/groupSourcesByCategory.test.ts
import { describe, it, expect } from 'vitest'
import { groupSourcesByCategory } from './groupSourcesByCategory'
import type { Source } from './types'

const mk = (over: Partial<Source>): Source => ({
  id: 'x', kind: 'card', name: 'N', logo_url: null, sort_order: 0, source_items: [], ...over,
})

describe('groupSourcesByCategory', () => {
  it('agrupa por source_category na ordem da taxonomia e ignora vazias', () => {
    const groups = groupSourcesByCategory([
      mk({ id: 'l', name: 'Livelo', source_category: 'loyalty', sort_order: 1 }),
      mk({ id: 'n', name: 'Nubank', source_category: 'bank_card', sort_order: 2 }),
    ])
    expect(groups.map((g) => g.category)).toEqual(['bank_card', 'loyalty'])
    expect(groups[0].meta.icon).toBe('🏦')
    expect(groups[0].sources[0].name).toBe('Nubank')
  })

  it('usa bank_card como fallback quando source_category falta', () => {
    const groups = groupSourcesByCategory([mk({ id: 'a', name: 'X' })])
    expect(groups[0].category).toBe('bank_card')
  })

  it('ordena fontes e itens por sort_order', () => {
    const groups = groupSourcesByCategory([
      mk({ id: 'b', name: 'B', source_category: 'bank_card', sort_order: 2,
        source_items: [{ id: 'i2', label: 'Plat', sort_order: 2 }, { id: 'i1', label: 'Gold', sort_order: 1 }] }),
      mk({ id: 'a', name: 'A', source_category: 'bank_card', sort_order: 1 }),
    ])
    expect(groups[0].sources.map((s) => s.name)).toEqual(['A', 'B'])
    expect(groups[0].sources[1].source_items.map((i) => i.label)).toEqual(['Gold', 'Plat'])
  })
})
```

- [ ] **Step 4: Rodar — deve falhar**

Run: `npm test -- --run groupSourcesByCategory`
Expected: FAIL ("Cannot find module './groupSourcesByCategory'").

- [ ] **Step 5: Implementar `groupSourcesByCategory.ts`**

```ts
import type { Source } from './types'
import type { SourceCategory } from '../benefits/types'
import { SOURCE_CATEGORY_META, categoryMeta, type CategoryMeta } from './categoryMeta'

export interface CategoryGroup {
  category: SourceCategory
  meta: CategoryMeta
  sources: Source[]
}

export function groupSourcesByCategory(sources: Source[]): CategoryGroup[] {
  const byCat = new Map<SourceCategory, Source[]>()
  for (const s of sources) {
    const cat: SourceCategory = s.source_category ?? 'bank_card'
    const withSortedItems: Source = {
      ...s,
      source_items: [...s.source_items].sort((a, b) => a.sort_order - b.sort_order),
    }
    byCat.set(cat, [...(byCat.get(cat) ?? []), withSortedItems])
  }
  return SOURCE_CATEGORY_META.map((m) => m.key)
    .filter((cat) => (byCat.get(cat)?.length ?? 0) > 0)
    .map((cat) => ({
      category: cat,
      meta: categoryMeta(cat),
      sources: (byCat.get(cat) ?? []).sort((a, b) => a.sort_order - b.sort_order),
    }))
}
```

- [ ] **Step 6: Incluir `source_category` no SELECT de `useSources` (sem trocar o agrupamento)**

Em `src/features/onboarding/useSources.ts`, só estender o SELECT (o swap do agrupamento é a Task 4):
```ts
const { data, error } = await supabase
  .from('sources')
  .select('id, kind, name, logo_url, sort_order, source_category, source_items(id, label, sort_order)')
  .eq('active', true)
```
(Manter o resto do arquivo igual — ainda chamando `groupSourcesByKind` por enquanto.)

- [ ] **Step 7: Rodar testes + build**

Run: `npm test -- --run groupSourcesByCategory && npm run build`
Expected: PASS + build verde.

- [ ] **Step 8: Commit**

```bash
git add src/features/onboarding/categoryMeta.ts src/features/onboarding/groupSourcesByCategory.ts src/features/onboarding/groupSourcesByCategory.test.ts src/features/onboarding/types.ts src/features/onboarding/useSources.ts
git commit -m "feat(p3): agrupamento de fontes por source_category (taxonomia)"
```

---

## Task 2: Admin `SourceForm` — campo `source_category`

Fecha o follow-up do P1: curador passa a marcar a categoria (hoje cai sempre no default `bank_card`).

**Files:**
- Modify: `src/features/admin/sources/types.ts`, `src/features/admin/sources/useAdminSources.ts`, `src/features/admin/sources/SourceForm.tsx`
- Test: `src/features/admin/sources/SourceForm.test.tsx`

**Interfaces:**
- Consumes: `SourceCategory` (`../../benefits/types`), `SOURCE_CATEGORY_META` (`../../onboarding/categoryMeta`).
- Produces: `SourceRow.source_category: SourceCategory`, `SourceInput.source_category` (via `Omit`), e o `SourceForm` emite `source_category` no `onSubmit`.

- [ ] **Step 1: Atualizar o teste do `SourceForm` (falha primeiro)**

Em `src/features/admin/sources/SourceForm.test.tsx`, adicionar a seleção de categoria e a asserção:
```tsx
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Itaú' } })
    fireEvent.change(screen.getByLabelText(/tipo \(kind\)/i), { target: { value: 'card' } })
    fireEvent.change(screen.getByLabelText(/categoria/i), { target: { value: 'bank_card' } })
    fireEvent.change(screen.getByLabelText(/connector_type/i), { target: { value: 'PERSONAL_BANK' } })
    fireEvent.click(screen.getByRole('button', { name: /mock-upload/i }))
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Itaú', kind: 'card', source_category: 'bank_card', connector_type: 'PERSONAL_BANK',
        logo_url: 'https://cdn.test/logo.png', country: 'BR', active: true,
      }),
    )
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npm test -- --run SourceForm`
Expected: FAIL (`getByLabelText(/categoria/i)` não encontrado).

- [ ] **Step 3: Adicionar `source_category` aos tipos do admin**

Em `src/features/admin/sources/types.ts`:
```ts
import type { SourceKind } from '../../onboarding/types'
import type { SourceCategory } from '../../benefits/types'

export interface SourceRow {
  id: string
  kind: SourceKind
  source_category: SourceCategory
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
```
(`SourceInput = Omit<SourceRow, 'id' | 'source_items'>` herda `source_category` automaticamente.)

- [ ] **Step 4: Incluir `source_category` no SELECT do admin**

Em `src/features/admin/sources/useAdminSources.ts`, no `SELECT`:
```ts
const SELECT =
  'id, kind, source_category, name, logo_url, sort_order, active, connector_type, pluggy_connector_id, institution_url, primary_color, country, source_items(id, source_id, label, sort_order, card_brand, card_level, pluggy_product)'
```

- [ ] **Step 5: Adicionar o select de categoria ao `SourceForm`**

Em `src/features/admin/sources/SourceForm.tsx`: importar a taxonomia, criar o estado e o campo, e emitir no submit.
```tsx
import type { SourceKind } from '../../onboarding/types'
import type { SourceCategory } from '../../benefits/types'
import { SOURCE_CATEGORY_META } from '../../onboarding/categoryMeta'
```
Adicionar o estado (perto dos outros `useState`):
```tsx
  const [sourceCategory, setSourceCategory] = useState<SourceCategory>(
    initial?.source_category ?? 'bank_card',
  )
```
Incluir no objeto de `onSubmit` (dentro de `submit`):
```tsx
      kind,
      source_category: sourceCategory,
```
Adicionar o campo logo após o select de `kind`:
```tsx
      <label className="text-sm font-medium" htmlFor="s-cat">Categoria</label>
      <select id="s-cat" value={sourceCategory} onChange={(e) => setSourceCategory(e.target.value as SourceCategory)} className="rounded border px-2 py-1">
        {SOURCE_CATEGORY_META.map((c) => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
      </select>
```

- [ ] **Step 6: Rodar testes + build**

Run: `npm test -- --run SourceForm admin_sources && npm run build`
Expected: PASS + build verde.

- [ ] **Step 7: Commit**

```bash
git add src/features/admin/sources/types.ts src/features/admin/sources/useAdminSources.ts src/features/admin/sources/SourceForm.tsx src/features/admin/sources/SourceForm.test.tsx
git commit -m "feat(p3): admin SourceForm define source_category (fecha follow-up P1)"
```

---

## Task 3: Backend — `source_requests` ("Outro") + hook

Tabela de captura de demanda + RLS + mutation. Não destrava benefício.

**Files:**
- Create: `supabase/migrations/0014_source_requests.sql`, `src/features/onboarding/useSaveSourceRequest.ts`, `tests/source_requests.integration.test.ts`

**Interfaces:**
- Consumes: `SourceCategory` (`../benefits/types`), cliente `supabase`.
- Produces: `useSaveSourceRequest()` → mutation com `mutateAsync(req: { source_category: SourceCategory; text: string })`.

- [ ] **Step 1: Escrever a migration**

```sql
-- supabase/migrations/0014_source_requests.sql
-- P3: captura de "Outro" (provedor não-listado) no onboarding. Sinal de demanda
-- para a curadoria do P4 — NÃO referencia source_items e NÃO destrava benefícios.
create table source_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  source_category source_category not null,
  text text not null check (char_length(text) between 1 and 200),
  created_at timestamptz not null default now()
);

alter table source_requests enable row level security;

-- O RLS faz a aplicação por linha; o grant habilita o role a tocar a tabela
-- (padrão do repo — ver 0003_rls.sql / 0002_user.sql). Sem o grant, o insert/select
-- falha com permissão negada mesmo para o dono.
grant select, insert on source_requests to authenticated;
grant select, insert, update, delete on source_requests to service_role;

-- usuário autenticado (inclusive anônimo) insere apenas em seu próprio nome
create policy "source_requests_own_insert" on source_requests
  for insert to authenticated
  with check (user_id = auth.uid());

-- usuário lê apenas os próprios pedidos
create policy "source_requests_own_select" on source_requests
  for select to authenticated
  using (user_id = auth.uid());

-- admin lê todos (curadoria)
create policy "source_requests_admin_select" on source_requests
  for select to authenticated
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.is_admin));
```

- [ ] **Step 2: Aplicar a migration no Supabase local**

Run: `supabase migration up`
Expected: aplica `0014_source_requests` sem erro (verificar na saída).
(Se preferir um estado limpo: `supabase db reset` — recria e re-seed; mais lento.)

- [ ] **Step 2b: Regenerar os tipos do banco (inclui `source_requests`)**

O client `supabase` é tipado pelo `src/lib/database.types.ts`; a tabela nova precisa entrar nesse arquivo para o insert tipar sem cast.
Run: `npm run gen:types`
Expected: `src/lib/database.types.ts` regenerado, agora contendo `source_requests`.
Conferir: `grep -n source_requests src/lib/database.types.ts` retorna linhas.

- [ ] **Step 3: Escrever o teste de RLS (falha primeiro se a migration não aplicou)**

```ts
// tests/source_requests.integration.test.ts
import { describe, it, expect } from 'vitest'
import { userClient } from './helpers/clients'

describe('source_requests RLS', () => {
  it('usuário insere pedido em seu próprio nome (user_id via default)', async () => {
    const { client, id } = await userClient()
    const { data, error } = await client
      .from('source_requests')
      .insert({ source_category: 'health', text: 'Unimed' })
      .select('id, user_id, source_category')
      .single()
    expect(error).toBeNull()
    expect(data!.user_id).toBe(id)
    expect(data!.source_category).toBe('health')
  })

  it('não permite inserir em nome de outro usuário', async () => {
    const { client } = await userClient()
    const { error } = await client
      .from('source_requests')
      .insert({ user_id: '00000000-0000-0000-0000-000000000000', source_category: 'retail', text: 'x' })
    expect(error).not.toBeNull()
  })

  it('usuário só enxerga os próprios pedidos', async () => {
    const a = await userClient()
    const b = await userClient()
    await a.client.from('source_requests').insert({ source_category: 'mall', text: 'Iguatemi' })
    const { data, error } = await b.client.from('source_requests').select('id')
    expect(error).toBeNull()
    expect((data ?? []).length).toBe(0)
  })
})
```

- [ ] **Step 4: Rodar — deve passar (migration aplicada)**

Run: `npm test -- --run source_requests`
Expected: PASS (3 testes). Se falhar com "relation source_requests does not exist", repetir Step 2.

- [ ] **Step 5: Implementar o hook**

```ts
// src/features/onboarding/useSaveSourceRequest.ts
import { useMutation } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { SourceCategory } from '../benefits/types'

export function useSaveSourceRequest() {
  return useMutation({
    mutationFn: async (req: { source_category: SourceCategory; text: string }) => {
      const { error } = await supabase.from('source_requests').insert(req)
      if (error) throw error
    },
  })
}
```
> Sem cast `as never`: após `gen:types` (Step 2b) a tabela `source_requests` está no schema tipado, então o insert `{ source_category, text }` type-checa direto. Se o `tsc` reclamar do payload, reconfira que o Step 2b rodou e que `source_requests` aparece em `src/lib/database.types.ts`.

- [ ] **Step 6: Rodar testes + build**

Run: `npm test -- --run source_requests && npm run build`
Expected: PASS + build verde.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0014_source_requests.sql src/lib/database.types.ts src/features/onboarding/useSaveSourceRequest.ts tests/source_requests.integration.test.ts
git commit -m "feat(p3): tabela source_requests (Outro) + RLS + grants + hook tipado"
```

---

## Task 4: Wizard híbrido — núcleo (categorias + gate + seleção)

Reescreve `OnboardingPage` para etapas por categoria com gate "Tenho/Não tenho" e seleção de provedores. Troca `useSources` para agrupar por categoria. Remove `groupSources.ts` (morto).

**Files:**
- Modify: `src/features/onboarding/useSources.ts`, `src/features/onboarding/OnboardingPage.tsx`, `src/features/onboarding/OnboardingPage.test.tsx`
- Delete: `src/features/onboarding/groupSources.ts`, `src/features/onboarding/groupSources.test.ts`

**Interfaces:**
- Consumes: `groupSourcesByCategory`/`CategoryGroup` (Task 1), `selectionReducer` (`./selection`), `useSaveUserSources`, `useUserSources`, `TransitionScreen`, primitivos DS (`../../ui`).
- Produces: `OnboardingPage` consumindo `useSources(): { data: CategoryGroup[] | undefined; isLoading; error }`.

- [ ] **Step 1: Trocar `useSources` para agrupar por categoria**

Reescrever `src/features/onboarding/useSources.ts`:
```ts
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { groupSourcesByCategory } from './groupSourcesByCategory'
import type { Source } from './types'

export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sources')
        .select('id, kind, name, logo_url, sort_order, source_category, source_items(id, label, sort_order)')
        .eq('active', true)
      if (error) throw error
      return groupSourcesByCategory((data ?? []) as unknown as Source[])
    },
  })
}
```

- [ ] **Step 2: Remover o agrupamento por kind (morto)**

```bash
git rm src/features/onboarding/groupSources.ts src/features/onboarding/groupSources.test.ts
```

- [ ] **Step 3: Reescrever o teste do `OnboardingPage` (núcleo) — falha primeiro**

Substituir o conteúdo de `src/features/onboarding/OnboardingPage.test.tsx` por:
```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { CategoryGroup } from './groupSourcesByCategory'

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

const requestMutate = vi.fn()
vi.mock('./useSaveSourceRequest', () => ({
  useSaveSourceRequest: () => ({ mutateAsync: requestMutate, isPending: false }),
}))

let existing: { data: string[] | undefined; isLoading: boolean; error?: unknown }
vi.mock('./useUserSources', () => ({ useUserSources: () => existing }))

const bankGroup: CategoryGroup = {
  category: 'bank_card',
  meta: { key: 'bank_card', label: 'Bancos & cartões', icon: '🏦' },
  sources: [
    { id: 's1', kind: 'card', name: 'Itaú', logo_url: null, sort_order: 1, source_category: 'bank_card',
      source_items: [{ id: 'i1', label: 'Black', sort_order: 1 }] },
  ],
}
const loyaltyGroup: CategoryGroup = {
  category: 'loyalty',
  meta: { key: 'loyalty', label: 'Fidelidade & pontos', icon: '⭐' },
  sources: [
    { id: 's3', kind: 'loyalty', name: 'Livelo', logo_url: null, sort_order: 1, source_category: 'loyalty',
      source_items: [{ id: 'i3', label: 'Livelo', sort_order: 1 }] },
  ],
}

let groups: CategoryGroup[]
vi.mock('./useSources', () => ({
  useSources: () => ({ data: groups, isLoading: false, error: null }),
}))

beforeEach(() => {
  navigateMock.mockReset()
  saveMutate.mockReset()
  saveMutate.mockResolvedValue(undefined)
  requestMutate.mockReset()
  requestMutate.mockResolvedValue(undefined)
  existing = { data: [], isLoading: false, error: null }
  groups = [bankGroup, loyaltyGroup]
})

import { OnboardingPage } from './OnboardingPage'

describe('OnboardingPage (wizard híbrido)', () => {
  it('mostra a 1ª categoria; gate "Tenho" revela provedores; seleciona e conclui', async () => {
    renderWithProviders(<OnboardingPage />)
    expect(screen.getByText(/Bancos & cartões/)).toBeInTheDocument()
    // provedores escondidos até "Tenho"
    expect(screen.queryByText('Itaú')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^tenho$/i }))
    fireEvent.click(screen.getByText('Itaú'))
    fireEvent.click(screen.getByRole('button', { name: /black/i }))
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))
    // passo 2: fidelidade — diz "Não tenho" e conclui
    expect(screen.getByText(/Fidelidade & pontos/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /não tenho/i }))
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith(expect.arrayContaining(['i1'])))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/painel'), { timeout: 2500 })
  })

  it('mostra só categorias com provedores (1 grupo → conclui direto)', () => {
    groups = [bankGroup]
    renderWithProviders(<OnboardingPage />)
    expect(screen.queryByText(/Fidelidade & pontos/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /avançar/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /concluir/i })).toBeInTheDocument()
  })

  it('modo edição: categoria com item pré-selecionado já aparece como "Tenho"', () => {
    existing = { data: ['i1'], isLoading: false }
    renderWithProviders(<OnboardingPage />)
    // provedores já visíveis sem clicar em "Tenho"
    expect(screen.getByText('Itaú')).toBeInTheDocument()
  })

  it('modo edição: "Não tenho" remove os itens da categoria ao concluir', async () => {
    existing = { data: ['i1'], isLoading: false }
    groups = [bankGroup]
    renderWithProviders(<OnboardingPage />)
    expect(screen.getByText('Itaú')).toBeInTheDocument() // pré-selecionado → "Tenho"
    fireEvent.click(screen.getByRole('button', { name: /não tenho/i }))
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalled())
    expect(saveMutate.mock.calls[0][0]).not.toContain('i1')
  })

  it('erro ao carregar fontes existentes não salva', () => {
    existing = { data: undefined, isLoading: false, error: new Error('x') } as unknown as typeof existing
    renderWithProviders(<OnboardingPage />)
    expect(screen.getByText(/erro ao carregar seus dados/i)).toBeInTheDocument()
    expect(saveMutate).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 4: Rodar — deve falhar**

Run: `npm test -- --run OnboardingPage`
Expected: FAIL (a página ainda agrupa por kind / sem gate).

- [ ] **Step 5: Reescrever `OnboardingPage.tsx` (núcleo)**

```tsx
import { useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSources } from './useSources'
import { selectionReducer } from './selection'
import { useSaveUserSources } from './useSaveUserSources'
import { TransitionScreen } from './TransitionScreen'
import { useSession } from '../auth/AuthProvider'
import { useUserSources } from './useUserSources'
import type { CategoryGroup } from './groupSourcesByCategory'
import type { SourceCategory } from '../benefits/types'
import type { Source } from './types'
import { Button } from '../../ui/Button'

type Gate = 'yes' | 'no' | undefined

function SourceBlock({
  source,
  selected,
  onToggle,
}: {
  source: Source
  selected: Set<string>
  onToggle: (itemId: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: 'var(--s3)' }}>
      <button
        type="button"
        className="w-full text-left"
        style={{ fontWeight: 700, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
        onClick={() => setOpen((o) => !o)}
      >
        {source.name}
      </button>
      {open && (
        <div className="chips" style={{ marginTop: 'var(--s2)' }}>
          {source.source_items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onToggle(it.id)}
              className={'chip' + (selected.has(it.id) ? ' on' : '')}
              aria-pressed={selected.has(it.id)}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { data: existing, isLoading: loadingExisting, error: existingError } = useUserSources(session?.user.id)
  const { data: groups, isLoading, error } = useSources()
  const [selected, dispatch] = useReducer(selectionReducer, new Set<string>())
  const [step, setStep] = useState(0)
  const [gates, setGates] = useState<Record<SourceCategory, Gate>>({} as Record<SourceCategory, Gate>)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const save = useSaveUserSources()

  // Conjunto de item ids existentes (modo edição) para pré-marcar gates "yes".
  const inited = useRef(false)
  useEffect(() => {
    if (!inited.current && existing && groups) {
      dispatch({ type: 'set', ids: existing })
      const existingSet = new Set(existing)
      const preGates = {} as Record<SourceCategory, Gate>
      for (const g of groups) {
        const hasAny = g.sources.some((s) => s.source_items.some((it) => existingSet.has(it.id)))
        if (hasAny) preGates[g.category] = 'yes'
      }
      setGates(preGates)
      inited.current = true
    }
  }, [existing, groups])

  if (isLoading || loadingExisting) return <p className="p-6">Carregando…</p>
  if (error || existingError) return <p className="p-6 text-red-600">Erro ao carregar seus dados.</p>
  if (saving) return <TransitionScreen />

  const steps: CategoryGroup[] = groups ?? []
  if (steps.length === 0) return <p className="p-6">Nenhuma fonte disponível ainda.</p>
  const current = steps[step]
  const isLast = step === steps.length - 1
  const gate = gates[current.category]

  function setGate(cat: SourceCategory, g: Gate) {
    setGates((prev) => ({ ...prev, [cat]: g }))
    // "Não tenho" remove os itens dessa categoria da seleção — senão, no modo
    // edição, fontes pré-selecionadas continuariam salvas mesmo após o usuário
    // dizer que não as tem (a UI mentiria e não daria pra remover fontes).
    if (g === 'no') {
      const group = steps.find((s) => s.category === cat)
      const catIds = new Set(group?.sources.flatMap((s) => s.source_items.map((it) => it.id)) ?? [])
      dispatch({ type: 'set', ids: [...selected].filter((id) => !catIds.has(id)) })
    }
  }

  async function next() {
    if (!isLast) {
      setStep((s) => s + 1)
      return
    }
    setSaving(true)
    setSaveError(false)
    try {
      await save.mutateAsync([...selected])
      await new Promise((r) => setTimeout(r, 1200))
      navigate('/painel')
    } catch {
      setSaving(false)
      setSaveError(true)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <div style={{ height: 6, width: '100%', overflow: 'hidden', borderRadius: 99, background: 'var(--line)' }}>
        <div style={{ height: '100%', background: 'var(--accent)', transition: 'width .25s', width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>

      <h1 style={{ fontSize: 'var(--fz-h2)', fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>
        Você tem {current.meta.icon} {current.meta.label}?
      </h1>

      <div className="chips">
        <button type="button" className={'chip' + (gate === 'yes' ? ' on' : '')} aria-pressed={gate === 'yes'} onClick={() => setGate(current.category, 'yes')}>
          Tenho
        </button>
        <button type="button" className={'chip' + (gate === 'no' ? ' on' : '')} aria-pressed={gate === 'no'} onClick={() => setGate(current.category, 'no')}>
          Não tenho
        </button>
      </div>

      {gate === 'yes' && (
        <div className="flex flex-col gap-2">
          {current.sources.map((s) => (
            <SourceBlock key={s.id} source={s} selected={selected} onToggle={(id) => dispatch({ type: 'toggle', itemId: id })} />
          ))}
        </div>
      )}

      {saveError && <p style={{ fontSize: 14, color: 'var(--warn)' }}>Não foi possível salvar. Tente de novo.</p>}

      <div className="mt-auto flex gap-2" style={{ alignItems: 'center' }}>
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
            Voltar
          </Button>
        )}
        <div style={{ marginLeft: 'auto', width: 'auto' }}>
          <Button onClick={next}>{isLast ? 'Concluir' : 'Avançar'}</Button>
        </div>
      </div>
    </div>
  )
}
```
> Nota sobre `Button` largura: o `.btn` é `width:100%`. Para Voltar/Avançar lado a lado, eles ficam em contêineres flex; o `marginLeft:auto` empurra o primário à direita. Se o layout ficar esticado, envolver cada `Button` num `div` com `style={{ width: 'auto' }}` (Voltar) — ajuste visual, sem mudar comportamento/tests.

- [ ] **Step 6: Rodar testes + build**

Run: `npm test -- --run OnboardingPage groupSourcesByCategory && npm run build`
Expected: PASS + build verde.

- [ ] **Step 7: Commit**

```bash
git add src/features/onboarding/useSources.ts src/features/onboarding/OnboardingPage.tsx src/features/onboarding/OnboardingPage.test.tsx
git commit -m "feat(p3): wizard de onboarding por categoria com gate Tenho/Não tenho"
```

---

## Task 5: Busca dentro da categoria + "Outro"

Adiciona ao `OnboardingPage` (gate "Tenho"): campo de busca que filtra provedores por nome e um campo "Outro" que grava em `source_requests`.

**Files:**
- Modify: `src/features/onboarding/OnboardingPage.tsx`, `src/features/onboarding/OnboardingPage.test.tsx`

**Interfaces:**
- Consumes: `useSaveSourceRequest` (Task 3), `Input` (`../../ui/Input`), `Button`.
- Produces: (sem novas exportações; comportamento adicional na página.)

- [ ] **Step 1: Adicionar os testes de busca e "Outro" (falham primeiro)**

Acrescentar dentro do `describe('OnboardingPage (wizard híbrido)', ...)` em `OnboardingPage.test.tsx`:
```tsx
  it('busca filtra os provedores por nome dentro da categoria', () => {
    groups = [{
      ...bankGroup,
      sources: [
        bankGroup.sources[0],
        { id: 's2', kind: 'card', name: 'Nubank', logo_url: null, sort_order: 2, source_category: 'bank_card',
          source_items: [{ id: 'i9', label: 'Ultravioleta', sort_order: 1 }] },
      ],
    }]
    renderWithProviders(<OnboardingPage />)
    fireEvent.click(screen.getByRole('button', { name: /^tenho$/i }))
    expect(screen.getByText('Itaú')).toBeInTheDocument()
    expect(screen.getByText('Nubank')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nub' } })
    expect(screen.queryByText('Itaú')).not.toBeInTheDocument()
    expect(screen.getByText('Nubank')).toBeInTheDocument()
  })

  it('"Outro" grava um pedido com a categoria atual', async () => {
    renderWithProviders(<OnboardingPage />)
    fireEvent.click(screen.getByRole('button', { name: /^tenho$/i }))
    fireEvent.change(screen.getByLabelText(/outro/i), { target: { value: 'C6 Bank' } })
    fireEvent.click(screen.getByRole('button', { name: /adicionar/i }))
    await waitFor(() =>
      expect(requestMutate).toHaveBeenCalledWith({ source_category: 'bank_card', text: 'C6 Bank' }),
    )
    expect(await screen.findByText(/recebemos/i)).toBeInTheDocument()
  })
```

- [ ] **Step 2: Rodar — deve falhar**

Run: `npm test -- --run OnboardingPage`
Expected: FAIL (sem searchbox / sem campo "Outro").

- [ ] **Step 3: Implementar busca + "Outro" no `OnboardingPage`**

Adicionar imports e hook:
```tsx
import { useSaveSourceRequest } from './useSaveSourceRequest'
import { Input } from '../../ui/Input'
```
No corpo do componente (após `const save = useSaveUserSources()`):
```tsx
  const saveRequest = useSaveSourceRequest()
  const [query, setQuery] = useState('')
  const [otherText, setOtherText] = useState('')
  const [otherSent, setOtherSent] = useState(false)

  // resetar busca/Outro ao trocar de etapa
  useEffect(() => {
    setQuery('')
    setOtherText('')
    setOtherSent(false)
  }, [step])
```
Calcular os provedores filtrados (antes do `return`, após definir `current`):
```tsx
  const filteredSources = current.sources.filter((s) =>
    s.name.toLowerCase().includes(query.trim().toLowerCase()),
  )
```
Adicionar o handler do "Outro":
```tsx
  async function submitOther() {
    const text = otherText.trim()
    if (!text) return
    try {
      await saveRequest.mutateAsync({ source_category: current.category, text })
      setOtherSent(true)
      setOtherText('')
    } catch {
      // silencioso; o usuário pode tentar de novo
    }
  }
```
Substituir o bloco `gate === 'yes'` por (busca + lista filtrada + "Outro"):
```tsx
      {gate === 'yes' && (
        <div className="flex flex-col gap-2">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="buscar provedor…"
            icon="⌕"
            ariaLabel="Buscar provedor"
          />
          {filteredSources.map((s) => (
            <SourceBlock key={s.id} source={s} selected={selected} onToggle={(id) => dispatch({ type: 'toggle', itemId: id })} />
          ))}
          {filteredSources.length === 0 && (
            <p className="muted" style={{ fontSize: 14 }}>Nenhum provedor encontrado.</p>
          )}
          <div style={{ borderTop: '1px solid var(--line-2)', marginTop: 'var(--s2)', paddingTop: 'var(--s2)' }}>
            <label className="lbl" htmlFor="other" style={{ margin: '0 0 var(--s2)' }}>
              Não está na lista? Conta pra gente (Outro)
            </label>
            {otherSent ? (
              <p className="muted" style={{ fontSize: 14 }}>Recebemos! Vamos avaliar incluir essa fonte. ✓</p>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--s2)', alignItems: 'center' }}>
                <label className="input" style={{ flex: 1, marginBottom: 0 }}>
                  <input id="other" value={otherText} onChange={(e) => setOtherText(e.target.value)} placeholder="ex.: C6 Bank" aria-label="Outro provedor" />
                </label>
                <div style={{ width: 'auto' }}>
                  <Button onClick={submitOther}>Adicionar</Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
```
> O `getByLabelText(/outro/i)` casa com o `<label htmlFor="other">` ("…(Outro)") **ou** com o `aria-label="Outro provedor"` do input — ambos apontam para o mesmo campo. Mantenha os dois textos contendo "Outro".

- [ ] **Step 4: Rodar testes + build**

Run: `npm test -- --run OnboardingPage && npm run build`
Expected: PASS + build verde.

- [ ] **Step 5: Commit**

```bash
git add src/features/onboarding/OnboardingPage.tsx src/features/onboarding/OnboardingPage.test.tsx
git commit -m "feat(p3): busca de provedores + captura de 'Outro' no onboarding"
```

---

## Task 6: Verificação final + visual

**Files:** nenhum (verificação).

- [ ] **Step 1: Suíte completa + build**

Run: `npm test && npm run build`
Expected: todos os testes verdes (127 anteriores + novos) + build limpo.

- [ ] **Step 2: Verificação visual ponta-a-ponta**

`npm run dev`; abrir `/onboarding` (sessão anônima):
- só categorias com provedores aparecem (hoje ~`bank_card`);
- "Você tem 🏦 Bancos & cartões?" → [Tenho]/[Não tenho];
- "Tenho" revela busca + provedores; busca filtra; selecionar variante;
- "Outro" → digitar → "Adicionar" → confirmação "Recebemos!";
- Concluir → transição "Montando o seu mapa" → `/painel` com os benefícios.
Conferir claro e escuro.

- [ ] **Step 3: Commit (se houve ajuste visual)**

```bash
git add -A && git commit -m "chore(p3): ajustes finais do onboarding multi-step"
```

Após o P3: seguir [[mapa-de-beneficios-source-agnostic]] — próximos são P4 (descoberta/expansão do catálogo, que popula as categorias não-bancárias e a tela "Discover") e P5 (mock fonte-agnóstico).

---

## Self-Review (cobertura da spec §4 + decisões)

- **Wizard híbrido por categoria** (gate Tenho/Não-tenho + busca embutida) → Tasks 4–5. **Só categorias com provedores** → Task 1 (`groupSourcesByCategory` filtra vazias) + teste Task 4. **Busca + "Outro"** → Task 5 (busca client-side) + Task 3 (persistência `source_requests`). **Taxonomia §2** (rótulos/ícones/ordem) → Task 1 (`SOURCE_CATEGORY_META`).
- **Persistência inalterada**: seleção via `replace_user_sources`/`useSaveUserSources` mantida (Task 4); "Outro" é tabela separada que **não** destrava benefício (Task 3).
- **Follow-up do P1** (admin não setava `source_category`) → Task 2 (campo no `SourceForm`), sem derrubar o default (teste `source_category.integration` intacto).
- **Gate de build** em toda task (vitest não type-checa). **Dados reais**: `useSources` lê do Supabase; código completo (sem placeholders) acima.
- **Modo edição** preservado (pré-seleção → gates "yes") → Task 4. **"Não tenho" remove os itens da categoria** da seleção (senão fontes removidas continuariam salvas) → Task 4 (`setGate` + teste de regressão).
- **Grants explícitos** em `source_requests` (padrão do repo: grant separado do RLS) + **`gen:types`** após a migration (tabela no schema tipado, hook sem `as never`) → Task 3. (Achados da review adversarial Codex.)
- **Fora de escopo (não nesta plan):** popular categorias não-bancárias e a tela "Discover" → P4; backfill/derrubar default de `source_category` → P4; mock → P5.
```
