# Ingestão real via Gmail — design (rev 2)

**Data:** 2026-07-18 · **rev 2** incorpora a review adversarial do Codex (ver changelog no fim).
**Objetivo (do usuário):** sair do mock e ler o Gmail de verdade para detectar quais programas de benefícios o usuário tem, atribuindo-os ao radar. Guardar o e-mail (remetente, assunto, data) que atribuiu cada programa, para aprimoramento futuro.

## Decisões de escopo (travadas)

1. **Só Gmail.** Pluggy/Open Finance foi **descartado do projeto** (2026-07-18). Limpeza das colunas mortas da migration 0007 é follow-up não-bloqueante.
2. **Arquitetura A — scan client-side, one-shot.** Google Identity Services (GIS) no browser → consent `gmail.readonly` → access token curto (~1h) → o browser chama a Gmail API direto. **Sem backend, sem token guardado, sem refresh token, sem worker/cron.**
3. **Alcance OAuth = modo Testing.** App OAuth não-verificado, limitado aos test users cadastrados (~100). Roda hoje, sem revisão do Google. **Ressalva de conformidade (Codex):** `gmail.readonly` é *restricted scope*; publicar para terceiros exige verificação + security assessment + Limited Use + política de privacidade — não é só "virar a chave". Como já **persistimos metadados no Supabase**, o design abaixo já respeita minimização/retção/deleção para não travar essa promoção depois.
4. **Detecção em nível de marca; tier sempre escolhido pelo usuário.** O e-mail identifica a **marca** (`spotify.com` → Spotify), **nunca** o produto/tier. Todo finding nasce com `itemId = null` (marca não-resolvida) e **não pode ser confirmado** enquanto o usuário não escolher um `source_item` — inclusive marcas de "tier único", que no catálogo são produtos específicos (Itaú→Personnalité, Bradesco→Aeternum, Amil→Amil One, Disney+→Premium): um e-mail da marca **não prova** posse do produto. Resolve-se no bottom-sheet existente. Sem default de tier, sem auto-tier.
5. **Persistência atômica, sob identidade durável.** Seleção + evidência gravadas numa **única transação** (RPC). O caminho Gmail **exige sessão com conta vinculada** (não-anônima): metadado sensível de e-mail não é persistido sob a sessão anônima descartável (perde-se ao trocar de device). Se anônimo, o fluxo pede o login por magic link (reusa o upgrade do Perfil) **antes** de salvar.
6. **Idempotência e ingestão aditiva.** Rescan não duplica (`unique(user_id, gmail_account, source_id, gmail_message_id)` + upsert). O scan **soma** programas; nunca remove os já marcados. Reconciliação de assinatura cancelada é fora de escopo (append-only).
7. **Sem monitor em background.** Re-escanear é ação manual. Alertas contínuos = eventual passo B (server-side), fora deste escopo.

## Achados que ancoram o design

- `user_sources` guarda **ids de `source_item`**, gravados via RPC. `useSaveUserSources` invalida `my_benefits`/`has_onboarded`/`user_sources`.
- Fluxo Gmail hoje é 100% mock: `demoFindings` chuta 3 marcas; `Vasculhando` é animação; `RevisarGmail` faz `existentes ∪ incluídos` **no browser** e chama `replace_user_sources` (read-modify-write não-atômico → risco de *lost update* com 2 abas). State machine em `OnboardingPage`.
- O bottom-sheet de tier e `pickTier` vivem no `ManualWizard`, não no `RevisarGmail`. A "recomendação" da sheet é o item de maior valor/benefícios — **não** existe "tier topo" semântico.
- Sessão pode ser **anônima** (auto sign-in em `auth.ts`); o próprio Perfil avisa que some ao trocar de device. `sources` cascata → apagaria evidência junto.

## Fluxo de dados (end-to-end)

