# Mapa de Benefícios M5 — Deploy no Dokploy Implementation Plan

> **For agentic workers:** Este plano é um RUNBOOK de infra/ops. Tasks 1–2 são código/artefato no repo (verificáveis localmente) e podem ir por subagente. Tasks 3–7 são **outward-facing** (criam infra real, fazem deploy, enviam e-mail): execute **inline no loop principal**, confirmando com o usuário em cada passo marcado ⚠️ CONFIRMAR. Muitos valores (IDs do Dokploy, domínios gerados, segredos) são descobertos ao vivo — registre-os conforme aparecem.

**Goal:** Mapa de Benefícios (M1–M4) no ar num deploy temporário: Supabase dedicado + front PWA estático no Dokploy, com magic link via Resend, em domínios `traefik.me`.

**Architecture:** Projeto Dokploy `benefy` com um compose Supabase oficial (só Kong exposto) e um app `web` (Dockerfile nginx) buildado do GitHub com auto-deploy. Front fala com o Supabase pela URL pública do Kong embutida no build.

**Tech Stack:** Dokploy v0.29.8 (MCP), Docker/OrbStack, Supabase self-hosted (compose oficial), Vite/nginx, Resend SMTP, Supabase CLI.

**Referência:** spec `docs/superpowers/specs/2026-06-14-mapa-de-beneficios-m5-deploy-design.md`.

---

## Pré-condições

- M1–M4 + hardenings na `main`, testes verdes, `npm run build` ok.
- Dokploy MCP conectado; provider GitHub "Dokploy-Rampap" conectado.
- Repo `github.com/fraelmachado/mapa-de-beneficios` existe; `main` local está à frente do `origin` (não publicado).
- Conta Resend com API key e domínio verificado (confirmar na Task 6).

---

## Estrutura de arquivos (M5, no repo)

```
Dockerfile            # CRIA: build multi-stage (node -> nginx)
nginx.conf            # CRIA: SPA fallback + cache headers
.dockerignore         # CRIA: enxuga o contexto de build
scripts/gen-supabase-keys.mjs   # CRIA: helper local p/ JWT_SECRET + anon/service keys (commit OK; não contém segredos)
```
Nenhum segredo entra no repo. Tudo sensível vai pro env do Dokploy.

---

## Task 1: Artefatos de build do front (Dockerfile + nginx)

**Files:**
- Create: `Dockerfile`, `nginx.conf`, `.dockerignore`

- [ ] **Step 1: `.dockerignore`**

Create `.dockerignore`:
```
node_modules
dist
.git
.env
.env.local
.env.test
supabase
docs
tests
coverage
*.log
```

- [ ] **Step 2: `nginx.conf`**

Create `nginx.conf`:
```nginx
server {
  listen 80;
  server_name _;
  root /usr/share/nginx/html;
  index index.html;

  # Assets com hash: cache longo e imutável
  location /assets/ {
    add_header Cache-Control "public, max-age=31536000, immutable";
    try_files $uri =404;
  }

  # Shell e service worker: nunca cachear (pra updates propagarem)
  location = /index.html { add_header Cache-Control "no-cache"; }
  location = /sw.js { add_header Cache-Control "no-cache"; }
  location = /manifest.webmanifest { add_header Cache-Control "no-cache"; }

  # SPA fallback
  location / {
    try_files $uri $uri/ /index.html;
  }
}
```

- [ ] **Step 3: `Dockerfile`**

Create `Dockerfile`:
```dockerfile
# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_ANON_KEY=$VITE_SUPABASE_ANON_KEY
RUN npm run build

# ---- serve ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

- [ ] **Step 4: Verificar o build da imagem localmente (Docker/OrbStack)**

Run:
```bash
docker build \
  --build-arg VITE_SUPABASE_URL=https://example.test \
  --build-arg VITE_SUPABASE_ANON_KEY=dummy \
  -t mapa-de-beneficios-web:local .
