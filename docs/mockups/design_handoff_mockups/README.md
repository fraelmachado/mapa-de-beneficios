# Handoff — Mapa de Benefícios (mockups → frontend)

Pacote de referência de design para implementação do frontend. Contém **todos os
mockups** criados na ferramenta de design + o design system usado por eles.

## Como este pacote é usado (leia primeiro)

Duas ferramentas, papéis que não se misturam:

- **Claude Design** = fonte da verdade **visual**. Decide layout, hierarquia,
  estados, responsividade e copy. Entrega os mockups `.dc.html` deste pacote.
- **Claude Code** (você) = **implementador**. Não decide design; **reproduz** o
  mockup aprovado no código real (React+Vite, `src/ui`), ligando aos dados.

**Regra de ouro:** cada tela tem UM dono de design — o mockup. Se algo visual
precisar mudar, muda no mockup (no Claude Design) e o `.dc.html` atualizado volta
pra este pacote; a implementação então reflete. Nunca há duas "verdades".

- Se, ao implementar, você sugerir algo visual diferente do mockup, **pergunte** —
  a decisão volta pro Design, não fica só no código.
- Em conflito entre uma instrução pontual e o padrão dos mockups existentes,
  **prefira a consistência com os mockups existentes**.

O fluxo completo (loop por tela + frases prontas) está em
`FLUXO-Design-e-Code.md` nesta pasta.

## Terminologia (obrigatória)

O conceito que originava benefícios — antes **provedores / fontes / programas de
fidelidade** — agora se chama **programa de benefícios** (plural: **programas de
benefícios**). Hierarquia canônica do catálogo: **programa de benefícios → variante
→ benefício**. Não confundir "programa de benefícios" (nó de topo) com "benefício"
(item folha). Use esse vocabulário em nomes de rota, componentes e copy.

## O que são estes arquivos

Os arquivos `*.dc.html` são **referências de design feitas em HTML** (protótipos que
mostram o look & feel e o comportamento pretendidos), **não** código de produção
para copiar direto. A tarefa é **recriar estas telas no codebase real**
(React 18 + Vite, TSX, feature-folders) usando os padrões e a UI kit já existentes.

Cada `.dc.html` é um "Design Component": markup com estilos inline + uma classe de
lógica JS (estado/handlers) no mesmo arquivo. Eles dependem de dois runtimes que
**não** fazem parte do produto final e servem só para os mockups renderizarem:

- `support.js` — runtime que monta o Design Component.
- `_ds/mapa-de-benef-cios-.../` — o design system (o mesmo source do qual `src/ui/`
  foi portado): `styles.css` (tokens + classes) e `_ds_bundle.js` (componentes React
  expostos em `window.MapaDeBenefCios_804719`).

Para **ver** um mockup renderizado: abra o `.dc.html` num navegador (os caminhos
relativos para `support.js`, `_ds/` e `browser-window.jsx` já estão resolvidos
dentro desta pasta). Para **implementar**: leia o código-fonte do `.dc.html` — é a
referência mais fiel (muito melhor que screenshot).

## Fidelidade

**Alta fidelidade** — cores, tipografia, espaçamento e interações finais.
Mas o alvo NÃO é pixel-copy do HTML: é reproduzir **estrutura + fluxo** usando o
nosso design system por cima. A fidelidade visual sai "de graça" porque o DS dos
mockups é exatamente o `src/ui` / `ds.css` já portados no projeto.

## Stack de destino e regras (do time)

- React 18 + Vite (SPA web, mobile-first responsivo, PWA via vite-plugin-pwa).
- react-router-dom, TanStack Query, @supabase/supabase-js.
- Componentes = função TSX; estrutura feature-folders (`src/features/...`).
- **Reaproveitar obrigatoriamente `src/ui/`**: Pass, Chip, Button, Row, Input,
  Alert, Nav, SegmentedControl, Skeleton, HeroRadar, Checklist. Tokens em
  `ds.css`/tailwind; tema dark via `[data-theme]` (`theme.ts`). É 1:1 com os
  componentes do design system deste pacote.
- **Não recriar** o design system nem telas que já existem. Só criar componente
  novo quando a tela pedir algo inexistente — e sempre com os tokens do DS.

## Status atual x escopo (importante — evitar retrabalho)

Quase todas as telas abaixo **já existem e já estão reskinadas** no codebase
(P2 + P3). Use os mockups como **fonte de verdade visual/comportamental** para
conferência e ajustes finos — **não** recrie do zero o que já está pronto.

- **App (feito):** Painel, Busca, Onboarding (multi-step), Detalhe, Perfil.
- **Admin (feito):** Login, Home, Fontes/Programas, Benefícios.

