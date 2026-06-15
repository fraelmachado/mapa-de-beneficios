# M7 — Schema real + catálogo Nubank/Inter/XP + bandeiras (design)

**Data:** 2026-06-15
**Status:** aprovado para plano
**Fonte de dados:** `docs/superpowers/prompt_agente_mvp_beneficios_vantagens.md` (varredura datada 2026-06-15)

## 1. Objetivo e escopo

Substituir o seed demo pelo **catálogo real datado** (Nubank, Inter, XP + bandeiras Mastercard/Visa), estendendo o schema para acomodar os dados sem perder a máquina que já funciona (`sources → source_items → benefits` + `benefit_sources` + `user_sources` + view `my_benefits`).

**Dentro do escopo:** migration aditiva de schema, recriação do enum de categoria, tabela de herança de bandeira, nova `my_benefits` (UNION dos dois caminhos), `seed.sql` reescrito com o catálogo real, RLS da tabela nova, testes.

**Fora do escopo (vira M8):** UI de compliance (badges de verificação, fonte+data, alertas de ativação/cobertura no card) e o motor de questionário/inferência (`Question` + `BenefitMatchRule`).

**Entregável:** usuário seleciona seus cartões reais e `my_benefits` retorna benefícios do emissor **e** herdados da bandeira, ponta-a-ponta, com a UI atual inalterada.

## 2. Decisões de modelagem (fechadas)

- **Herança de bandeira: derivada** por `(card_brand, card_level)` via tabela-junção `benefit_card_tiers`. Um cartão novo daquela brand+level herda os benefícios da bandeira automaticamente, sem religar nada.
- **Categorias: 16 chaves técnicas en** no enum (`benefit_category`); labels pt-BR vivem só na camada de UI (constante `CATEGORIES`).
- **Import: `seed.sql` versionado**, idempotente (`ON CONFLICT DO UPDATE`), aplicado local + prod via `/pg/query` (fluxo M5). O doc é uma varredura datada ("seed de MVP, não base definitiva"); congelar num seed versionado é mais honesto que tratar o markdown como fonte viva.
- **Program não vira tabela** — colapsa no atributo `program` (texto) do benefício. YAGNI.
- **`sources` = só emissores** (Nubank/Inter/XP, `kind='card'`). **Mastercard/Visa NÃO são `sources`** (não selecionáveis); existem apenas como pares brand/level em `benefit_card_tiers`.
- **Benefícios duplicados do doc colapsam:** ex. `benefit_nubank_gold_protecao_preco` e `benefit_mastercard_gold_protecao_preco` viram **um** benefício de bandeira em `benefit_card_tiers` (`mastercard`/`gold`). Elimina a duplicação que existia no doc.

## 3. Mudanças de schema (migration `0009_catalogo_real.sql`)

### 3.1 Slugs estáveis (idempotência + referência no seed)
```sql
alter table sources       add column slug text unique;
alter table source_items  add column slug text unique;
alter table benefits      add column slug text unique;
```

### 3.2 Enum de categoria recriado com as 16 chaves
> **Ordem obrigatória:** `my_benefits` depende de `benefits.category`, então a view precisa ser **dropada antes** do swap de enum e recriada depois (seção 4). Por isso 0009 começa com `drop view if exists my_benefits;`.
```sql
drop view if exists my_benefits;  -- depende de benefits.category

create type benefit_category_v2 as enum (
  'travel','insurance','cashback','investback','points','miles','shopping',
  'restaurant','airport','concierge','investment','security',
  'account_service','international_purchase','experience','other');

alter table benefits alter column category drop default;
alter table benefits
  alter column category type benefit_category_v2
  using (
    case category::text
      when 'viagem'        then 'travel'
      when 'entretenimento' then 'experience'
      when 'saude'         then 'security'
      when 'seguros'       then 'insurance'
      when 'compras'       then 'shopping'
      else 'other'
    end::benefit_category_v2
  );
drop type benefit_category;
alter type benefit_category_v2 rename to benefit_category;
```
> Nota: o `using` remapeia eventuais linhas do seed demo; como o seed será reescrito por completo, o remapeamento serve só para a migration não falhar caso rode sobre o banco demo.

### 3.3 Enums auxiliares
```sql
create type benefit_source_kind as enum ('issuer','card_network','partner','mixed');
create type redemption_type as enum (
  'automatic','app','coupon','partner_portal','insurance_claim','certificate',
  'concierge','physical_access','points_exchange','statement_credit','other');
create type verification_status as enum (
  'official_confirmed','official_needs_regulation_check','partner_network',
  'inferred_from_card_network','needs_manual_validation');
create type location_scope as enum (
  'online','physical','global_network','countrywide','airport','city','regional','unknown');
create type geolocation_status as enum ('exact','approximate','needs_geocoding','not_applicable');
```