```
Expected: build conclui sem erro (npm ci → vite build → nginx copy).

- [ ] **Step 5: Verificar que a imagem serve o SPA + fallback**

Run:
```bash
docker run -d --rm -p 8099:80 --name mapa-de-beneficios-web-test mapa-de-beneficios-web:local
sleep 2
echo "--- raiz ---"; curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8099/
echo "--- rota profunda (fallback SPA) ---"; curl -s http://localhost:8099/painel | grep -o "<title>[^<]*</title>" || echo "sem title"
docker stop mapa-de-beneficios-web-test
```
Expected: raiz responde `200`; a rota `/painel` retorna o HTML do shell (mesmo `index.html`), provando o fallback.

- [ ] **Step 6: Commit**

```bash
git add Dockerfile nginx.conf .dockerignore
git commit -m "build: Dockerfile (nginx) + nginx.conf SPA + .dockerignore para deploy"
```

---

## Task 2: Helper de geração de chaves do Supabase

**Files:**
- Create: `scripts/gen-supabase-keys.mjs`

- [ ] **Step 1: Script gerador (HS256 JWTs casados com o JWT_SECRET)**

Create `scripts/gen-supabase-keys.mjs`:
```js
// Uso: node scripts/gen-supabase-keys.mjs
// Gera JWT_SECRET e as chaves ANON/SERVICE_ROLE assinadas com ele (HS256),
// + uma POSTGRES_PASSWORD. Saída só no stdout — NÃO commitar os valores.
import crypto from 'node:crypto'

const jwtSecret = crypto.randomBytes(32).toString('hex')
const pgPassword = crypto.randomBytes(24).toString('base64url')

const b64url = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
function sign(payload) {
  const head = b64url({ alg: 'HS256', typ: 'JWT' })
  const body = b64url(payload)
  const sig = crypto.createHmac('sha256', jwtSecret).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}

const iat = Math.floor(new Date('2026-01-01T00:00:00Z').getTime() / 1000)
const exp = iat + 10 * 365 * 24 * 3600 // ~10 anos

console.log('POSTGRES_PASSWORD=' + pgPassword)
console.log('JWT_SECRET=' + jwtSecret)
console.log('ANON_KEY=' + sign({ role: 'anon', iss: 'supabase', iat, exp }))
console.log('SERVICE_ROLE_KEY=' + sign({ role: 'service_role', iss: 'supabase', iat, exp }))
console.log('DASHBOARD_PASSWORD=' + crypto.randomBytes(16).toString('base64url'))
```

- [ ] **Step 2: Rodar e conferir o formato**

Run: `node scripts/gen-supabase-keys.mjs`
Expected: imprime 5 linhas `CHAVE=valor`. Os JWTs têm 3 segmentos separados por `.`. **Guarde essa saída com segurança** (vai pro env do Dokploy na Task 4) — não cole em arquivo versionado.

- [ ] **Step 3: Commit (só o script, sem valores)**

```bash
git add scripts/gen-supabase-keys.mjs
git commit -m "chore: helper local de geração de chaves do Supabase"
```

---

## Task 3: ⚠️ CONFIRMAR — Publicar o repo no GitHub

Outward-facing: torna o código público/remoto. Confirmar com o usuário antes.

- [ ] **Step 1: Conferir o que será publicado**

Run:
```bash
git status -sb
git log --oneline origin/main..HEAD 2>/dev/null | wc -l
git ls-files | grep -E "\.env" || echo "nenhum .env rastreado (ok)"
```
Expected: confirmar que NENHUM `.env`/segredo está rastreado; ver quantos commits serão publicados.

- [ ] **Step 2: ⚠️ CONFIRMAR e publicar**

Após o "ok" do usuário:
```bash
git push -u origin main
```
Expected: push aceito; `origin/main` passa a refletir a `main` local.

---

## Task 4: ⚠️ CONFIRMAR — Projeto Dokploy + Supabase dedicado

Outward-facing: cria infra real. Executar inline via Dokploy MCP, confirmando antes de criar/deployar.

- [ ] **Step 1: Criar o projeto `benefy`**

MCP: `mcp__dokploy__project-create` com `{ name: "benefy", description: "Mapa de Benefícios — agregador de benefícios" }`.
Registrar o `projectId` e o `environmentId` (production) retornados.

- [ ] **Step 2: Obter o docker-compose oficial do Supabase**

Usar o compose oficial de self-hosting do Supabase (referência: `github.com/supabase/supabase` → `docker/docker-compose.yml`), pinado numa versão estável. Este é o conteúdo do serviço compose no Dokploy.

- [ ] **Step 3: Montar o `.env` do Supabase (no Dokploy, não no repo)**

Variáveis a definir (valores da Task 2 + domínios; os domínios `traefik.me` só são conhecidos após o Step 5 — usar placeholders e atualizar):
```
POSTGRES_PASSWORD=<da Task 2>
JWT_SECRET=<da Task 2>
ANON_KEY=<da Task 2>
SERVICE_ROLE_KEY=<da Task 2>
DASHBOARD_USERNAME=admin
DASHBOARD_PASSWORD=<da Task 2>
POSTGRES_HOST=db
POSTGRES_DB=postgres
POSTGRES_PORT=5432
SITE_URL=https://<dominio-app-traefikme>
API_EXTERNAL_URL=https://<dominio-kong-traefikme>
SUPABASE_PUBLIC_URL=https://<dominio-kong-traefikme>
ADDITIONAL_REDIRECT_URLS=https://<dominio-app-traefikme>
DISABLE_SIGNUP=false
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=true
SMTP_ADMIN_EMAIL=no-reply@<dominio-verificado-resend>
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=<RESEND_API_KEY>
SMTP_SENDER_NAME=Mapa de Benefícios
```
(Demais variáveis do compose ficam nos defaults do template oficial.)

- [ ] **Step 4: ⚠️ CONFIRMAR — Criar o serviço compose**

MCP: `mcp__dokploy__compose-create` no `environmentId` do projeto, nome `supabase`, com o compose do Step 2 e o env do Step 3. Confirmar antes de criar.

- [ ] **Step 5: Gerar domínio temporário pro Kong**

MCP: gerar domínio `traefik.me` apontando pro serviço Kong (porta da API, normalmente 8000) — `mcp__dokploy__domain-generateDomain` / `domain-create` no serviço do compose. Registrar o hostname gerado → este é `API_EXTERNAL_URL`/`SUPABASE_PUBLIC_URL`. Atualizar o env (Step 3) com o valor real.

- [ ] **Step 6: ⚠️ CONFIRMAR — Deploy do Supabase**

MCP: `mcp__dokploy__compose-deploy`. Confirmar antes. Acompanhar logs (`compose-readLogs`) até os serviços subirem (db, auth, rest, kong saudáveis).

- [ ] **Step 7: Verificar a API pública**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<dominio-kong-traefikme>/auth/v1/health
```
Expected: `200` (GoTrue saudável atrás do Kong).