O que realmente falta / está fraco é **uma tela**: `/admin/discovery` (revisão de
candidatos do P4, hoje um v1 mínimo). **Já existe um mockup dedicado pra ela:**
`Admin Discovery.dc.html` — use-o como referência principal (ver seção abaixo).

> Nota de consistência: `Admin Discovery.dc.html` foi montado com as **classes CSS
> do DS** (`.btn`, `.input`, `.pill`, `.tag`, `.nav`) + HTML, igual aos demais
> mockups admin — e não com os componentes React `Button`/`Chip`/`Row`/etc. Isso é
> proposital (consistência com os mockups existentes). Na implementação, mapeie
> esses elementos para os componentes equivalentes de `src/ui`. Ex.: no mockup a
> sidebar chama o item de **"Fontes"**; confirme o rótulo real com o time (o app
> admin existente usa **"Programas"**) e padronize.

## Design System (tokens principais)

Definidos em `_ds/.../styles.css` (consumir via `var(--*)`, nunca hardcode):

- **Superfícies:** `--bg`, `--surface`, `--surface-2`.
- **Tinta:** `--ink`, `--ink-2`, `--muted`; linhas `--line`.
- **Acento/estados:** `--accent`, `--warn`, `--ok`.
- **Categorias:** `--c-airport`, `--c-seguro`, `--c-viagem`, `--c-cashback`,
  `--c-compras`, `--c-pontos`.
- **Espaçamento:** escala base 4px — `--s1`…`--s16`.
- **Tipografia:** fonte `Onest`; escala `--fz-display` … `--fz-eyebrow`.
- **Forma:** `--radius`, `--r-sm`, `--r-xs`, `--r-pill`; sombra `--shadow`,
  `--shadow-lg`.
- **Tema:** claro/escuro via `[data-theme="dark"]` no `<html>`, persistido em
  `localStorage` (`mb-theme`).

## Mapa de telas → rotas

| Mockup (arquivo) | Módulo | Rota provável | Observações |
|---|---|---|---|
| `Tela 01 - Boas-vindas` | App | `/onboarding` | Entrada do onboarding |
| `Tela 02 - Como descobrir` | App | `/onboarding` | Escolha do método de descoberta |
| `Tela 03 - Vasculhando` | App | `/onboarding` | Estado de progresso/scan |
| `Tela 04 - Painel` | App | `/` (Radar) | Tela principal; usa `HeroRadar` + grid de `Pass` |
| `Tela 05 - Detalhe` | App | `/beneficio/:id` | Detalhe de um benefício |
| `Tela 06 - Wizard manual` | App | `/onboarding` | Cadastro manual de cartão/programa |
| `Tela 07 - Radar montado` | App | `/` | Painel populado |
| `Tela 08 - Revisar Gmail` | App | `/onboarding` | Revisão de itens achados no Gmail |
| `Tela 09 - Alertas` | App | `/alertas` | Lista de alertas |
| `Tela 10 - Painel vazio` | App | `/` | Estado vazio do Radar |
| `Tela 11 - Perfil` | App | `/perfil` | Perfil/config |
| `Onboarding` | App | `/onboarding` | Fluxo consolidado (multi-step) |
| `Busca` | App | `/busca` | Busca/filtros |
| `Admin` / `Admin App` | Admin | `/admin/*` | App admin completo (login, home, fontes, benefícios) |
| `Admin Discovery` | Admin | `/admin/discovery` | **Tela nova** — revisão de candidatos do Discovery (fila de jobs + árvore fonte→variante→benefício, aprovação em cascata) |
| `Admin Responsivo` | Admin | — | Mesmo app admin em frame mobile + desktop lado a lado (só demonstra responsividade) |
| `Admin Mobile` | Admin | — | Recorte mobile do admin |
| `Fluxo do App` / `Fluxo do Admin` | — | — | Diagramas de fluxo (navegação entre telas), referência de arquitetura |

`Admin Responsivo`, `Fluxo do App` e `Fluxo do Admin` são **telas de apresentação**
(mostram outras telas juntas / diagramam navegação) — não viram rotas.

## Comportamento responsivo (regra geral)

Os mockups usam **container queries** (`@container`), não `@media`. Breakpoint
principal: **760px** (Admin) / **960px** (Painel do App).
- Abaixo: coluna única + bottom nav (`Nav`).
- Acima: sidebar + grid.
No frontend real isso pode virar media query / container query conforme o padrão do
projeto — o importante é preservar as duas formas de cada layout.

---

## FOCO: `/admin/discovery` (a tela que falta)

Referência principal: o mockup **`Admin Discovery.dc.html`** (abre renderizado, mesmo
shell admin). O padrão de card Aprovar/Rejeitar também aparece na aba **"Pendentes"**
de **`Admin App.dc.html`** — abra, faça login ("Entrar") e vá em
"Programas de benefícios".

