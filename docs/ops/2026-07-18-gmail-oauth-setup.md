# Setup OAuth Gmail (modo Testing) — runbook Google Cloud

**Data:** 2026-07-18
**Escopo:** obter um `VITE_GOOGLE_CLIENT_ID` (OAuth Client ID Web, público, sem secret) para o método de ingestão "conectar Gmail" do onboarding.

> `.env.example` já documenta a var. **Sem `VITE_GOOGLE_CLIENT_ID` setado, o método Gmail cai direto no wizard manual** — a ausência da var não quebra o app, só desabilita esse atalho (ver `useGmailAuth.ts` e o teste "sem VITE_GOOGLE_CLIENT_ID (gmail indisponível) pula direto pro wizard manual").

O console do Google reorganizou o antigo "OAuth consent screen" sob **Google Auth Platform** (tabs: **Branding**, **Audience**, **Data Access**, **Clients**). Os passos abaixo usam essa nomenclatura atual — se seu console ainda mostrar as telas antigas, o mapeamento é 1:1 (comentado em cada passo).

## 1. Projeto + API

1. [console.cloud.google.com](https://console.cloud.google.com) → criar ou selecionar um projeto.
2. **APIs & Services → Library** → buscar **Gmail API** → **Enable**.

## 2. Google Auth Platform (consent screen)

Menu lateral: **APIs & Services → Google Auth Platform**.

1. **Branding** — nome do app, e-mail de suporte (obrigatórios na primeira vez; qualquer valor razoável serve em modo Testing).
2. **Audience** — tipo **External**; deixar em **Testing** (não precisa passar por verificação do Google para uso interno/dev). Em **Test users**, adicionar seu e-mail (e o de qualquer testador) — só contas listadas aqui conseguem completar o consent enquanto o app estiver em Testing.
   *(Nomenclatura antiga: isto era a seção "OAuth consent screen" → "Test users".)*
3. **Data Access** — adicionar o scope `.../auth/gmail.readonly` (buscar "Gmail API" na lista de scopes). É o único scope necessário — leitura de metadados/mensagens, sem escrever ou apagar nada na caixa.
   *(Nomenclatura antiga: "Scopes" dentro do consent screen.)*

## 3. Clients (OAuth Client ID)

Tab **Clients** (mesma tela do Google Auth Platform; era "Credentials → Create OAuth client ID").

1. **Create client** → tipo **Web application**.
2. **Authorized JavaScript origins** — adicionar as duas:
   - `http://localhost:5173`
   - `https://www.mapadebeneficios.com.br`
3. **Não** criar/copiar client secret — o fluxo usado é o GIS (Google Identity Services) `initTokenClient` client-side, que não usa secret.
4. Salvar e copiar o **Client ID** (formato `xxxx.apps.googleusercontent.com`).

## 4. Configurar o Client ID

- **Local:** `.env.local` (gitignored) →
  ```
  VITE_GOOGLE_CLIENT_ID=<client-id>
  ```
  Reiniciar `npm run dev` para o Vite pegar a var.
- **Prod (Dokploy):** app do front → build arg `VITE_GOOGLE_CLIENT_ID=<client-id>` → redeploy (o valor é embutido no bundle em build-time, igual `VITE_SUPABASE_URL`).

## 5. Verificação (manual — não automatizável por agente)

Com `VITE_GOOGLE_CLIENT_ID` em `.env.local`:

1. `npm run dev` → abrir `/onboarding` → método Gmail → consent.
2. Conectar com uma conta de teste (precisa estar na lista de **Test users** do passo 2.2, senão o Google recusa com "app não verificado / acesso bloqueado").
3. Esperado: popup real do Google aparece; após consentir, `Vasculhando` mostra a contagem real de mensagens; `Revisar` lista marcas reais detectadas no inbox; confirmar grava evidências (`select * from source_evidence` no Supabase local).
4. Sem a var: o método Gmail deve pular direto pro wizard manual, sem erro.

Este passo exige um popup OAuth real e uma conta Google de teste — não roda headless/CI. Marcar como feito só depois de rodar manualmente no browser.
