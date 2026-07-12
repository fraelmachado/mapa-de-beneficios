# Conclusão do Fluxo do App — Gmail Prévia + Alertas (design)

> Spec 1 de 2 desta etapa de design. Spec 2 = alinhamento do Fluxo do Admin (separado).

**Goal:** Completar o Fluxo do App de 9/12 para 12/12 telas, alinhando **Vasculhando (Tela 03)**, **Revisar Gmail (Tela 08)** e **Alertas (Tela 09)** aos mockups, ligados por navegação real — tudo **visual + mock**, sem Gmail nem motor de alertas de verdade.

**Fonte visual:** `docs/mockups/design_handoff_mockups/Tela 03/08/09 *.dc.html` e `Tela 02 - Como descobrir.dc.html`. Não copiar runtime/fixtures dos mockups para produção.

## Escopo

**Dentro:**
- Habilitar o card Gmail do Método como **"Prévia"** (não mais "Em breve").
- Fluxo de descoberta demo: Vasculhando → Revisar Gmail → salvar → Radar montado.
- Tela de Alertas (opt-in) como passo pós-onboarding nos dois caminhos + linha "Alertas" no Perfil.

**Fora:**
- OAuth/leitura real do Gmail; qualquer varredura de e-mail de verdade.
- Motor de alertas (envio, agendamento, backend); schema, migrations, RPC, Edge Functions.
- Fluxo do Admin (Spec 2).

## Restrições globais

- Só tokens de `src/ui/ds.css` para superfícies, texto, bordas, estados; nada hardcoded exceto o que já foi aprovado nos gradientes de marca.
- Animações decorativas (sweep, ping, pop, count-up) atrás de `prefers-reduced-motion: reduce`.
- **Honestidade:** nenhuma copy pode afirmar que lemos o e-mail do usuário. O fluxo é rotulado como prévia/demonstração. "Descartar aqui só remove do radar."
- **Persistência preservada:** salvar usa `useSaveUserSources` (mesma via de escrita atual). Nada de novo backend.
- Valores em R$ são placeholder (`nº de benefícios × 180/ano`), sempre rotulados "estimado".
- Mobile-first (390×844); desktop aditivo. Tema claro e escuro.
- Cada tela precisa de loading/erro onde fizer sentido (reaproveitar `PageState`/`Skeleton`).

## Fluxo e navegação

```
Welcome → Método ┬─ (Manual)        → Wizard ──────────────────────┐
                 └─ (Gmail Prévia)  → Vasculhando → Revisar Gmail ──┤
                                                                     ├→ Radar montado → Alertas → Painel
```

- `OnboardingPage` orquestra as telas do onboarding por estado. Novos estados: `'gmail-scan'`, `'gmail-review'`, além de `'welcome' | 'method' | 'manual'`.
- **Alertas é uma rota** `/alertas` (fora da árvore do onboarding), com dois modos por query:
  - `?from=onboarding` → mostra "Ativar alertas" + "Agora não"; ambas vão para `/painel`.
  - sem query (via Perfil) → modo edição: "Voltar" (→ `/perfil`), sem "Agora não".
- Radar montado encerra indo para `/alertas?from=onboarding` (hoje vai direto para `/painel`). Isso vale para os **dois** caminhos, porque ambos passam por Radar montado.
- `mode=edit` continua entrando direto no Wizard (sem Alertas no fim da edição).

## Telas

### Método (Tela 02) — habilitar Gmail Prévia
- Card Gmail deixa de ter `disabled`; badge muda de "Em breve" para **"Prévia"**.
- Mantém aurora/twinkles/logo já existentes. Passa a ser selecionável e a CTA inferior, com Gmail selecionado, chama `onGmail`.
- Copy do card ajustada para prévia (sem "lemos seus e-mails" como fato).

### Vasculhando (Tela 03) — scan cosmético
- Radar com `mb-sweep` (conic-gradient girando), anel `mb-ping`, dots `mb-pop` surgindo.
- Count-up de `0 → N benefícios encontrados`, onde **N = soma dos benefícios dos programas achados** (contagem real do catálogo demo).
- Barra de progresso animada + labels rotativos ("procurando cartões…", etc.).
- Ao concluir: botão "Ver meus benefícios →" (não auto-navega) → Revisar.
- Substitui/estende a `TransitionScreen` atual (que hoje é usada como transição de save do wizard). O save do wizard continua usando a transição simples; Vasculhando é a tela rica do caminho Gmail.

