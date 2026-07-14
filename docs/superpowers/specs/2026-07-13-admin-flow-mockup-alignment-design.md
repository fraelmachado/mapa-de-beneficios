# Fluxo do Admin — Alinhamento aos Mockups (Spec 2) — Design

**Data:** 2026-07-13
**Status:** proposto (aguardando revisão do usuário)
**Precede:** implementação via writing-plans → subagent-driven-development
**Relacionado:** Spec 1 "Conclusão do Fluxo do App" (concluído e mergeado em `develop`).

## Objetivo

Reestilizar o Admin (todas as telas: Entrar, Painel do catálogo, Programas de benefícios, Benefícios, Discovery) para bater **exatamente** com os mockups do Claude Design (`docs/mockups/design_handoff_mockups/Admin App.dc.html` + `Admin Discovery.dc.html`, com a intenção responsiva de `Admin Responsivo.dc.html`), **mantendo intacto o CRUD real** que já existe. Onde o mockup mostra algo sem dado real por trás, usar **placeholder/mock** — nunca inventar backend novo.

## Princípio-guia

O Admin hoje é funcional mas sem estilo (inline styles + utilitários Tailwind, zero `@media`, exceto Discovery que já foi reskinado). Este spec troca a **casca e a apresentação**, não a lógica. Todo hook/CRUD/rota existente é preservado; mudam layout, CSS e a introdução de componentes de UI compartilhados.

## Global Constraints (herdadas por toda task)

- **Design tokens compartilhados:** os mockros usam o MESMO `src/ui/ds.css` do app. Toda cor/spacing via `var(--…)` (`--accent` `#2B44FF`, `--ink`, `--ink-2`, `--muted`, `--surface`, `--surface-2`, `--bg`, `--line`, `--warn`, `--ok`, `--s1..--s16`, `--radius`/`--r-sm`/`--r-xs`/`--r-pill`, `--shadow`/`--shadow-lg`, fonte Onest via `--font`, e as 6 cores de categoria `--c-airport/-seguro/-viagem/-cashback/-compras/-pontos`). **Proibido hex/rgb hardcoded** (exceto onde o próprio mockup usa uma cor de chrome específica, ex. sidebar escura `#0f1013` — documentar como token novo `--admin-side-bg`). Dark mode herdado de `[data-theme="dark"]`, sem overrides admin-específicos.
- **Responsivo mobile-first via container query:** breakpoint único **`@container (min-width: 760px)`** sobre `.aa-root { container-type: inline-size }`. Um só componente por tela, sem telas duplicadas. Reconciliar o `discovery.css` existente (hoje `720px`) para `760px`.
  - `<760px`: sidebar oculta, navegação em **bottom-tabbar**; overlays como **bottom-sheet** (slide-up + grip); listas como **cards** empilhados; ações **icon-only**; botão "novo" icon-only.
  - `≥760px`: **sidebar** fixa 246px (fundo escuro) + conteúdo; overlays como **modal centralizado** (pop-in, backdrop blur); listas como **tabela** com colunas; ações com texto; botão "novo" com texto+ícone.
- **CRUD real preservado:** nenhuma escrita/rota/hook existente é removida. Reskin não altera contratos de dados.
- **Placeholders explícitos:** todo campo/estatística do mockup sem dado real vira placeholder visível e é listado na seção "Placeholders" desta spec. Nada finge ser dado real.
- **Reuso de primitivos:** usar `src/ui/Button`, `Chip`, `SegmentedControl`, `PageState`, `Skeleton`, `Input` onde encaixam (o mockup já usa `.btn`/`.input`/`.chip`/`.seg`/`.tag`/`.pill`/`.new` que são globais no ds.css). Substituir os `"Carregando…"`/`"Erro…"` crus das listas admin por `PageState`/`Skeleton`.
- `Admin.dc.html` e `Admin Mobile.dc.html` são iterações **superadas** (prefixos `ad-`/`am-`, larguras fixas); autoridade é `Admin App.dc.html` + `Admin Discovery.dc.html` + `Admin Responsivo.dc.html`.

## Arquitetura

### AdminAppShell (novo) — substitui AdminLayout