### Cabeçalho + abas
- Eyebrow "Programas de benefícios" + `h1`.
- `SegmentedControl` com contagem: **"Pendentes {n}" | "Ativos {n}" | "Rejeitados {n}"**
  (aba inicial: Pendentes).

### Banner de ação em lote (`Alert`) — só quando aba=Pendentes e há pendentes
> **{pendCount}** programas encontrados pelo robô aguardando aprovação. Ao aprovar,
> ele começa a buscar os benefícios.
+ botão **"Aprovar todos"** (`Button` primary).

### Card do candidato
- Avatar quadrado com **iniciais** (2 letras) + nome do programa.
- Linha de meta: pill com o **tipo** ("Programa de pontos" | "Cia aérea" | "Cartão").
- Linha do robô (status `pending`), ícone de robô + texto:
  > **{origin}** · encontrado {found} · **{confidence}%** confiança · ~{estBenefits} benefícios

  (`{confidence}%` na cor `--ok`.)
- Ações por status:
  - `pending` → **"Aprovar"** (primary, ícone check) + **"Rejeitar"** (texto, cor `--warn`). Aprovar → status `searching`.
  - `searching` → pill "buscando benefícios…" com spinner; sem ações.
  - `active` → "Editar" / "Remover".
  - `rejected` → "Motivo: {reason}" + "Reconsiderar" (volta a `pending`).

### Responsivo do card (o ponto central — bug que foi corrigido no mockup)
Duas formas, breakpoint ~760px:
- **Desktop (≥760px):** linha estilo tabela — `nome | meta | AÇÕES` numa coluna à
  direita (`grid-template-areas: "name act" / "meta act"`).
- **Mobile (<760px):** coluna única empilhada — nome, meta e as ações numa **linha
  própria abaixo** dos dados, alinhadas à esquerda (`"name" / "meta" / "act"`).
  Aprovar/Rejeitar **não** podem sobrepor o texto de URL/confiança nem espremer o nome.

### Rejeitar → modal de confirmação
- Título "Rejeitar programa" (ícone de aviso).
- Texto: "Descartar **{name}**? O robô não vai buscar os benefícios dele."
- Campo "Motivo (opcional)" (`Input`/textarea). Default se vazio: "Sem motivo informado".
- Botões: "Cancelar" (ghost) | "Rejeitar" (cor `--warn`).
- Toasts: rejeitar → "Programa rejeitado"; reconsiderar → "Voltou para pendentes".

### Modelo de dados
```ts
type CandidateStatus = 'pending' | 'searching' | 'active' | 'rejected';
interface Candidate {
  id: string;
  name: string;          // "Livelo"
  type: string;          // "Programa de pontos" | "Cia aérea" | "Cartão"
  status: CandidateStatus;
  origin?: string;       // "livelo.com.br/beneficios"
  found?: string;        // "há 2h" | "ontem"
  confidence?: number;   // 0–100
  estBenefits?: number;  // estimativa de nº de benefícios
  benefits?: number;     // nº real após a busca
  reason?: string;       // motivo da rejeição
}
```
Fixtures reais usados no mockup (bons para seed / estado vazio):
- Livelo · Programa de pontos · livelo.com.br/beneficios · há 2h · 96% · ~12
- Esfera Santander · Programa de pontos · esfera.com.vc · há 5h · 91% · ~9
- C6 Átomos · Cartão · c6bank.com.br/atomos · ontem · 88% · ~6
- TudoAzul · Cia aérea · voeazul.com.br/tudoazul · ontem · 84% · ~8
- Dotz · Programa de pontos · rejeitado · motivo "Duplicado de um programa já ativo"

No mockup as ações são `setState` local — no real, ligar Aprovar/Rejeitar/
Reconsiderar/Aprovar-todos a **mutations do TanStack Query** contra o Supabase, com
invalidação de query. Estado vazio de cada aba: "Nenhum programa nesta aba."

### A confirmar com o time antes de codar
1. Endpoint/tabela Supabase dos candidatos e o shape real (bate com `Candidate`?).
2. Reaproveitar `Row`/`Pass` do `src/ui` para o card, ou criar `<CandidateCard>` novo?
3. "Aprovar" dispara a busca assíncrona no backend? Precisa de loading/erro por card
   além do `searching`?

## Arquivos deste pacote

- `*.dc.html` — os mockups (código-fonte de referência).
- `support.js`, `browser-window.jsx` — runtimes só para renderizar os mockups.
- `_ds/mapa-de-benef-cios-.../` — design system (`styles.css`, `_ds_bundle.js`).
- `assets/` — imagens/ícones usados nos mockups.
