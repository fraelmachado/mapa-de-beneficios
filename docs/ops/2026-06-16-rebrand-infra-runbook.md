# Rebrand de infraestrutura — "Benefy" → "Mapa de Benefícios" (runbook)

**Data:** 2026-06-16
**Status:** plano para execução futura (NÃO executar fora de janela coordenada)
**Pré-requisito crítico:** há **outro agente trabalhando neste mesmo repo/working tree**. Tudo abaixo mexe em **estado compartilhado** (remoto Git, Dokploy, domínios, possivelmente Supabase local). Só executar com o outro agente **parado** e com sincronização combinada.

> Já feito (Fases 1, seguras): UI visível, PWA `name`/`short_name`, `package.json`/lock (`mapa-de-beneficios`), projeto design-system claude.ai "Mapa de Benefícios", memória. Este runbook cobre **só a Fase infra/externa**.

## 0. Decisões a travar antes de começar

1. **Hostnames definitivos** (sugestão):
   - Front: `mapadebeneficios.rampap.com.br`
   - API (Supabase Kong): `api.mapadebeneficios.rampap.com.br`
   (Alternativa curta: `mdb.rampap.com.br` + `api.mdb.rampap.com.br`.)
2. **Renomear o repositório GitHub** `benefy`? (sim/não). Se sim, todos os clones precisam atualizar o `origin`.
3. **Renomear o diretório local** `~/Projects/benefy`? Recomendado **não** durante trabalho ativo (quebra sessões). Opcional, por último.
4. **Supabase local `project_id`**: manter `benefy` (mudar re-chaveia containers/volumes de dev). Fora do escopo deste runbook.

## 1. Pré-condições (checar na janela)

- [ ] Outro agente **parado**; ninguém com edições não commitadas (`git status` limpo).
- [ ] **Push das pendências locais primeiro** e `origin/main` sincronizado:
  ```bash
  git fetch origin && git status -sb        # confirmar ahead/behind
  git pull --ff-only origin main            # incorporar o que o outro agente empurrou
  npm test && npm run build                 # verde antes de empurrar
  git push origin main
  ```
  (Hoje há ~3 commits locais à frente: design lib, rename UI, rename pacote.)
- [ ] DNS criado pelo usuário (passo 2) **propagado**.
- [ ] **Snapshot pré-mudança capturado (passo 1.5) — OBRIGATÓRIO. Não iniciar nenhuma alteração sem ele.**

## 1.5. Snapshot pré-mudança (baseline para rollback) — OBRIGATÓRIO

Antes de tocar em qualquer recurso, registrar o estado atual num arquivo versionado (ex.: `docs/ops/snapshots/<data>-pre-rebrand.md`) — o rollback (§9) depende disso. Capturar:

- [ ] **Git:** `git rev-parse HEAD` (SHA de partida) + `git status -sb`.
- [ ] **Env do compose supabase** (`_ueWmUNJEKkNbdxSVmcqG`) — valores atuais de `SITE_URL`, `API_EXTERNAL_URL`, `SUPABASE_PUBLIC_URL`, `ADDITIONAL_REDIRECT_URLS` (copiar verbatim via `compose-one`, sem expor `SERVICE_ROLE_KEY`/`ANON_KEY` no doc — só os hosts).
- [ ] **Build arg do front** (`1BjRuRUM7eitGRBJ29wMi`) — valor atual de `VITE_SUPABASE_URL`.
- [ ] **Domínios atuais** anexados ao front e ao Kong (hostnames sslip + flags de HTTPS), via `domain-byApplicationId` / `domain-byComposeId`.
- [ ] **Nomes atuais** do projeto/app/compose no Dokploy.
- [ ] **Bundle atual** servido (`/assets/index-*.js`) e título, para comparação pós-mudança.

Guardar esse snapshot **antes** de prosseguir. Cada valor revertido no §9 sai daqui — não da memória.

## 2. DNS (usuário — fora do Claude)

Criar registros `A` apontando para o host atual `85.31.230.250`:
- [ ] `mapadebeneficios.rampap.com.br` → `85.31.230.250`
- [ ] `api.mapadebeneficios.rampap.com.br` → `85.31.230.250`

Validar: `dig +short mapadebeneficios.rampap.com.br` retorna o IP.

## 3. Supabase (Kong/API) — novo domínio + env

Recursos prod (Dokploy):
- Projeto **benefy** `FZ70f3Xo3OmCwP2VRep8j` · env production `la4D67DI-3B4xwTO-WEfq`
- Compose **supabase** `_ueWmUNJEKkNbdxSVmcqG`
- App **web** `1BjRuRUM7eitGRBJ29wMi`

Passos:
1. **Adicionar domínio** ao serviço Kong do compose supabase apontando para `api.mapadebeneficios.rampap.com.br` (porta do Kong, ex. 8000), com **HTTPS + Let's Encrypt** habilitado (agora deve emitir cert — era o motivo de migrar do sslip.io). Manter o domínio sslip antigo no ar durante a transição (rollback).
2. **Atualizar env do compose supabase** (via `compose-update`/edição de env): trocar para o novo host —
   - `API_EXTERNAL_URL=https://api.mapadebeneficios.rampap.com.br`
   - `SUPABASE_PUBLIC_URL=https://api.mapadebeneficios.rampap.com.br`
   - `SITE_URL=https://mapadebeneficios.rampap.com.br`
   - `ADDITIONAL_REDIRECT_URLS=https://mapadebeneficios.rampap.com.br/*`
   (GoTrue usa SITE_URL + redirect allowlist para o **magic link**; se não atualizar, o login por e-mail quebra.)
