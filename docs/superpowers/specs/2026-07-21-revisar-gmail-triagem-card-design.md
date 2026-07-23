# Revisar Gmail — triagem card-a-card (Opção 3) + categoria

**Data:** 2026-07-21
**Origem:** feedback do usuário no smoke real — "não gostei da tela implementada, quero testar a opção 3 (triagem card-a-card) do mockup `docs/mockups/2026-07-19-revisar-gmail-opcoes-1-3.html`. Só gostaria de acrescentar a categoria a qual o card pertence."

## Problema

A tela implementada em 2026-07-19 (Opção 1 — lista com Tenho/Não por linha, ver
[2026-07-19-revisar-confirmacao-ux-design.md](2026-07-19-revisar-confirmacao-ux-design.md))
pede N decisões numa parede única de linhas. Cada linha tem nome, sub-rótulo, dois botões e
estados de cor; a densidade cresce com o número de marcas encontradas e nada indica **por que**
aquela marca apareceu, além de "via Nubank". O usuário rejeitou a tela no uso real.

A Opção 3, já mockada e descartada na rodada anterior, resolve por foco: uma decisão por vez,
com espaço para mostrar a evidência (remetente, data) e as versões da marca no próprio card.
Falta nela um dado que o usuário pediu: **a categoria do programa** (Bancos & cartões,
Varejo & assinaturas, …), que hoje só aparece no wizard manual.

## Decisão

Substituir a lista pela **triagem card-a-card**, com **resumo antes de salvar**. A tela vira
duas fases:

1. **Triagem** — um card por marca encontrada, decisão por toque, avança sozinho.
2. **Resumo** — o que você confirmou, com desfazer por item e o CTA que salva.

Nada é gravado até o CTA do resumo (mesma `add_gmail_sources` em lote de hoje).

### Decisões de interação (aprovadas)

| Questão | Escolha | Por quê |
|---|---|---|
| Fim do fluxo | Resumo antes de salvar | Mantém a rede de segurança da lista atual sem a fadiga de decidir tudo numa tela só; um toque errado no meio não vira dado salvo. |
| Multi-tier | Toque no tier **decide e avança** | Um toque em vez de dois; o resumo cobre o engano. O rodapé desse card fica só com "Não tenho" — a escolha do tier **é** o "tenho". |
| Voltar | `‹` volta um card | Gesto que o usuário já espera; reabre a decisão do card anterior. Pontinhos ficam como progresso, não navegação (alvo de 7px não passa em toque). |
| Categoria | Eyebrow acima da marca, com ponto colorido | Reusa a classe `.lbl` que todas as telas do onboarding já usam; sem elemento visual novo num card que já tem logo, nome, e-mail e tiers. A cor vai no **ponto**, não no texto — ver "Categoria" abaixo. |
| Ação no resumo | **Editar**, não "desfazer" | Reabrir o card mantendo a escolha é o que o botão faz de fato; chamar isso de "desfazer" mentiria (a decisão continua valendo se o usuário só voltar). Desfazer de verdade é escolher outra coisa no card. |
| Descartados | Aparecem no resumo, esmaecidos | O resumo existe pra pegar o toque errado — e o toque errado mais provável é "Não tenho" numa marca que você tem. Esconder os descartados atrás de um contador anularia metade da rede de segurança. |

## Arquitetura

Nenhuma query nova, nenhuma migration: `useSources` já traz `source_category` por marca e
`benefitCount` + `estValueBrl` por tier ([useSources.ts](../../../src/features/onboarding/useSources.ts)).

### Estado

Os dois Maps de hoje (`decision: Map<sourceId,'have'|'no'>` + `chosen: Map<sourceId,itemId>`)
colapsam em **um**:

```ts
decision: Map<string, string | null>  // sourceId → itemId escolhido | null ("não tenho")
                                      // ausente = ainda não decidido
```

O `itemId` já codifica "tenho + qual versão", eliminando o estado impossível de hoje
("have" sem tier escolhido). Mais:

- `idx: number` — card atual.
- `phase` derivado: `idx >= findings.length` → resumo.
- `fromSummary: boolean` — o card atual foi aberto pelo "Editar" do resumo.

Regras:
- Decidir avança: `setDecision` + (`fromSummary` ? volta ao resumo : `idx+1`). Editar o card 2 de
  5 pelo resumo devolve ao resumo, não empurra o usuário pelos cards 3-5 de novo.
- Decidir o último card (fluxo normal) entra no resumo.
- A transição é **idempotente por índice**: a decisão grava em `findings[idx].sourceId` e o
  avanço é `setIdx(i => i === idx ? i + 1 : i)`. Duplo toque ou Enter repetido não pula card.
