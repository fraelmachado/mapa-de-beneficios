# M8a — Fonte, data de coleta e benefícios da mesma fonte (design)

**Data:** 2026-06-16
**Status:** aprovado para plano

## 1. Objetivo e escopo

Dar transparência ao usuário sobre **de onde** veio a informação de cada benefício e **quando** foi coletada, e permitir explorar **outros benefícios catalogados da mesma fonte oficial**.

Os dados já existem no banco (colunas `benefits.source_url`, `source_name`, `observed_at`, criadas no M7) mas não são projetados pela view `my_benefits` nem exibidos no app.

**Dentro do escopo:** estender a view `my_benefits` com os 3 campos; exibir bloco "Fonte" + data na tela de detalhe; listar "Da mesma fonte" (benefícios do próprio usuário com o mesmo `source_url`); testes; aplicação aditiva em produção.

**Fora do escopo:** descoberta de benefícios que o usuário **não** tem (catálogo completo por fonte); surfacing de `verification_status` / alertas de ativação (M8b futuro); fonte no card da lista.

## 2. Decisões (fechadas com o usuário)

- **Correlação = mesma `source_url`**, restrita aos benefícios que o usuário **possui** (dentro de `my_benefits`). Sem expor o catálogo inteiro — privacidade e simplicidade. Filtragem client-side sobre os dados já carregados.
- **Incluir a data da última coleta/atualização** (`observed_at`), rotulada como "Informações coletadas em DD/MM/AAAA".
- **`verification_status` fica de fora** por ora (YAGNI).
- **Card permanece limpo**; fonte/data/correlação só na tela de detalhe.

## 3. Dados — migração `0011_my_benefits_fonte.sql`

Recria a view `my_benefits` adicionando 3 colunas à projeção (mantém o CTE `unlocked` com os dois caminhos e o `array_agg` de `via` exatamente como no M7; só acrescenta colunas no `select` final):

```sql
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

> A view permanece `security_invoker`; a RLS das tabelas-base segue filtrando por `auth.uid()`. Nenhuma mudança de RLS.

## 4. Camada de dados no app

- `MyBenefit` (em `src/features/benefits/types.ts`): adicionar `source_url: string | null`, `source_name: string | null`, `observed_at: string | null`.
- `useMyBenefits` (`select(...)`): incluir `source_url, source_name, observed_at` na string de seleção.
- Regenerar `src/lib/database.types.ts`.

## 5. UI — `src/features/detalhe/BenefitDetail.tsx`

Abaixo do bloco "Como usar" (e do botão de ação), renderizar **condicionalmente**:

**Bloco "Fonte"** (só se `safeHttpUrl(source_url)` existir):
- Link externo seguro (`target="_blank" rel="noreferrer"`, reuso de `safeHttpUrl`), com texto = `source_name` se houver, senão o host da URL (`new URL(url).host`).
- Linha discreta: "Informações coletadas em {data}" quando `observed_at` existir, formatada pt-BR (`new Date(observed_at + 'T00:00:00').toLocaleDateString('pt-BR')` — `observed_at` é `date`, sem timezone; o `T00:00:00` evita deslocamento de fuso).

**Bloco "Da mesma fonte"** (só se houver ≥1 correlato):
- Da lista completa de `useMyBenefits` (já disponível via `useBenefit`, que reusa `useMyBenefits`), filtrar benefícios com o mesmo `source_url` (não nulo) e `id` diferente do atual.
- Renderizar cada um como `<Link to={'/beneficio/' + b.id}>` com o `title`.

Para acessar a lista completa dentro do detalhe, `useBenefit` passa a expor também `related` (ou o componente usa `useMyBenefits` diretamente). Decisão: estender `useBenefit` para retornar `related: MyBenefit[]` (benefícios com mesmo `source_url`, exceto o atual), mantendo a lógica de correlação testável isoladamente.

## 6. Testes

- **View (integração):** um usuário com um cartão recebe, em `my_benefits`, os campos `source_url`/`source_name`/`observed_at` preenchidos para um benefício conhecido do catálogo real.
- **Correlação (unidade):** função pura que, dada a lista e um benefício, retorna os de mesma `source_url` exceto ele mesmo; ignora `source_url` nulo.
- **BenefitDetail (componente):** renderiza o link de fonte + data quando presentes; oculta o bloco quando `source_url` é nulo; renderiza "Da mesma fonte" com correlatos e oculta quando não há.

## 7. Arquivos afetados

- Criar: `supabase/migrations/0011_my_benefits_fonte.sql`.
- Modificar: `src/features/benefits/types.ts`, `src/features/benefits/useMyBenefits.ts`, `src/features/benefits/useBenefit.ts`, `src/features/detalhe/BenefitDetail.tsx`, `src/lib/database.types.ts` (regen).
- Criar (correlação testável): `src/features/benefits/relatedBySource.ts` + teste.
- Testes: novo teste de view (`tests/my_benefits_fonte.integration.test.ts`), unidade de `relatedBySource`, e ampliação de `BenefitDetail.test.tsx`.

## 8. Produção

- Aplicar `0011` via postgres-meta `/pg/query` (aditiva: só recria a view; não toca dados nem RLS). Reportar e confirmar antes.
- Rebuild do front (a mudança altera o bundle). Confirmar o deploy de produção com o usuário antes de disparar.

## 9. Riscos

- **Drift bundle×dados:** como no M7, a mudança de UI exige rebuild do front; sem ele, a tela de detalhe antiga ignora os novos campos (degradação graciosa — não quebra, só não mostra). Mitigação: rebuild do front junto com a migração.
- **Formato de `observed_at`:** é `date` (string `YYYY-MM-DD`). Formatar com âncora `T00:00:00` para evitar deslocamento de fuso ao exibir.
