# Pluggy / Open Finance — achados da API e alinhamento do schema

**Data:** 2026-06-15
**Fonte:** https://docs.pluggy.ai (auth, accounts, items, identity, connectors)
**Status:** Pesquisa registrada. **Integração NÃO implementada** — só alinhamento de schema.

## Por que Pluggy

Pluggy é um agregador de Open Finance (Brasil). Permite, com consentimento do
usuário, descobrir **quais instituições/produtos financeiros a pessoa possui**
(bancos, cartões, operadoras, programas) — exatamente o insumo que o Mapa de Benefícios hoje
coleta de forma **declarativa** (a varredura do onboarding). No futuro, a Pluggy
substituiria/complementaria a varredura manual, populando automaticamente as fontes
do usuário. Alinhar o schema agora evita recadastrar/migrar dados depois.

## Modelo de dados da Pluggy (resumo)

### Auth
- **API Key** (backend, expira ~2h): criada a partir de `CLIENT_ID`/`CLIENT_SECRET`;
  lê dados de todos os produtos, gerencia items/webhooks. Header `X-API-KEY`.
- **Connect Token** (frontend, ~30min, escopo limitado): usado pelo widget Pluggy
  Connect pra o usuário conectar contas. Não lê dados de produto.
- Fluxo: backend gera Connect Token → front abre o widget → usuário conecta →
  cria-se um **Item** → backend lê Accounts/Identity com a API Key.

### Connector (= instituição financeira)
Representa uma instituição integrável. Campos principais:
- `id` (number) — id do conector na Pluggy
- `name`, `institutionUrl`, `imageUrl`, `primaryColor` (hex)
- `type` — categoria da instituição. Valores típicos: `PERSONAL_BANK`,
  `BUSINESS_BANK`, `INVESTMENT`, `TELECOMMUNICATION`, `DIGITAL_ECONOMY`, `OTHER`
- `country` (ex.: `BR`)
- `products` — o que expõe: `ACCOUNTS`, `CREDIT_CARDS`, `TRANSACTIONS`,
  `IDENTITY`, `INVESTMENTS`, `LOANS`, `PAYMENT_DATA`, etc.
- `credentials` — especificação dos campos de login
- `health`, `isSandbox`, `isOpenFinance`

**Mapeamento p/ Mapa de Benefícios:** `connector` ≈ nosso **`sources`** (instituição). O `type`
da Pluggy é mais rico que nosso `kind`:
- `PERSONAL_BANK`/`BUSINESS_BANK` → `kind=card` (bancos emissores de cartão)
- `TELECOMMUNICATION` → `kind=carrier`
- `DIGITAL_ECONOMY` → `kind=loyalty` (marketplaces/fidelidade)
- (`kind=cpf` não tem conector Pluggy — é benefício por CPF, fora do OF)

### Item (= conexão usuário ↔ connector)
Uma conexão estabelecida. Campos: `id`, `connector`, `status`, `executionStatus`,
`createdAt`, `updatedAt`, `error`, `clientUserId`. Status: updating/sync, success,
error, MFA pendente, etc.

**Mapeamento:** um `Item` ≈ "o usuário tem relacionamento com esta instituição".
Na integração futura, cada Item viraria linhas em uma tabela de conexões do usuário,
e suas Accounts determinariam quais `source_items` (variantes) ele possui — hoje
isso é a seleção manual em `user_sources`.

### Account (= conta bancária ou cartão sob um Item)
- `id`, `itemId`, `type` (`BANK` | `CREDIT`), `subtype`
  (`CHECKING_ACCOUNT` | `SAVINGS_ACCOUNT` | `CREDIT_CARD`)
- `number`, `name`, `marketingName`, `balance`, `currencyCode`, `owner`, `taxNumber`
- `bankData` (transferNumber, closingBalance, overdraft…)
- **`creditData`** (cartões — central pro Mapa de Benefícios):
  - `level` — tier do cartão: ex. `BLACK`, `INFINITE`, `SIGNATURE`, `PLATINUM`,
    `GOLD`, `STANDARD`
  - `brand` — bandeira: `VISA`, `MASTERCARD`, `ELO`, `AMEX`, `HIPERCARD`…
  - `creditLimit`, `availableCreditLimit`, `balanceCloseDate`, `balanceDueDate`,
    `status` (ACTIVE/BLOCKED/CANCELLED), `holderType` (MAIN/ADDITIONAL)

**Mapeamento:** `creditData.brand` + `creditData.level` ≈ nosso **`source_items`**
de cartão (hoje um `label` livre tipo "Black/Infinite"). Alinhar esses dois campos
permite casar automaticamente a conta Pluggy com a variante do nosso catálogo.

### Identity (= titular)
`fullName`, `document`/`documentType`, `taxNumber` (CPF/CNPJ), `birthDate`,
`emails`, `phoneNumbers`, `addresses`, `relations`. Útil futuramente p/ benefícios
por CPF e personalização — fora do escopo do alinhamento atual.

## Ajuste de schema proposto (alinhamento, sem integração)

Migração aditiva (colunas nullable; não quebra nada existente):

### `sources` (+ alinhamento com Connector)
- `pluggy_connector_id` int **nullable unique** — id do conector Pluggy
- `connector_type` text nullable — tipo OF (`PERSONAL_BANK`, `TELECOMMUNICATION`,
  `DIGITAL_ECONOMY`, …); mantemos `kind` como o agrupamento do app
- `institution_url` text nullable
- `primary_color` text nullable
- `country` text not null default `'BR'`
- (`logo_url` já equivale a `imageUrl`)

### `source_items` (+ alinhamento com Account.creditData)
- `card_brand` text nullable — `VISA`/`MASTERCARD`/`ELO`/… (Pluggy `creditData.brand`)
- `card_level` text nullable — `BLACK`/`INFINITE`/`PLATINUM`/… (Pluggy `creditData.level`)
- `pluggy_product` text nullable — produto que destrava (`CREDIT_CARDS`, `ACCOUNTS`…)

Esses campos deixam o catálogo "casável" com o que a Pluggy retorna, sem mudar o
fluxo declarativo atual.

## Futuro (na integração — NÃO agora)

Tabelas novas a criar quando integrarmos (espelhando Item/Account):
- `user_connections` (≈ Pluggy Item): id, user_id, source_id, pluggy_item_id,
  status, last_synced_at, created_at.
- `connection_accounts` (≈ Pluggy Account): id, user_connection_id, source_item_id
  (casado por brand/level), pluggy_account_id, type, subtype, card_brand, card_level.
- Ao sincronizar, derivar `user_sources` automaticamente a partir das accounts
  (a seleção manual vira fallback). Auth Pluggy (CLIENT_ID/SECRET) fica em secrets
  do backend; Connect Token gerado por uma edge function/endpoint.

Referência cruzada: [[mapa-de-beneficios-project]].
