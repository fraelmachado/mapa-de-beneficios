# Benefy — MVP Design

**Data:** 2026-06-13
**Status:** Aprovado para planejamento

## Visão geral

Benefy é um agregador/buscador de benefícios que o usuário já possui mas pode não
conhecer: vantagens de cartão de crédito, streamings inclusos na operadora,
programas de fidelidade e descontos por CPF (seguros, salas VIP, descontos em
farmácia/cinema, etc.). A dor central: pessoas pagam por coisas a que já têm
direito de graça.

O MVP usa o **modelo declarativo**: o usuário marca o que possui (banco + variante
de cartão, operadora + plano, programas de fidelidade, opcionalmente CPF) e o app
cruza essas escolhas contra um **catálogo curado de benefícios**. Varredura
automática via CPF/e-mail fica fora do MVP (LGPD/complexidade).

## Objetivo deste build

MVP **para lançar** — app funcional com usuários reais e deploy real, entregando
valor end-to-end mesmo com catálogo inicial pequeno (profundidade > amplitude).

## Decisões fechadas

| Tópico | Decisão |
|---|---|
| Plataforma | PWA mobile-first agora; empacotar nativo (Capacitor) depois |
| Front | Vite + React + TypeScript + Tailwind (SPA, sem SSR) |
| Backend | Supabase (Postgres + Auth + Storage + RLS) |
| Auth | Anônimo primeiro (Supabase anonymous sign-in) → upgrade p/ email mágico/Google |
| Catálogo | Seed curado e estreito + painel admin (CRUD) |
| Motor de cruzamento | Mapeamento relacional por tags (abordagem A), evoluível p/ condições |
| Escopo v1 | Só o core: onboarding → painel → detalhe → busca |
| Pós-MVP | Geolocalização/alertas, push, afiliados, monetização |
| Hospedagem front | Dokploy (build estático Vite, nginx/Nixpacks) |
| Hospedagem backend | Supabase self-hosted no Dokploy (Docker Compose) |

Nota: campos de geolocalização **entram no schema já**, para que o cadastro do
catálogo capture lat/lng/endereço desde o início, mesmo que a feature de alertas
por proximidade seja construída pós-MVP.

## Modelo de dados

Sete tabelas. Relações:

```
sources ──< source_items ──< benefit_sources >── benefits ──< benefit_locations
                  │
profiles ──< user_sources >── source_items
```

### Lado catálogo (curado pelo admin)

**`sources`** — a "fonte" selecionável na grade do onboarding.
- `id` (uuid, pk)
- `kind` (enum: `card` | `carrier` | `loyalty` | `cpf`)
- `name` (text)
- `logo_url` (text, nullable)
- `sort_order` (int)
- `active` (bool, default true)

**`source_items`** — a folha que o usuário realmente marca (ex: Itaú → "Black/Infinite", Claro → "Pós", Livelo → "—").
- `id` (uuid, pk)
- `source_id` (uuid, fk → sources)
- `label` (text)
- `sort_order` (int)

**`benefits`** — o benefício e o "como usar".
- `id` (uuid, pk)
- `title` (text)
- `summary` (text)
- `category` (enum: `viagem` | `entretenimento` | `saude` | `seguros` | `compras`)
- `scope` (enum: `nacional` | `regional` | `pontual`)
- `uf` (text, nullable — para benefícios regionais sem ponto exato)
- `steps` (text, markdown — passo a passo)
- `partner_name` (text, nullable — marca parceira exibida no card)
- `valid_until` (date, nullable — validade; alimenta filtro "vencendo" e alerta futuro)
- `image_url` (text, nullable — banner/imagem)
- `action_url` (text, nullable — link de resgate/emissão)
- `action_label` (text, nullable)
- `active` (bool, default true)
- `created_at` (timestamptz, default now())

**`benefit_sources`** — M:N. O benefício aparece se o usuário tiver **qualquer**
source_item mapeado (semântica OR = abordagem A).
- `benefit_id` (uuid, fk → benefits)
- `source_item_id` (uuid, fk → source_items)
- pk composta (benefit_id, source_item_id)

**`benefit_locations`** — 0..N pontos físicos do benefício (geo capturado já).
- `id` (uuid, pk)
- `benefit_id` (uuid, fk → benefits)
- `name` (text — ex: "Sala VIP GRU T2")
- `lat` (float8), `lng` (float8)
- `address` (text, nullable), `city` (text, nullable), `uf` (text, nullable)
- `radius_m` (int, nullable — raio do gatilho de proximidade futuro)
- `active` (bool, default true)

### Lado usuário

**`profiles`** — espelho do auth com flag de admin.
- `id` (uuid, pk = auth.uid)
- `display_name` (text, nullable)
- `is_admin` (bool, default false)
- `created_at` (timestamptz)

**`user_sources`** — o que a pessoa marcou na varredura.
- `user_id` (uuid, fk → profiles/auth)
- `source_item_id` (uuid, fk → source_items)
- pk composta (user_id, source_item_id)

