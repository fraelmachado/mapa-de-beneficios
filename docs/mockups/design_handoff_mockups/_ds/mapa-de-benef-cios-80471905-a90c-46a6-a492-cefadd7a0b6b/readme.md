# Mapa de Benefícios — Design System

App mobile-first (roda em mobile e desktop) para mapear benefícios de cartões: salas VIP, seguros, cashback, viagem, compras e pontos.

## Como consumir

1. Carregue a folha global e o bundle (é o que o `templates/painel/ds-base.js` faz):
   - `styles.css` — tokens + classes de componente.
   - `_ds_bundle.js` — componentes React (expostos em `window.MapaDeBenefCios_804719`).
2. Use as classes do CSS para componentes estáticos, ou importe os componentes React.

```js
const { Pass } = window.MapaDeBenefCios_804719;
```

## Tokens (em `styles.css`)

- **Cor:** superfícies (`--bg`, `--surface`, `--surface-2`), tinta (`--ink`, `--ink-2`, `--muted`), linhas, acento (`--accent`), estados (`--warn`, `--ok`) e categorias (`--c-airport`, `--c-seguro`, `--c-viagem`, `--c-cashback`, `--c-compras`, `--c-pontos`).
- **Espaçamento:** escala base 4px — `--s1`…`--s16`.
- **Tipografia:** `--fz-display` … `--fz-eyebrow`, fonte `Onest`.
- **Forma:** `--radius`, `--r-sm`, `--r-xs`, `--r-pill`; elevação `--shadow`, `--shadow-lg`.

## Tema claro / escuro

Aplicado via `[data-theme="dark"]` no `<html>`. A seleção inicial (preferência salva > preferência do sistema) é feita em `ds-base.js` e persistida em `localStorage` (`mb-theme`).

## Componentes (React)

- **Pass** — card de benefício com borda por categoria, picote e pill de origem.
- **Button** — `variant`: `primary` | `ink` | `ghost`; suporta `disabled` e `icon`.
- **Chip** — chip de filtro; `category` exibe o ponto colorido; `active` marca seleção.
- **SegmentedControl** — ordenação/abas controladas por `options`, `value`, `onChange`.
- **Alert** — aviso de atenção/compliance.
- **Nav** — navegação por `items` (`label`, `icon`, `href`, `active`).
- **Row** — linha de lista com `leading`/`trailing`; vira link com `href`.
- **Input** — campo com `icon`, `type`, controlado por `value`/`onChange`.
- **Checklist** — passos de elegibilidade (`items` com `done`).
- **Skeleton** — placeholder de carregamento (`variant`: `bar` | `pass`).
- **HeroRadar** — hero do Painel com contagem e valor estimado.

Todos os padrões agora têm componente React. As classes de `styles.css` seguem disponíveis para uso direto em HTML.

## Templates

- **Painel (Radar)** (`templates/painel/`) — tela principal responsiva: coluna única + bottom nav no mobile; sidebar + grid de passes no desktop (≥960px). Filtros por categoria e ordenação interativos; consome `<Pass>` via bundle.
