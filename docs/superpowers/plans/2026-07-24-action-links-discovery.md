# Links de ação confiáveis no catálogo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corrigir o deep link da rede Amil e permitir que o Discovery sugira CTAs completos, publicados somente após revisão administrativa.

**Architecture:** O Discovery passa a transportar o par opcional `action_url`/`action_label` no payload do benefício, validá-lo na entrada, exibi-lo na revisão e persistir somente na promoção aprovada. O formulário administrativo aplica o mesmo contrato, enquanto uma migration de dados e o seed mantêm o link da Amil correto em ambientes existentes e novos.

**Tech Stack:** TypeScript 5, React 18, Zod 4, Vitest, Testing Library, PostgreSQL/Supabase migrations.

## Global Constraints

- CTA ausente é válido; se presente, `action_url` e `action_label` são obrigatórios em conjunto.
- `action_url` aceita somente URLs absolutas com protocolo `http:` ou `https:`.
- Espaços externos devem ser removidos antes da persistência.
- Aprovação sem CTA nunca apaga um CTA existente.
- Aprovação com CTA substitui o par existente, pois a revisão é explícita.
- Benefícios novos promovidos pelo Discovery permanecem inativos.
- A correção canônica da Amil é `https://www.amil.com.br/institucional/#/servicos/saude/rede-credenciada/amil/busca-avancada`.
- Não adicionar dependências.
- Implementar em TDD: teste falhando, falha confirmada, implementação mínima, testes verdes.

---

## File Structure

- `scripts/discovery/candidatesSchema.ts`: contrato Zod e JSON Schema do CTA sugerido.
- `scripts/discovery/candidatesSchema.test.ts`: pares válidos/inválidos e protocolo permitido.
- `scripts/discovery/flatten.ts`: transporte do CTA validado para o payload persistido.
- `scripts/discovery/flatten.test.ts`: preservação do par no candidato achatado.
- `scripts/discovery/discover.ts`: instrução explícita para o agente procurar deep links oficiais.
- `src/features/admin/discovery/CandidateTree.tsx`: visualização do destino público antes da aprovação.
- `src/features/admin/discovery/CandidateTree.test.tsx`: regressão da revisão visual.
- `supabase/migrations/0022_discovery_action_links.sql`: promoção transacional do CTA aprovado.
- `tests/discovery_promote.integration.test.ts`: inserção, substituição e preservação do CTA.
- `src/features/admin/benefits/actionLink.ts`: normalização/validação pura do par.
- `src/features/admin/benefits/actionLink.test.ts`: contrato unitário do formulário.
- `src/features/admin/benefits/BenefitForm.tsx`: entrada semântica e bloqueio de submissão inválida.
- `src/features/admin/benefits/BenefitForm.test.tsx`: comportamento acessível do erro e payload normalizado.
- `supabase/migrations/0023_fix_amil_network_action_url.sql`: correção do registro existente por slug.
- `supabase/seed.sql`: valor canônico para novos resets/deploys.
- `tests/seed_catalog.integration.test.ts`: contrato de dados da Amil.

---

### Task 1: Contrato e transporte do CTA no Discovery

**Files:**
- Modify: `scripts/discovery/candidatesSchema.test.ts`
- Modify: `scripts/discovery/flatten.test.ts`
- Modify: `scripts/discovery/candidatesSchema.ts`
- Modify: `scripts/discovery/flatten.ts`
- Modify: `scripts/discovery/discover.ts`

**Interfaces:**
- Consumes: nós de benefício retornados pelo agente.
- Produces: `BenefitNode` com `action_url?: string` e `action_label?: string`; payload achatado com as mesmas chaves opcionais.

- [ ] **Step 1: Write the failing schema tests**

Add inside `describe('candidatesTreeSchema', ...)`:

```ts
  it('aceita CTA HTTP(S) completo e ausência de CTA', () => {
    const withAction = structuredClone(validTree) as {
      sources: Array<{ items: Array<{ benefits: Array<Record<string, unknown>> }> }>
    }
    const benefit = withAction.sources[0].items[0].benefits[0]
    benefit.action_url = 'https://unimed.coop.br/rede-credenciada'
    benefit.action_label = 'Ver rede'

    expect(candidatesTreeSchema.safeParse(withAction).success).toBe(true)
    expect(candidatesTreeSchema.safeParse(validTree).success).toBe(true)
  })

  it.each([
    [{ action_url: 'https://unimed.coop.br/rede' }, 'sem rótulo'],
    [{ action_label: 'Ver rede' }, 'sem URL'],
    [{ action_url: 'javascript:alert(1)', action_label: 'Abrir' }, 'protocolo inseguro'],
    [{ action_url: 'ftp://unimed.coop.br/rede', action_label: 'Abrir' }, 'protocolo não HTTP'],
  ])('rejeita CTA inválido: %s (%s)', (action) => {
    const bad = structuredClone(validTree) as {
      sources: Array<{ items: Array<{ benefits: Array<Record<string, unknown>> }> }>
    }
    Object.assign(bad.sources[0].items[0].benefits[0], action)
    expect(candidatesTreeSchema.safeParse(bad).success).toBe(false)
  })

  it('expõe o par de CTA no JSON Schema do benefício', () => {
    const benefitSchema = candidatesJsonSchema.properties.sources.items.properties.items
      .items.properties.benefits.items
    expect(benefitSchema.properties).toHaveProperty('action_url')
    expect(benefitSchema.properties).toHaveProperty('action_label')
    expect(benefitSchema).toHaveProperty('allOf')
  })
```

- [ ] **Step 2: Run schema tests to verify RED**

Run:

```bash
npm test -- scripts/discovery/candidatesSchema.test.ts
```

Expected: FAIL because incomplete and non-HTTP CTA values are accepted and the JSON Schema lacks both properties.

- [ ] **Step 3: Implement the paired Zod and JSON Schema contract**

In `scripts/discovery/candidatesSchema.ts`, add:

```ts
const httpUrl = z.string().trim().url().refine((value) => {
  const protocol = new URL(value).protocol
  return protocol === 'http:' || protocol === 'https:'
}, 'URL deve usar http ou https')
```

Add these properties to `benefitNode`:

```ts
  action_url: httpUrl.optional(),
  action_label: z.string().trim().min(1).optional(),
```

Change the closing `z.object(...)` for `benefitNode` to:

```ts
}).superRefine((benefit, ctx) => {
  if (Boolean(benefit.action_url) !== Boolean(benefit.action_label)) {
    ctx.addIssue({
      code: 'custom',
      path: benefit.action_url ? ['action_label'] : ['action_url'],
      message: 'action_url e action_label devem ser informados juntos',
    })
  }
})
```

Add to the benefit `properties` in `candidatesJsonSchema`:

```ts
                      action_url: { type: 'string', format: 'uri', pattern: '^https?://' },
                      action_label: { type: 'string', minLength: 1 },
```

Add alongside the benefit schema's `required`/`properties`:

```ts
                    allOf: [
                      { if: { required: ['action_url'] }, then: { required: ['action_label'] } },
                      { if: { required: ['action_label'] }, then: { required: ['action_url'] } },
                    ],
```

- [ ] **Step 4: Run schema tests to verify GREEN**

Run:

```bash
npm test -- scripts/discovery/candidatesSchema.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write the failing flatten test**

In the `tree` fixture in `scripts/discovery/flatten.test.ts`, add:

```ts
            {
              title: 'Farmácia',
              summary: 'desconto',
              category: 'security',
              source_url: 'https://unimed.coop.br/f',
              action_url: 'https://unimed.coop.br/rede-credenciada',
              action_label: 'Ver rede',
            },
```

Replace the existing compact benefit object, then add to the first `flattenTree` test:

```ts
    expect(ben.payload).toMatchObject({
      action_url: 'https://unimed.coop.br/rede-credenciada',
      action_label: 'Ver rede',
    })
```

- [ ] **Step 6: Run flatten test to verify RED**

Run:

```bash
npm test -- scripts/discovery/flatten.test.ts
```

Expected: FAIL because `flattenTree` drops both fields.

- [ ] **Step 7: Transport the CTA and instruct the discovery agent**

In the benefit payload assembled by `flattenTree`, add:

```ts
            action_url: b.action_url ?? null,
            action_label: b.action_label ?? null,
```

In the prompt array in `scripts/discovery/discover.ts`, immediately after the instruction to cite `source_url`, add:

```ts
          `Quando houver um destino oficial direto para usar/resgatar o benefício, informe action_url e action_label juntos; prefira o deep link à homepage.`,
