# Tela "Programas" → Meus programas (redesign) — design

**Data:** 2026-07-19
**Origem:** feedback do usuário — (1) o re-scan do Gmail não tinha gatilho no front; (2) a tela "Programas" (hoje = wizard de onboarding em `?mode=edit`) não segue a linguagem do Revisar; (3) deveria mostrar o método de onboarding usado + permitir refazer/mudar. Protótipo interativo aprovado: artifact `468b8fca-0902-45c5-861d-cb7dc5c0f7d8` (fonte em `docs/mockups/2026-07-19-programas-meus-programas.html`).

## Problema

Ao tocar **Programas** (bottom nav), abre o `ManualWizard` em `?mode=edit` — um wizard de 5 passos por categoria, pensado pra *montar do zero*. Quem já tem programas quer **ver e gerenciar os seus**, não re-caminhar o onboarding. Além disso: nenhum caminho reabre o **scan do Gmail** (re-scan), e não se mostra a **proveniência** (o que veio do Gmail × manual).

## Decisão (aprovada via protótipo interativo)

**Programas** vira uma tela **"Meus programas"** — lista dos programas do usuário, na linguagem visual do Revisar — com dois pontos de entrada pra crescer (Gmail / catálogo) e gestão por item. Os fluxos de *adicionar* (wizard por categoria) e *descobrir* (scan Gmail) continuam existindo; a tela Programas passa a ser a **casa** deles, padronizando a linguagem.

### Anatomia da tela (`/programas`, dentro do AppLayout)

1. **Header:** título "Programas".
2. **Resumo:** "Você tem N programas" + **chips de proveniência** ("4 via Gmail", "2 manuais") + "Última busca no Gmail há X · <conta>" (some se não houver evidência).
3. **Duas ações:** **Procurar no Gmail** (primária, cobalt → re-scan) e **Do catálogo** (ghost → wizard de adicionar).
4. **Lista "Seus programas":** cada item (card estilo `.review-item`): logo/inicial + "Marca Tier" + selo **Gmail**/**Manual** (+ "há X" se Gmail) + botão **⋯**.
5. **⋯ por item (bottom sheet, 1 folha só):**
   - Marca **multi-tier** → mostra **direto as versões** ("Qual o seu X?" com tiers + valor/ano + a atual selecionada; tocar troca o tier) **+** divisor **+** "Remover do radar".
   - Marca **single-tier** → só o cabeçalho (de onde veio) + "Remover do radar".
6. **Empty state:** se não houver programas, um card com CTA pros dois caminhos.

### Proveniência (sem migration)

Derivada de `source_evidence`: `source_id` presente em `source_evidence` do usuário ⇒ **Gmail** (com `email_from` e "há X" via `created_at`/`email_date` mais recente); senão ⇒ **Manual**. "Última busca" = `max(created_at)`. Novo hook `useSourceEvidence(userId)` (select own-rows: `source_id, email_from, email_date, created_at`).

### Dados da lista

Novo hook `useMyPrograms(userId)` que compõe:
- `useUserSources` → ids de `source_item` do usuário;
- `useSources` (catálogo) → marca/tiers/categoria/logo/valor por item;
- `useSourceEvidence` → proveniência por `source_id`.
Retorna por programa `{ itemId, sourceId, brand, tier, tiers, logo, provenance, when, from }` + um resumo `{ total, gmailCount, manualCount, lastScan }`.

### Gerenciar (reusa a RPC existente — sem RPC nova)

- **Remover:** recomputa o conjunto de `user_sources` **menos** aquele item → `replace_user_sources(ids)`.
- **Trocar tier:** recomputa trocando o `source_item` antigo pelo novo (mesma marca) → `replace_user_sources(ids)`.
- Evidência **não** é apagada ao remover um programa (é histórico; a retenção de 30 dias / "apagar dados" no Perfil cuidam). O resumo conta proveniência só entre os programas **atuais**, então remover já some da contagem.

### Re-scan (Gmail) e Adicionar (catálogo)

- **Procurar no Gmail** → `/onboarding?method=gmail`: `OnboardingPage` passa a honrar esse parâmetro **começando direto em `gmail-consent`** (pula welcome/method). Ao concluir (ou 0 achados), volta pra **`/programas`**. Re-scan é **aditivo/idempotente** (RPC `add_gmail_sources`, `on conflict do nothing`) — soma novos, não duplica, roda sob o mesmo `user_id`.
- **Do catálogo** → `/onboarding?mode=edit` (o `ManualWizard` atual, pré-preenchido). Inalterado.

### Navegação

- Bottom nav / AppLayout "Programas" passa a apontar pra **`/programas`** (nova tela), não mais `/onboarding?mode=edit`.
- Painel "Adicionar programas" e Perfil "Editar meus programas": manter apontando pro fluxo de adicionar (`/onboarding?mode=edit`) — ou, opcional, pra `/programas`. (Decisão de detalhe no plano; default = manter.)

## Escopo

**Front-only. Sem migration, sem RPC nova.** Reusa `replace_user_sources`, `add_gmail_sources`, `useSources`, `source_evidence` (só leitura nova), a linguagem `.review-item`/bottom-sheet.

### Arquivos (previsto)
- `src/features/programas/MeusProgramas.tsx` (nova tela) + `programas.css` (ou reuso de classes existentes).
- `src/features/programas/useMyPrograms.ts`, `useSourceEvidence.ts`.
- `src/features/programas/ProgramSheet.tsx` (⋯: tiers multi + remover; reusa visual do `ob-sheet`/`TierSheet`).
- `src/features/onboarding/OnboardingPage.tsx` — honrar `?method=gmail` (start em `gmail-consent`; onDone → `/programas`).
- `src/router.tsx` — rota `/programas` sob AppLayout.
- `src/features/layout/{BottomNav,AppLayout}.tsx` — "Programas" → `/programas`.
- Hooks de gestão: `useRemoveProgram`/`useSwapTier` (ou um `useEditPrograms` que envolve `replace_user_sources` recomputando a partir de `useUserSources`).

## Fora de escopo
- Mudança no `ManualWizard` (segue como o "adicionar do catálogo").
- Ordenação por categoria / valor no resumo (pode virar follow-up).
- Verificação Google / abrir Gmail a usuários fora do Testing (decisão de produto à parte).
