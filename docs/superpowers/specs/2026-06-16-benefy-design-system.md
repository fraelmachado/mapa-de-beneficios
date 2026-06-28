# Benefy — Design System (v3 aprovado)

**Data:** 2026-06-16
**Status:** direção visual aprovada pelo usuário
**Mockup de referência:** `docs/mockups/2026-06-16-benefy-mockups-v3.html` (abrir no navegador)

> **IMPORTANTE — o que este doc trava e o que NÃO trava.**
> Trava o **sistema visual**: tokens (cor/tipo/espaço/raio/sombra), a anatomia dos componentes e os motivos. **NÃO** trava o conteúdo do mockup — números (ex.: "23 benefícios"), textos de exemplo, listas de cartões e categorias por card são **ilustrativos**. A implementação React puxa dados reais de `my_benefits`/catálogo; nada de copy/contagem do mockup deve ser hard-coded como baseline.

## 1. Conceito

Cada benefício é um **passe** (ticket/voucher perfurado) — salas VIP, seguros, milhas e vouchers ganham forma física. Base clara e leve (clean/moderno), com **cor por categoria** para dar vida sem ruído. Mobile-first PWA, pt-BR.

## 2. Tokens

### Cor
```
--bg:        #F6F6F3   (fundo da app)
--surface:   #FFFFFF   (cards, rows)
--ink:       #15161B   (texto principal, nav ativa, botão escuro)
--ink-2:     #3A3B42   (texto secundário)
--muted:     #8A8B92   (texto terciário/labels)
--line:      #ECEBE6   (bordas)
--line-2:    #F2F1EC   (divisores internos)
--accent:    #2B44FF   (cobalto — ação primária: CTAs, links, foco)
--accent-soft:#EDEFFF
```

### Cores de categoria (hue + soft bg) — dirigem a faixa lateral e a tag do passe
```
airport   #2B44FF / #EDEFFF
seguro    #0E9F6E / #E6F6EF      (insurance/security)
viagem    #0CA3B2 / #E2F6F8      (travel)
cashback  #E08A0E / #FCF1DF      (cashback/investback)
compras   #7A5AF8 / #F0ECFE      (shopping)
pontos    #E5447E / #FCE7EF      (points/miles)
```
As 16 categorias do catálogo mapeiam para esse conjunto de hues (agrupando: airport→airport; insurance/security→seguro; travel→viagem; cashback/investback→cashback; shopping→compras; points/miles→pontos; concierge/investment/account_service/international_purchase/experience/other → tom neutro `--ink-2`/cinza). O mapa exato será definido no plano de implementação.

### Origem do benefício (pílulas)
```
Emissor (issuer)      verde   #0E9F6E / #E6F6EF
Bandeira (card_network) cobalto #2B44FF / #EDEFFF
Parceiro (partner)    âmbar   #E08A0E / #FCF1DF
Mixed                 usar a origem dominante (decisão no plano)
```

### Tipografia — **Onest** (Google Fonts), pesos 400–800
- Display/títulos de tela: 25–29px, weight 700, `letter-spacing:-.03em`
- Título do card (`h3`): 18px / 700 / -.02em
- Corpo: 13.5–14.5px / 400–500 / line-height ~1.5
- Eyebrow/label: 11.5px / 700 / `.1em` / uppercase / `--muted`
- Número-herói: até 44–46px / 800 / -.04em

### Espaço, raio, sombra
```
--radius: 20px (cards grandes/superfícies)   --r-sm: 14px (rows, inputs)
passe: border-radius 18px
--shadow: 0 1px 2px rgba(21,22,27,.04), 0 10px 26px -18px rgba(21,22,27,.22)
padding de tela (scroll): 8px 20px 100px   |  gap entre passes: ~13px
```

## 3. Componentes

### Passe (card de benefício) — elemento de assinatura
Anatomia:
- **Faixa lateral** (5px) na cor da categoria (`--cat`).
- **Stub** (topo): linha `via <b>Produto</b>` à esquerda + **tag de categoria** (uppercase, cor/soft da categoria) à direita; `h3` título; `p.d` descrição curta.
- **Perfuração**: borda tracejada horizontal com dois "furos" (círculos da cor do fundo) nas laterais.
- **Foot** (base): **pílula de origem** (Emissor/Bandeira/Parceiro) à esquerda + botão circular `→` (ink) à direita.
- Card de **destaque** pode usar a faixa/realce mais forte (sem mudar a estrutura).

### Chips de categoria (filtro)
Pill `border-radius:11px`, branco com borda; ativo = `--ink` com texto branco. Pode exibir um ponto na cor da categoria.

### Hero "radar" (Painel)
Bloco com **gradiente** cobalto→teal→verde (`linear-gradient(120deg,#2B44FF,#0CA3B2,#0E9F6E)`), número grande de benefícios + subtítulo. Conteúdo (número) vem de dados reais.

### Botões
- Primário: fundo `--accent`, texto branco, `radius:14px`, sombra cobalto.
- Ink: fundo `--ink` (ações secundárias fortes, ex.: "Ver no portal").
- Ghost: branco + borda.

### Rows (listas: "da mesma fonte", conta, fonte oficial)
Branco, borda `--line`, `radius:14px`, peso 600, chevron `→`/`↗` em `--muted`.

### Bottom nav
Branca translúcida (blur), borda superior, 3 itens (Painel/Buscar/Perfil); ativo em `--ink` com ícone no `--accent`.

### Bloco "Fonte oficial" (detalhe — M8a já no app)
Eyebrow "Fonte oficial" → row com avatar quadrado (inicial da fonte, cor verde-confiança) + nome (`source_name` ou host) + `↗`; abaixo, linha `muted` com ponto verde "Informações coletadas em DD/MM/AAAA" (`observed_at`). Lista "Da mesma fonte" usa o componente Row.

## 4. Telas cobertas pelo mockup
Onboarding · Painel · Detalhe do benefício · Buscar · Perfil. (Admin e estados vazios/erro/carregando serão desenhados no plano de implementação seguindo estes tokens.)

## 5. Próximo passo
Implementar o reskin no app React + Tailwind (milestone próprio), mapeando estes tokens para o `tailwind.config` + componentes (`BenefitCard`/passe, `CategoryChips`, hero do `Painel`, `BenefitDetail`, `AppLayout/BottomNav`, onboarding, perfil), **consumindo dados reais** — sem herdar copy/números do mockup.
