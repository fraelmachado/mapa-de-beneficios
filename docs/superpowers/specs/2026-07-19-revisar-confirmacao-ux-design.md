# Revisar Gmail — confirmação explícita por entrada (UX)

**Data:** 2026-07-19
**Origem:** feedback do usuário no smoke real da ingestão Gmail — "na etapa após a busca, onde informo o tipo do benefício ou que não tenho, não há nada visual indicando quais já foram ajustados; toda entrada precisa de confirmação, de forma fluida".

## Problema

No `RevisarGmail` atual: marcas de item único já vêm marcadas (✓, opt-out) e marcas multi-tier aparecem com ✓ **mesmo sem o usuário ter escolhido tier** — não há distinção visual entre "resolvido" e "falta decidir", nem indicador de progresso. Resultado: o usuário não sabe o que já ajustou.

## Decisão (aprovada via mockup, tema escuro do app)

Toda entrada nasce **pendente** e exige decisão explícita. Três estados por linha:
- **Pendente** — nenhuma decisão ainda.
- **Tenho** — confirmado. Item único → o único `source_item`; multi-tier → o tier escolhido.
- **Não tenho** — descartado.

CTA ("Adicionar ao radar") só habilita com **0 pendentes**. Progresso "X de N" + barra no topo.

### Opção ESCOLHIDA — "lista com Tenho / Não por linha" (implementar agora)

- Mantém a lista atual (`.review-item`), que o usuário elogiou.
- Linha **pendente**: borda-esquerda âmbar (`--warn`) + sub-rótulo ("confirme" p/ single, "escolher versão" p/ multi) + dois botões inline **Tenho** (cobalt) / **Não** (ghost).
  - Single: **Tenho** confirma na hora; **Não** descarta.
  - Multi: **Tenho ›** abre a `TierSheet` existente (tiers + "não tenho"); **Não** descarta direto.
- Linha **Tenho**: anel cobalt (reusa o `.on` do sheet) + ✓ verde; nome mostra o tier; ação pequena "trocar versão" (multi) / o próprio ✓ permite desfazer.
- Linha **Não tenho**: esmaecida (`opacity .5`) + "desfazer".
- Topo: barra de progresso + "X de N". Rodapé: "Adicionar ao radar · falta K" (desabilitado) → "Adicionar K ao radar" (habilitado com 0 pendentes).
- Cópia honesta mantida ("metadados … nunca o corpo do e-mail").

**Modelo de estado (impl):** `decision: Map<sourceId,'have'|'no'>` (ausente = pendente) + `chosen: Map<sourceId,itemId>` (tier multi). `pendente = !decision.has(id)`. `resolvedItem(have) = single ? items[0] : chosen.get(id)`. `blocked = algum finding pendente`. `payload = findings com decision==='have'` (item_id = resolvedItem).

### Opção REGISTRADA p/ A/B futuro — "toque + destaque de pendência"

Guardada para teste A/B (não implementar agora). Mais enxuta: sem botões Tenho/Não visíveis por linha.
- Linha **pendente**: anel/realce de atenção + rótulo "toque para confirmar" (single) / "escolher versão ›" (multi); **um** alvo de toque.
  - Toque single → confirma (**Tenho**), com um "não tenho" pequeno/secundário para descartar.
  - Toque multi → abre a `TierSheet` (tiers + "não tenho").
- Estados **Tenho**/**Não tenho** iguais aos da Opção 1 (✓ verde / esmaecido).
- Mesmo gate de CTA (0 pendentes) e mesmo modelo de dados — só muda o **affordance de decisão** (toque-implícito vs botões-explícitos). Isso torna o A/B barato: mesma máquina de estado, troca só a renderização da linha pendente.
- Hipótese do teste: botões explícitos (Op.1) = menos ambiguidade; toque (Op.2) = menos poluição visual / mais rápido. Métrica sugerida: taxa de conclusão do Revisar + nº de descartes corretos.

### Descartada — "triagem card-a-card" (Opção 3)

Fluida, mas troca a lista inteira por um fluxo card-a-card (rework maior, sai do layout aprovado). Fora de escopo; registrada só como referência.

## Escopo da implementação (Opção 1)

- `src/features/onboarding/RevisarGmail.tsx` — novo modelo de estado + render dos 3 estados + progresso + gate.
- `src/features/onboarding/RevisarGmail.test.tsx` — todos pendentes → CTA off; Tenho/Não single; Tenho›→sheet→tier / Não multi; gate 0-pendentes; payload só dos "have".
- `src/features/onboarding/onboarding.css` — `.review-item.pend`/`.done`/`.no`, `.review-actions`/`.review-yes`/`.review-no`, `.review-prog`/`.review-bar`.
- `TierSheet` já suporta `onRemove` (para "não tenho" dentro da folha) — reusar.

Fora de escopo: Opção 2 (só documentada), Opção 3, mudanças no scan/matching/persistência (a RPC/payload não mudam — continua `add_gmail_sources` com os itens "have").