### Revisar Gmail (Tela 08) — revisar achados (por programa)
- "Descoberta concluída / Revise o que encontramos" + contador "incluídos R$ X/ano" (placeholder, recalcula ao alternar).
- **Achados = subconjunto curado do catálogo** resolvido em runtime de `useSources`: os primeiros programas da primeira categoria (ex.: 2-3 fontes de `bank_card`), com a primeira variante de cada. Todos começam incluídos.
- Cada item é um card com provedor + variante + nº de benefícios, com toggle incluir/descartar (opacidade reduzida ao descartar).
- Nota honesta: "Prévia — nada foi lido do seu e-mail; descartar aqui só ajusta seu radar."
- CTA "Adicionar ao radar" salva os `source_item` incluídos via `useSaveUserSources` → Radar montado.
- **Adaptação registrada:** revisar opera por **programa**, não por benefício individual (a persistência é por `source_item`). O contador e a lista refletem programas/seus benefícios, não toggles por benefício.

### Alertas (Tela 09) — opt-in (rota `/alertas`)
- "Não perca um benefício" + três preferências em linhas com toggle: **Novos benefícios**, **Prazo de expiração**, **Resumo mensal** (defaults: Novos on, Prazo on, Resumo off, como no mockup).
- Modo onboarding (`?from=onboarding`): primária "Ativar alertas" + secundária "Agora não"; ambas → `/painel`.
- Modo edição (via Perfil): "Voltar" → `/perfil`; sem "Agora não".
- Preferências persistem em `localStorage` (`mb-alerts`), sem efeito de backend.

### Perfil — linha "Alertas"
- Nova linha (ícone de sino) na seção "Conta", entre "Editar meus programas" e "Tema", abrindo a tela de Alertas em modo edição.

## Dados e mocks

- Catálogo real via `useSources`; benefícios reais via `useMyBenefits` (para contagens no Radar montado, já existente).
- Conjunto demo dos "achados": determinístico a partir do catálogo carregado (primeiras N fontes da 1ª categoria). Sem dados fabricados de provedor.
- Alertas: só estado local (`localStorage`).

## Componentes / arquivos

- **Novos:** `src/features/onboarding/Vasculhando.tsx`, `RevisarGmail.tsx`, `Alertas.tsx`; estilos adicionados a `src/features/onboarding/onboarding.css` (+ possível `alertas.css`/reuso). `useAlertPrefs` (hook local de localStorage).
- **Alterados:** `OnboardingIntro.tsx` (Método: Gmail Prévia + `onGmail`), `OnboardingPage.tsx` (estados `gmail-scan`/`gmail-review`), `RadarMontado.tsx` (`onView` → `/alertas?from=onboarding`), `Perfil.tsx` (linha Alertas → `/alertas`), `src/router.tsx` (rota `/alertas`).
- **Keyframes** `mb-sweep`, `mb-ping`, `mb-pop` adicionados às animações compartilhadas de `onboarding.css`.

## Estados
- Vasculhando: sempre "carregando/scanning" até concluir; sem erro (é cosmético) — se `useSources` falhar, cai no estado de erro já existente do onboarding antes de iniciar o scan.
- Revisar: se o conjunto demo vier vazio (catálogo sem fontes), mostra `PageState` "Nada para revisar" com CTA para o Painel.
- Alertas: sem loading (estado local).

## Testes
- **Unit (Vitest/RTL):**
  - Método: card Gmail habilitado, badge "Prévia", `onGmail` disparado.
  - Fluxo demo no `OnboardingPage`: Gmail → Vasculhando (mock de scan conclui) → Revisar → "Adicionar ao radar" chama `useSaveUserSources` com os ids incluídos → Radar montado → Alertas → `/painel`.
  - Revisar: descartar um item remove-o do save; contador atualiza.
  - Alertas: toggles persistem; "Ativar alertas" e "Agora não" vão para `/painel`; Perfil abre Alertas em modo edição.
  - `prefers-reduced-motion` desliga as animações (checagem de classe/CSS).
- **E2E (Playwright, gate visual):** estende `tests/e2e/app-layout.spec.ts` com o caminho Gmail Prévia (método → vasculhando → revisar → alertas → painel) nos 4 cenários (mobile/desktop × claro/escuro), com asserção de no-overflow e screenshots.

## Auto-revisão (self-review)
- Sem TBD/placeholders de spec.
- Consistência: Alertas no fim dos dois caminhos; Revisar por programa alinhado à persistência; Gmail "Prévia" coerente com a decisão de honestidade.
- Escopo: focado numa etapa (App), implementável num plano só; Admin explicitamente fora.
- Ambiguidade resolvida: "achados" = subconjunto determinístico do catálogo; contadores = placeholder rotulado; Alertas = local.
