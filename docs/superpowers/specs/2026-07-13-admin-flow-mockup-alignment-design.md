# Fluxo do Admin — Alinhamento aos Mockups (Spec 2) — Design

**Data:** 2026-07-13 (revisado 2026-07-14: 2 passadas de revisão adversarial Codex)
**Status:** proposto (aguardando revisão do usuário)
**Precede:** implementação via writing-plans → subagent-driven-development
**Relacionado:** Spec 1 "Conclusão do Fluxo do App" (concluído e mergeado em `develop`).

## Objetivo

Reestilizar o Admin (telas: Entrar, Painel do catálogo, Programas de benefícios, Benefícios, Discovery) para bater com os mockups do Claude Design (`docs/mockups/design_handoff_mockups/Admin App.dc.html` + `Admin Discovery.dc.html`, com a intenção responsiva de `Admin Responsivo.dc.html`), **mantendo o CRUD real** que já existe. Onde o mockup mostra algo sem dado real por trás, **não inventar** — mostrar só o que existe (ou placeholder marcado quando inevitável).

## Princípio-guia

Troca de **casca e apresentação**, não de lógica. Todo hook/CRUD/rota existente é preservado; mudam layout, CSS e a introdução de componentes de UI compartilhados. **Três exceções conscientes, aprovadas na revisão:** (a) uma coluna nova (`rejection_reason`, D4); (b) a etapa de confirmação de exclusão (D11, correção de UX); (c) a mudança de lifecycle do modal de criação, que passa a **permanecer aberto** após criar para adicionar variantes/locais (D7 — hoje ele fecha na hora via `setEditing(null)`). Nada de fingir dado real.

## Decisões resolvidas (revisão adversarial Codex — 2026-07-14, 2 passadas)

Estas decisões são **autoritativas** e prevalecem sobre qualquer leitura mais frouxa do resto do documento.