### 3.4 Colunas aditivas
```sql
alter table benefits
  add column benefit_source benefit_source_kind,
  add column redemption_type redemption_type,
  add column source_url text,
  add column source_name text,
  add column observed_at date,
  add column verification_status verification_status,
  add column notes text,
  add column long_description text,
  add column program text,
  add column requires_activation boolean not null default false,
  add column requires_eligible_card boolean not null default false,
  add column requires_certificate boolean not null default false,
  add column limits_description text;

alter table source_items
  add column display_name text,
  add column product_type text,
  add column eligibility_description text,
  add column points_rule text,
  add column cashback_rule text,
  add column min_investment numeric,
  add column min_income numeric,
  add column min_monthly_spend numeric,
  add column source_url text,
  add column verification_status verification_status;

alter table benefit_locations
  alter column lat drop not null,
  alter column lng drop not null,
  add column scope location_scope,
  add column country text,
  add column region text,
  add column airport_code text,
  add column terminal text,
  add column geolocation_status geolocation_status;
```

### 3.5 Tabela de herança de bandeira
```sql
create table benefit_card_tiers (
  benefit_id uuid not null references benefits(id) on delete cascade,
  card_brand text not null,
  card_level text not null,
  primary key (benefit_id, card_brand, card_level)
);
create index on benefit_card_tiers (card_brand, card_level);
grant select, insert, update, delete on benefit_card_tiers to service_role;
```

### 3.6 RLS de `benefit_card_tiers` (migration `0010_rls_benefit_card_tiers.sql`)
Mesmo padrão das demais tabelas de catálogo: `enable row level security`; `select` para `authenticated`; `insert/update/delete` apenas quando `is_admin()`. `grant` para `authenticated` (quirk local).

## 4. Nova `my_benefits` (migration na própria `0009` ou `0011_my_benefits_card_tiers.sql`)

```sql
drop view if exists my_benefits;
create view my_benefits with (security_invoker = true) as
with unlocked as (
  -- caminho direto (benefício do emissor, ligado ao produto específico)
  select b.id as benefit_id, si.label as via
  from benefits b
  join benefit_sources bs on bs.benefit_id = b.id
  join source_items si on si.id = bs.source_item_id
  join user_sources us on us.source_item_id = si.id
  where us.user_id = auth.uid() and b.active
  union
  -- caminho derivado (benefício de bandeira, herdado por brand+level)
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
       b.created_at, array_agg(distinct u.via order by u.via) as via
from unlocked u join benefits b on b.id = u.benefit_id
group by b.id;
grant select on my_benefits to authenticated;
```

**Contrato de saída idêntico ao atual** (`via text[]`) → frontend não muda. As colunas novas de `benefits` (compliance) **ficam fora da view** por ora, honrando o escopo backend-only; entram na view quando o M8 de UI precisar.

## 5. Seed (`seed.sql` reescrito)

### 5.0 Limpeza do catálogo demo (preâmbulo escopado)
As linhas demo (Itaú/Claro/Livelo e seus benefícios) foram inseridas **sem `slug`** (UUIDs fixos), então **não colidem** com o `ON CONFLICT (slug)` do catálogo real e sobreviveriam ao lado dele. O catálogo passa a ser autoritativo, **mas sem `truncate` cego**: remoção **escopada** apenas do que é demo, em ordem de dependência.

```sql
-- Remove SÓ o catálogo demo, por identificador. Sem truncate-tudo; sem tocar user_sources direto.
delete from benefits
 where id in (
   'd0000001-0000-0000-0000-000000000001',
   'd0000001-0000-0000-0000-000000000002',
   'd0000001-0000-0000-0000-000000000003');           -- cascata: benefit_sources, benefit_locations

delete from sources
 where id in (
   '11111111-1111-1111-1111-111111111111',            -- Itaú
   '22222222-2222-2222-2222-222222222222',            -- Claro
   '33333333-3333-3333-3333-333333333333');           -- Livelo
-- cascata: source_items demo -> e, por FK, user_sources que apontavam p/ eles.
```

> **Decisão (hard replace autorizado):** ao remover os cartões demo, as `user_sources` que apontavam para eles são removidas pela cascata — é intrínseco, pois esses cartões deixam de existir no catálogo e a seleção não tem para onde migrar. `profiles`/`auth.users` ficam intactos.
>
> **Salvaguarda de produção:** a aplicação destrutiva em prod **não é rotina de seed**. É um passo único e deliberado, executado **somente com confirmação explícita do usuário** (igual ao fluxo M5 via `/pg/query`). Antes de aplicar, reportar quantas `user_sources` seriam afetadas. Em local/dev roda livremente (sem usuários reais).

