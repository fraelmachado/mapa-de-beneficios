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
| Categoria | Eyebrow colorido acima da marca | Reusa a classe `.lbl` que todas as telas do onboarding já usam; sem elemento visual novo num card que já tem logo, nome, e-mail e tiers. |

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

Regras:
- Decidir (`setDecision` + `idx+1`) avança; decidir o último entra no resumo.
- `‹`: `idx > 0` → `idx-1` (a decisão anterior continua visível e é sobrescrita se ele decidir de novo);
  `idx === 0` → `onBack()` (sai da tela, comportamento atual); no resumo → volta ao último card.
- CTA só existe no resumo. Payload e `onDone(haveList)` idênticos aos de hoje, incluindo o
  tratamento de erro (`saveError` + alerta, permanece no resumo).
- Lista vazia não é caso desta tela: `OnboardingPage` já desvia para `gmail-none` quando o
  scan não acha nada, então `findings.length >= 1` é pré-condição.

### Componentes

```
RevisarGmail.tsx        máquina de estado (idx + decision), decide o que renderizar
  ├── TriageCard.tsx    um card: logo, categoria, marca, procedência, tiers, rodapé
  └── TriageSummary.tsx conferência final: confirmados + desfazer + CTA
```

`TriageCard` é puro: recebe `finding` + `chosenId` (para reabrir uma decisão) e devolve
`onDecide(itemId | null)`. Sem estado próprio, testável isolado.

**Card:**
- mark de 56px com o logo (fallback: inicial da marca, como hoje);
- eyebrow `.lbl` com `color` da categoria + o rótulo de `categoryMeta()`;
- nome da marca;
- procedência: "achamos no seu Gmail" + remetente + `relTime(emailDate)`;
- **marca de versão única:** rodapé `[Não tenho] [Tenho ›]`;
- **marca multi-tier:** tiers com `≈R$ X/ano` e selo "Mais completo" pelo mesmo critério da
  `TierSheet` (mais benefícios, desempate por maior valor estimado); toque no tier decide;
  rodapé só `[Não tenho]`;
- pontinhos de progresso `aria-hidden`; o progresso acessível é um texto "3 de 5";
- `peek` (borda do próximo card espiando) só quando há próximo — decorativo.

**Resumo:** reaproveita o CSS `.review-*` que já existe — a lista de hoje vira a tela de
conferência, então o CSS escrito na rodada anterior não é jogado fora. Mostra as linhas
confirmadas com "desfazer" (volta ao card correspondente, `idx = índice do finding`), uma
linha discreta "N descartados", o `≈R$ X/ano` somado, a nota de privacidade e o aviso de
scan parcial. CTA: `Adicionar N ao radar`, ou `Concluir` se nada foi confirmado.

### Categoria

- `Finding` ganha `category: SourceCategory`, preenchida em `matchSources` a partir de
  `source.source_category ?? 'bank_card'` (mesmo default de `groupSourcesByCategory`).
- `CategoryMeta` ganha `color: string`, e o mapa `SOURCE_CAT_COLOR` **sai** de
  `admin/discovery/discoveryMeta.ts` **para** `onboarding/categoryMeta.ts`; `discoveryMeta`
  passa a ler de lá. Sem isso o onboarding importaria cor de dentro do admin, que é de trás
  pra frente. Uma fonte de verdade para label + ícone + cor.

## Testes

- `RevisarGmail.test.tsx` **reescrito** (a UI que ele cobre deixa de existir):
  card único avança ao decidir; toque no tier decide e avança com o tier certo; `‹` reabre a
  decisão anterior; resumo lista só os "tenho"; desfazer no resumo volta ao card; CTA salva o
  payload correto; erro de save mantém no resumo.
- `TriageCard.test.tsx` **novo**: renderiza categoria, procedência e tiers; dispara `onDecide`
  com o `itemId` do tier tocado e com `null` no "Não tenho".
- `matchSources.test.ts`: +1 caso — categoria propagada da `Source` para o `Finding`.
- `OnboardingPage.test.tsx` não muda (mocka a tela).
- Sem e2e novo: o fluxo do Gmail não está no gate visual (depende de OAuth real).

## Fora de escopo

- `TierSheet` continua como está — o wizard manual e `/programas` usam. Só deixa de aparecer
  nesta tela.
- **Sem swipe.** Decisão por toque em botão: testável, acessível e suficiente. Swipe entra
  depois se o uso real pedir.
- A Opção 2 registrada para A/B na spec anterior fica congelada — este redesign a substitui
  como alternativa a ser testada.