- **D1 — Fusão Discovery↔Programas: fina e honesta.** Programas tem 3 abas; Pendentes/Rejeitados vêm de candidatos reais mostrando só campos existentes. **Omite** confiança% e nº estimado (não inventa). Aprovar = abrir o cascade real; sem "o robô vai buscar".
- **D2 — Agregação.** Pendentes/Rejeitados = todos os candidatos-fonte (`entity_type='source'`) com `review_status` pending/rejected, de **todos os jobs**. Como `fingerprint` é `UNIQUE` global (0015), "deduplicar" = selecionar por fingerprint distinto (o banco já garante unicidade; nada de dedupe manual frágil). Hook de leitura novo `useSourceCandidates(status)` (só SELECT, sem schema novo).
- **D3 — Ação da linha + drill-in.** Primária = **"Revisar"** → abre o cascade da fonte clicada, aprovando via o RPC real (`promote_discovery_candidate`), passo a passo. **Sem "Aprovar todos"**; banner só informa contagem. "Rejeitar" na linha abre o modal de motivo. O drill-in usa um hook novo `useCandidateSubtree(sourceFingerprint)` que busca a fonte + descendentes navegando por `parent_fingerprint` **em todos os jobs** (NÃO por `job_id`, senão perde filhos re-descobertos em jobs mais novos). `CandidateTree` é reusado, recebendo o subtree já montado.
- **D4 — Rejeição com motivo (contrato explícito, entregue na Task 1).** Migration **0017** adiciona `discovery_candidates.rejection_reason text null`; regenera `src/lib/database.types.ts` e atualiza `src/features/admin/discovery/types.ts` (`DiscoveryCandidate` ganha `rejection_reason`). Rejeição e reconsideração são **UPDATE direto** na tabela (não há nem se cria RPC). Hooks: `useRejectCandidate` → `mutate({ candidateId, reason })` (grava `review_status='rejected'` + `rejection_reason`); `useReconsiderCandidate` → `mutate({ candidateId })` (grava `review_status='pending'` + `rejection_reason=null`). Ambos invalidam as queries de candidatos (job e agregada). O `useRejectCandidate` atual (assinatura `(jobId)` → `mutate(candidateId)`) é ajustado para esse contrato.
- **D5 — Metadados do robô (Pendentes).** Mostrar **origem** = `provenance.source_url`, pill de `verification_status` se houver, e a data. Como o upsert por fingerprint **não** reescreve `created_at` (reflete a 1ª descoberta), a cópia é **"visto pela 1ª vez há X"** (não "encontrado agora"). Confiança% e nº estimado **omitidos**.
- **D6 — Origem/fonte nos Benefícios.** `origem` = enum `benefit_source` → Emissor(`issuer`)/Bandeira(`card_network`)/Parceiro(`partner`)/Misto(`mixed`), usando `.pill.iss/.brand/.part` do ds.css (Misto ganha um 4º estilo neutro). `fonte` = nome do(s) programa(s) vinculado(s) via `benefit_sources`. Estende o SELECT do hook de benefícios (leitura).
- **D7 — Campos dos forms + lifecycle.** Preservar **exatamente** os campos que `SourceForm`/`BenefitForm` + editores de variantes/fontes/locais já editam, reestilizados (avançados via "mostrar mais"). Ao **criar**, o modal **passa a permanecer aberto** (mudança consciente, exceção (c) acima) para adicionar variantes/locais, em vez do `setEditing(null)` imediato de hoje. Não adicionar colunas que o form nunca teve.
- **D8 — Badge "novo".** Derivado de `created_at < 14 dias` (regra do app). **Remove** o checkbox "Marcar como novidade" do mockup. Sem coluna nova. Inclui `created_at` no SELECT/tipo do hook de benefícios (leitura).
- **D9 — Layout responsivo.** Colunas da tabela **fluidas** (`minmax(0,1fr)` + truncar); overflow confinado ao container da tabela (`overflow-x:auto`), **nunca na página**. Shell `min-height:100dvh` + rolagem do documento; sidebar `sticky` (desktop) e tabbar `fixed` (mobile). Zero overflow horizontal em qualquer largura (incl. 760–832px).
- **D10 — Overlay + componentes.** Sheet/Modal via **`<dialog>` nativo** (`showModal()`). A11y explícita: foco inicial no primeiro controle interativo (ou no `<dialog>`), **restauração de foco** ao elemento anterior ao fechar, `Escape` fecha, nome acessível via `aria-labelledby` do título; clique no backdrop fecha nos modais de confirmação, mas **não** nos forms (evita perda de dados). **Estender aditivamente** `Button` (`className`/`aria-label`), `Input` (`id`/`required`/`disabled`), `SegmentedControl` (badge `.n`). **Nav do admin é componente próprio** dentro do `AdminAppShell` usando `NavLink`/`to` (roteamento SPA) — o `Nav` do app usa `<a href>` e não serve; reusa estilo via classes/tokens, não o componente. **Compor novos**: AdminAppShell, AdminNav, AdminList/Row, StatGrid, Toast, AdminSheet.
- **D11 — Confirmação de exclusão.** Modal "Remover item?" nos deletes de **topo** (fonte/benefício) com **aviso de cascade**; a contagem real (nº de variantes/vínculos) vem de ampliar o SELECT de `useAdminSources`/`useAdminBenefits` — se inviável na task, usar aviso genérico ("isto remove também variantes e vínculos"). Remoções **aninhadas** (variante/local no form) usam confirmação **inline** leve.
- **D12 — Testes.** `global-setup` do Playwright provisiona admin idempotente (email/senha conhecidos como constantes locais do setup, `profiles.is_admin=true`) via service_role (padrão de `tests/helpers/clients.ts`); assume Supabase local no ar. **Responsivo + foco preso/Escape do `<dialog>`** verificados no **browser real** (Playwright). No jsdom, `src/test-setup.ts` ganha um **polyfill mínimo** de `showModal()`/`close()` (o jsdom do repo não os implementa) só para abrir/fechar — unit cobre abrir/fechar/callbacks e lógica, **nunca** foco-preso nem `@container`.
- **D13 — Migrations em produção.** 0014–**0017** aplicadas em prod **junto do deploy** de Spec 2 (checklist de release `develop→main`). Abas de discovery **degradam com graça** (vazio/"indisponível", sem quebrar) se as tabelas faltarem.
- **D14 — Tokens de chrome.** ds.css ganha `--admin-side-bg`, `--admin-side-ink`, `--admin-side-hover`, `--admin-line`, `--admin-backdrop` (light/dark). Sidebar intencionalmente **escura nos dois temas**. Valores concretos definidos na task de tokens (derivados do mockup: sidebar ~`#0f1013`); resto reusa tokens existentes; proíbe hex/rgb literais fora desses tokens.

## Global Constraints (herdadas por toda task)

- **Design tokens compartilhados:** MESMO `src/ui/ds.css`. Toda cor via `var(--…)`; chrome admin via tokens de D14. Dark mode herdado de `[data-theme="dark"]` (com overrides dos `--admin-*`).
- **Responsivo mobile-first:** `@container (min-width: 760px)` sobre `.aa-root { container-type: inline-size }`; reconciliar `discovery.css` (720→760). Layout conforme D9.
  - `<760px`: tabbar `fixed`; overlays bottom-sheet (`<dialog>` estilizado, slide-up + grip); cards; ações icon-only (com `aria-label`); "novo" icon-only.
  - `≥760px`: sidebar 246px escura `sticky`; modal centralizado (`<dialog>`, backdrop blur); tabela de colunas fluidas; ações com texto; "novo" texto+ícone.