```

- [ ] **Step 8: Run focused Discovery tests**

Run:

```bash
npm test -- scripts/discovery/candidatesSchema.test.ts scripts/discovery/flatten.test.ts scripts/discovery/discover.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add scripts/discovery/candidatesSchema.ts scripts/discovery/candidatesSchema.test.ts scripts/discovery/flatten.ts scripts/discovery/flatten.test.ts scripts/discovery/discover.ts
git commit -m "feat(discovery): coletar links diretos de ação"
```

---

### Task 2: Mostrar o CTA sugerido antes da aprovação

**Files:**
- Modify: `src/features/admin/discovery/CandidateTree.test.tsx`
- Modify: `src/features/admin/discovery/CandidateTree.tsx`
- Modify: `src/features/admin/discovery/discovery.css`

**Interfaces:**
- Consumes: `payload.action_url` e `payload.action_label` do candidato.
- Produces: link de revisão identificado como “Destino do botão”, sem alterar as ações de aprovação.

- [ ] **Step 1: Write the failing rendering test**

Add to `CandidateTree.test.tsx`:

```tsx
  it('mostra o destino do botão público antes da aprovação', () => {
    const withAction = tree.map((candidate) => candidate.id === 'b1'
      ? {
          ...candidate,
          payload: {
            ...candidate.payload,
            action_url: 'https://wellhub.com/academias/busca',
            action_label: 'Ver rede',
          },
        }
      : candidate)

    render(<CandidateTree candidates={withAction} onPromote={vi.fn()} onReject={vi.fn()} />)

    expect(screen.getByText('Destino do botão')).toBeInTheDocument()
    const action = screen.getByRole('link', { name: /ver rede/i })
    expect(action).toHaveAttribute('href', 'https://wellhub.com/academias/busca')
  })
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- src/features/admin/discovery/CandidateTree.test.tsx
```

Expected: FAIL because the CTA is not rendered.

- [ ] **Step 3: Render the reviewed CTA**

Inside the benefit map in `CandidateTree.tsx`, derive:

```ts
                        const actionUrl = str(bp.action_url)
                        const actionLabel = str(bp.action_label)
```

After `.dv-ben-meta`, add:

```tsx
                                {actionUrl && actionLabel ? (
                                  <div className="dv-action-preview">
                                    <span>Destino do botão</span>
                                    <a href={actionUrl} target="_blank" rel="noreferrer">
                                      {actionLabel} · {host(actionUrl)}
                                    </a>
                                  </div>
                                ) : null}
```

Add to `discovery.css`:

```css
.dv-action-preview {
  display: flex;
  flex-wrap: wrap;
  gap: .4rem .65rem;
  align-items: center;
  margin-top: .45rem;
  font-size: var(--fz-sm);
}

.dv-action-preview > span {
  color: var(--muted);
  font-weight: 700;
}