---

## Task 5: ⚠️ CONFIRMAR — Migrations + seed em produção

Outward-facing: escreve no banco de produção.

- [ ] **Step 1: Obter conexão temporária ao Postgres de produção**

Expor temporariamente a porta do Postgres do compose (Dokploy: porta externa no serviço `db`) OU rodar via rede interna. Montar a connection string: `postgresql://postgres:<POSTGRES_PASSWORD>@<host>:<porta>/postgres`.

- [ ] **Step 2: ⚠️ CONFIRMAR — Aplicar migrations**

Run (com a conn string real):
```bash
supabase db push --db-url "postgresql://postgres:<pw>@<host>:<porta>/postgres"
```
Expected: aplica `0001`–`0006` sem erro.
(Fallback se `db push` reclamar de ambiente: aplicar os arquivos `supabase/migrations/*.sql` em ordem via `psql "<conn>" -f <arquivo>`.)

- [ ] **Step 3: Aplicar o seed demo**

Run:
```bash
psql "postgresql://postgres:<pw>@<host>:<porta>/postgres" -f supabase/seed.sql
```
Expected: insere fontes/itens/benefícios/mapeamentos/local demo.

- [ ] **Step 4: Verificar o schema**

Run:
```bash
psql "postgresql://postgres:<pw>@<host>:<porta>/postgres" -c "select count(*) from benefits;"
psql "postgresql://postgres:<pw>@<host>:<porta>/postgres" -c "select table_name from information_schema.views where table_name='my_benefits';"
```
Expected: `benefits` ≥ 3; view `my_benefits` existe.

- [ ] **Step 5: ⚠️ CONFIRMAR — Fechar o acesso ao Postgres**

