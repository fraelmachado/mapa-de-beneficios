# Mapa de Benefícios M5 — Deploy no Dokploy (design)

**Data:** 2026-06-14
**Status:** Aprovado para planejamento

## Visão geral

Colocar o Mapa de Benefícios (M1–M4) no ar num **deploy temporário** no Dokploy self-hosted da
Rampap, com um **Supabase dedicado** e o front PWA servido estaticamente. Objetivo:
app navegável de ponta a ponta numa URL pública (domínio temporário), com magic link
funcionando via Resend. É uma milestone de **infra/ops e outward-facing** — ações
reais (criar serviços, deploy, envio de e-mail) são confirmadas com o usuário antes
de executar.

## Contexto do ambiente (inspecionado via Dokploy MCP)

- Dokploy **v0.29.8**, self-hosted (`isCloud=false`), **um servidor** (local; sem
  servidores remotos registrados).
- **Provider GitHub já conectado** ("Dokploy-Rampap-30-01-2025") — dá para ligar o
  repo `fraelmachado/mapa-de-beneficios`.
- Já existe um Supabase self-hosted ("Rampap") como referência de padrão de compose —
  **não será reutilizado** (Mapa de Benefícios terá instância dedicada para isolamento de auth/DB).
- Host compartilhado e povoado (n8n, Metabase, Flowise, etc.) — atenção a recursos.

## Decisões fechadas

| Tópico | Decisão |
|---|---|
| Supabase | **Instância dedicada nova** (compose oficial), não reusar a "Rampap" |
| Método Supabase | Compose oficial como serviço "compose" do Dokploy (abordagem A) |
| Domínio | **Temporário** auto-gerado pelo Dokploy (`traefik.me`/sslip.io), HTTPS via Traefik/Let's Encrypt; troca por domínio próprio no lançamento |
| E-mail (magic link) | **Resend SMTP** (`smtp.resend.com`), domínio verificado no Resend |
| Front deploy | GitHub `fraelmachado/mapa-de-beneficios`@`main` + **Dockerfile** (nginx) + **auto-deploy por webhook** |
| Catálogo prod | Aplicar migrations `0001–0006` + **seed demo** (`seed.sql`) |
| Admin CRUD | **Não existe ainda** — fica para M6 (curadoria real do catálogo) |
| Segredos | Apenas no Dokploy (env); nunca no git. `ANON_KEY` no bundle do front é público por design |

## Arquitetura

Projeto Dokploy novo `benefy` (environment `production`) com dois deployables no
mesmo host/rede Docker:

### 1. `supabase` (compose)
Compose oficial do Supabase. Serviços: Postgres, GoTrue (auth), PostgREST (REST),
Realtime, Storage, **Kong** (API gateway), Studio, Meta.

- **Exposto publicamente:** apenas o **Kong** (porta da API), via Traefik com domínio
  `traefik.me` automático e HTTPS. Esta é a `VITE_SUPABASE_URL` de produção.
- **NÃO exposto:** Postgres (só rede interna) e Studio (acesso interno; se precisar,
  via basic-auth do Traefik — fora do escopo do MVP).

### 2. `web` (application)
SPA Vite estático.

- Fonte: GitHub `fraelmachado/mapa-de-beneficios`, branch `main`, build por Dockerfile.
- Exposto via Traefik com outro domínio `traefik.me` automático (HTTPS) = o app.
- Fala com o Supabase **a partir do navegador** → usa a URL pública do Kong embutida
  no build (build-time, Vite).

## Configuração do Supabase (env / secrets)

Gerados na criação e guardados **somente no Dokploy**:

- `POSTGRES_PASSWORD` — forte, aleatória
- `JWT_SECRET` — ≥ 32 chars, aleatória
- `ANON_KEY`, `SERVICE_ROLE_KEY` — JWTs assinados com o `JWT_SECRET` (regenerados para
  casar com o secret; chaves de exemplo do compose NÃO servem)
- `SITE_URL` = URL pública do app (`https://benefy.<traefik.me>`)
- `ADDITIONAL_REDIRECT_URLS` = URL do app
- `API_EXTERNAL_URL` / `SUPABASE_PUBLIC_URL` = URL pública do Kong
- Anonymous sign-ins **habilitado** (`GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED=true` /
  equivalente do compose)
