# Ingestão real via Gmail — design

**Data:** 2026-07-18
**Objetivo (do usuário):** sair do mock e ler o Gmail de verdade para detectar quais programas de benefícios o usuário tem, atribuindo-os ao radar. Guardar o e-mail (remetente, assunto, data) que atribuiu cada programa, para aprimoramento futuro.

## Decisões de escopo (travadas)

1. **Só Gmail.** Pluggy/Open Finance foi **descartado do projeto** (2026-07-18). Nenhuma referência nova; limpeza das colunas mortas da migration 0007 é follow-up não-bloqueante.
2. **Arquitetura A — scan client-side, one-shot.** Google Identity Services (GIS) no browser → consent `gmail.readonly` → access token curto (~1h) → o browser chama a Gmail API direto. **Sem backend, sem token guardado, sem refresh token, sem worker/cron.** Encaixa no SPA estático + Supabase que já existe.
3. **Alcance OAuth = modo Testing.** App OAuth não-verificado, limitado aos test users cadastrados (~100). Roda hoje, sem revisão do Google / CASA / política de privacidade. Promover à verificação é decisão externa futura; a mesma base técnica serve.
4. **Detecção em nível de marca, não de tier.** Dos e-mails extrai-se remetente/assunto/data de forma confiável → identifica a **marca** (ex.: `spotify.com` → Spotify). O **tier** (Gold/Platinum/…) não é adivinhado: marca multi-tier reabre o **bottom-sheet de tier que já existe** no wizard. Sem auto-tier.
5. **Sem monitor em background.** Re-escanear é ação manual sob demanda. Alertas contínuos ficam para um eventual passo B (server-side com token guardado), fora deste escopo.

## Achados que ancoram o design

- `user_sources` guarda **ids de `source_item`**, gravados atomicamente via RPC `replace_user_sources(item_ids)`. `useSaveUserSources` invalida `my_benefits`/`has_onboarded`/`user_sources`.
- Fluxo Gmail hoje é 100% mock: `demoFindings(groups)` chuta as 3 primeiras marcas do catálogo; `Vasculhando` é só animação; `RevisarGmail` faz merge com os existentes e salva. A state machine está em `OnboardingPage` (`welcome → method → gmail-scan → gmail-review → gmail-done`).
- `Finding = { itemId, provider, variant, logo }`. `RevisarGmail` faz toggle dos findings e, no submit, `merged = existentes ∪ incluídos` → `replace_user_sources`.
- A cópia do Revisar hoje afirma *"Prévia — nada foi lido do seu e-mail"*. Passa a ser **honesta** (o que foi lido, o que foi guardado).
- O **bottom-sheet de tier** e a ação `pickTier` vivem no `ManualWizard`, não no `RevisarGmail` — precisam ser extraídos para reuso.
- Catálogo tem 25 marcas; nenhuma tem hoje um campo de domínio de remetente para matching.

## Fluxo de dados (end-to-end)

1. Usuário escolhe o caminho Gmail em `MethodStep` → dispara o consent.
2. `useGmailAuth`: carrega o script GIS (`https://accounts.google.com/gsi/client`), `initTokenClient({ client_id: VITE_GOOGLE_CLIENT_ID, scope: 'https://www.googleapis.com/auth/gmail.readonly' })`, `requestAccessToken()` → popup → `access_token`.
3. `gmailScan(accessToken, catálogo, fetcher)`:
   - `messages.list?q=from:(dom1 OR dom2 …) newer_than:2y&maxResults=100` — query montada de todos os `match_domains` do catálogo.
   - Mais recente primeiro, `messages.get?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date` — **só headers, nunca o corpo**. Para ao cobrir todas as marcas casadas ou no teto de ~60 gets (`// ponytail: cap 60, subir se faltar cobertura`).
4. `matchSources(emails, catálogo)` (função **pura**): domínio do `From` casa por **sufixo** contra `match_domains`; 1 finding por marca casada, com o e-mail **mais recente** como evidência. Desconhecido → ignora.
5. Resolução de `source_item`: marca single-tier → o item único; marca multi-tier → item do tier topo com flag "a confirmar" (o Revisar reabre o `TierSheet`).
6. `Vasculhando` (agora real) mostra a contagem → `RevisarGmail` lista os findings → usuário confirma/ajusta tier → submit.
7. Submit: `replace_user_sources(itens)` (como hoje) **e** grava evidências dos programas incluídos (`useSaveSourceEvidence`, best-effort — falha de evidência **não** perde os sources).

## Modelo de dados — migration `0020_gmail_ingestion.sql`