.dv-action-preview a {
  color: var(--ink);
  font-weight: 700;
  overflow-wrap: anywhere;
}
```

- [ ] **Step 4: Run test to verify GREEN**

Run:

```bash
npm test -- src/features/admin/discovery/CandidateTree.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/admin/discovery/CandidateTree.tsx src/features/admin/discovery/CandidateTree.test.tsx src/features/admin/discovery/discovery.css
git commit -m "feat(admin): revisar CTA sugerido pelo discovery"
```

---

### Task 3: Persistir o CTA aprovado sem apagar links existentes

**Files:**
- Modify: `tests/discovery_promote.integration.test.ts`
- Create: `supabase/migrations/0022_discovery_action_links.sql`

**Interfaces:**
- Consumes: `discovery_candidates.payload.action_url/action_label`.
- Produces: `benefits.action_url/action_label` inseridos ou atualizados dentro de `promote_discovery_candidate(uuid)`.

- [ ] **Step 1: Extend the integration fixture**

Change `seedTree` to accept:

```ts
async function seedTree(
  db: ReturnType<typeof serviceClient>,
  tag: string,
  action?: { action_url: string; action_label: string },
) {
```

Change the benefit payload to:

```ts
      payload: {
        slug: benSlug,
        title: 'Farmácia',
        summary: 'desconto',
        category: 'security',
        scope: 'nacional',
        card_tiers: [],
        ...action,
      },
```

- [ ] **Step 2: Write failing insert, update, and preserve tests**

Add inside `describe('promote_discovery_candidate', ...)`:

```ts
  it('grava o CTA de um benefício novo aprovado', async () => {
    const db = serviceClient()
    const s = await seedTree(db, stamp(), {
      action_url: 'https://x.dev/f/rede',
      action_label: 'Ver rede',
    })
    const adm = await adminClient()
    await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.srcFp) })
    await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.itemFp) })
    const promoted = await adm.client.rpc('promote_discovery_candidate', {
      candidate_id: await candId(db, s.benFp),
    })

    const benefit = await db.from('benefits')
      .select('action_url, action_label')
      .eq('id', promoted.data as string)
      .single()
    expect(benefit.data).toMatchObject({
      action_url: 'https://x.dev/f/rede',
      action_label: 'Ver rede',
    })
  })

  it('substitui o CTA existente quando a atualização aprovada traz outro par', async () => {
    const db = serviceClient()
    const s = await seedTree(db, stamp(), {
      action_url: 'https://x.dev/f/rede-nova',
      action_label: 'Consultar rede',
    })
    await db.from('benefits').insert({
      slug: s.benSlug,
      title: 'Farmácia antiga',
      summary: 'antigo',
      category: 'security',
      scope: 'nacional',
      action_url: 'https://x.dev/f/rede-antiga',
      action_label: 'Ver rede antiga',
    })
    const adm = await adminClient()
    await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.srcFp) })
    await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.itemFp) })
    const promoted = await adm.client.rpc('promote_discovery_candidate', {
      candidate_id: await candId(db, s.benFp),
    })

    const benefit = await db.from('benefits')
      .select('action_url, action_label')
      .eq('id', promoted.data as string)
      .single()
    expect(benefit.data).toMatchObject({
      action_url: 'https://x.dev/f/rede-nova',
      action_label: 'Consultar rede',
    })
  })

  it('preserva o CTA existente quando a atualização aprovada não traz CTA', async () => {
    const db = serviceClient()
    const s = await seedTree(db, stamp())
    await db.from('benefits').insert({
      slug: s.benSlug,
      title: 'Farmácia antiga',
      summary: 'antigo',
      category: 'security',
      scope: 'nacional',
      action_url: 'https://x.dev/f/rede-existente',
      action_label: 'Ver rede existente',
    })
    const adm = await adminClient()
    await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.srcFp) })
    await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.itemFp) })
    const promoted = await adm.client.rpc('promote_discovery_candidate', {
      candidate_id: await candId(db, s.benFp),
    })

    const benefit = await db.from('benefits')
      .select('action_url, action_label')
      .eq('id', promoted.data as string)
      .single()
    expect(benefit.data).toMatchObject({
      action_url: 'https://x.dev/f/rede-existente',
      action_label: 'Ver rede existente',
    })
  })