- `GOTRUE_MAILER_AUTOCONFIRM=false` (magic link exige confirmação por e-mail)
- SMTP (Resend): `SMTP_HOST=smtp.resend.com`, `SMTP_PORT=465`, `SMTP_USER=resend`,
  `SMTP_PASS=<RESEND_API_KEY>`, remetente `no-reply@<domínio verificado no Resend>`
- Credenciais do Studio (`DASHBOARD_USERNAME`/`DASHBOARD_PASSWORD`) — Studio não público

Pré-requisito Resend: uma **API key** e um **domínio verificado** (checar via Resend
MCP/skill durante a execução).

## Build do front (mudanças no repo)

- `Dockerfile` multi-stage:
  1. `node:20-alpine`: `npm ci` + `npm run build`, recebendo build-args
     `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (Vite injeta em build-time).
  2. `nginx:alpine`: serve `dist/` com `nginx.conf` que faz **SPA fallback**
     (`try_files $uri /index.html`) e serve corretamente `manifest.webmanifest` e
     `sw.js` (sem cache agressivo no `sw.js`/`index.html`).
- `.dockerignore` (node_modules, dist, .env*, supabase/.branches, etc.).
- O `ANON_KEY` embutido no bundle é público por design (a segurança real é a RLS).

## Migrations + seed em produção

Aplicar `supabase/migrations/0001–0006` + `supabase/seed.sql` no Postgres de produção:

- Via `supabase db push --db-url <conn-string-prod>` (aplica as migrations
  versionadas) e `psql <conn> -f supabase/seed.sql` para o seed demo.
- Acesso ao Postgres: expor temporariamente a porta interna no Dokploy (ou rodar um
  one-off na rede do compose) e **fechar depois**. A connection-string usa a
  `POSTGRES_PASSWORD` gerada.
- Resultado esperado: schema completo + RLS + view `my_benefits` + RPC
  `replace_user_sources` + catálogo demo (Itaú/Claro/Livelo + 3 benefícios).

## CI/CD

- Usar o provider GitHub já conectado; ligar o app `web` ao repo
  `fraelmachado/mapa-de-beneficios`@`main`, build por Dockerfile.
- **Auto-deploy por webhook:** push na `main` redeploya o front.
- **Pré-passo obrigatório:** `git push` — o `main` local está à frente do `origin`
  (M1–M4 ainda não publicados). Garantir que `.env*` continua gitignored.

## Verificação (smoke test em produção)

1. Abrir a URL do app → cai no onboarding (sessão anônima criada).
2. Selecionar Itaú "Black/Infinite" → concluir → painel mostra **2 benefícios**.
3. Abrir um benefício (detalhe) e a busca.
4. Perfil → enviar magic link para um e-mail → confirmar que o e-mail chega (Resend).

Ferramenta: MCP do Chrome DevTools (ou `curl`) para validar o app no ar.

## Segurança / ações outward-facing

- Criar serviços, deployar e enviar e-mail são ações reais — **confirmar com o usuário
  antes de cada uma**.
- Segredos só no Dokploy (env). Nada de secret commitado. Verificar o diff antes de
  cada push.
- Postgres e Studio não públicos. Apenas Kong (API) e o app expostos.

## Ordem de execução (detalhada no plano)

1. **Repo prep:** `Dockerfile`, `nginx.conf`, `.dockerignore` (commit) + `git push` da `main`.
2. **Projeto Dokploy** `benefy` (production).
3. **Supabase compose:** subir com env (secrets, auth, SMTP) + domínio `traefik.me` no Kong.
4. **Migrations + seed** no Postgres de produção.
5. **App `web`:** criar do GitHub, build-args (`VITE_SUPABASE_URL`=Kong, `VITE_SUPABASE_ANON_KEY`), domínio `traefik.me`, auto-deploy webhook; deploy.
6. **Smoke test** end-to-end (inclui magic link via Resend).

## Fora de escopo (futuro)

- Domínio próprio + DNS (lançamento) e PNG de ícone para iOS.
- Painel admin de curadoria do catálogo (**M6**).
- Backups automatizados do Postgres de produção, observabilidade/alertas.
- Hardening extra (basic-auth no Studio, rate limiting, etc.).