### 5.1 Conteúdo
Transcrição do catálogo do doc, tudo por `slug` + `ON CONFLICT (slug) DO UPDATE`:

- **`sources`** (3): `nubank`, `inter`, `xp` — `kind='card'`, com `institution_url`, `country='BR'`.
- **`source_items`** (~17): cartões/níveis reais com `slug`, `display_name`, `card_brand`, `card_level`, `product_type`, regras (`points_rule`, `cashback_rule`, `min_*`), `source_url`, `verification_status`. Ex.: `nubank-ultravioleta-black` (`mastercard`/`black`), `xp-infinite` (`visa`/`infinite`).
- **`benefits`** (~40): com `benefit_source`, `category`, `redemption_type`, `verification_status`, `source_url`, `observed_at`, flags `requires_*`, `limits_description`, `program`.
- **`benefit_sources`**: liga benefícios **de emissor** (`issuer`/`partner`) aos `source_items` específicos.
- **`benefit_card_tiers`**: liga benefícios **de bandeira** (`card_network`) aos pares brand/level (Mastercard Gold/Platinum/Black, Visa Signature/Infinite). Benefícios `mixed` podem aparecer nos dois.
- **`benefit_locations`**: geo onde houver (lat/lng + `geolocation_status='needs_geocoding'`); `scope`/`geolocation_status` (`not_applicable`) para `global_network`/`online`.

## 6. Testes (TDD)

- **Migration/RLS** (`benefit_card_tiers`): leitura autenticada OK; escrita por não-admin negada; escrita por admin OK.
- **View `my_benefits` (integração):**
  - usuário com cartão `visa`/`infinite` vê benefícios Visa Infinite (caminho derivado) **e** os do emissor daquele cartão;
  - usuário sem cartões → resultado vazio;
  - dedup: 2 cartões que destravam o mesmo benefício → 1 linha, `via` com os 2 labels;
  - benefício `mixed` ligado por ambos os caminhos → 1 linha (UNION dedup).
- **Checklist do doc (seção 13) como casos:** Ultravioleta→Priority Pass + Lounge GRU + pontos/cashback + Nu Viagens + IOF zero; Nubank Gold→benefícios Mastercard Gold; XP Infinite→4 salas VIP + Visa Infinite; Mastercard Black→compra protegida + garantia estendida + concierge; Inter Prime→salas VIP + Priority Pass.
- **App:** suíte atual (84 testes) permanece verde com novo schema/seed; regenerar `database.types.ts`.

## 7. Arquivos afetados

- Criar: `supabase/migrations/0009_catalogo_real.sql`, `0010_rls_benefit_card_tiers.sql`, `0011_my_benefits_card_tiers.sql` (ou consolidar 0009+0011).
- Reescrever: `supabase/seed.sql`.
- Regenerar: `src/lib/database.types.ts`.
- Frontend: nenhuma mudança de comportamento (apenas labels pt-BR das novas categorias na constante `CATEGORIES` de `src/features/benefits/types.ts`).
- Prod: aplicar migrations + seed via `/pg/query`.

## 8. Riscos e mitigação

- **Recriar enum `benefit_category`** quebra dependências (view, constante TS). Mitigação: dropar a view antes, recriar depois; atualizar `CATEGORIES`; regenerar types.
- **`card_brand`/`card_level` inconsistentes** entre seed e `benefit_card_tiers` → benefício não herda. Mitigação: vocabulário controlado documentado no topo do seed (brands: `mastercard`/`visa`; levels: `gold`/`platinum`/`black`/`signature`/`infinite`), e teste de integração cobrindo a herança.
- **Drift seed local × prod.** Mitigação: mesmo `seed.sql` aplicado nos dois ambientes; slugs garantem idempotência.
- **Catálogo demo sobrevivente.** Linhas demo sem `slug` não colidem no `ON CONFLICT` e ficariam órfãs no banco. Mitigação: remoção escopada por identificador (seção 5.0); teste verifica que pós-seed só existem `sources` reais (Nubank/Inter/XP) e nenhuma demo (Itaú/Claro/Livelo).
- **Destruição de `user_sources` em produção.** Remover os cartões demo cascateia para as seleções de usuários reais. Mitigação: hard replace é intrínseco (cartões demo deixam de existir), mas a aplicação em prod é passo único, **autorizado explicitamente**, com contagem de `user_sources` afetadas reportada antes (seção 5.0). Local/dev roda sem restrição.