Remover a porta externa temporária do `db` (Dokploy) e redeploy do compose se necessário. Confirmar que o Postgres voltou a ser interno-only.

---

## Task 6: ⚠️ CONFIRMAR — App web (GitHub + Dockerfile + auto-deploy)

- [ ] **Step 1: Confirmar Resend (pré-requisito do magic link)**

Via Resend MCP/skill: confirmar que existe uma API key e um **domínio verificado**. Registrar o remetente (`no-reply@<dominio-verificado>`) e a API key (vai no `SMTP_PASS` do Supabase — Task 4 Step 3; se o Supabase já subiu sem isso, atualizar o env e redeploy).

- [ ] **Step 2: ⚠️ CONFIRMAR — Criar a aplicação `web`**

MCP: `mcp__dokploy__application-create` no `environmentId`, nome `web`. Depois `application-saveGithubProvider` (githubId `kjbNpJ9sEgsk_qs0pA4Oh`, repo `fraelmachado/mapa-de-beneficios`, branch `main`) e `application-saveBuildType` = `dockerfile` (path `Dockerfile`).

- [ ] **Step 3: Build args (build-time env do Vite)**

MCP: `application-saveEnvironment` com build args / env:
```
VITE_SUPABASE_URL=https://<dominio-kong-traefikme>
VITE_SUPABASE_ANON_KEY=<ANON_KEY da Task 2>
```
(Garantir que o Dokploy passa esses como `--build-arg` no Dockerfile.)

- [ ] **Step 4: Domínio do app**

MCP: gerar domínio `traefik.me` pro app (porta 80). Registrar → este é o `SITE_URL`. Se diferente do placeholder da Task 4, **atualizar o env do Supabase** (`SITE_URL`/`ADDITIONAL_REDIRECT_URLS`) e redeploy do compose.

- [ ] **Step 5: Auto-deploy (webhook)**

MCP: habilitar auto-deploy na aplicação (`application-update` com autoDeploy, ou `application-refreshToken` p/ o webhook). Registrar a URL do webhook.

- [ ] **Step 6: ⚠️ CONFIRMAR — Deploy do app**

MCP: `application-deploy`. Acompanhar `application-readLogs` até o build (Dockerfile) e o serviço subirem.

- [ ] **Step 7: Verificar o app no ar**

Run:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<dominio-app-traefikme>/
```
Expected: `200`.

---

## Task 7: Smoke test end-to-end (produção)

Verificação manual/assistida via Chrome DevTools MCP (ou navegador).

- [ ] **Step 1: Fluxo anônimo**

Abrir `https://<dominio-app-traefikme>/`. Esperado: cai no onboarding (sessão anônima criada — checar no Network que `POST /auth/v1/signup` ou `/token` anônimo retorna 200).

- [ ] **Step 2: Cruzamento**

Selecionar Itaú "Black/Infinite" → concluir → painel mostra **2 benefícios ativos**. Abrir um detalhe e a busca.

- [ ] **Step 3: Magic link**

Perfil → informar um e-mail → "Salvar meu acesso". Esperado: mensagem "enviamos um link"; o e-mail chega via Resend (checar caixa/painel do Resend). Abrir o link confirma e a conta deixa de ser anônima.

- [ ] **Step 4: Registrar URLs e segredos**

Anotar (fora do repo) as URLs finais (app + API), e confirmar que os segredos estão só no Dokploy. Atualizar a memória do projeto com as URLs de produção.

---

## Definition of Done (M5)

- [ ] Repo publicado no GitHub (`origin/main` = `main`), sem segredos rastreados.
- [ ] Supabase dedicado no ar; `/auth/v1/health` = 200; Postgres/Studio não públicos.
- [ ] Migrations `0001–0006` + seed demo aplicados em produção.
- [ ] App `web` no ar (Dockerfile/nginx), auto-deploy por webhook ligado.
- [ ] Smoke test ok: anônimo → painel (2 benefícios) → detalhe → busca → magic link recebido via Resend.
- [ ] URLs de produção registradas; segredos só no Dokploy.

**Próximo (M6 sugerido):** painel admin de curadoria do catálogo (CRUD de sources/benefits/locations + bootstrap do primeiro admin), domínio próprio + DNS, PNG de ícone iOS, tuning de Workbox e backups do Postgres.
```