- `alter table sources add column match_domains text[] not null default '{}';` — populado no `seed.sql` para as 25 marcas (ex.: Spotify `{spotify.com}`, Nubank `{nubank.com.br}`). Idempotência por slug preservada.
- Tabela **`source_evidence`** (o requisito do usuário):

  | coluna | tipo | nota |
  |---|---|---|
  | `id` | uuid pk default `gen_random_uuid()` | |
  | `user_id` | uuid not null → `auth.users` on delete cascade | |
  | `source_id` | uuid not null → `sources` on delete cascade | a marca atribuída |
  | `email_from` | text not null | remetente |
  | `email_subject` | text | assunto |
  | `email_date` | timestamptz | data do e-mail |
  | `gmail_message_id` | text | referência (não é o conteúdo) |
  | `created_at` | timestamptz default `now()` | quando foi atribuído |

  RLS **own-rows**: `select`/`insert` com `user_id = auth.uid()`; grants a `authenticated`. Gravada **só para programas confirmados** (nada dos rejeitados).

## Matching (heurística)

- `parseFrom.ts` (puro): `"Spotify" <no-reply@e.spotify.com>` → domínio `e.spotify.com`.
- `matchSources.ts` (puro): casa por **sufixo** (`spotify.com` cobre `e.spotify.com`); dedupe por marca mantendo o e-mail mais recente como evidência; sinaliza multi-tier.
- Começa só com domínio de remetente (sinal confiável). Keyword de assunto é YAGNI até uma marca exigir.

## Privacidade

- Escopo `gmail.readonly`; token só no browser, expira em ~1h, **nunca persistido**.
- Só **headers** buscados (`format=metadata`), nunca corpo/anexo.
- Persistimos apenas **remetente/assunto/data** dos programas **confirmados** (own-rows RLS). Nada dos rejeitados; nenhum conteúdo de e-mail.
- Cópia do Revisar deixa de dizer "nada foi lido" e passa a explicar o que foi lido e o que foi guardado.
- Revogação: pela conta Google (permissões de terceiros).

## Telas / código

- Novo `src/features/onboarding/gmail/`: `useGmailAuth.ts` (GIS), `gmailScan.ts` (list+get+cap, **fetcher injetável** p/ teste), `matchSources.ts`, `parseFrom.ts`.
- `OnboardingPage`: troca `demoFindings` pelo scan real; a tela `gmail-scan` ganha estados de consent/loading/erro/"nenhum programa encontrado" (fallback → wizard manual, como o atalho D4 atual).
- `Finding` ganha `sourceId` + evidência (`from/subject/date/messageId`). `RevisarGmail` grava evidências após o `replace_user_sources`.
- Extrair `TierSheet` do `ManualWizard` para componente compartilhado, reusado no `RevisarGmail` para marcas multi-tier.
- Env **`VITE_GOOGLE_CLIENT_ID`** (público, sem secret) — lida no `useGmailAuth`; ausente → caminho Gmail desabilitado com aviso (não quebra o app).

## Testes

- `parseFrom.test.ts`: nome+ângulo, só endereço, subdomínio, lixo.
- `matchSources.test.ts`: match por sufixo, subdomínio, domínio desconhecido ignorado, flag multi-tier, evidência = e-mail mais recente, dedupe por marca.
- `gmailScan.test.ts`: fetcher fake (canned list+get), teto de gets respeitado, montagem da query.
- `RevisarGmail`: grava evidência no submit (supabase mockado); falha de evidência não bloqueia o save.

## Pré-requisito manual (usuário, Google Cloud — ~5 min)

Criar OAuth 2.0 Client (Web application); consent screen em **Testing** + test users; habilitar **Gmail API**; authorized JavaScript origins (`http://localhost:5173` + domínio de prod). Client ID → `VITE_GOOGLE_CLIENT_ID` (build arg no Dockerfile/Dokploy + `.env.local`). Sem client secret (fluxo de token público). Passo-a-passo exato entra no plano de implementação.

## Housekeeping

- `docs/superpowers/plans/README.md` ainda cita "Open Finance/Pluggy" no próximo gate — atualizar para só Gmail no commit desta spec.
- Colunas mortas da migration 0007 (`sources.connector_type`/`institution_url`/`primary_color`/`pluggy_connector_id`, `source_items.pluggy_product`) e campos legados no admin `SourceForm`: remoção é limpeza separada, não-bloqueante para este escopo.

## Fora de escopo (explícito)

Monitor em background/alertas automáticos; auto-detecção de tier; verificação OAuth do Google; leitura de corpo/anexo; outros provedores de e-mail além do Gmail.
