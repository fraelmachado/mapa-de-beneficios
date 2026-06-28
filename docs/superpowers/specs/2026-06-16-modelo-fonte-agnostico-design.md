# Modelo de fonte de benefícios agnóstico + taxonomia (design)

**Data:** 2026-06-16
**Status:** spec para revisão → base do plano P1 (dados)

## 1. Objetivo e reframing

Hoje o app trata **benefício = cartão**. Mas benefícios vêm de muitos **programas**: operadoras de celular, planos de saúde, multibenefícios corporativos (iFood Benefícios, Wellhub, Flash…), fidelidade/pontos, varejo/assinaturas, shoppings. Esta spec define o **modelo de origem fonte-agnóstico** e a **taxonomia de categorias** que destravam o de-viés do frontend e o onboarding multi-categoria.

O termo guarda-chuva passa a ser **"programas de benefícios"** (não "cartões"). Cartão é **uma** categoria entre várias.

**Escopo desta spec:** o modelo de dados de origem/categoria e a taxonomia. **Não** detalha a implementação — isso vira o plano **P1 (dados)**. O reskin (P2), o onboarding multi-step (P3) e a expansão do catálogo via discovery (P4) são specs/planos próprios que **consomem** este modelo.

## 2. Taxonomia de categorias de fonte

Nova dimensão **`source_category`** em `sources` — a categoria voltada ao usuário (dirige o agrupamento do onboarding, o ícone e a pílula de origem). Valores (chave técnica · rótulo pt-BR · ícone):

| chave | rótulo | ícone | exemplos (discovery) |
|---|---|---|---|
| `bank_card` | Bancos & cartões | 🏦 | Nubank, Inter, XP, Itaú (+ bandeiras Visa/Master) |
| `carrier` | Operadoras de celular | 📶 | Claro, Vivo, TIM |
| `health` | Planos de saúde | 🩺 | Unimed, Bradesco Saúde, SulAmérica, Amil, Hapvida, Porto |
| `corporate_benefits` | Multibenefícios | 💼 | iFood Benefícios, Wellhub (Gympass), Flash, Caju, Alelo, VR, Ticket, Pluxee |
| `loyalty` | Fidelidade & pontos | ⭐ | Livelo, Esfera, LATAM Pass, Smiles, Azul, Dotz |
| `retail` | Varejo & assinaturas | 🛍️ | Amazon Prime, Meli+, iFood Clube, Magalu |
| `mall` | Shoppings | 🏬 | Iguatemi One, JHSF *(regional/opcional)* |

**Relação com o enum atual `sources.kind`** (`card/carrier/loyalty/cpf`): `source_category` é mais rico e **supersede** `kind` para fins de UI. No P1: introduzir `source_category`, fazer backfill das fontes atuais (Nubank/Inter/XP → `bank_card`) e **alinhar/depreciar** `kind` (decisão de execução no P1; preferência: manter `kind` apenas como metadado técnico se algo depender dele, senão remover).

## 3. Modelo de origem (exibição) — fonte-agnóstico

Aposentar **Emissor / Bandeira / Parceiro** como eixo principal. Dois níveis:

- **Origem primária (sempre):** "**de onde o usuário tem**" = a fonte que ele selecionou e que destravou o benefício → `{ícone categoria} {rótulo categoria} · {provedor}`.
  - Ex.: `🏦 Banco · XP` · `🩺 Plano de saúde · Unimed` · `💼 Multibenefícios · Wellhub` · `📶 Operadora · Claro`.
- **Origem secundária (quando agrega valor, sobretudo no detalhe):** **quem de fato concede** o benefício, derivado de `benefit_source`:
  - `card_network` → a bandeira/nível (ex.: "Visa Infinite") — só para cartões;
  - `partner` → o parceiro (`partner_name`, ex.: "Priority Pass");
  - `issuer` → o próprio provedor (sem secundária);
  - `mixed` → mostra o parceiro/bandeira como secundária.

Exemplo mental: "Priority Pass" aparece como **`🏦 Banco · Nubank`** (onde você tem) com secundária **"Parceiro · Priority Pass"** (quem provê). "Seguro de locadora" aparece como **`🏦 Banco · XP`** com secundária **"Visa Infinite"**.

### Implicação de dados — o contrato de `my_benefits` precisa crescer
A view hoje projeta `via` (`source_items.label`), `source_url`, `source_name`, `observed_at`, `partner_name` — mas **não** projeta `benefit_source` nem nenhum rótulo de bandeira. Logo, **nem a origem primária nem a secundária são sustentáveis hoje**. P1 deve estender a view (nos **dois** caminhos — direto e derivado por brand/level) para projetar:

**Para a origem primária (de onde o usuário tem):**
- **provedor** = `sources.name` (ex.: "Nubank", "Unimed");
- **`source_category`** (ex.: `bank_card`, `health`).
- Como um benefício pode ser destravado por mais de uma fonte, agregar provedores distintos (à semelhança de como `via` já agrega os labels) — array de `{provedor, source_category}`. (Forma exata do agregado: decisão de execução no P1; provável `json_agg` distinto.)

**Para a origem secundária (quem concede):**
- **`benefit_source`** (`issuer`/`card_network`/`partner`/`mixed`) — **falta projetar; P1 adiciona.**
- **`partner_name`** — já projetado; usado quando `benefit_source ∈ {partner, mixed}`.
- **rótulo de bandeira** (ex.: "Visa Infinite") — **não existe no contrato e não é derivável da view atual.** Para benefícios `card_network`, a bandeira que destrava vem do `benefit_card_tiers (card_brand, card_level)` **casado com o `source_item` do usuário** no caminho derivado. P1 deve projetar esse par (ex.: `card_brand`/`card_level` do match, ou um `network_label` já formatado "Visa Infinite"). Sem isso, a secundária de cartão não pode ser renderizada.

> Resumo do gap fechado: P1 = **+`benefit_source`**, **+provedor/`source_category` agregados**, **+rótulo de bandeira (brand/level do match no caminho derivado)**, além de manter `partner_name`. Só assim P2 consegue exibir primária (tipo-de-fonte+provedor) **e** secundária (bandeira/parceiro).

## 4. Onboarding multi-categoria (estrutura)

Reescrita do onboarding de "marcar cartões" para **multi-step por categoria** (spec/plano próprios — P3). Estrutura conceitual fixada aqui:

1. Grade/sequência das categorias da §2 (cards grandes com ícone + nome).
2. Por categoria: **"Você tem [categoria]?" → [Tenho] / [Não tenho]**.
3. Se **Tenho** → expande os **principais provedores** daquela categoria (chips selecionáveis) + busca + "outro".
4. Progresso por categoria; ao fim → transição "Montando o seu mapa".

A seleção continua persistindo em `user_sources` (referência a `source_items`), inalterado no backend — só a forma de **coletar** muda.

## 5. De-viés do frontend (consumido por P2)

- Linguagem: "programas de benefícios" / "o que você tem"; remover "cartões" como termo-mãe (vira uma categoria).
- Painel: ordenar por "**Fonte**" (não "Cartão"); hero "de N **programas**".
- Card/Detalhe: origem primária por tipo-de-fonte+provedor (§3); bandeira/parceiro como secundária.
- Exemplos diversificados (saúde, multibenefícios, operadora) lado a lado com cartões.
- Visual "passe" **mantido** (metáfora neutra de voucher).
- Admin: "Fontes & **programas**".

## 6. Fora do escopo (specs/planos próprios)

- **P4 — Expansão do catálogo via discovery:** popular as categorias novas (providers, itens, benefícios, fontes oficiais) — pipeline de curadoria. Esta spec só prepara o **modelo**; não cria os dados.
- **P3 — Build do onboarding multi-step:** UI/estado/persistência.
- **P2 — Reskin fonte-agnóstico:** aplicação visual.

## 7. Decisões pinadas (resumo para o P1)

1. Adicionar enum **`source_category`** (7 valores da §2) + coluna em `sources`; backfill das fontes atuais para `bank_card`.
2. `my_benefits` passa a projetar (caminhos direto **e** derivado): **provedor (`sources.name`) + `source_category`** agregados (primária); **`benefit_source`** (falta hoje); **rótulo de bandeira** = `card_brand`/`card_level` do match no caminho derivado (falta hoje); manter `partner_name` (secundária).
3. Origem primária = tipo-de-fonte+provedor; secundária = `benefit_source` + (`partner_name` para parceiro | bandeira para `card_network`). **Nenhum dos dois é sustentável pelo contrato atual da view — P1 fecha o gap (ver §3).**
4. `sources.kind` alinhado/depreciado em favor de `source_category` (decisão de execução no P1).
5. Sem mudança no mecanismo de `user_sources`/seleção; muda só a coleta (P3) e a exibição (P2).
