# Fluxo do Admin — Alinhamento aos Mockups (Spec 2) — Design

**Data:** 2026-07-13 (revisado 2026-07-14 após revisão adversarial Codex)
**Status:** proposto (aguardando revisão do usuário)
**Precede:** implementação via writing-plans → subagent-driven-development
**Relacionado:** Spec 1 "Conclusão do Fluxo do App" (concluído e mergeado em `develop`).

## Objetivo

Reestilizar o Admin (telas: Entrar, Painel do catálogo, Programas de benefícios, Benefícios, Discovery) para bater com os mockups do Claude Design (`docs/mockups/design_handoff_mockups/Admin App.dc.html` + `Admin Discovery.dc.html`, com a intenção responsiva de `Admin Responsivo.dc.html`), **mantendo o CRUD real** que já existe. Onde o mockup mostra algo sem dado real por trás, **não inventar** — mostrar só o que existe (ou placeholder marcado quando inevitável).

## Princípio-guia

Troca de **casca e apresentação**, não de lógica. Todo hook/CRUD/rota existente é preservado; mudam layout, CSS e a introdução de componentes de UI compartilhados. Duas exceções conscientes, aprovadas na revisão: uma coluna nova (`rejection_reason`) e a etapa de confirmação de exclusão (correção de UX). Nada de fingir dado real.

## Decisões resolvidas (revisão adversarial Codex — 2026-07-14)

Estas decisões são **autoritativas** e prevalecem sobre qualquer leitura mais frouxa do resto do documento.

- **D1 — Fusão Discovery↔Programas: fina e honesta.** Programas tem 3 abas; Pendentes/Rejeitados vêm de candidatos reais mostrando só campos existentes. **Omite** confiança% e nº estimado (não inventa). Aprovar = abrir o cascade real; sem "o robô vai buscar".
- **D2 — Agregação.** Pendentes/Rejeitados = todos os candidatos-fonte (`entity_type='source'`) com `review_status` pending/rejected, de **todos os jobs**, deduplicados por fingerprint/slug. Exige um hook de leitura novo `useSourceCandidates(status)` (só SELECT, sem schema novo).
- **D3 — Ação da linha.** Primária = **"Revisar"** → abre o cascade **filtrado à fonte daquela linha** (fonte + variantes + benefícios), aprovando via o RPC real, passo a passo. **Sem "Aprovar todos"**; o banner só informa a contagem. "Rejeitar" na linha abre o modal de rejeição.
- **D4 — Rejeição com motivo.** Migration **0017** adiciona `discovery_candidates.rejection_reason text null`. O modal "Rejeitar programa" captura e persiste; aba Rejeitados exibe. **"Reconsiderar"** volta `review_status='pending'` e limpa `rejection_reason`. `useRejectCandidate` passa a aceitar `(candidateId, reason)`.
- **D5 — Metadados do robô (Pendentes).** Mostrar **origem** = `provenance.source_url`, **"encontrado há X"** = `created_at`, pill de `verification_status` se houver. Confiança% e nº estimado **omitidos**.
- **D6 — Origem/fonte nos Benefícios.** `origem` = enum `benefit_source` → Emissor(`issuer`)/Bandeira(`card_network`)/Parceiro(`partner`)/Misto(`mixed`), usando `.pill.iss/.brand/.part` do ds.css (Misto ganha um 4º estilo neutro). `fonte` = nome do(s) programa(s) vinculado(s) via `benefit_sources`. Estende o SELECT do hook de benefícios (leitura).
- **D7 — Campos dos forms.** Preservar **exatamente** os campos que `SourceForm`/`BenefitForm` + editores de variantes/fontes/locais já editam, reestilizados (avançados via "mostrar mais"/progressive disclosure). Ao **criar** um registro, o modal **continua aberto** para adicionar variantes/locais (fluxo multi-etapa atual). Não adicionar colunas que o form nunca teve.
- **D8 — Badge "novo".** Derivado de `created_at < 14 dias` (regra do app). **Remove** o checkbox "Marcar como novidade" do mockup. Sem coluna nova. Exige incluir `created_at` no SELECT/tipo do hook de benefícios (leitura).
- **D9 — Layout responsivo.** Colunas da tabela **fluidas** (`minmax(0,1fr)` + truncar); se faltar espaço, rolagem **dentro** do container da tabela (`overflow-x:auto`), **nunca na página**. Shell usa `min-height:100dvh` + rolagem do documento; sidebar `sticky` (desktop) e tabbar `fixed` embaixo (mobile). Garante zero overflow horizontal em qualquer largura, incl. faixa 760–832px.
- **D10 — Overlay + componentes.** Sheet/Modal via **`<dialog>` nativo** (`showModal()`: foco preso, Escape, backdrop, top-layer). **Estender aditivamente** os primitivos compartilhados (`Button`: `className`/`aria-label`; `Input`: `id`/`required`/`disabled`; `SegmentedControl`: badge de contagem `.n`; `Nav`: estado ativo/badge) sem quebrar o app. **Compor novos** só os específicos do admin (AdminAppShell, AdminList/Row, StatGrid, Toast).
- **D11 — Confirmação de exclusão.** Modal "Remover item?" nos deletes de **topo** (fonte/benefício) com **aviso de cascade** (ex.: "remove também N variantes e M vínculos"); remoções **aninhadas** (variante/local no form) usam confirmação **inline** leve.
- **D12 — Testes.** `global-setup` do Playwright provisiona um **admin idempotente** (email/senha conhecidos, `profiles.is_admin=true`) via service_role (padrão de `tests/helpers/clients.ts`); assume Supabase local no ar. **Responsivo** verificado no **browser real** (viewports dos 4 projetos), nunca via `matchMedia` no jsdom. Unit (jsdom) cobre **só lógica** (filtro de aba, confirmação, mapeamentos), não `@container`.
- **D13 — Migrations em produção.** 0014–**0017** aplicadas em prod **junto do deploy** de Spec 2 (item de checklist de release `develop→main`). As abas de discovery **degradam com graça** (vazio/"indisponível", sem quebrar) se as tabelas faltarem.
- **D14 — Tokens de chrome.** Adicionar ao ds.css um conjunto pequeno: `--admin-side-bg`, `--admin-side-ink`, `--admin-side-hover`, `--admin-line`, `--admin-backdrop`, com valores light/dark. Sidebar intencionalmente **escura nos dois temas** (como o mockup). Resto reusa tokens existentes; proíbe hex/rgb literais.

