# Conclusão do Fluxo do App — Gmail Prévia + Alertas (design)

> Spec 1 de 2 desta etapa de design. Spec 2 = alinhamento do Fluxo do Admin (separado).
> Revisada após auditoria adversarial (Codex) — ver "Decisões da revisão adversarial".

**Goal:** Completar o Fluxo do App de 9/12 para 12/12 telas, alinhando **Vasculhando (Tela 03)**, **Revisar Gmail (Tela 08)** e **Alertas (Tela 09)** aos mockups, ligados por navegação real — tudo **visual + mock**, sem Gmail nem motor de alertas de verdade.

**Fonte visual:** `docs/mockups/design_handoff_mockups/Tela 03/08/09 *.dc.html` e `Tela 02 - Como descobrir.dc.html`. Não copiar runtime/fixtures dos mockups para produção.

## Escopo

**Dentro:**
- Habilitar o card Gmail do Método como **"Prévia"** (não mais "Em breve").
- Fluxo de descoberta demo: Vasculhando → Revisar Gmail → salvar → Radar montado.
- Tela de Alertas (opt-in) como passo pós-onboarding + rota `/alertas` reutilizada pelo Perfil.

**Fora:**
- OAuth/leitura real do Gmail; qualquer varredura de e-mail de verdade.
- Motor de alertas (envio, agendamento, backend); schema Supabase, migrations, RPC, Edge Functions.
- Contagem real de benefícios por programa (não existe no contrato de `useSources` — ver decisão D2).
- Corrigir o loop de bootstrap para onboarding vazio (pré-existente; ver "Fora de escopo / follow-ups").
- Fluxo do Admin (Spec 2).

## Restrições globais

- Só tokens de `src/ui/ds.css`; nada hardcoded exceto os gradientes de marca já aprovados.
- Animações decorativas (sweep, ping, pop, count-up) atrás de `prefers-reduced-motion: reduce` — com reduced-motion, o scan pula direto ao estado concluído.
- **Honestidade:** nenhuma copy afirma que lemos o e-mail. Tudo rotulado como prévia/demonstração. "Descartar aqui só ajusta seu radar — nada foi lido do seu e-mail."
- **Persistência preservada e não destrutiva:** salvar usa `useSaveUserSources` (mesma via), mas o Gmail salva a **união** dos achados incluídos com `useUserSources` existentes (D1). Nada de novo backend.
- Valores em R$ são placeholder (`nº de programas × 180/ano`), sempre rotulados "estimado".
- Mobile-first (390×844); desktop aditivo. Tema claro e escuro.

## Decisões da revisão adversarial

- **D1 — Save do Gmail é MERGE, não replace.** `useSaveUserSources`/`replace_user_sources` substitui a seleção inteira. Para não apagar programas existentes, a CTA de Revisar salva `união(useUserSources.data, incluídos)` (dedup por `source_item.id`). Coerente com "Adicionar ao radar".
- **D2 — Contagem do scan é cosmética, sem contrato novo.** `useSources` não traz nº de benefícios. Vasculhando conta **programas achados** (não benefícios); o label é "programas encontrados". Sem ampliar query/select.
- **D3 — Conjunto demo determinístico.** Achados = **os 3 primeiros `source_items`** da 1ª categoria retornada por `useSources` (1 item por fonte, ordem `sort_order`; se a categoria tiver <3 fontes, usa o que houver). Todos começam incluídos.
- **D4 — Fallback de catálogo vazio/insuficiente.** Se `useSources` não retorna nenhuma fonte na 1ª categoria, o caminho Gmail **não** cai no Painel (evita loop de bootstrap): redireciona para o Wizard manual (`'manual'`).
- **D5 — "Todos descartados".** A CTA "Adicionar ao radar" fica **desabilitada** com 0 incluídos (exige ≥1). Quem não quer nenhum volta ao Método e escolhe manual.
- **D6 — `onView` do Radar montado é por-caminho, não global.** `RadarMontado` recebe o destino via prop. Onboarding (manual OU gmail) → `/alertas?from=onboarding`. Edição (`mode=edit`) → `/painel` (sem Alertas). Nada de trocar o comportamento global do componente.
- **D7 — `/alertas` é rota de tela cheia, fora do `AppLayout`** (como `/beneficio/:id` e `/onboarding`), sem sidebar/tabbar.
- **D8 — Click no card = ação imediata.** No Método, clicar no card Gmail chama `onGmail` na hora (igual manual chama `onManual`); sem estado de rádio/seleção intermediário.
- **D9 — Vasculhando é componente novo.** `TransitionScreen` atual permanece só como transição de save do Wizard. Duração do scan ~2.4s (timer cosmético).

