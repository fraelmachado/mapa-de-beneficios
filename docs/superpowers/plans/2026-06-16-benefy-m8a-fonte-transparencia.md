# M8a — Fonte, data de coleta e benefícios da mesma fonte — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exibir, na tela de detalhe do benefício, a fonte oficial (link + nome), a data da última coleta, e a lista de outros benefícios do usuário catalogados da mesma fonte.

**Architecture:** Estende a view `my_benefits` com `source_url`/`source_name`/`observed_at` (já existentes em `benefits`). A correlação "da mesma fonte" é uma função pura sobre os dados já carregados por `useMyBenefits` (sem query nova), exposta via `useBenefit`. A UI nova fica só na `BenefitDetail`.

**Tech Stack:** Supabase (view SQL, RLS security_invoker), Vitest + Testing Library, React + TypeScript.

**Spec:** `docs/superpowers/specs/2026-06-16-benefy-m8a-fonte-transparencia-design.md`

---

## Task 1: Estender `my_benefits` com fonte/data (dados + tipos)

**Files:**
- Create: `supabase/migrations/0011_my_benefits_fonte.sql`
- Create: `tests/my_benefits_fonte.integration.test.ts`
- Modify: `src/features/benefits/types.ts`, `src/features/benefits/useMyBenefits.ts`, `src/lib/database.types.ts` (regen)
- Modify (fixtures): `src/features/detalhe/BenefitDetail.test.tsx`, `src/features/busca/Search.test.tsx`, `src/features/benefits/filterBenefits.test.ts`, `src/features/benefits/BenefitCard.test.tsx`, `src/features/painel/Painel.test.tsx`

- [ ] **Step 1: Escrever a migration 0011**

Create `supabase/migrations/0011_my_benefits_fonte.sql`:

```sql
-- M8a: expõe fonte/data de coleta em my_benefits. Aditiva: só recria a view
-- (security_invoker mantido; RLS das tabelas-base inalterada).
drop view if exists my_benefits;
create view my_benefits with (security_invoker = true) as
with unlocked as (
  select b.id as benefit_id, si.label as via
  from benefits b
  join benefit_sources bs on bs.benefit_id = b.id
  join source_items si on si.id = bs.source_item_id
  join user_sources us on us.source_item_id = si.id
  where us.user_id = auth.uid() and b.active
  union
  select b.id, si.label
  from benefits b
  join benefit_card_tiers bct on bct.benefit_id = b.id
  join source_items si on si.card_brand = bct.card_brand
                      and si.card_level = bct.card_level
  join user_sources us on us.source_item_id = si.id
  where us.user_id = auth.uid() and b.active
)
select b.id, b.title, b.summary, b.category, b.scope, b.uf, b.steps,
       b.partner_name, b.valid_until, b.image_url, b.action_url, b.action_label,
       b.created_at, b.source_url, b.source_name, b.observed_at,
       array_agg(distinct u.via order by u.via) as via
from unlocked u join benefits b on b.id = u.benefit_id
group by b.id;
grant select on my_benefits to authenticated;
```

- [ ] **Step 2: Aplicar local**

Run: `npx supabase db reset`
Expected: aplica 0001–0011 + seed sem erro. (Após reset, aguarde ~10s os containers de auth subirem antes de rodar testes de integração.)

- [ ] **Step 3: Escrever o teste de view (falha primeiro)**

Create `tests/my_benefits_fonte.integration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { serviceClient, userClient } from './helpers/clients'

describe('my_benefits expõe fonte/data', () => {
  it('projeta source_url, source_name e observed_at para um benefício do catálogo', async () => {
    const db = serviceClient()
    const { data: item } = await db.from('source_items').select('id').eq('slug', 'xp-infinite').single()
    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [item!.id] })

    const { data, error } = await client
      .from('my_benefits')
      .select('title, source_url, observed_at')
    expect(error).toBeNull()
    const rows = data ?? []
    // pelo menos um benefício do XP Infinite tem fonte oficial e data de coleta
    expect(rows.some((r) => typeof r.source_url === 'string' && r.source_url!.startsWith('http'))).toBe(true)
    expect(rows.some((r) => typeof r.observed_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.observed_at!))).toBe(true)
  })
})
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- my_benefits_fonte`
Expected: PASS (a view já foi recriada no Step 2).