Componente de casca responsiva que envolve `<Outlet/>`:
- Possui o root `.aa-root` (`container-type: inline-size`) e `.aa-shell`.
- **Navegação a partir de uma única lista de itens** (`Painel /admin`, `Programas /admin/sources`, `Benefícios /admin/benefits`, `Discovery /admin/discovery`) — renderizada como `.aa-side` (sidebar escura, ≥760px) OU `.aa-tabbar` (bottom nav, <760px). Item ativo por `aria-current` (sem estilo inline). Badge de contagem de pendentes no item Discovery/Programas.
- Marca (brand lockup) + botão de logout (mantém `supabase.auth.signOut`).
- `AdminGuard`/`useIsAdmin` inalterados na lógica; só recebem estados visuais (`PageState`/`Skeleton`) no lugar dos `<p>` crus.

### Telas e rotas (inalteradas no roteamento)

| Rota | Componente atual | Reskin |
|---|---|---|
| `/admin/login` | `AdminLogin` | `.aa-login`: fundo gradiente radial, card ≤400px, brand, `.input` email/senha, `.btn` entrar, rodapé "Instalável como app". Wiring `signInWithPassword` intacto. |
| `/admin` | `AdminHome` | Painel do catálogo: `.aa-statgrid` (2-col mobile / 4-col desktop) + `.aa-areagrid` (1-col / 2-col) de cards de área (Programas, Benefícios). |
| `/admin/sources` | `AdminSources` + forms | Programas de benefícios (ver seção dedicada). |
| `/admin/benefits` | `AdminBenefits` + forms | Benefícios (ver seção dedicada). |
| `/admin/discovery` | `AdminDiscovery` + `CandidateTree` | Detalhe do cascade (drill-in do Pendentes) + fila de jobs; ajustar breakpoint 720→760, encaixar na nova casca. |

## Tela: Programas de benefícios (fusão com Discovery)

Segue `Admin App.dc.html` à risca, com os dados vindos do modelo real:

- Header + botão "Novo programa" (icon-only <760, texto+ícone ≥760).
- **Segmented `[Pendentes · Ativos · Rejeitados]`** (sobre `SegmentedControl`, com badge de contagem `.n` por aba).
- Banner `.aa-batch` "N programas aguardando aprovação · Aprovar todos" — só na aba Pendentes com count>0.
- Lista responsiva `.aa-list` (cards <760 / tabela ≥760):
  - **Ativos** = `sources` reais (`useAdminSources`). Linha: avatar-inicial, nome, pill(tipo). Ações **Editar** (abre form modal/sheet) e **Remover** (abre confirm "Remover item?"). CRUD real 100% preservado.
  - **Pendentes** = candidatos reais de discovery (`discovery_candidates` de nível fonte, via `useDiscovery`). Linha com `.aa-robo` (origem · encontrado · confiança% · nº estimado de benefícios). Ações **Aprovar** (promote RPC existente) / **Rejeitar** (abre "Rejeitar programa" com motivo). **Drill-in**: clicar abre o cascade (`CandidateTree`) para aprovação granular source→variante→benefício.
  - **Rejeitados** = candidatos rejeitados; ação **Reconsiderar**.
- **Placeholders** (seção Placeholders): campos de robô que o schema real não tem (ver risco/mapa abaixo) aparecem com valor placeholder marcado.

## Tela: Benefícios

- Header + "Novo benefício".
- Toolbar: `.input.aa-search` + `.chips` (categorias, scroll horizontal) — reusar `Chip`.
- `.aa-list` (cards/tabela): título + badge `new` (do campo real de novidade, se existir; senão placeholder), `.tag`(categoria) + `.pill`(origem) + fonte. Editar/Remover.
- **Form (modal/sheet):** estética do mockup, **todos os campos reais mantidos** (`BenefitForm` + `BenefitSourcesEditor` multi-fonte + `BenefitLocationsEditor`). Campos além do mockup (16 categorias reais, multi-fonte, scope/uf/steps/valid_until/image/action/locais) ficam em **progressive disclosure** ("mostrar mais"/seções recolhíveis). CRUD real preservado.

## Componentes compartilhados novos

- **AdminAppShell** — casca responsiva (sidebar↔tabbar), nav de uma lista, brand + logout.
- **AdminSheet/Modal** — overlay único: bottom-sheet (mobile, slide-up, grip, cantos arredondados no topo) ↔ dialog centralizado (desktop, pop-in, blur), com variante `wide` (520px). Hospeda: confirm-delete, rejeitar-motivo, e os forms de entidade.
- **AdminList/AdminRow** — coleção responsiva: card por linha (mobile, ações icon) ↔ tabela com colunas (desktop, ações texto). Colunas parametrizáveis (name/meta/count/actions) para reuso em Programas e Benefícios.
- **StatGrid** — tiles de estatística (2-col/N-col).
- **SegmentedTabs (com contagem)** — wrapper fino sobre `SegmentedControl` que renderiza o pill `.n` por aba.
- **Toast** — não existe primitivo de toast no app hoje; necessário para confirmações de salvar/remover/aprovar (`aa-toast`).
- **Confirm-delete** — hoje `AdminSources`/`AdminBenefits`/editores deletam **na hora, sem confirmação**. O modal "Remover item?" introduz a etapa de confirmação (correção de UX real, não só estilo).