## Fluxo e navegação

```
Welcome → Método ┬─ (Manual)        → Wizard ──────────────────────┐
                 └─ (Gmail Prévia)  → Vasculhando → Revisar Gmail ──┤
                                                                     ├→ Radar montado → /alertas?from=onboarding → /painel
```

- `OnboardingPage` orquestra estados: `'welcome' | 'method' | 'manual' | 'gmail-scan' | 'gmail-review'`.
- **Dono do catálogo no caminho Gmail:** o `OnboardingPage` (ou um wrapper do caminho Gmail) consome `useSources`. Loading → skeleton `ob-state`; erro → `PageState` com "Tentar novamente" (`refetch`), **antes** de iniciar o scan. O scan só começa com o catálogo carregado.
- **Sair/voltar do fluxo Gmail:** Vasculhando e Revisar têm botão Voltar → volta ao Método (estado `'method'`); as escolhas de Revisar são efêmeras (recomeçam se refizer o scan).
- **Alertas é rota** `/alertas`, fora da árvore do onboarding (D7), com dois modos por query:
  - `?from=onboarding` → "Ativar alertas" + "Agora não"; ambas → `/painel`.
  - sem query (via Perfil) → "Voltar" → `/perfil`; sem "Agora não".
- Radar montado encerra indo para `/alertas?from=onboarding` **apenas no onboarding** (D6); em `mode=edit` vai direto para `/painel`.

## Telas

### Método (Tela 02) — habilitar Gmail Prévia
- Card Gmail perde `disabled`; badge "Em breve" → **"Prévia"**. Mantém aurora/twinkles/logo.
- Click no card chama `onGmail` imediatamente (D8). Copy ajustada para prévia (sem afirmar leitura de e-mail).

### Vasculhando (Tela 03) — scan cosmético (componente novo, D9)
- Radar `mb-sweep` + anel `mb-ping` + dots `mb-pop`; count-up `0 → nº de programas achados`; label "programas encontrados" (D2); barra de progresso + labels rotativos; duração ~2.4s.
- `prefers-reduced-motion`: sem sweep/ping/pop e sem count-up; mostra o estado concluído direto.
- Concluído → "Ver meus benefícios →" → Revisar. Botão Voltar → Método.

### Revisar Gmail (Tela 08) — revisar achados (por programa)
- "Descoberta concluída / Revise o que encontramos" + contador "incluídos R$ X/ano" (placeholder D2, recalcula ao alternar).
- Lista os achados (D3): card com provedor + variante, toggle incluir/descartar (opacidade ao descartar). Nota honesta: "Prévia — nada foi lido do seu e-mail; descartar aqui só ajusta seu radar."
- CTA "Adicionar ao radar": **desabilitada com 0 incluídos** (D5); salva `união(existentes, incluídos)` via `useSaveUserSources` (D1).
- **Estado de save:** durante o `mutateAsync`, CTA em "Salvando…" e desabilitada (sem duplo clique); em erro, mensagem `role="alert"` "Não foi possível salvar. Tente de novo." e as escolhas permanecem; em sucesso → Radar montado.
- Se o conjunto demo vier vazio → redireciona ao Wizard (D4); não renderiza Revisar vazio.
- **Adaptação registrada:** revisar opera por **programa** (`source_item`), não por benefício individual.