- **CRUD real preservado** (exceções D4/D7/D11 acima).
- **Placeholders explícitos e mínimos** (ver seção). Nada finge dado real.
- **Reuso de primitivos** (estendidos aditivamente, D10): `Button`, `Input`, `Chip`, `SegmentedControl`, `PageState`, `Skeleton`. Nav do admin é própria (D10). Trocar `"Carregando…"`/`"Erro…"` crus por `PageState`/`Skeleton`.
- `Admin.dc.html`/`Admin Mobile.dc.html` **superados**; autoridade = `Admin App.dc.html` + `Admin Discovery.dc.html` + `Admin Responsivo.dc.html`.

## Arquitetura

### AdminAppShell (novo) — substitui AdminLayout
Casca responsiva envolvendo `<Outlet/>`: root `.aa-root` (`container-type:inline-size`); **AdminNav** próprio (uma lista de itens `Painel`/`Programas`/`Benefícios`/`Discovery`, via `NavLink`/`to`) renderizado como `.aa-side` (sidebar escura, ≥760px) OU `.aa-tabbar` (bottom nav fixa, <760px), ativo por `NavLink`; badge de pendentes; brand + logout (`supabase.auth.signOut`). `AdminGuard`/`useIsAdmin` com lógica inalterada + `PageState`/`Skeleton`.

### Telas e rotas (roteamento inalterado)
| Rota | Componente atual | Reskin |
|---|---|---|
| `/admin/login` | `AdminLogin` | `.aa-login` (gradiente, card ≤400px, brand, `.input`, `.btn`). `signInWithPassword` intacto. |
| `/admin` | `AdminHome` | Painel: `.aa-statgrid` (contagens reais: programas, benefícios, pendentes; "novos" via `created_at`) + `.aa-areagrid`. |
| `/admin/sources` | `AdminSources` + forms | Programas (ver seção). |
| `/admin/benefits` | `AdminBenefits` + forms | Benefícios (ver seção). |
| `/admin/discovery` | `AdminDiscovery` + `CandidateTree` | Cascade (drill-in de "Revisar", via `useCandidateSubtree`) + fila de jobs; breakpoint 720→760; dentro da nova casca. |

## Tela: Programas de benefícios (D1/D2/D3/D5)
- Header + "Novo programa" (icon-only <760 / texto+ícone ≥760).
- Segmented **[Pendentes · Ativos · Rejeitados]** (`SegmentedControl` estendido com badge `.n`).
- Banner de contagem (informativo, **sem** "Aprovar todos").
- Lista responsiva `.aa-list` (cards/tabela fluida):
  - **Ativos** = `sources` reais (`useAdminSources`), CRUD completo (Editar via modal; Remover via confirm de topo com aviso de cascade — D11).
  - **Pendentes** = `useSourceCandidates('pending')`, com `.aa-robo` = origem (`source_url`) · "visto pela 1ª vez há X" (`created_at`) · pill `verification_status`. Ações: **Revisar** (drill-in `useCandidateSubtree`) / **Rejeitar** (modal → `rejection_reason`).
  - **Rejeitados** = `useSourceCandidates('rejected')`; ação **Reconsiderar** (`useReconsiderCandidate`: volta a pending, limpa motivo).
- "Tipo" do programa: **reusar** o mapa existente `SOURCE_CATEGORY_META` (`src/features/onboarding/categoryMeta.ts`) para rótulos — não recriar tabela.
- Degradação graciosa se tabelas de discovery ausentes (D13).

## Tela: Benefícios (D6/D7/D8)
- Header + "Novo benefício". Toolbar: `.input.aa-search` + `.chips` (reusar `Chip`).
- `.aa-list`: título + badge `new` (via `created_at<14d`), `.tag`(categoria) + `.pill`(origem = `benefit_source`) + fonte (programa vinculado). Editar/Remover (confirm de topo).
- **Form (`<dialog>`):** estética do mockup, campos = os que o form já edita hoje (D7), avançados via "mostrar mais"; multi-fonte (`BenefitSourcesEditor`) e locais (`BenefitLocationsEditor`) preservados; modal permanece aberto após criar (D7). Erros de mutation exibidos; prevenção de duplo-submit.

