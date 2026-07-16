# Paridade total com os mockups — plano de implementação

**Data:** 2026-07-15
**Branch:** `feat/mockup-parity`
**Objetivo (do usuário):** o app final deve ser **visualmente idêntico aos mockups** e conter **todas as funcionalidades** neles previstas. Autonomia total no repo e no Dokploy; não parar até completo.

## Decisões de escopo (travadas)
1. **Fluxo Gmail = prévia visual fiel.** Telas 03 (Vasculhando) e 08 (Revisar Gmail) devem ficar idênticas aos mockups, usando dados de catálogo como demo, mantendo o copy honesto ("nada é lido do seu e-mail"). **Sem** OAuth/integração real.
2. **Catálogo = fidelidade de mockup.** Logos reais + o conjunto de marcas/tiers/benefícios/valores que os mockups demonstram (modelo embutido nos `.dc.html`). O catálogo real completo permanece com o pipeline de discovery (P4/P5), fora deste escopo.

## Achados que moldam o plano
- **Todas as telas dos mockups já existem no código** (`OnboardingPage` state machine → `OnboardingIntro`/`Vasculhando`/`ManualWizard`/`RevisarGmail`/`RadarMontado`; `Painel` inclui o branch vazio = Tela 10). Não há tela a criar do zero — é **polir**.
- **Tokens de CSS do app ≈ idênticos ao `_ds` dos mockups** (`src/ui/ds.css`: `--accent:#2B44FF`, Onest, cores por categoria). Drift, quando existe, é no **CSS por tela** (9 arquivos `*.css` de feature), não nos tokens.
- **Gate de teste NÃO é pixel-diff** (`tests/e2e`): valida ausência de overflow horizontal (390/1440, light/dark) + estrutura/roles/nomes acessíveis. Posso reestilizar livre desde que não quebre hooks (`.pass`, `.side`, `.tabbar`, `.ob-tile`, `.review-item`, `.aa-*`) nem introduza overflow.
- **Modelo de conteúdo dos mockups** está embutido nos `.dc.html` (marcas com `color`/`est`/`domain`/`logo`, tiers com `est`/`benefits`/`recommended`, 5 categorias). É a fonte-da-verdade do conteúdo.
- **Deploy:** `Dockerfile` (build args `VITE_SUPABASE_URL/ANON_KEY` baked) → nginx no Dokploy (app `1BjRuRUM7eitGRBJ29wMi`). Branch de build é config do Dokploy (confirmar `main`); webhook de auto-deploy tinha investigação pendente → deploy manual via MCP `application-deploy`.
- **Prod SQL** roda via pg-meta: `POST https://api.mapadebeneficios.com.br/pg/query` com service_role (ver memória `mapa-de-beneficios-prod-supabase-ops`).

## Lacunas de dados/schema
- `sources.logo_url` nulo → tiles caem em placeholder de letra. Precisa: assets de logo + `logo_url`.
- **Sem campo de valor estimado** em `benefits`/view/Pass. Mockups mostram `≈ R$ X/ano` por benefício e agregado. Precisa: coluna `benefits.estimated_value_brl`, expor na view `my_benefits`, somar no Painel/Radar.
- **Sem badge "assinatura"** no `Pass` (só `novo`/`tag`). Adicionar.
- Catálogo atual: 3 provedores (nubank/inter/xp), só `bank_card`. Mockup demonstra ~30 provedores em 5 categorias.

## Fases

### Fase 1 — Dados & assets (maior salto visual; deploy cedo)
1. **Logos:** produzir SVGs limpos das marcas do mockup (Nubank, Itaú, Bradesco, C6, Inter, XP, Vivo, Claro, TIM, Spotify, Disney+, Amazon Prime, SulAmérica, Amil, Bradesco Saúde, BB, Santander, BTG, LATAM/Smiles/TudoAzul…), subir ao bucket `assets`, setar `sources.logo_url`.
2. **Schema:** migration `0018_benefit_estimated_value.sql` → `alter table benefits add column estimated_value_brl int`; recriar view `my_benefits` expondo o valor (via agregação por benefício).
3. **Seed:** expandir `supabase/seed.sql` para o conjunto de marcas/tiers/benefícios/valores do modelo dos mockups (5 categorias, `source_category` correta, `est` → `estimated_value_brl`, `steps`, `action_url`, `long_description`). Manter idempotência por slug e os testes `tests/seed_*` verdes.
4. **Aplicar em prod:** migration + reseed via pg-meta; validar contagens e a query do onboarding.

### Fase 2 — Componentes (funcionalidade prevista nos mockups)
5. **Pass/`toPassProps`:** linha de valor estimado (`≈ R$ X/ano`), badge `assinatura`, garantir "via **provedor**" (usar `origins[0].provider`, não só tier).
6. **Detalhe:** pílula "valor estimado" no hero; botão salvar/bookmark **funcional** (tabela `favorites` + toggle) como no mockup Tela 05; CTA de ação já existe (condicional a `action_url`).
7. **Painel/Radar:** somar `estimated_value_brl` real em vez do placeholder `~R$180/benefício`.
8. **Wizard:** agrupar por **marca** (um card por provedor, tier escolhido dentro) como na Tela 06, preservando os hooks de teste (`.ob-tile`).

### Fase 3 — Polish de CSS por tela (paridade pixel)
Percorrer cada tela no browser (390px) contra o mockup e alinhar o CSS de feature:
- Tela 01: rótulo "SEU RADAR DE BENEFÍCIOS" cobalto (não cinza).
- Tela 06: barra de progresso segmentada; rótulo "SEU TESOURO ESCONDIDO".
- Tela 05: bookmark + pílula de valor.
- Tela 11: inicial no avatar, ícone no input de e-mail, setas.
- Telas 03/08/10 (Vasculhando/Revisar/vazio): alinhar ao mockup.
- Demais deltas descobertos na varredura.

### Fase 4 — Deploy & verificação
9. Rodar `npm run build` + `npm test` (e2e) verdes; sem overflow horizontal.
10. Merge para a branch de deploy; `application-deploy` no Dokploy; aguardar healthy.
11. **Verificação visual ao vivo**: reabrir cada tela em `www.mapadebeneficios.com.br` no browser e comparar 1:1 com o mockup. Iterar até idêntico.

## Verificação (definição de "pronto")
- Cada tela dos mockups reproduzida 1:1 no app ao vivo (varredura no browser 390px light+dark).
- Todas as funcionalidades dos mockups presentes (valor estimado, badges, salvar, prévia Gmail, empty states, alertas).
- `npm test` (e2e) verde; zero overflow horizontal em 390/1440 light/dark.
- Catálogo em prod com logos e valores; onboarding→radar→detalhe funcional.

## Ordem de entrega
Fase 1 primeiro (dados dão ~80% da percepção; deploy cedo pra o usuário ver). Depois 2 → 3, com deploy incremental. Fase 4 fecha e verifica cada tela.