1. Usuário escolhe o caminho Gmail em `MethodStep`. **Gate de conta:** se a sessão é anônima, pede o login (magic link, Perfil) antes de continuar. **Pré-consent:** um aviso curto (escopo lido, janela de tempo, o que é guardado no servidor, retenção, revogação) **antes** de abrir o popup do Google.
2. `useGmailAuth`: carrega GIS, `initTokenClient({ client_id: VITE_GOOGLE_CLIENT_ID, scope: gmail.readonly })`, `requestAccessToken()`. Callback trata **cancelamento/erro** do popup (fechar sem consentir não trava a UI). Após o token, `GET users/me/profile` → `emailAddress` da conta Gmail; a UI **mostra qual conta** será escaneada e pede confirmação antes de qualquer persistência.
3. `gmailScan(accessToken, catálogo, fetcher)` — **por domínio, não busca global** (corrige viés de cobertura/quota/ordenação):
   - Para cada domínio de `match_domains`: `messages.list?q=from:{domínio} newer_than:2y&maxResults=3` (concorrência limitada ~6). `// ponytail: por-domínio evita 1 remetente ruidoso mascarar os demais; ~25 lists baratos`.
   - `messages.get?format=metadata&metadataHeaders=From,Subject,Date` dos ids retornados (**só headers, nunca o corpo**), escolhe o de **maior `internalDate`** (não confia em ordem de `list` nem no header `Date`).
   - Erros: 404 isolado (msg sumiu entre list/get) é ignorado; 401/403 → reautenticar/abortar; 429/5xx → 1 retry com backoff; se algum domínio ficar sem resposta por erro, o scan é marcado **parcial** e a UI diz isso (nunca rotula "concluído" um scan truncado).
4. `matchSources(emails, catálogo)` (**puro**): casa o domínio do `From` por **boundary de label** (`spotify.com` casa `e.spotify.com`, **rejeita** `evilspotify.com`), normalizando case/espaço/ponto final/múltiplos endereços. 1 finding por marca, com `sourceId`, `itemId = null`, e a evidência = e-mail de maior `internalDate`.
5. `Vasculhando` (real) mostra a contagem. `RevisarGmail`: cada finding é uma **marca não-resolvida**; tocar abre a sheet para escolher o `source_item`. **A CTA de confirmar fica bloqueada enquanto houver marca incluída sem tier escolhido.** Sem default.
6. Submit → **RPC única `add_gmail_sources(payload jsonb)`** (SECURITY como o `replace_user_sources`): numa transação, para cada item resolvido, `insert into user_sources … on conflict do nothing` (aditivo, sem read-modify-write no cliente) **e** `insert into source_evidence … on conflict (chave) do nothing`. Sucesso só é reportado se a transação inteira commitar.

## Modelo de dados — migration `0020_gmail_ingestion.sql`

- `alter table sources add column match_domains text[] not null default '{}';` — populado no `seed.sql` para as 25 marcas. Autoridade = seed (admin UI de domínios é fora de escopo; ver deferidos).
- Tabela **`source_evidence`**:

  | coluna | tipo | nota |
  |---|---|---|
  | `id` | uuid pk default `gen_random_uuid()` | |
  | `user_id` | uuid not null → `auth.users` on delete cascade | |
  | `source_id` | uuid not null → `sources` on delete cascade | marca atribuída |
  | `gmail_account` | text not null | conta Gmail escaneada (proveniência + chave) |
  | `gmail_message_id` | text not null | referência, não conteúdo |
  | `email_from` | text not null | |
  | `email_subject` | text | |
  | `email_date` | timestamptz | `internalDate` da mensagem |
  | `created_at` | timestamptz default `now()` | quando atribuído |

  **`unique(user_id, gmail_account, source_id, gmail_message_id)`** (idempotência). RLS **own-rows** `select`/`insert`/**`delete`** com `user_id = auth.uid()`; grants a `authenticated`. Gravada **só para programas confirmados** e **só com sessão não-anônima**.
- **RPC `add_gmail_sources(payload jsonb)`** — contrato atômico aditivo descrito acima. `payload` = array de `{ item_id, source_id, gmail_account, gmail_message_id, email_from, email_subject, email_date }`.

## Privacidade

- Escopo `gmail.readonly`; token só no browser, expira ~1h, **nunca persistido**; limpo da memória em unmount/logout/navegação; nunca em storage, query-string ou logs.
- **Minimização de dados** (`format=metadata`, só headers) — mas o **escopo autoriza a caixa toda** (`gmail.metadata` não aceita `q`): a cópia de consent diz isso honestamente.
- Persistimos **metadados de e-mail (remetente, assunto, data)** dos programas confirmados. Cópia **não** afirma "nada foi lido / nenhum conteúdo" — assunto é conteúdo. Diz o que foi lido e o que foi guardado.
- **Deleção:** ação "Desconectar Gmail e apagar dados" no Perfil → revoga o token via GIS (`google.accounts.oauth2.revoke`) + `delete from source_evidence` (own-rows). Explica que desconectar não desfaz programas já adicionados ao radar.
- Findings rejeitados nunca são persistidos; os headers em memória são descartados no reject/back/erro/unmount.

## Telas / código

- Novo `src/features/onboarding/gmail/`: `useGmailAuth.ts` (GIS: token, `getProfile`, revoke, cancelamento), `gmailScan.ts` (list-por-domínio + get + internalDate + parcial, **fetcher injetável**), `matchSources.ts`, `parseFrom.ts` (boundary de label).
- `OnboardingPage`: gate de conta anônima → link; pré-consent; troca `demoFindings` pelo scan real; tela `gmail-scan` com estados consent/loading/**parcial**/erro/nenhum-encontrado.
- `Finding`: `{ sourceId, provider, logo, itemId: string | null, evidence }`. `RevisarGmail`: marcas não-resolvidas + sheet reusada (extrair `TierSheet` do `ManualWizard`) + CTA bloqueada até resolver; submit chama `add_gmail_sources`.
- `Perfil`: botão "Desconectar Gmail e apagar dados".
- Env **`VITE_GOOGLE_CLIENT_ID`** (público) — ausente → caminho Gmail desabilitado com aviso.

