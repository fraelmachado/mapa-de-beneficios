# P4 — Autodiscover de catálogo (discovery) — design

**Data:** 2026-06-28
**Status:** aprovado para plano

> **Posição no roadmap fonte-agnóstico:** esta é a spec **P4 — Expansão do catálogo via discovery** referenciada em [`2026-06-16-modelo-fonte-agnostico-design.md`](2026-06-16-modelo-fonte-agnostico-design.md) §1 e §6. Aquela spec prepara o **modelo** (taxonomia `source_category`, origem fonte-agnóstica); **esta cria os dados** que populam as categorias novas.
>
> **Dependência:** requer o **P1 (dados)** aterrissado — em especial o enum/coluna **`source_category`** em `sources`. A migração deste discovery vem **depois** da migração do P1.

## 1. Objetivo e escopo

Automatizar a **descoberta de catálogo** — hoje 100% manual (admin + `seed.sql`, alimentado por uma pesquisa pontual do ChatGPT). Um **agente de pesquisa** recebe um alvo (um "brief": um **programa de benefícios** — banco, operadora, plano de saúde, multibenefícios, fidelidade, varejo ou shopping), pesquisa na web e propõe **fontes novas, variantes, benefícios e heranças de bandeira** como *candidatos* numa fila de revisão. Um admin revisa, edita e aprova; só então o candidato vira catálogo real.

O discovery é o mecanismo que **popula as 7 categorias de fonte** (`source_category`) definidas no P1 — não só cartões. Os exemplos abrangem saúde (Unimed, SulAmérica), multibenefícios (Wellhub, Flash, iFood Benefícios), operadoras (Claro, Vivo), fidelidade (Livelo, Smiles), varejo (Meli+, Prime), shoppings — em pé de igualdade com bancos/cartões.

A máquina **nunca** escreve no catálogo sem um humano aprovar. A procedência (`source_url`, `source_name`, `observed_at`, `verification_status`) — base de transparência criada no M7/M8a — viaja com o candidato desde a entrada.

**Dentro do escopo (v1):**
- Schema de staging genérico (`source` + `source_item` + `benefit`), idempotente e pronto pra paralelismo.
- Agente de descoberta rodando como **script** (`scripts/discover.ts`), disparo manual/CI.
- Descoberta de **fontes novas E benefícios** (árvore completa), aprovados encadeados.
- UI admin de revisão (`/admin/discovery`) com diff vs. catálogo.
- Promoção transacional candidato → catálogo.
- Testes (TDD).

**Fora do escopo (v1):**
- Worker Dokploy com cron/loop (schema já preparado; ver §9).
- Botão "rodar agora" síncrono no admin (ver §8).
- Descoberta de **fontes do usuário** (varredura automática / Open Finance / Pluggy) — é outra frente, não catálogo.
- Re-verificação periódica / detecção de expiração de benefícios já catalogados.
- O **modelo** fonte-agnóstico em si (`source_category`, projeção de provedor na `my_benefits`, depreciação de `kind`) — é o **P1**, pré-requisito desta spec.

## 2. Decisões (fechadas com o usuário)

- **Mecanismo:** agente LLM de pesquisa, contínuo e sob demanda (reproduz a pesquisa manual do ChatGPT como pipeline).
- **Staging:** fila de revisão **separada**; catálogo real nunca recebe escrita de máquina sem humano.
- **Runtime v1:** roda como **script** (`scripts/discover.ts`); Worker fica pra depois. A idempotência/paralelismo moram no **schema** (fingerprint + upsert, jobs com `FOR UPDATE SKIP LOCKED`), então migrar pro Worker é embrulhar o mesmo código — sem retrabalho de dados.
- **Escopo da v1:** schema suporta os 3 tipos de entidade; o agente + a UI já cobrem **fontes novas + benefícios** de ponta a ponta.
- **Motor do agente (decisão MVP):** **Codex CLI como runtime** — `discover.ts` faz shell-out pro binário `codex` em modo não-interativo, em vez de chamar uma API. Decisão consciente de MVP; **trocável depois** (a arquitetura é agnóstica ao motor — ver §3). O custo: menos determinismo na chamada (recuperado na fronteira de validação) e dependência de ter o CLI+auth no ambiente. **Isolamento de segredos é obrigatório** (§3): o subprocesso Codex roda com env higienizado e **nunca** recebe o `SUPABASE_SERVICE_ROLE_KEY` — senão prompt-injection da web fura o gate de revisão humana.
- **Taxonomia:** o candidato `source` carrega **`source_category`** (uma das 7 do P1); o agente classifica a fonte descoberta na taxonomia. Discovery é o pipeline que popula as categorias novas (§6 do P1).

## 3. O agente — `scripts/discover.ts` (Codex CLI como runtime)

Script Node/TS, disparo manual ou CI. Orquestra o Codex CLI; **não** chama API de LLM diretamente.

Passos:

1. **Reivindica um job** com claim atômico (`update ... where id = (select ... for update skip locked limit 1)`) — seguro com N processos.
2. **Monta diretório de trabalho temporário e isolado** (no scratchpad, **fora do repo**) e escreve nele:
   - o `brief` do job;
   - o **contexto do catálogo atual** (slugs/nomes de `sources` e `benefits` existentes + `source_category`), pra o agente não repropor o conhecido e habilitar `match_status=update`;
   - a **taxonomia `source_category`** (as 7 chaves do P1 com rótulo/exemplos) pra o agente classificar a fonte;
   - o **JSON Schema** da árvore `source → source_items → benefits → card_tiers`, com `source.source_category` ∈ taxonomia (obrigatório), `source_url` obrigatória por nó e `verification_status`.
3. **Shell-out pro Codex** em modo headless (`codex exec`/equivalente, pinado na implementação via skill `codex:setup`), com prompt restrito: *"pesquise o brief na web, classifique a fonte numa `source_category`, escreva `candidates.json` conforme este schema, cada nó citando `source_url`, não faça mais nada"*.
4. **Lê e valida `candidates.json`** contra o schema (zod). **Esta é a fronteira que recupera o determinismo** que uma API de structured output daria de graça:
   - inválido → **1 retry** realimentando os erros de validação no prompt;
   - falhou de novo → job vira `error` (nada entra na fila).
5. **Fingerprint + upsert** dos candidatos (com `parent_fingerprint` ligando a árvore), computa `match_status` contra o catálogo, marca o job `done`.

**Contrato com o agente = "arquivo + schema + validate-and-retry"**, não garantia de schema na chamada.

**Regras de qualidade:** todo candidato precisa citar `source_url`; sem fonte → `verification_status = needs_manual_validation`.

**Segurança — modelo de ameaça e isolamento (load-bearing).** O Codex é um agente de coding com **shell/FS** e consome **conteúdo web não-confiável** (risco de prompt-injection). Portanto o subprocesso inteiro é tratado como **não-confiável**, e a propriedade central — *máquina nunca escreve no catálogo sem humano* — **não pode depender do bom comportamento dele**. Travas:

- **Separação de privilégio / segredos (a trava principal).** O `SUPABASE_SERVICE_ROLE_KEY` vive **somente no orquestrador `discover.ts`**, único processo que fala com o banco. O subprocesso Codex é spawnado com **ambiente higienizado por allowlist** (não herda o env do pai): recebe **apenas** a própria auth do Codex e nada mais — **nunca** a service-role key, o env do Supabase, nem outros segredos do repo/CI. Assim, mesmo sob prompt-injection vinda da web, o agente **não tem credencial** pra escrever no catálogo ou ler o banco.
- **FS/CWD restrito.** Roda num diretório temporário no scratchpad, **fora do repo**; sem escrita no repo nem acesso a `.env`/arquivos de segredo. Usar os flags de sandbox/aprovação do próprio Codex pra negar escalonamento de shell onde possível.
- **Saída não-confiável.** `candidates.json` é validado por schema (zod) e cai em *staging* revisado por humano — defesa em profundidade; nada é promovido sem aprovação.
- O agente **nunca** escreve no repo nem no banco; quem persiste é o `discover.ts` via `service_role`, **depois** de validar. A auth do Codex e a service-role key chegam por env em **processos distintos** — nunca no mesmo ambiente, nunca no browser.

> **Trocabilidade.** Migrar pra uma API de LLM (Claude `claude-opus-4-8` + `web_search_20260209` + structured outputs, ou GPT) é substituir só o passo 3–4 por uma chamada com `output_config.format` — sem mexer em jobs, fingerprint, staging, promoção ou UI.

## 4. Modelo de dados — migração `00NN_discovery.sql`

Duas tabelas novas. RLS: leitura/escrita só `service_role` e admins (mesmo padrão de `is_admin` usado no resto do admin).

> **Ordem de migração:** numerar **após** a migração do P1 que introduz `source_category` (não fixar `0012` aqui — o P1 ocupa uma faixa antes). O `payload` de um candidato `source` referencia `source_category`.

### `discovery_jobs`
Unidade de claim paralelo.

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid pk | |
| `brief` | text | alvo da rodada (instituição/tema) |
| `status` | enum `pending\|processing\|done\|error` | |
| `claimed_at` | timestamptz null | |
| `claimed_by` | text null | identificador do processo/worker |
| `error` | text null | |
| `created_by` | uuid null | admin que enfileirou |
| `created_at` | timestamptz default now() | |

### `discovery_candidates`
Genérica — suporta os 3 tipos de entidade.