```

- [ ] **Step 3: Run integration tests to verify RED**

Reset the local database so it reflects migrations through `0021`, then run:

```bash
npx -y supabase@2.95.0 db reset
npm test -- tests/discovery_promote.integration.test.ts
```

Expected: FAIL because the current promotion function does not persist CTA fields.

- [ ] **Step 4: Add the promotion migration**

Create `supabase/migrations/0022_discovery_action_links.sql`:

```sql
create or replace function public.promote_discovery_candidate(candidate_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c            public.discovery_candidates;
  parent       public.discovery_candidates;
  parent_id    uuid;
  new_id       uuid;
  p            jsonb;
  prov         jsonb;
  tier         jsonb;
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;

  select * into c
  from public.discovery_candidates
  where id = candidate_id
  for update;

  if not found then
    raise exception 'candidate not found';
  end if;

  if c.promoted_id is not null then
    return c.promoted_id;
  end if;

  p := c.payload;
  prov := c.provenance;

  if c.parent_fingerprint is not null then
    select * into parent
    from public.discovery_candidates
    where fingerprint = c.parent_fingerprint;

    if found then
      parent_id := coalesce(parent.promoted_id, parent.matched_id);
    end if;
    if parent_id is null then
      raise exception 'parent % not promoted yet', c.parent_fingerprint;
    end if;
  end if;

  if c.entity_type = 'source' then
    insert into public.sources (slug, name, source_category, kind)
    values (
      p->>'slug',
      p->>'name',
      (p->>'source_category')::public.source_category,
      coalesce((p->>'kind')::public.source_kind, 'card')
    )
    on conflict (slug) do update set
      name = excluded.name,
      source_category = excluded.source_category
    returning id into new_id;

  elsif c.entity_type = 'source_item' then
    insert into public.source_items (
      slug, source_id, label, display_name, card_brand, card_level, product_type,
      source_url, verification_status
    )
    values (
      p->>'slug',
      parent_id,
      p->>'label',
      p->>'display_name',
      p->>'card_brand',
      p->>'card_level',
      p->>'product_type',
      prov->>'source_url',
      (prov->>'verification_status')::public.verification_status
    )
    on conflict (slug) do update set
      label = excluded.label
    returning id into new_id;

  elsif c.entity_type = 'benefit' then
    insert into public.benefits as existing (
      slug, title, summary, category, scope, active, redemption_type, benefit_source,
      long_description, program, source_url, source_name, observed_at, verification_status,
      action_url, action_label
    )
    values (
      p->>'slug', p->>'title', p->>'summary', (p->>'category')::public.benefit_category,
      coalesce((p->>'scope')::public.benefit_scope, 'nacional'), false,
      (p->>'redemption_type')::public.redemption_type,
      (p->>'benefit_source')::public.benefit_source_kind,
      p->>'long_description', p->>'program', prov->>'source_url', prov->>'source_name',
      (prov->>'observed_at')::date, (prov->>'verification_status')::public.verification_status,
      nullif(btrim(p->>'action_url'), ''), nullif(btrim(p->>'action_label'), '')
    )
    on conflict (slug) do update set
      title = excluded.title,
      summary = excluded.summary,
      action_url = case
        when excluded.action_url is not null and excluded.action_label is not null
          then excluded.action_url
        else existing.action_url
      end,
      action_label = case
        when excluded.action_url is not null and excluded.action_label is not null
          then excluded.action_label
        else existing.action_label
      end
    returning id into new_id;

    insert into public.benefit_sources (benefit_id, source_item_id)
    values (new_id, parent_id)
    on conflict do nothing;

    for tier in
      select * from jsonb_array_elements(coalesce(p->'card_tiers', '[]'::jsonb))
    loop
      insert into public.benefit_card_tiers (benefit_id, card_brand, card_level)
      values (new_id, tier->>'card_brand', tier->>'card_level')
      on conflict do nothing;
    end loop;
  end if;

  update public.discovery_candidates
  set
    promoted_id = new_id,
    promoted_at = now(),
    review_status = 'approved'
  where id = candidate_id;

  return new_id;
end;
$$;

grant execute on function public.promote_discovery_candidate(uuid) to authenticated;
grant execute on function public.promote_discovery_candidate(uuid) to service_role;
```

- [ ] **Step 5: Reset and run integration tests to verify GREEN**

Run:

```bash
npx -y supabase@2.95.0 db reset
npm test -- tests/discovery_promote.integration.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0022_discovery_action_links.sql tests/discovery_promote.integration.test.ts
git commit -m "feat(discovery): persistir CTA aprovado"
```

---

### Task 4: Validar e normalizar CTA no Admin

**Files:**
- Create: `src/features/admin/benefits/actionLink.ts`
- Create: `src/features/admin/benefits/actionLink.test.ts`
- Modify: `src/features/admin/benefits/BenefitForm.test.tsx`
- Modify: `src/features/admin/benefits/BenefitForm.tsx`

**Interfaces:**
- Produces: `normalizeActionLink(actionUrl: string, actionLabel: string): ActionLinkResult`.
- Consumes: strings dos campos do formulário.

- [ ] **Step 1: Write failing unit tests for the normalizer**

Create `actionLink.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeActionLink } from './actionLink'