## Estados de erro / vazio / carregamento

Trocar strings cruas por `PageState` (erro/vazio, com retry) e `Skeleton` (carregando) em todas as 5 telas de lista.

## Testes

- **Gate visual Playwright** estendido ao Admin (novo spec e2e em `tests/e2e/admin-layout.spec.ts`) nos 4 projetos (mobile/desktop × light/dark): login → painel → programas (3 abas) → benefícios → discovery; asserts de sem-overflow-horizontal, presença de sidebar (≥760) vs tabbar (<760), sheet vs modal. Requer usuário admin no seed local.
- **Unit (Vitest + Testing Library):** filtro por aba (Pendentes/Ativos/Rejeitados), confirm-delete (não deleta sem confirmar), navegação responsiva, AdminSheet (sheet vs modal por largura via container/mocked matchMedia), Toast. Testes de CRUD existentes preservados/ajustados aos novos wrappers.
- **`npm run build`** é o único type-check (vitest não roda tsc) — cada task roda build.

## Tokens novos (admin) a adicionar

Classes `aa-*` (casca/Programas/Benefícios) e `dv-*` (Discovery, já existentes em `discovery.css`). Adicionar token de chrome da sidebar escura (`--admin-side-bg`, com valor light/dark) em vez de hex hardcoded. Lista completa de classes `aa-*` no relatório de análise (seção 3 do gap map) — todas serão criadas em CSS dedicado (`src/features/admin/admin.css` ou por-tela), consumindo tokens do ds.css.

## Placeholders (dados sem backing real)

1. **Robô em Pendentes** (origem/encontrado/confiança%/nº estimado): mapear aos campos reais de `discovery_candidates` onde existirem; onde não existir campo no schema, placeholder marcado.

Itens **reais** (não placeholder), para evitar ambiguidade:
- **Painel "Novos"** e **badge `new` em Benefícios** = derivação real de `created_at < 14 dias` (mesma regra que o app já usa no Spec 1). Sem flag persistida nova, sem placeholder.
- **Painel "Programas"/"Benefícios"/"Pendentes"** = contagens reais (`sources`, `benefits`, `discovery_candidates` pendentes).

## Fora de escopo

- Novo schema/pipeline de discovery (a fusão é **visual + reuso do pipeline real existente**, com placeholders para campos ausentes — não cria colunas novas em `sources`).
- Migrations de discovery em produção (deferidas ao deploy `develop → main`, decisão separada).
- Funcionalidades novas de admin além do que os mockups mostram.

## Riscos / notas

- **Fusão Discovery↔Programas** reusa o pipeline real (`discovery_candidates`, promote RPC, `CandidateTree`) como detalhe; as abas Pendentes/Rejeitados são a superfície leve. Campos de robô ausentes no schema = placeholder (não inventar coluna).
- **Forms**: manter todos os campos reais é inegociável (CRUD real); o mockup guia só a estética + progressive disclosure. Reconciliar enums do mockup (Tipo/Categoria simplificados) com os enums reais — usar os enums REAIS, com o visual do mockup.
- **Confirm-delete** muda comportamento (adiciona confirmação) — é correção desejada.
- **Seed local** precisa de um usuário admin (`profiles.is_admin`) para o gate e2e do admin.

## Decomposição sugerida (para writing-plans)

Um único spec, implementável como um plano com tasks sequenciadas por dependência:
1. Tokens/CSS base + AdminAppShell (casca responsiva) + AdminGuard/estados.
2. AdminSheet/Modal + Toast + confirm-delete (primitivos de overlay).
3. AdminList/AdminRow (coleção responsiva) + StatGrid + SegmentedTabs.
4. Login + Painel do catálogo.
5. Programas (Ativos = CRUD real; abas; batch; forms via progressive disclosure).
6. Programas — Pendentes/Rejeitados (wiring discovery) + drill-in cascade (reconciliar breakpoint).
7. Benefícios (lista/toolbar + form com todos os campos).
8. Gate visual Playwright do admin + unit tests + seed admin.