- `‹`: `idx > 0` → `idx-1` (a decisão anterior aparece pré-selecionada e é sobrescrita se ele
  decidir de novo); `idx === 0` → `onBack()` (sai da tela, comportamento atual); no resumo →
  volta ao último card.
- Durante o save (`saving`) a tela inteira fica inerte: editar e voltar ficam desabilitados,
  não só o CTA.
- Qualquer mudança de decisão limpa `saveError` — um erro de uma tentativa anterior não pode
  seguir na tela depois que o usuário mexeu no que vai ser salvo.
- CTA só existe no resumo. Payload e `onDone(haveList)` idênticos aos de hoje.
- Lista vazia não é caso desta tela: `OnboardingPage` já desvia para `gmail-none` quando o
  scan não acha nada, então `findings.length >= 1` é pré-condição.
- Marca sem nenhum `source_item` não vira card: `matchSources` a descarta na origem, porque
  não há o que confirmar (hoje ela cairia no caminho multi-tier com zero tiers tocáveis).

### Componentes

```
RevisarGmail.tsx        máquina de estado (idx + decision), decide o que renderizar
  ├── TriageCard.tsx    um card: logo, categoria, marca, procedência, tiers, rodapé
  └── TriageSummary.tsx conferência final: confirmados + descartados + editar + CTA
```

`TriageCard` é puro: recebe `finding` + `chosenId` (para reabrir uma decisão) e devolve
`onDecide(itemId | null)`. Sem estado próprio, testável isolado.