3. **Redeploy do compose supabase** e aguardar healthy. `reloadTraefik` se necessário.
4. Verificar:
   ```bash
   curl -s -o /dev/null -w "%{http_code}\n" https://api.mapadebeneficios.rampap.com.br/auth/v1/health   # 200
   ```

## 4. Front (app web) — novo domínio + rebuild com nova API

1. **Atualizar o build arg `VITE_SUPABASE_URL`** do app web para `https://api.mapadebeneficios.rampap.com.br` (e `VITE_SUPABASE_ANON_KEY` permanece o mesmo). O bundle embute essa URL em build-time → **precisa rebuild**.
2. **Adicionar domínio** `mapadebeneficios.rampap.com.br` ao app web com HTTPS + Let's Encrypt. Manter o domínio sslip antigo durante a transição.
3. **Redeploy do app web** (`application-deploy`). Aguardar build (~2–3 min).
4. Verificar:
   ```bash
   APP=https://mapadebeneficios.rampap.com.br
   curl -s -o /dev/null -w "%{http_code}\n" $APP/                       # 200
   curl -s $APP/ | grep -o "<title>[^<]*</title>"                       # Mapa de Benefícios
   # bundle aponta p/ nova API:
   B=$(curl -s $APP/ | grep -oE '/assets/index-[A-Za-z0-9_-]+\.js' | head -1)
   curl -s $APP$B | grep -c "api.mapadebeneficios.rampap.com.br"        # > 0
   ```
5. **Teste de ponta a ponta**: abrir o app, criar sessão anônima, selecionar cartões, ver benefícios; testar **magic link** (deve chegar e redirecionar para o novo domínio).

## 5. Nomes internos no Dokploy (cosmético)

- Renomear o **projeto** `benefy` → `Mapa de Benefícios` e/ou descrição (via `project-update`). Não afeta deploy; só organização.

## 6. Repositório GitHub (se decidido renomear)

1. Renomear repo `benefy` → `mapa-de-beneficios` no GitHub (Settings).
2. Atualizar o remote em **todos os clones**:
   ```bash
   git remote set-url origin git@github.com:fraelmachado/mapa-de-beneficios.git   # ajustar conforme owner/url
   git remote -v
   ```
3. **Avisar o outro agente** para atualizar o `origin` dele (senão `push`/`pull` dele falham).
4. Conferir o **webhook de auto-deploy** do front (a URL do repo muda; reconfigurar no Dokploy se aplicável — e isso resolve de quebra a investigação pendente de por que o auto-deploy não disparou).

## 7. Diretório local (opcional, por último)

Só com tudo verde e ninguém usando a pasta:
```bash
cd ~ && mv Projects/benefy Projects/mapa-de-beneficios
```
Reabrir editores/sessões apontando para o novo caminho. (Quebra qualquer sessão ativa que use o caminho antigo — por isso é o último passo.)

## 8. Limpeza pós-transição

- [ ] Remover os domínios `*-sslip.io` antigos do front e do Kong (depois de confirmar o novo no ar por alguns dias).
- [ ] Atualizar quaisquer referências em `docs/` *vivos* (não históricos) ao novo domínio.
- [ ] (Resend) Quando houver domínio de e-mail verificado, alinhar o remetente à nova marca.

## 9. Rollback

**Fonte da verdade do rollback = o snapshot do passo 1.5.** Restaurar cada valor a partir dele, não de memória. Quase tudo deste rebrand vive **fora do Git** (env/domínios/build args no Dokploy), então o rollback é majoritariamente de infra — e cada passo mantém o recurso antigo no ar até a verificação.

- Front/API: os domínios sslip antigos continuam funcionando; restaurar o build arg `VITE_SUPABASE_URL` ao valor do snapshot e redeploy volta ao estado anterior.
- Env do Supabase: restaurar `SITE_URL`/`API_EXTERNAL_URL`/`SUPABASE_PUBLIC_URL`/`ADDITIONAL_REDIRECT_URLS` aos valores do snapshot e redeploy.
- Domínios novos: removê-los do front/Kong reverte o roteamento; os antigos seguem ativos.
- Repo: renomear de volta no GitHub (mantém redirecionamento temporário do nome antigo; atualizar `origin` é o certo).

> **Git — NUNCA usar `git reset --hard` neste working tree.** É compartilhado com outro agente; um hard reset apagaria o próprio snapshot, trabalho não commitado e os commits do outro agente. Para desfazer um commit de código deste rebrand, usar **`git revert <sha>`** (cria um commit de reversão, preserva histórico e o trabalho alheio). Garantir que o arquivo de snapshot (1.5) esteja **commitado e empurrado** antes da janela, para que sobreviva a qualquer reversão.

## 10. Checklist final

- [ ] DNS resolvendo (front + api)
- [ ] HTTPS válido (cert Let's Encrypt emitido) em ambos
- [ ] `/auth/v1/health` 200 na nova API
- [ ] App no novo domínio, título "Mapa de Benefícios", bundle apontando p/ nova API
- [ ] Fluxo anônimo + catálogo OK
- [ ] Magic link chega e redireciona ao novo domínio
- [ ] Outro agente notificado do novo remote/caminho
- [ ] Domínios antigos removidos (após período de segurança)