## Testes

- `parseFrom`: nome+ângulo, só endereço, subdomínio, múltiplos endereços, lixo, case/ponto-final.
- `matchSources`: boundary de label (aceita subdomínio, **rejeita `evilspotify.com`**), domínio desconhecido ignorado, dedupe por marca, evidência = maior `internalDate`, finding sempre `itemId=null`.
- `gmailScan`: fetcher fake — por-domínio, escolhe maior `internalDate`, ignora 404 isolado, marca parcial em erro, monta query.
- `RevisarGmail`: CTA bloqueada com marca sem tier; submit resolvido chama `add_gmail_sources`.
- **RLS `source_evidence`** (adversarial, como `rls.test.ts`): select/insert cross-user negado, `user_id` forjado, anon negado, delete só own-rows.
- **`add_gmail_sources` integração:** atomicidade (falha → nada gravado), idempotência (rescan não duplica via unique+upsert), aditividade (não apaga sources prévios).

## Pré-requisitos manuais (usuário)

- **Google Cloud (~5 min):** OAuth 2.0 Client (Web); consent em Testing + test users; habilitar Gmail API; authorized JS origins (`http://localhost:5173` + domínio prod). Client ID → `VITE_GOOGLE_CLIENT_ID`. Sem secret.
- **SMTP (magic link):** o gate de conta usa magic link. Hoje o Resend não tem domínio verificado (entrega só ao endereço dono). Para testadores além do dono, **verificar um domínio no Resend** — senão o login deles não chega. Passo-a-passo dos dois entra no plano.

## Fora de escopo (deferidos, com motivo)

- **Monitor/alertas em background** — precisa server-side + token guardado (passo B).
- **Auto-detecção de tier** — sinal do e-mail não prova produto; usuário escolhe.
- **Verificação OAuth do Google / produção para terceiros** — processo externo; design já minimiza para não bloquear depois.
- **Reconciliação de assinatura cancelada** — ingestão é append-only por ora.
- **Admin UI para `match_domains`** — seed é a autoridade; source criada no admin fica invisível ao scan até entrar no seed. Aceito conscientemente.
- **Multi-conta Gmail simultânea** — `gmail_account` já é gravado (proveniência/chave), mas UX de várias contas fica para depois.
- **Retenção automática/limpeza de órfãos** — mitigado pelo gate de conta não-anônima + deleção manual; job de expiração é passo B.

## Changelog rev 2 (o que a review adversarial mudou)

**Incorporado:** brand→tier vira `itemId=null` que bloqueia confirmação (fim do default de tier); RPC atômica única `add_gmail_sources` (fim do best-effort e do read-modify-write no cliente); unique+upsert (idempotência); `gmail_account` gravado; match por boundary de label (fim do `endsWith` inseguro); `internalDate` no lugar do header `Date`; cópia de privacidade honesta ("metadados", não "nada do conteúdo"); gate de conta não-anônima antes de persistir; deleção (RLS delete + botão no Perfil + revoke GIS); scan por-domínio (fim do viés do cap global) + estado "parcial" + tratamento de 401/403/404/429/5xx + cancelamento do popup; teste de RLS cross-user e de atomicidade/idempotência.

**Deliberadamente deferido** (ver seção acima): backoff/quota como estratégia formal, admin de `match_domains`, multi-conta, reconciliação de cancelamento, job de retenção. Motivo comum: não travam o "uau" em modo Testing e cabem melhor no passo B / quando abrir para terceiros.