## Global Constraints (herdadas por toda task)

- **Design tokens compartilhados:** os mockups usam o MESMO `src/ui/ds.css` do app. Toda cor/spacing via `var(--…)`. **Proibido hex/rgb hardcoded** — cores de chrome admin usam os tokens novos de D14. Dark mode herdado de `[data-theme="dark"]` (com os overrides dos tokens `--admin-*`).
- **Responsivo mobile-first via container query:** breakpoint único **`@container (min-width: 760px)`** sobre `.aa-root { container-type: inline-size }`. Reconciliar o `discovery.css` existente (hoje `720px`) para `760px`. Regras de layout conforme **D9**.
  - `<760px`: sidebar oculta, **bottom-tabbar** (`fixed`); overlays como **bottom-sheet** (`<dialog>` estilizado, slide-up + grip); listas como **cards**; ações **icon-only** (com `aria-label`); botão "novo" icon-only.
  - `≥760px`: **sidebar** 246px (escura, `sticky`); overlays como **modal centralizado** (`<dialog>`, pop-in, backdrop blur); listas como **tabela** de colunas fluidas; ações com texto; botão "novo" texto+ícone.
- **CRUD real preservado** (exceções: D4 coluna `rejection_reason`, D11 confirmação de delete).
- **Placeholders explícitos e mínimos:** ver seção Placeholders. Nada finge dado real.
- **Reuso de primitivos** (estendidos aditivamente conforme D10): `Button`, `Input`, `Chip`, `SegmentedControl`, `Nav`, `PageState`, `Skeleton`. Substituir `"Carregando…"`/`"Erro…"` crus por `PageState`/`Skeleton`.
- `Admin.dc.html` e `Admin Mobile.dc.html` são **superados**; autoridade é `Admin App.dc.html` + `Admin Discovery.dc.html` + `Admin Responsivo.dc.html`.

