# design-system-source — design v3 "passe" (do Claude Design)

Fonte do design system **Mapa de Benefícios** v3 "passe", puxada do projeto
claude.ai/design `Mapa de Benefícios` (projectId `80471905-a90c-46a6-a492-cefadd7a0b6b`)
em 2026-06-29. **É design system real (componentes React + tokens), não mockup.**

## Arquivos
- `styles.css` — **fonte de verdade do visual**: tokens (cores, categorias, espaçamento
  base-4, tipografia Onest, raios, sombras) + classes de componente (`.pass`, `.chip`,
  `.btn`, `.nav`, `.row`, `.input`, `.alert`, `.check`, `.seg`, `.sk`) + **dark mode**
  via `[data-theme="dark"]`.
- `COMPONENTS_SOURCE.txt` — componentes React (`.jsx` + tipos `.d.ts`): **Pass** (card
  "passe"), Chip, Nav, HeroRadar, Button, Input, SegmentedControl, Row, Checklist,
  Skeleton, Alert. APIs/props documentadas nos `.d.ts`.
- `PAINEL_TEMPLATE_REFERENCE.txt` — composição da tela **Painel/Radar** (shell
  responsivo: coluna única no mobile + sidebar/grid no desktop; tabbar; hero com
  gradiente; chips por categoria; seg control; toggle de tema). Referência de layout.

## Como usar (P2 — reskin)
1. Tokens → integrar `styles.css` no app (`src/index.css` + mapear no `tailwind.config`).
2. Componentes → recriar em `src/ui/` como `.tsx` a partir do `COMPONENTS_SOURCE.txt`
   (os `.jsx` usam `React.createElement`; converter pra JSX/TSX tipado).
3. Religar as telas (Painel, Buscar, Detalhe, Perfil, admin) usando esses componentes
   com **dados reais** do Supabase (a view `my_benefits` já projeta `origins`/`networks`/
   `benefit_source` do P1) — usar o template do Painel como referência de shell.

Mapeamento de dados (mockup ilustrativo → real): `category` vem da categoria do
benefício; `via` do nome do cartão/fonte; `originType`/`originLabel` de
`origins`/`benefit_source`. Confirmar nomes amigáveis no plano P2.

> O `design_handoff_discover/` do projeto Claude Design trata de uma tela **nova
> "Discover"** (explorar/ativar programas), ainda não desenhada — escopo futuro (≈P4),
> fora do reskin das telas atuais.