- [ ] **Step 5: Adicionar os campos a `MyBenefit`**

In `src/features/benefits/types.ts`, na interface `MyBenefit`, adicionar após `created_at`:

```ts
  source_url: string | null
  source_name: string | null
  observed_at: string | null
```

- [ ] **Step 6: Incluir os campos no select de `useMyBenefits`**

In `src/features/benefits/useMyBenefits.ts`, alterar a string do `.select(...)` para incluir os 3 campos:

```ts
        .select(
          'id, title, summary, category, scope, uf, steps, partner_name, valid_until, image_url, action_url, action_label, created_at, source_url, source_name, observed_at, via',
        )
```

- [ ] **Step 7: Atualizar os 5 fixtures de teste de `MyBenefit`**

Os literais `MyBenefit` nos testes ficam sem os 3 campos obrigatórios → `tsc` quebraria. Em CADA um destes arquivos, adicionar `source_url: null, source_name: null, observed_at: null` a TODO objeto que monta um `MyBenefit` (procure por objetos com a propriedade `via:`):
- `src/features/detalhe/BenefitDetail.test.tsx` (objeto `b`)
- `src/features/busca/Search.test.tsx`
- `src/features/benefits/filterBenefits.test.ts`
- `src/features/benefits/BenefitCard.test.tsx`
- `src/features/painel/Painel.test.tsx`

Exemplo (BenefitDetail.test.tsx, objeto `b`) — adicionar os campos:

```ts
const b: MyBenefit = {
  id: 'b1', title: 'Seguro Viagem', summary: 'Cobertura internacional', category: 'travel',
  scope: 'nacional', uf: null, steps: '1. Emita a apólice\n2. Apresente o bilhete',
  partner_name: 'C6', valid_until: null, image_url: null, action_url: 'https://x.test',
  action_label: 'Emitir', created_at: '', via: ['Carbon'],
  source_url: null, source_name: null, observed_at: null,
}
```

Para fixtures que usam `as MyBenefit` parcial ou spread, garanta que o objeto base tenha os 3 campos. Rode `npx tsc --noEmit` para localizar qualquer fixture faltante e corrija.

- [ ] **Step 8: Regenerar tipos do banco**

Run: `npm run gen:types`
Then run: `npm run build`
Expected: `tsc` + build limpos.

- [ ] **Step 9: Rodar a suíte inteira**

Run: `npm test`
Expected: tudo verde.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/0011_my_benefits_fonte.sql tests/my_benefits_fonte.integration.test.ts \
        src/features/benefits/types.ts src/features/benefits/useMyBenefits.ts src/lib/database.types.ts \
        src/features/detalhe/BenefitDetail.test.tsx src/features/busca/Search.test.tsx \
        src/features/benefits/filterBenefits.test.ts src/features/benefits/BenefitCard.test.tsx \
        src/features/painel/Painel.test.tsx
git commit -m "feat(m8a): my_benefits expõe source_url/source_name/observed_at"
```

---

## Task 2: Correlação "da mesma fonte" (função pura + useBenefit)

**Files:**
- Create: `src/features/benefits/relatedBySource.ts`
- Create: `src/features/benefits/relatedBySource.test.ts`
- Modify: `src/features/benefits/useBenefit.ts`

- [ ] **Step 1: Escrever o teste da função pura (falha primeiro)**

Create `src/features/benefits/relatedBySource.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { relatedBySource } from './relatedBySource'
import type { MyBenefit } from './types'

function mk(id: string, source_url: string | null): MyBenefit {
  return {
    id, title: `B${id}`, summary: '', category: 'other', scope: 'nacional', uf: null,
    steps: null, partner_name: null, valid_until: null, image_url: null, action_url: null,
    action_label: null, created_at: '', via: [], source_url, source_name: null, observed_at: null,
  }
}