describe('normalizeActionLink', () => {
  it('aceita ausência de CTA', () => {
    expect(normalizeActionLink('', '')).toEqual({
      ok: true,
      value: { action_url: null, action_label: null },
    })
  })

  it('remove espaços externos do par válido', () => {
    expect(normalizeActionLink('  https://amil.com.br/rede  ', '  Ver rede  ')).toEqual({
      ok: true,
      value: {
        action_url: 'https://amil.com.br/rede',
        action_label: 'Ver rede',
      },
    })
  })

  it.each([
    ['https://amil.com.br/rede', ''],
    ['', 'Ver rede'],
    ['javascript:alert(1)', 'Abrir'],
    ['ftp://amil.com.br/rede', 'Abrir'],
    ['amil.com.br/rede', 'Abrir'],
  ])('rejeita combinação inválida %s / %s', (url, label) => {
    expect(normalizeActionLink(url, label)).toMatchObject({ ok: false })
  })
})
```

- [ ] **Step 2: Run unit test to verify RED**

Run:

```bash
npm test -- src/features/admin/benefits/actionLink.test.ts
```

Expected: FAIL because `actionLink.ts` does not exist.

- [ ] **Step 3: Implement the pure normalizer**

Create `actionLink.ts`:

```ts
export type ActionLinkValue = {
  action_url: string | null
  action_label: string | null
}

export type ActionLinkResult =
  | { ok: true; value: ActionLinkValue }
  | { ok: false; error: string }

export function normalizeActionLink(actionUrl: string, actionLabel: string): ActionLinkResult {
  const url = actionUrl.trim()
  const label = actionLabel.trim()

  if (!url && !label) {
    return { ok: true, value: { action_url: null, action_label: null } }
  }
  if (!url || !label) {
    return { ok: false, error: 'Informe a URL e o rótulo da ação juntos.' }
  }

  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { ok: false, error: 'A URL da ação deve usar http ou https.' }
    }
  } catch {
    return { ok: false, error: 'Informe uma URL de ação completa e válida.' }
  }

  return {
    ok: true,
    value: { action_url: url, action_label: label },
  }
}
```

- [ ] **Step 4: Run unit test to verify GREEN**

Run:

```bash
npm test -- src/features/admin/benefits/actionLink.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write failing form tests**

Add to `BenefitForm.test.tsx`:

```tsx
  it('normaliza e submete um CTA HTTP(S) completo', () => {
    const onSubmit = vi.fn()
    render(<BenefitForm initial={null} sources={sources} onSubmit={onSubmit} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Rede Amil' } })
    fireEvent.change(screen.getByLabelText(/resumo/i), { target: { value: 'Hospitais e clínicas' } })
    fireEvent.change(screen.getByLabelText(/URL de ação/i), {
      target: { value: '  https://amil.com.br/rede  ' },
    })
    fireEvent.change(screen.getByLabelText(/rótulo da ação/i), {
      target: { value: '  Ver rede  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({
        action_url: 'https://amil.com.br/rede',
        action_label: 'Ver rede',
      }),
    }))
  })

  it('bloqueia CTA incompleto com erro acessível', () => {
    const onSubmit = vi.fn()
    render(<BenefitForm initial={null} sources={sources} onSubmit={onSubmit} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Rede Amil' } })
    fireEvent.change(screen.getByLabelText(/resumo/i), { target: { value: 'Hospitais e clínicas' } })
    fireEvent.change(screen.getByLabelText(/URL de ação/i), {
      target: { value: 'https://amil.com.br/rede' },
    })
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent(/URL e o rótulo/i)
  })
```

- [ ] **Step 6: Run form tests to verify RED**

Run:

```bash
npm test -- src/features/admin/benefits/BenefitForm.test.tsx
```

Expected: FAIL because values are not normalized and incomplete pairs are submitted.

- [ ] **Step 7: Integrate validation into `BenefitForm`**

Import:

```ts
import { normalizeActionLink } from './actionLink'
```

Add state:

```ts
  const [actionError, setActionError] = useState<string | null>(null)
```

Add `noValidate` to the `<form>` so the explicit application validation can trim values before the browser's URL constraint handling:

```tsx
    <form noValidate onSubmit={submit} style={{ display: 'flex', flexDirection: 'column' }}>
```

At the start of `submit`, after `e.preventDefault()`, add:

```ts
    const action = normalizeActionLink(actionUrl, actionLabel)
    if (!action.ok) {
      setActionError(action.error)
      return
    }
    setActionError(null)
```

Replace the two action fields in the payload with:

```ts
        action_url: action.value.action_url,
        action_label: action.value.action_label,
```

Change the URL input and associate both fields with the validation message:

```tsx
        <Input
          id="b-aurl"
          type="url"
          value={actionUrl}
          aria-describedby={actionError ? 'b-action-error' : undefined}
          aria-invalid={Boolean(actionError)}
          onChange={(e) => setActionUrl(e.target.value)}
        />
```

