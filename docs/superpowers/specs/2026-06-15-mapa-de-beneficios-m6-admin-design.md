# Mapa de Benefícios M6 — Painel admin de catálogo (design)

**Data:** 2026-06-15
**Status:** Aprovado para planejamento

## Visão geral

Hoje o catálogo (sources, source_items, benefits, mapeamentos, locations) só é
populado pelo `seed.sql`. O M6 entrega um **painel admin in-app** para curar o
catálogo de verdade: criar/editar/remover fontes, variantes, benefícios, o vínculo
benefício↔variantes, e locais (geo) — incluindo os campos de alinhamento Pluggy/Open
Finance adicionados no 0007. Acesso restrito a usuários `is_admin`.

## Decisões fechadas

| Tópico | Decisão |
|---|---|
| Estrutura | Admin como árvore de rotas `/admin` no MESMO app (abordagem A), gateado por `is_admin` |
| Login admin | E-mail + senha (`signInWithPassword`) — funciona sem SMTP |
| 1º admin | Bootstrap via service role/SQL (cria usuário + `is_admin=true`); local e prod |
| Imagens | Upload pro Supabase Storage (bucket público `assets`) |
| Escopo CRUD | Catálogo completo: sources(+source_items, +campos Pluggy), benefits(+todos os campos), benefit_sources (vínculo), benefit_locations (geo) |
| Front auth | Sessão autenticada do admin (sem service role no cliente); RLS faz cumprir |
| Fora de escopo | Integração Pluggy (só preencher campos manual), analytics, edição em massa |

## Arquitetura

Admin vive no mesmo SPA (Vite/React), reusando `lib/supabase.ts`, TanStack Query e
React Router. Rotas sob `/admin`, fora do `AppLayout`/BottomNav do app do usuário.

### Auth & acesso
- `/admin/login` — formulário e-mail/senha → `supabase.auth.signInWithPassword`.
- `useIsAdmin(userId)` — query `select is_admin from profiles where id = auth.uid()`
  (chave `['is_admin', userId]`). Retorna boolean.
- `AdminGuard` — componente que envolve as rotas admin: espera sessão (AuthProvider já
  garante), checa `useIsAdmin`; se não-admin → redireciona pra `/admin/login`
  (ou mostra "sem acesso"). Estados de loading/erro tratados.
- **Bootstrap do 1º admin** (setup, não-UI): via service role criar o usuário admin
  (email/senha) e `update profiles set is_admin = true where id = <uid>`. O trigger
  `protect_is_admin` já permite isso via service role. Documentado no plano; aplicado
  local e prod.

### Layout & rotas
- `AdminLayout` — casca própria (cabeçalho + navegação admin: Sources, Benefits, Sair).
- `/admin` — home com atalhos/contagens.
- `/admin/sources` — lista + edição de fontes (e suas variantes).
- `/admin/benefits` — lista + edição de benefícios (vínculos + locais).
- `/admin/login` — fora do guard.

### CRUD de Sources
Lista (nome, kind, ativo) com busca. Formulário cria/edita:
- Núcleo: `name`, `kind` (card/carrier/loyalty/cpf), `sort_order`, `active`, `logo_url` (via upload).
- Pluggy: `connector_type`, `pluggy_connector_id`, `institution_url`, `primary_color`, `country`.
- **source_items aninhados:** adicionar/editar/remover variantes (`label`, `sort_order`,
  `card_brand`, `card_level`, `pluggy_product`).

### CRUD de Benefits
Lista (título, categoria, ativo) com busca/filtro. Formulário cria/edita:
- Campos: `title`, `summary`, `category`, `scope`, `uf`, `steps` (markdown/multilinha),
  `partner_name`, `valid_until`, `image_url` (via upload), `action_url`, `action_label`, `active`.
- **benefit_sources:** multi-select das `source_items` que destravam o benefício.
- **benefit_locations:** lista inline de locais (`name`, `lat`, `lng`, `address`,
  `city`, `uf`, `radius_m`, `active`).

### Storage (imagens)
- Bucket público `assets` (leitura pública; escrita/observação só admin via policy).
- Componente `ImageUpload` — sobe o arquivo pra `assets/<pasta>/<arquivo>`, obtém a
  URL pública e devolve pro campo (`logo_url`/`image_url`).
- Migração nova cria o bucket e as policies de storage.

### Segurança (RLS)
- Escrita do catálogo (sources/source_items/benefits/benefit_sources/benefit_locations)
  já é gateada por `is_admin()` (M1). Sem mudança nas policies das tabelas.
- **Storage policies:** `objects` no bucket `assets` — `select` público; `insert`/
  `update`/`delete` só quando `is_admin()`.
- O front admin usa a sessão do admin (não service role). Um não-admin que tente
  escrever é barrado pela RLS (defesa real no servidor).

### Dados & componentes
Organização feature-based:
```
src/features/admin/
  AdminGuard.tsx
  AdminLayout.tsx
  useIsAdmin.ts
  AdminLogin.tsx
  AdminHome.tsx
  sources/  (AdminSources.tsx, SourceForm.tsx, SourceItemsEditor.tsx, hooks)
  benefits/ (AdminBenefits.tsx, BenefitForm.tsx, BenefitSourcesEditor.tsx, BenefitLocationsEditor.tsx, hooks)
  upload/   (ImageUpload.tsx, useUploadAsset.ts)
```
Hooks TanStack Query para list/create/update/delete de cada entidade, com
invalidação das queries do app (`['sources']`, `['my_benefits']`, etc.) quando fizer
sentido.

### Testes
- Componentes (forms/listas/guard) com hooks mockados (Vitest + Testing Library).
- Lógica pura (ex.: montar payloads, validação de campos).
- Integração (Supabase local): admin consegue CRUD do catálogo; não-admin é negado
  (reforça as policies do M1); upload/policy do bucket `assets` (admin escreve,
  leitura pública).

### Deploy
- Auto-deploy do front no push (webhook já ligado).
- Migração do bucket aplicada local + prod (via `/pg/query` ou storage API).
- Bootstrap do admin executado local e prod (service role).

## Fora de escopo (futuro)
- Integração Pluggy real (Connect Token, sync de Items/Accounts).
- Roles/permissões além de `is_admin` (ex.: editores), audit log, edição em massa,
  i18n do admin.