describe('relatedBySource', () => {
  it('retorna os de mesma source_url, exceto o próprio', () => {
    const a = mk('1', 'https://visa.com/x')
    const b = mk('2', 'https://visa.com/x')
    const c = mk('3', 'https://mastercard.com/y')
    const out = relatedBySource([a, b, c], a)
    expect(out.map((x) => x.id)).toEqual(['2'])
  })

  it('ignora benefícios com source_url nulo (inclusive o atual)', () => {
    const a = mk('1', null)
    const b = mk('2', null)
    expect(relatedBySource([a, b], a)).toEqual([])
  })

  it('lista vazia quando não há outros da mesma fonte', () => {
    const a = mk('1', 'https://x.test')
    const c = mk('3', 'https://y.test')
    expect(relatedBySource([a, c], a)).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar o teste**

Run: `npm test -- relatedBySource`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar a função**

Create `src/features/benefits/relatedBySource.ts`:

```ts
import type { MyBenefit } from './types'

/** Outros benefícios do usuário catalogados da MESMA fonte oficial (source_url),
 *  exceto o próprio. Ignora source_url nulo. */
export function relatedBySource(all: MyBenefit[], current: MyBenefit): MyBenefit[] {
  if (!current.source_url) return []
  return all.filter((b) => b.id !== current.id && b.source_url === current.source_url)
}
```

- [ ] **Step 4: Rodar o teste**

Run: `npm test -- relatedBySource`
Expected: PASS.

- [ ] **Step 5: Expor `related` em `useBenefit`**

Replace `src/features/benefits/useBenefit.ts` com:

```ts
import { useMyBenefits } from './useMyBenefits'
import { relatedBySource } from './relatedBySource'
import type { MyBenefit } from './types'

export function useBenefit(userId: string | undefined, id: string | undefined) {
  const q = useMyBenefits(userId)
  const all = q.data ?? []
  const benefit: MyBenefit | undefined = all.find((b) => b.id === id)
  const related: MyBenefit[] = benefit ? relatedBySource(all, benefit) : []
  return { ...q, benefit, related }
}
```

- [ ] **Step 6: Rodar a suíte inteira**

Run: `npm test`
Expected: tudo verde.

- [ ] **Step 7: Commit**

```bash
git add src/features/benefits/relatedBySource.ts src/features/benefits/relatedBySource.test.ts src/features/benefits/useBenefit.ts
git commit -m "feat(m8a): relatedBySource + useBenefit.related"
```

---

## Task 3: UI da fonte/data/correlatos na tela de detalhe

**Files:**
- Modify: `src/features/detalhe/BenefitDetail.tsx`
- Modify: `src/features/detalhe/BenefitDetail.test.tsx`

- [ ] **Step 1: Escrever os testes (falham primeiro)**

Em `src/features/detalhe/BenefitDetail.test.tsx`, adicionar (dentro do `describe`) três casos. O `useBenefit` reusa o mock de `useMyBenefits`, então a correlação funciona a partir do `data` mockado:

```ts
  it('mostra a fonte oficial (nome) e a data de coleta', () => {
    const withSource: MyBenefit = {
      ...b, source_url: 'https://www.visa.com.br/beneficios', source_name: 'Visa Brasil',
      observed_at: '2026-06-15',
    }
    result = { data: [withSource], isLoading: false, error: null }
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    const src = screen.getByRole('link', { name: /visa brasil/i })
    expect(src).toHaveAttribute('href', 'https://www.visa.com.br/beneficios')
    expect(screen.getByText(/coletadas em/i)).toBeInTheDocument()
    expect(screen.getByText(/15\/06\/2026/)).toBeInTheDocument()
  })

  it('oculta o bloco de fonte quando não há source_url', () => {
    result = { data: [{ ...b, source_url: null, source_name: null, observed_at: null }], isLoading: false, error: null }
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    expect(screen.queryByText(/fonte/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/coletadas em/i)).not.toBeInTheDocument()
  })

  it('lista "Da mesma fonte" com correlatos e linka para o detalhe', () => {
    const cur: MyBenefit = { ...b, id: 'b1', source_url: 'https://visa.com/x' }
    const sib: MyBenefit = { ...b, id: 'b2', title: 'Outro Visa', source_url: 'https://visa.com/x' }
    const other: MyBenefit = { ...b, id: 'b3', title: 'Mastercard X', source_url: 'https://mc.com/y' }
    result = { data: [cur, sib, other], isLoading: false, error: null }
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    const link = screen.getByRole('link', { name: /outro visa/i })
    expect(link).toHaveAttribute('href', '/beneficio/b2')
    expect(screen.queryByRole('link', { name: /mastercard x/i })).not.toBeInTheDocument()
  })
```

- [ ] **Step 2: Rodar os testes**

Run: `npm test -- BenefitDetail`
Expected: FAIL nos 3 novos casos (UI ainda não existe).

- [ ] **Step 3: Implementar a UI**

Em `src/features/detalhe/BenefitDetail.tsx`:

(a) trocar a desestruturação para incluir `related`:

```ts
  const { benefit, related, isLoading, error } = useBenefit(session?.user.id, id)
```

(b) adicionar dois helpers no topo do arquivo (após `safeHttpUrl`):

```ts
function sourceLabel(name: string | null, url: string): string {
  if (name) return name
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function formatDate(d: string | null): string | null {
  if (!d) return null
  const parsed = new Date(d + 'T00:00:00')
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString('pt-BR')
}
```

(c) antes do `return (`, calcular:

```ts
  const sourceUrl = safeHttpUrl(benefit.source_url)
  const collectedAt = formatDate(benefit.observed_at)
```

(d) inserir, dentro do JSX, logo APÓS o link de ação (`{actionUrl && (...)}`) e ANTES do fechamento `</div>` final:

```tsx
      {sourceUrl && (
        <div className="mt-2 border-t border-slate-100 pt-4">
          <h2 className="mb-1 font-semibold text-slate-900">Fonte</h2>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-slate-700 underline"
          >
            {sourceLabel(benefit.source_name, sourceUrl)}
          </a>
          {collectedAt && (
            <p className="mt-1 text-xs text-slate-500">Informações coletadas em {collectedAt}</p>
          )}
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-2">
          <h2 className="mb-2 font-semibold text-slate-900">Da mesma fonte</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {related.map((r) => (
              <li key={r.id}>
                <Link to={`/beneficio/${r.id}`} className="text-slate-700 underline">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
```

- [ ] **Step 4: Rodar os testes do componente**

Run: `npm test -- BenefitDetail`
Expected: PASS (todos os casos, antigos e novos).

- [ ] **Step 5: Verificação final**

Run: `npm test && npm run build`
Expected: suíte inteira verde; build ok.

- [ ] **Step 6: Commit**

```bash
git add src/features/detalhe/BenefitDetail.tsx src/features/detalhe/BenefitDetail.test.tsx
git commit -m "feat(m8a): bloco Fonte + data de coleta + 'da mesma fonte' no detalhe"
```

---

## Pós-execução (fora do escopo de código — exige autorização)

- **Produção:** aplicar `0011_my_benefits_fonte.sql` via postgres-meta `/pg/query` (aditiva: só recria a view; não toca dados nem RLS). É uma operação de produção — confirmar com o usuário antes.
- **Rebuild do front em produção:** a UI nova só aparece com o bundle novo. Disparar o redeploy do app `web` (deploy de produção, outward-facing) — confirmar com o usuário antes; lembrar da lição do M7 (migração que muda contrato front×banco exige rebuild do front junto).

---

## Self-Review (autor do plano)

**Cobertura do spec:**
- §3 view estendida → Task 1 (migration + view test). §4 camada de dados (type/select/regen) → Task 1 Steps 5–8. §5 UI fonte+data+correlatos → Task 3. §5 `relatedBySource` + `useBenefit.related` → Task 2. §6 testes (view/unidade/componente) → Tasks 1/2/3. §7 arquivos → cobertos. §8 produção → bloco Pós-execução. §9 risco de formato de data → `formatDate` com âncora `T00:00:00`; risco bundle×dados → Pós-execução.

**Placeholder scan:** todo passo tem código/comando completo. Sem TBD/TODO.

**Consistência de tipos/nomes:** `relatedBySource(all, current)` definida na Task 2 e usada em `useBenefit` (Task 2) e exercida via mock na Task 3; os 3 campos (`source_url`/`source_name`/`observed_at`) idênticos entre migration, `MyBenefit`, select e fixtures; `useBenefit` retorna `{ benefit, related, ... }` consumido na Task 3.