**Card:**
- mark de 56px com o logo (fallback: inicial da marca, como hoje);
- eyebrow `.lbl`: ponto na cor da categoria + rótulo de `categoryMeta()`;
- nome da marca;
- procedência: "achamos no seu Gmail" + remetente + `relTime(emailDate)` — o `relTime` de
  [buildPrograms.ts:11](../../../src/features/programas/buildPrograms.ts#L11), que passa a ser
  exportado ("hoje" / "há N dias" / "há N semanas" / "há N meses" / "há N anos"). O `rel()` do
  admin é outra implementação, com outro contrato; não é reusado aqui;
- **marca de versão única:** rodapé `[Não tenho] [Tenho ›]`;
- **marca multi-tier:** tiers com `≈R$ X/ano` e selo "Mais completo" pelo mesmo critério da
  `TierSheet` (mais benefícios, desempate por maior valor estimado); toque no tier decide;
  rodapé só `[Não tenho]`. Tier sem benefício mapeado mostra "Benefícios em breve" e **omite**
  o valor, como já faz a sheet — nunca "R$ 0/ano". O selo só aparece se o tier tiver benefício;
- **"Não tenho certeza"** continua disponível abaixo dos tiers, escolhendo o tier "Mais
  completo" — é exatamente o que a `TierSheet` faz hoje neste fluxo. Sem essa saída, quem não
  sabe a versão do cartão só teria a opção errada de dizer "Não tenho";
- `peek` (borda do próximo card espiando) só quando há próximo — decorativo.

**Progresso e foco (acessibilidade):**
- Os pontinhos são a apresentação, não a semântica: o contêiner deles leva
  `role="progressbar"` + `aria-valuemin/max/now`, preservando o que a tela tem hoje
  ([RevisarGmail.tsx:86](../../../src/features/onboarding/RevisarGmail.tsx#L86)); os pontos em
  si são `aria-hidden`. Acima de 8 achados os pontos dão lugar à barra contínua já existente
  (`.review-bar`), que não degrada com N.
- Texto "3 de 5" visível ao lado, em `aria-live="polite"`, para anunciar o avanço.
- Ao trocar de card o foco vai para o `<h2>` do novo card (`tabIndex={-1}`), senão o foco morre
  no botão que acabou de desmontar e o leitor de tela volta pro topo do documento.
- Tiers são `aria-pressed` quando correspondem à decisão já tomada (card reaberto), como a
  sheet faz hoje.
- Todo alvo de toque tem no mínimo 44px e `:focus-visible` herdado dos botões do design system.

**Resumo:** reaproveita o CSS `.review-*` que já existe — a lista de hoje vira a tela de
conferência, então o CSS escrito na rodada anterior não é jogado fora. Lista **todos** os
achados, confirmados primeiro (com o tier escolhido no nome) e descartados depois, esmaecidos
(`.review-no`, que já existe). Cada linha tem **"Editar"**, que reabre aquele card com a
decisão atual pré-selecionada e devolve ao resumo. Fecha com `≈R$ X/ano` somado dos
confirmados, a nota de privacidade e o aviso de scan parcial. CTA: `Adicionar N ao radar`, ou
`Concluir` se nada foi confirmado.

### Categoria

- `Finding` ganha `category: SourceCategory`, preenchida em `matchSources` a partir de
  `source.source_category ?? 'bank_card'` (mesmo default de `groupSourcesByCategory`).
- `CategoryMeta` ganha `color: string`, e o mapa `SOURCE_CAT_COLOR` **sai** de
  `admin/discovery/discoveryMeta.ts` **para** `onboarding/categoryMeta.ts`; `discoveryMeta`
  passa a ler de lá. Sem isso o onboarding importaria cor de dentro do admin, que é de trás
  pra frente. Uma fonte de verdade para label + ícone + cor.
- **A cor não pinta o texto.** As cores de categoria são de marcador, não de tipografia: em
  texto de 11px no tema claro elas ficam entre 2,7:1 e 3,9:1, abaixo do mínimo de 4,5:1 do
  WCAG AA. O eyebrow usa um ponto colorido de 8px seguido do rótulo em `--ink-2` — o mesmo
  padrão de `.chip i.cat-*` que o design system já usa ([ds.css:188](../../../src/ui/ds.css#L188)).
  Cor como reforço, texto legível como base.

## Testes

- `RevisarGmail.test.tsx` **reescrito** (a UI que ele cobre deixa de existir):
  card único avança ao decidir; toque no tier decide e avança com o tier certo; `‹` reabre a
  decisão anterior pré-selecionada; resumo lista confirmados **e** descartados; "Editar" no
  resumo volta ao card e **devolve ao resumo** ao decidir; CTA salva o payload correto; erro de
  save mantém no resumo e some ao mudar uma decisão; duplo toque no mesmo botão não pula card.
- `TriageCard.test.tsx` **novo**: renderiza categoria, procedência e tiers; dispara `onDecide`
  com o `itemId` do tier tocado e com `null` no "Não tenho"; "Não tenho certeza" devolve o tier
  "Mais completo"; tier sem benefício não mostra valor; foco vai para o título ao montar.
- `matchSources.test.ts`: +2 casos — categoria propagada da `Source` para o `Finding`, e marca
  sem `source_items` descartada.
- `OnboardingPage.test.tsx` não muda (mocka a tela).
- Sem e2e novo: o fluxo do Gmail não está no gate visual (depende de OAuth real).

## Fora de escopo

- `TierSheet` continua como está — o wizard manual e `/programas` usam. Só deixa de aparecer
  nesta tela.
- **Sem swipe.** Decisão por toque em botão: testável, acessível e suficiente. Swipe entra
  depois se o uso real pedir.
- A Opção 2 registrada para A/B na spec anterior fica congelada — este redesign a substitui
  como alternativa a ser testada.
- **Logo que falha no carregamento** continua sem fallback (hoje o fallback só cobre
  `logo_url` nulo). Não é regressão desta tela e vale um `onError` global no dia em que
  incomodar.

## Dívida conhecida, fora deste escopo

A revisão adversarial da spec (Codex, 2026-07-21) apontou quatro defeitos que **já existem em
produção** e não são causados por este redesign. Ficam registrados aqui para não se perderem:

1. **Catálogo carregando vira "nada encontrado".** `OnboardingPage` faz
   `flatSources = sourcesQuery.data ?? []` sem olhar `isLoading`/`error`
   ([OnboardingPage.tsx:27](../../../src/features/onboarding/OnboardingPage.tsx#L27)), então um
   scan disparado antes do catálogo chegar acha zero marcas e cai no `gmail-none` como se a
   caixa de entrada estivesse limpa. É o mais grave da lista.
2. **Re-scan troca o tier em silêncio.** A RPC apaga os tiers irmãos antes de inserir
   ([0021](../../../supabase/migrations/0021_add_gmail_sources_exclusive.sql)); quem já tinha
   Platinum e confirma Gold num re-scan perde o Platinum sem aviso.
3. **"Não tenho" no re-scan não remove nada.** Rejeitados nunca entram no payload, então
   descartar uma marca que já está no radar não a tira de lá.
4. **A tela final perde o tier escolhido** em marcas multi-tier
   ([OnboardingPage.tsx:104](../../../src/features/onboarding/OnboardingPage.tsx#L104)).

Os itens 2 e 3 só aparecem no fluxo de re-scan a partir de `/programas`, que é onde devem ser
resolvidos — não na primeira viagem do onboarding, que é o que esta spec cobre.