| coluna | tipo | nota |
|---|---|---|
| `id` | uuid pk | |
| `job_id` | uuid fk → discovery_jobs | |
| `entity_type` | enum `source\|source_item\|benefit` | |
| `fingerprint` | text **unique** | `hash(entity_type + chave natural normalizada)` |
| `parent_fingerprint` | text null | liga benefit→source_item→source no mesmo lote, ou aponta pra entidade existente |
| `payload` | jsonb | espelha as colunas reais da entidade. `source` inclui **`source_category`** (taxonomia do P1) + `name`; `source_item` inclui `label`, `card_brand/level`; `benefit` inclui title, summary, category, redemption_type, `benefit_source` (issuer/card_network/partner/mixed, p/ origem secundária), etc. |
| `provenance` | jsonb | `source_url`, `source_name`, `observed_at`, `verification_status`, citações |
| `match_status` | enum `new\|update\|duplicate` | diff vs. catálogo por slug/fingerprint |
| `matched_id` | uuid null | registro existente, quando `update` |
| `review_status` | enum `pending\|approved\|rejected` | |
| `reviewed_by` | uuid null | |
| `promoted_id` | uuid null | id do registro criado/atualizado no catálogo |
| `promoted_at` | timestamptz null | |
| `created_at` | timestamptz default now() | |

**Upsert** é `on conflict (fingerprint) do update` — re-rodar atualiza o candidato e bumpa `observed_at`, nunca duplica.

## 5. Idempotência & paralelismo

- **Fingerprint determinística** por entidade. Ex.: source = `source|<slug>`; source_item = `source_item|<source_slug>|<label-normalizado>`; benefit = `benefit|<source_item_slug>|<titulo-normalizado>`. Reprocessar = upsert idempotente.
- **Jobs com claim atômico** (`FOR UPDATE SKIP LOCKED`) → escala horizontal no futuro Worker só "subindo mais processos", sem mudar dado.
- **Promoção** (§7) roda em **transação** checando `review_status` pra dois admins não promoverem o mesmo candidato em corrida.

## 6. Admin — revisão (`/admin/discovery`)

Nova feature `src/features/admin/discovery/`, seguindo o padrão de `src/features/admin/benefits/`.

- **Lista de jobs** + "Novo job" (campo `brief`, grava `pending`). Sem "rodar agora" na v1 (ver §8).
- **Fila de candidatos** por job, agrupada pela árvore (source → items → benefits), com chip de `match_status` (novo/atualização/duplicado) e `verification_status`.
- **Detalhe do candidato:** `payload` editável reusando os campos de `BenefitForm`/`SourceForm` + bloco de procedência (fonte, data, citação) — a transparência do M8a, agora na entrada.
- **Ações:** Aprovar · Editar e aprovar · Rejeitar. Aprovar um `benefit` exige que o `source_item` pai exista ou esteja aprovado no mesmo lote — a árvore promove de cima pra baixo.

## 7. Promoção (candidato → catálogo)

Função transacional (TS no admin via `service_role`/RPC):

- `source` novo → insere em `sources` (gera slug) **com `source_category`**; `update` → atualiza `matched_id`. (`kind` preenchido conforme a decisão de depreciação do P1: alinhado a `source_category` enquanto existir, ou omitido se removido.)
- `source_item` → insere/atualiza com `card_brand/level`, ligando ao source pai (novo ou existente).
- `benefit` → insere em `benefits` com **`active=false`** (rascunho publicável) + cria `benefit_sources`/`benefit_card_tiers` conforme a árvore. Copia `source_url/source_name/observed_at/verification_status` do `provenance`.
- Grava `promoted_id`/`promoted_at` no candidato e marca `review_status=approved`.

O catálogo nunca recebe escrita de máquina sem humano, e a procedência viaja junto. Re-promover é no-op (idempotente).

## 8. Disparo (v1)

- **v1: admin enfileira, script roda fora de banda.** O admin só cria jobs `pending`; o `discover.ts` roda manual/CI e consome a fila. Dar shell-out num agente de coding a partir de um request HTTP é inadequado — botão "rodar agora" fica pro Worker.
- **Dependência operacional (registrada):** onde o discover roda (máquina, CI e o futuro Worker) precisa ter o **Codex CLI instalado e autenticado**. Com uma API seria só dep npm + env var; com o CLI é binário + login/API key no ambiente — o container do Worker precisará empacotar isso.

## 9. Testes (TDD, padrão do repo)

- **Unit:** `fingerprint.ts` (determinismo/normalização); `matchCatalog.ts` (new/update/duplicate); montagem do JSON Schema.
- **Agente:** mock do **shell-out** (a invocação do `codex`) — `discover.ts` recebe um `candidates.json` de fixture e asserta upsert correto + ligação por `parent_fingerprint` + `match_status`. Sem rede/CLI real no CI.
- **Promoção (integração):** candidato → linhas reais + procedência + idempotência (re-promover = no-op).
- **Componentes admin:** render da árvore, ações aprovar/rejeitar, com `renderWithProviders`.

## 10. Futuro (fora da v1)

- **Worker Dokploy:** cron + loop `SKIP LOCKED`, embrulhando o mesmo `discover.ts`. Idempotência/paralelismo já estão no schema.
- **Troca de motor:** Codex CLI → API de LLM (Claude/GPT) substituindo só o passo 3–4 de `discover.ts`.
- **Botão "rodar agora"** no admin (depende do Worker/endpoint).
- **Re-verificação periódica** de benefícios catalogados (expiração, mudança de cobertura).