## Arquitetura

### AdminAppShell (novo) — substitui AdminLayout
Casca responsiva envolvendo `<Outlet/>`: root `.aa-root` (`container-type:inline-size`); nav de **uma única lista** de itens (`Painel`, `Programas`, `Benefícios`, `Discovery`) renderizada como `.aa-side` (sidebar escura, ≥760px) OU `.aa-tabbar` (bottom nav fixa, <760px), ativo por `aria-current`; badge de contagem de pendentes; brand + logout (`supabase.auth.signOut`). `AdminGuard`/`useIsAdmin` com lógica inalterada, recebendo `PageState`/`Skeleton`.

### Telas e rotas (roteamento inalterado)
| Rota | Componente atual | Reskin |
|---|---|---|
| `/admin/login` | `AdminLogin` | `.aa-login` (gradiente, card ≤400px, brand, `.input`, `.btn`). `signInWithPassword` intacto. |
| `/admin` | `AdminHome` | Painel: `.aa-statgrid` (contagens reais: programas, benefícios, pendentes; "novos" derivado de `created_at`) + `.aa-areagrid` de cards de área. |
| `/admin/sources` | `AdminSources` + forms | Programas (ver seção). |
| `/admin/benefits` | `AdminBenefits` + forms | Benefícios (ver seção). |
| `/admin/discovery` | `AdminDiscovery` + `CandidateTree` | Cascade (drill-in de "Revisar") + fila de jobs; breakpoint 720→760; dentro da nova casca. |

## Tela: Programas de benefícios (fusão fina com Discovery — D1/D2/D3/D5)
- Header + "Novo programa" (icon-only <760 / texto+ícone ≥760).
- Segmented **[Pendentes · Ativos · Rejeitados]** (sobre `SegmentedControl` estendido com badge `.n`).
- Banner de contagem (informativo, **sem** "Aprovar todos").
- Lista responsiva `.aa-list` (cards/tabela fluida):
  - **Ativos** = `sources` reais (`useAdminSources`), CRUD completo (Editar via modal; Remover via confirm de topo com aviso de cascade).
  - **Pendentes** = candidatos-fonte reais (`useSourceCandidates('pending')`), com `.aa-robo` = origem (`source_url`) · "encontrado há X" (`created_at`) · pill `verification_status`. Ações: **Revisar** (abre cascade filtrado à fonte) / **Rejeitar** (modal com motivo → `rejection_reason`).
  - **Rejeitados** = `useSourceCandidates('rejected')`; ação **Reconsiderar** (volta a pending, limpa motivo).
- "Tipo" do programa: mapear o enum real (`source_category`, 7 valores) para rótulos legíveis; documentar a tabela de mapeamento na task (não usar `kind`).
- Degradação graciosa se tabelas de discovery ausentes (D13).

## Tela: Benefícios (D6/D7/D8)
- Header + "Novo benefício". Toolbar: `.input.aa-search` + `.chips` (reusar `Chip`).
- `.aa-list`: título + badge `new` (derivado `created_at<14d`), `.tag`(categoria) + `.pill`(origem = `benefit_source`) + fonte (programa vinculado). Editar/Remover (confirm de topo).
- **Form (modal `<dialog>`):** estética do mockup, campos = os que o form já edita hoje (D7), avançados via progressive disclosure; multi-fonte (`BenefitSourcesEditor`) e locais (`BenefitLocationsEditor`) preservados; modal permanece aberto após criar para adicionar fontes/locais. Erros de mutation exibidos; prevenção de duplo-submit.