```tsx
        <Input
          id="b-alabel"
          value={actionLabel}
          aria-describedby={actionError ? 'b-action-error' : undefined}
          aria-invalid={Boolean(actionError)}
          onChange={(e) => setActionLabel(e.target.value)}
        />
        {actionError ? <p id="b-action-error" role="alert">{actionError}</p> : null}
```

- [ ] **Step 8: Run focused Admin tests**

Run:

```bash
npm test -- src/features/admin/benefits/actionLink.test.ts src/features/admin/benefits/BenefitForm.test.tsx src/features/admin/benefits/AdminBenefits.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/admin/benefits/actionLink.ts src/features/admin/benefits/actionLink.test.ts src/features/admin/benefits/BenefitForm.tsx src/features/admin/benefits/BenefitForm.test.tsx
git commit -m "feat(admin): validar links de ação de benefícios"
```

---

### Task 5: Corrigir a Amil em ambientes existentes e novos

**Files:**
- Modify: `tests/seed_catalog.integration.test.ts`
- Modify: `supabase/seed.sql`
- Create: `supabase/migrations/0023_fix_amil_network_action_url.sql`

**Interfaces:**
- Consumes: benefício identificado pelo slug estável `amil-rede-hospitais`.
- Produces: CTA canônico “Ver rede” em instalações existentes e após reset.

- [ ] **Step 1: Write the failing seed contract test**

Add to `tests/seed_catalog.integration.test.ts`:

```ts
  it('Amil aponta diretamente para a busca avançada da rede credenciada', async () => {
    const db = serviceClient()
    const benefit = await db.from('benefits')
      .select('action_url, action_label')
      .eq('slug', 'amil-rede-hospitais')
      .single()

    expect(benefit.error).toBeNull()
    expect(benefit.data).toEqual({
      action_url: 'https://www.amil.com.br/institucional/#/servicos/saude/rede-credenciada/amil/busca-avancada',
      action_label: 'Ver rede',
    })
  })
```

- [ ] **Step 2: Run test to verify RED**

Run:

```bash
npm test -- tests/seed_catalog.integration.test.ts
```

Expected: FAIL showing the current homepage `https://www.amil.com.br`.

- [ ] **Step 3: Correct the seed**

In the `amil-rede-hospitais` tuple in `supabase/seed.sql`, replace only the `action_url` value with:

```sql
    'https://www.amil.com.br/institucional/#/servicos/saude/rede-credenciada/amil/busca-avancada',
```

Keep the separate `source_url` as `https://www.amil.com.br`, because it identifies the official source rather than the action destination.

- [ ] **Step 4: Add the production data migration**

Create `supabase/migrations/0023_fix_amil_network_action_url.sql`:

```sql
update public.benefits
set
  action_url = 'https://www.amil.com.br/institucional/#/servicos/saude/rede-credenciada/amil/busca-avancada',
  action_label = 'Ver rede'
where slug = 'amil-rede-hospitais';
```

- [ ] **Step 5: Reset and run the seed contract to verify GREEN**

Run:

```bash
npx -y supabase@2.95.0 db reset
npm test -- tests/seed_catalog.integration.test.ts
```

Expected: PASS.

- [ ] **Step 6: Verify the public detail regression**

Run:

```bash
npm test -- src/features/detalhe/BenefitDetail.test.tsx
```

Expected: PASS, including direct `href` rendering and rejection of `javascript:`.

- [ ] **Step 7: Commit**

```bash
git add supabase/seed.sql supabase/migrations/0023_fix_amil_network_action_url.sql tests/seed_catalog.integration.test.ts
git commit -m "fix(catalog): usar rede credenciada direta da Amil"
```

---

## Final Verification

- [ ] Run formatting/static diff checks:

```bash
git diff --check
```

Expected: no output.

- [ ] Reset the database and run the full test suite:

```bash
npx -y supabase@2.95.0 db reset
npm test
```

Expected: all tests PASS.

- [ ] Run type checking and production build:

```bash
npm run build
```

Expected: `tsc` and `vite build` exit 0.

- [ ] Inspect the final scope:

```bash
git status --short
git log --oneline -6
```

Expected: only intentional commits/files from Tasks 1–5; no unrelated workspace changes.