### Alertas (Tela 09) — opt-in (rota `/alertas`, D7)
- "Não perca um benefício" + três preferências (linhas com toggle acessível): **Novos benefícios**, **Prazo de expiração**, **Resumo mensal** (defaults: Novos on, Prazo on, Resumo off).
- Modo onboarding (`?from=onboarding`): "Ativar alertas" grava `optIn:true` + toggles atuais; "Agora não" grava `optIn:false` (dismissed, não repergunta); ambas → `/painel`.
- Modo edição (via Perfil): "Voltar" → `/perfil`; grava as mudanças de toggle ao alternar.
- **Toggles** são `role="switch"` com `aria-checked`, foco visível e operáveis por teclado; mudança anunciada em `aria-live`.
- **Persistência (mock):** `localStorage` chave `mb-alerts`, schema `{ v: 1, optIn: boolean, novos: boolean, prazo: boolean, resumo: boolean }`. Leitura com `try/catch`: JSON inválido, versão diferente ou `localStorage` indisponível → cai nos defaults, sem quebrar.

### Perfil — linha "Alertas"
- Nova linha (ícone de sino) na seção "Conta", entre "Editar meus programas" e "Tema", navegando para `/alertas` (modo edição).

## Componentes / arquivos

- **Novos:** `src/features/onboarding/Vasculhando.tsx`, `RevisarGmail.tsx`; `src/features/alertas/Alertas.tsx` (+ css) e `useAlertPrefs.ts` (hook localStorage com guarda/recuperação).
- **Alterados:** `OnboardingIntro.tsx` (Método: Gmail Prévia + `onGmail`), `OnboardingPage.tsx` (estados `gmail-scan`/`gmail-review`, consumo de `useSources`, fallback D4), `RadarMontado.tsx` (destino via prop, D6), `ManualWizard.tsx` (passa `onView` conforme `mode=edit`), `Perfil.tsx` (linha Alertas), `src/router.tsx` (rota de tela cheia `/alertas`).
- **Keyframes** `mb-sweep`, `mb-ping`, `mb-pop` adicionados às animações compartilhadas de `onboarding.css`.

## Testes
- **Unit (Vitest/RTL):**
  - Método: Gmail habilitado, badge "Prévia", click chama `onGmail`.
  - Caminho Gmail no `OnboardingPage`: erro de `useSources` mostra retry; sucesso inicia scan → Vasculhando conclui → Revisar lista os achados (D3).
  - Revisar: CTA desabilitada com 0 incluídos (D5); salvar chama `useSaveUserSources` com **união** de existentes + incluídos (D1); erro de save mantém escolhas e mostra alerta; sucesso vai a Radar montado.
  - Fallback: catálogo vazio no caminho Gmail redireciona ao Wizard (D4).
  - `RadarMontado`: onboarding → `/alertas?from=onboarding`; `mode=edit` → `/painel` (D6).
  - `useAlertPrefs`: default; JSON inválido/indisponível → defaults; "Ativar" grava optIn true; "Agora não" grava optIn false.
  - Alertas: toggles `role="switch"` alternam e persistem; navegação por modo; Perfil abre `/alertas`.
  - `prefers-reduced-motion` desliga animações do scan.
- **E2E (Playwright):** estende `tests/e2e/app-layout.spec.ts` com o caminho Gmail Prévia (método → vasculhando → revisar → adiciona → radar → alertas → painel) nos 4 cenários, com no-overflow e screenshots. Depende de seed com ≥1 fonte na 1ª categoria (garantir no seed de teste).

## Fora de escopo / follow-ups
- **Loop de bootstrap para onboarding vazio** (pré-existente): concluir onboarding com 0 programas não cria `user_sources`, e o bootstrap devolve para `/onboarding`. Afeta também o Wizard. Registrar como follow-up separado; esta spec só evita **criar novo** dead-end (D4/D5).
- Migração das preferências de Alertas para backend real quando o motor existir (o schema local `mb-alerts` é a semente).

## Auto-revisão (self-review)
- Sem TBD/placeholders; toda quantidade fixada (D3: 3; scan ~2.4s).
- Consistência: "Adicionar ao radar" = merge não destrutivo (D1); contagem cosmética (D2) elimina a contradição com `useSources`; `onView` por-caminho (D6) elimina a contradição manual/edit.
- Escopo: uma etapa (App), um plano; contagem real e loop de bootstrap explicitamente fora.
- Ambiguidades resolvidas em D1–D9; estados de loading/erro/pending/empty definidos e testáveis.