### Motor de cruzamento

Exposto como view/RPC `my_benefits`, filtrando por `auth.uid()` — nenhuma lógica
de elegibilidade no cliente:

```sql
select distinct b.*, si.label as via
from benefits b
join benefit_sources bs on bs.benefit_id = b.id
join source_items si    on si.id = bs.source_item_id
join user_sources us    on us.source_item_id = si.id
where us.user_id = auth.uid() and b.active;
```

O campo `via` alimenta o selo "através do seu cartão X" da tela de detalhe.

### Evolução futura (não implementar agora)

- Condições complexas (abordagem C): adicionar `benefits.condition jsonb` (nullable)
  e avaliar quando presente — não quebra o mapeamento relacional existente.
- Proximidade geo: habilitar PostGIS/`earthdistance` no Postgres e fazer query de
  raio sobre `benefit_locations` (lat/lng já estarão populados).

## Arquitetura do app

### App do usuário (PWA, mobile-first)

| Rota | Tela | Função |
|---|---|---|
| `/` | Splash/redirect | Cria sessão anônima Supabase se não existir; roteia p/ onboarding ou painel |
| `/onboarding` | Varredura | 3 passos (cartões, operadora, fidelidade/CPF) + tela de transição "cruzando dados…"; grava em `user_sources` |
| `/painel` | Dashboard | Saudação + contagem, destaque do dia, chips de categoria, feed de benefícios cruzados |
| `/beneficio/:id` | Detalhe | Selo "via X", o que inclui, passo a passo, botão de ação (`action_url`) |
| `/buscar` | Busca | Full-text nos benefícios **do usuário** + filtro por categoria |
| `/perfil` | Perfil | Edita `user_sources`; upgrade de conta anônima → email/Google |

Navegação inferior fixa, 3 itens: **Painel · Buscar · Perfil**.

### Painel admin

Mesmo app React, rotas sob `/admin`, protegidas por `profiles.is_admin = true`.

| Rota | Função |
|---|---|
| `/admin` | Login (Supabase Auth) + guarda de rota; nega não-admin |
| `/admin/sources` | CRUD de `sources` e `source_items` |
| `/admin/benefits` | CRUD de `benefits` (todos os campos), seleção dos `source_items` que destravam (M:N) e `benefit_locations` inline |

Sem firula visual: tabelas com busca/filtro + formulários. Upload de logo/imagem
vai pro Supabase Storage (bucket público `assets`).

### Organização do código (feature-based)

```
src/
  lib/supabase.ts        # client
  features/
    auth/                # sessão anônima, upgrade de conta
    onboarding/          # varredura
    benefits/            # painel, detalhe, busca (queries + componentes)
    profile/
    admin/               # CRUD de catálogo
  components/ui/         # primitivos Tailwind reutilizáveis
  routes.tsx
```

Cada feature isola suas queries do Supabase e seus componentes.

## Segurança (RLS)

| Tabela | Leitura | Escrita |
|---|---|---|
| `sources`, `source_items`, `benefits`, `benefit_sources`, `benefit_locations` | qualquer autenticado (inclui anônimo) | só admin |
| `profiles` | dono lê o seu; admin lê todos | dono atualiza o seu, **exceto** `is_admin` |
| `user_sources` | dono | dono (CRUD do próprio) |

**Regra crítica:** `is_admin` nunca é editável pelo próprio usuário — fica fora do
update permitido de `profiles`; só se altera via SQL/service-role. O primeiro
admin é setado manualmente via SQL no setup.

## Deploy, qualidade e dados

- **Migrations:** versionadas via Supabase CLI (`supabase/migrations/*.sql`).
  Schema reprodutível, sem cliques no dashboard.
- **Seed:** `seed.sql` com o catálogo curado inicial (~30-50 benefícios reais,
  montados junto com o usuário).
- **Front:** build estático Vite servido no Dokploy (nginx/Nixpacks), apontando
  para a URL do Supabase self-hosted.
- **Backend:** Supabase self-hosted no Dokploy via Docker Compose. Ops sob
  responsabilidade do dono: backups, upgrades, secrets. (MCP do Dokploy disponível
  para auxiliar no provisionamento.)
- **PWA:** manifest + service worker via `vite-plugin-pwa` (instala na home,
  abre offline a casca do app).
- **Testes:** Vitest para lógica das features (queries/transformações, mapeamento
  perfil→benefícios) e componentes críticos do onboarding. TDD nos pontos de
  lógica de negócio; UI pura sem teste pesado.

## Fora de escopo (pós-MVP)

- Geolocalização e alertas de proximidade (dado já é capturado no cadastro)
- Notificações push / avisos (vencimento de pontos, destaque proativo)
- Links de afiliado e monetização
- Varredura automática via CPF/e-mail
- Empacotamento nativo (Capacitor) — habilitado pela escolha PWA-first
```