## Componentes compartilhados
- **AdminAppShell** — casca responsiva (sidebar↔tabbar), nav de uma lista, brand+logout.
- **AdminSheet/Modal** — `<dialog>` nativo: bottom-sheet (mobile) ↔ dialog centralizado (desktop), variante `wide`. Hospeda confirm-delete, rejeitar-motivo, forms.
- **AdminList/AdminRow** — coleção responsiva: cards (mobile) ↔ tabela de colunas fluidas (desktop); colunas parametrizáveis (name/meta/count/actions). Semântica: usar roles de tabela/linha (`role="table"/"row"/"cell"`) para leitores de tela.
- **StatGrid** — tiles de estatística (2-col/N-col).
- **SegmentedTabs** — `SegmentedControl` estendido com pill de contagem por aba.
- **Toast** — novo; contrato: `aria-live="polite"`, fila, duração, respeita `prefers-reduced-motion`.

## Estados de erro / vazio / carregamento
`PageState` (erro/vazio, com retry — expor `refetch` dos hooks nas telas) e `Skeleton` (carregando; adicionar variante de lista/tabela) em todas as telas de lista.

## Testes (D12)
- **Gate visual Playwright** — novo `tests/e2e/admin-layout.spec.ts`, 4 projetos (mobile/desktop × light/dark): login → painel → programas (3 abas) → benefícios → discovery. Asserts: sem overflow horizontal; sidebar (≥760) vs tabbar (<760); sheet vs modal; `<dialog>` com foco/Escape. `global-setup` provisiona admin idempotente via service_role.
- **Unit (Vitest/TL):** lógica apenas — filtro por aba, dedupe de candidatos, confirm-delete (não deleta sem confirmar), mapeamentos (benefit_source→rótulo, source_category→tipo, novo por created_at), AdminSheet (abre/fecha/Escape/foco em jsdom via `<dialog>`), Toast (aria-live/fila). **Não** testar `@container` no jsdom.
- **`npm run build`** é o único type-check; cada task roda build.

## Tokens novos (D14)
`--admin-side-bg`, `--admin-side-ink`, `--admin-side-hover`, `--admin-line`, `--admin-backdrop` (light/dark) no ds.css. Classes `aa-*` (casca/Programas/Benefícios) e `dv-*` (Discovery, já existentes) em CSS dedicado consumindo tokens.

## Placeholders (dados sem backing real)
1. **Robô em Pendentes**: só campos existentes (origem/encontrado/verification_status). Confiança%/estimativa **omitidos** (não placeholder).

Itens **reais** (não placeholder): Painel "Novos" e badge `new` = `created_at < 14 dias`; contagens do Painel (Programas/Benefícios/Pendentes) = reais.

## Fora de escopo
- Novo schema/pipeline de discovery além da coluna `rejection_reason` (D4).
- Aplicar migrations em prod fora do deploy de Spec 2 (D13).
- Campos de robô inexistentes (confiança/estimativa) — omitidos, não criados.
- Expandir forms para colunas que hoje não são editáveis (D7).

## Decomposição (para writing-plans) — reordenada por dependência (achado 16)

1. **Fundação de dados + tokens.** Migration 0017 (`rejection_reason`); hook `useSourceCandidates(status)` (agregado/deduplicado); estender SELECT/tipo do hook de benefícios (`benefit_source`, fonte, `created_at`); `useRejectCandidate(id, reason)`; tokens `--admin-*` no ds.css. (Tudo que a UI consome vem antes da UI.)
2. **Extensões de primitivos + AdminSheet.** Props aditivas em Button/Input/SegmentedControl/Nav; `<dialog>` AdminSheet/Modal (a11y); Toast; confirm-delete (topo + inline).
3. **AdminAppShell** (sidebar↔tabbar responsiva, nav+badge, logout) + AdminGuard/estados; AdminList/Row + StatGrid.
4. **Login + Painel do catálogo** (contagens reais + "novos" derivado).
5. **Programas — Ativos** (CRUD de fontes, forms com campos atuais + progressive disclosure, confirm de topo com cascade).
6. **Programas — Pendentes/Rejeitados + Revisar (cascade)** (wiring `useSourceCandidates`, rejeição com motivo, reconsiderar, drill-in filtrado; reconciliar breakpoint discovery; degradação graciosa).
7. **Benefícios** (lista/toolbar + form completo).
8. **Gate visual Playwright do admin + global-setup admin + unit tests.** (Cada task 3–7 já entrega seus próprios testes; esta consolida o e2e.)