## Componentes compartilhados
- **AdminAppShell** — casca responsiva (sidebar↔tabbar), AdminNav, brand+logout.
- **AdminNav** (novo) — nav própria via `NavLink`/`to`, renderizada como sidebar ou tabbar; badge de contagem.
- **AdminSheet/Modal** — `<dialog>` nativo: bottom-sheet (mobile) ↔ dialog centralizado (desktop), variante `wide`; a11y de D10. Hospeda confirm-delete, rejeitar-motivo, forms.
- **AdminList/AdminRow** — coleção responsiva: cards (mobile) ↔ tabela de colunas fluidas (desktop); colunas parametrizáveis; roles de tabela (`role="table"/"row"/"cell"`).
- **StatGrid** — tiles (2-col/N-col).
- **SegmentedTabs** — `SegmentedControl` estendido com pill de contagem.
- **Toast** — novo; `aria-live="polite"`, fila, duração, respeita `prefers-reduced-motion`.

## Estados de erro / vazio / carregamento
`PageState` (erro/vazio, com retry — expor `refetch`) e `Skeleton` (carregando; adicionar variante de lista/tabela) em todas as telas de lista.

## Testes (D12)
- **Gate visual Playwright** — `tests/e2e/admin-layout.spec.ts`, 4 projetos (mobile/desktop × light/dark): login → painel → programas (3 abas) → benefícios → discovery. Asserts: sem overflow horizontal; sidebar (≥760) vs tabbar (<760); sheet vs modal; `<dialog>` foco/Escape. `global-setup` provisiona admin idempotente via service_role.
- **Unit (Vitest/TL):** lógica — filtro/contagem de aba, seleção por fingerprint distinto, confirm-delete, mapeamentos (benefit_source→rótulo, source_category via `SOURCE_CATEGORY_META`, novo por created_at), abrir/fechar AdminSheet (polyfill `<dialog>` no `test-setup.ts`), Toast (aria-live/fila). **Não** testar foco-preso nem `@container` no jsdom.
- **`npm run build`** = único type-check; cada task roda build.

## Tokens novos (D14)
`--admin-side-bg`, `--admin-side-ink`, `--admin-side-hover`, `--admin-line`, `--admin-backdrop` (light/dark) no ds.css; valores derivados do mockup (sidebar ~`#0f1013`). Classes `aa-*`/`dv-*` em CSS dedicado consumindo tokens.

## Placeholders (dados sem backing real)
1. **Robô em Pendentes**: só campos existentes (origem/1ª-vez/verification_status). Confiança%/estimativa **omitidos** (não placeholder).

Reais (não placeholder): Painel "Novos" e badge `new` = `created_at < 14 dias`; contagens do Painel = reais.

## Fora de escopo
- Novo schema/pipeline de discovery além de `rejection_reason` (D4).
- Aplicar migrations em prod fora do deploy de Spec 2 (D13).
- Campos de robô inexistentes (confiança/estimativa) — omitidos.
- Expandir forms para colunas hoje não editáveis (D7).

## Decomposição (para writing-plans) — ordenada por dependência

1. **Fundação de dados + tokens.** Migration `0017` (`rejection_reason`) + regen `database.types.ts` + update `discovery/types.ts`; hooks `useSourceCandidates(status)` (agregado por fingerprint distinto), `useCandidateSubtree(fingerprint)` (recursivo por `parent_fingerprint`, cross-job), `useRejectCandidate({candidateId,reason})`, `useReconsiderCandidate({candidateId})` (com invalidação); estender SELECT/tipo de benefícios (`benefit_source`, fonte, `created_at`); tokens `--admin-*` no ds.css; polyfill `<dialog>` no `test-setup.ts`.
2. **Extensões de primitivos + AdminSheet + Toast.** Props aditivas em Button/Input/SegmentedControl; `<dialog>` AdminSheet (a11y de D10); Toast; confirm-delete (topo + inline).
3. **AdminAppShell + AdminNav** (sidebar↔tabbar, NavLink, badge, logout) + AdminGuard/estados; AdminList/Row + StatGrid.
4. **Login + Painel do catálogo** (contagens reais + "novos" derivado).
5. **Programas — Ativos** (CRUD de fontes; forms com campos atuais + "mostrar mais"; modal permanece aberto pós-criação; confirm de topo com cascade; "Tipo" via `SOURCE_CATEGORY_META`).
6. **Programas — Pendentes/Rejeitados + Revisar (cascade).** Wiring `useSourceCandidates`; rejeição com motivo; reconsiderar; drill-in via `useCandidateSubtree` (reusa `CandidateTree`); reconciliar breakpoint discovery; degradação graciosa.
7. **Benefícios** (lista/toolbar + form completo).
8. **Gate visual Playwright do admin + global-setup admin + consolidação de unit tests.** (Cada task 3–7 já entrega seus próprios testes.)
