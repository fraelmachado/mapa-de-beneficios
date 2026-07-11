# Alinhamento visual do app aos mockups - Design

**Data:** 2026-07-10

**Status:** aprovado para planejamento

## Objetivo

Atualizar o layout das telas existentes do app autenticado para reproduzir a
estrutura, a hierarquia, os estados e o comportamento responsivo dos mockups em
`docs/mockups/design_handoff_mockups/`, preservando os dados reais, os contratos
Supabase e as rotas principais.

Esta e a primeira frente de uma modernizacao em etapas. Ela cobre o app. O admin,
a integracao real com Gmail e a tela de Alertas terao specs e planos separados.

## Decisoes aprovadas

- Executar em etapas: app existente, depois admin, depois Gmail e Alertas.
- Trabalhar em fatias verticais por tela, com uma entrega validavel por fatia.
- Buscar paridade ampla de UI e estados, nao apenas uma troca cosmetica de CSS.
- Mostrar Gmail como `Em breve`, sem navegacao simulada nem integracao nesta frente.
- Validar todas as telas em mobile, desktop, tema claro e tema escuro.
- Preservar hooks, RPCs, schema, migrations e contratos de dados existentes.
- Usar os mockups como fonte da verdade visual e `src/ui`/`ds.css` como base de
  implementacao.

## Escopo

### Rotas cobertas

- `/painel`
- `/buscar`
- `/beneficio/:id`
- `/perfil`
- `/onboarding`
- `/onboarding?mode=edit`

### Mockups de referencia

| Area | Fonte visual principal |
| --- | --- |
| Shell e navegacao | `Tela 04 - Painel.dc.html`, `Busca.dc.html`, `Tela 11 - Perfil.dc.html` |
| Painel populado | `Tela 04 - Painel.dc.html`, `Tela 07 - Radar montado.dc.html` |
| Painel vazio | `Tela 10 - Painel vazio.dc.html` |
| Busca | `Busca.dc.html` |
| Detalhe | `Tela 05 - Detalhe.dc.html` |
| Perfil | `Tela 11 - Perfil.dc.html` |
| Onboarding | `Tela 01 - Boas-vindas.dc.html`, `Tela 02 - Como descobrir.dc.html`, `Tela 06 - Wizard manual.dc.html`, `Onboarding.dc.html` |

Quando houver diferenca entre um mockup isolado e o consolidado, prevalece o
mockup isolado da tela para estrutura e o consolidado para continuidade do fluxo.
Os dados exibidos sempre vem dos hooks reais; fixtures dos mockups nao entram no
bundle de producao.

## Fora de escopo

- Admin (`/admin/*`).
- OAuth, leitura ou varredura do Gmail.
- Tela e rota de Alertas.
- Backend novo, schema, migration, RPC ou Edge Function.
- Mudanca na taxonomia do catalogo.
- Substituicao do design system existente.
- Testes de regressao visual por comparacao rigida de pixels.

## Arquitetura

A implementacao sera incremental, na ordem:

1. Shell compartilhado.
2. Painel.
3. Busca.
4. Detalhe.
5. Perfil.
6. Onboarding.

Cada fatia fecha comportamento, testes de componente, build e gate visual antes
da proxima. As mudancas permanecem nas feature-folders atuais. CSS compartilhado
de shell fica em `src/ui/layout.css`; estilos particulares ficam junto da feature.

O HTML dos `.dc.html` nao sera portado literalmente. Os componentes de producao
continuam usando `Button`, `Input`, `Alert`, `Skeleton`, `Pass`, `HeroRadar`,
`Checklist`, chips e tokens existentes em `src/ui` e `src/ui/ds.css`.

Um componente compartilhado novo so sera criado quando pelo menos duas telas
precisarem do mesmo contrato e comportamento. Variacoes meramente visuais usam
classes e composicao, sem criar wrappers sem responsabilidade propria.

## Shell responsivo

`AppLayout` continua sendo o dono do shell do app autenticado.

### Mobile

- Base mobile-first em coluna unica.
- Bottom nav fixa com `Painel`, `Buscar` e `Perfil`.
- Conteudo respeita safe areas e reserva espaco para a navegacao.
- Nenhum controle ou CTA pode ficar escondido pela bottom nav.

### Desktop

- Sidebar persistente com marca, os mesmos tres destinos e controle de tema.
- Bottom nav oculta.
- Area principal centralizada, com largura adequada a cada tela.
- A expansao desktop e aditiva sobre a composicao mobile.

### Tema

- Todos os fundos, bordas, textos, estados e categorias usam tokens.
- Claro e escuro mantem contraste e hierarquia equivalentes.
- Nao entram cores de superficie hardcoded nem gradientes decorativos novos.

## Painel

O Painel combina os estados de `Tela 04`, `Tela 07` e `Tela 10`.

### Conteudo

- Eyebrow do radar.
- `HeroRadar` com contagem real.
- Filtros por categoria.
- Lista de passes usando `BenefitCard`/`Pass` existentes.

### Estados

- **Loading:** skeletons com geometria estavel para hero, filtros e passes.
- **Erro:** mensagem contextual e botao `Tentar novamente`, ligado ao `refetch`.
- **Radar vazio:** composicao dedicada, CTA para adicionar programas e acao Gmail
  visivel como `Em breve` e desabilitada.
- **Populado:** hero, categorias e passes reais.
- **Filtro vazio:** mensagem de nenhuma correspondencia e acao para limpar filtro;
  nao reutiliza a copy do radar totalmente vazio.

## Busca

A Busca segue `Busca.dc.html` e continua client-side sobre `useMyBenefits`.

- Busca ao vivo por titulo, programa e descricao.
- Campo de busca com label acessivel e acao de limpar quando preenchido.
- Chips de categoria compartilhados com o Painel.
- Resultado usa o mesmo `BenefitCard`.
- Loading, erro recuperavel, catalogo vazio e nenhuma correspondencia possuem
  composicoes e copies distintas.
- O resumo de resultados informa a quantidade quando existe filtro ativo.

## Detalhe do beneficio

O Detalhe segue `Tela 05 - Detalhe.dc.html` sem perder a transparencia adicionada
no M8a.

- Navegacao de volta.
- Categoria, titulo, programas de origem e resumo.
- Aviso de elegibilidade.
- Checklist `Como usar` quando houver passos.
- CTA externo somente para URL HTTP/HTTPS valida.
- Fonte oficial, data de coleta e beneficios relacionados pela mesma fonte.
- Loading com skeleton; erro com retry; inexistente com retorno ao Painel.
- Conteudo longo quebra linha sem overflow e CTAs permanecem alcançaveis.

## Perfil

O Perfil segue `Tela 11 - Perfil.dc.html`.

- Cabecalho e identidade da conta.
- Estado de visitante ou conta vinculada.
- Vinculo por e-mail com estados inicial, enviando, enviado e erro.
- Erro preserva o e-mail digitado.
- Grupo `Seus programas` leva a `/onboarding?mode=edit`.
- Grupo de preferencias contem o controle de tema.
- A pagina usa secoes e rows; nao transforma cada bloco em um card independente.

## Onboarding

O onboarding vira um fluxo interno explicito:

`Boas-vindas -> Como descobrir -> Wizard manual -> Transicao -> Painel`

### Entrada nova

`/onboarding` inicia em Boas-vindas. O CTA principal avanca para a escolha do
metodo.

### Escolha do metodo

- Caminho manual avanca para o wizard real.
- Gmail permanece visivel para fidelidade de composicao.
- A acao Gmail usa estado `Em breve`, `aria-disabled`/`disabled` adequado e nao
  navega.

### Edicao

`/onboarding?mode=edit` pula Boas-vindas e escolha do metodo e abre o wizard
preenchido. O modo e explicito na URL para sobreviver a reload e nao ser inferido
da quantidade de selecoes.

### Wizard manual

- Mantem agrupamento por `source_category`.
- Mantem gate obrigatorio `Tenho`/`Nao tenho`.
- Mantem busca de programas, selecao de variantes e captura de `Outro`.
- `Nao tenho` continua removendo selecoes da categoria.
- Voltar preserva gates e selecoes.
- Falha ao salvar mantem etapa, gates e selecoes para nova tentativa.
- Sucesso mostra a transicao e navega para `/painel`.

### Estados de dados

- Loading inicial possui composicao propria, sem texto solto no viewport.
- Erro de fontes ou selecoes existentes oferece retry.
- Catalogo sem grupos apresenta estado indisponivel sem permitir concluir um fluxo
  vazio por acidente.

## Fluxo de dados

- Painel e Busca consomem `useMyBenefits`.
- Detalhe consome `useBenefit`.
- Perfil consome sessao, `useLinkEmail` e tema.
- Onboarding consome `useSources`, `useUserSources`, `selectionReducer`,
  `useSaveUserSources` e `useSaveSourceRequest`.
- Queries expõem `refetch` aos estados de erro.
- Mutations existentes continuam sendo a unica via de escrita.
- Nenhum fixture visual altera os dados de producao.

## Acessibilidade

- Uma hierarquia de headings coerente por pagina.
- Navegacoes com nome acessivel e estado ativo.
- Controles apenas visuais recebem label ou texto acessivel.
- Foco visivel em links, botoes, chips e inputs.
- Estado Gmail `Em breve` nao e anunciado como acao disponivel.
- Erros e confirmacoes de mutation sao perceptiveis por texto, nao apenas por cor.
- Areas clicaveis preservam tamanho confortavel no mobile.

## Estrategia de testes

### Componentes

Vitest e Testing Library cobrem, por fatia:

- renderizacao semântica principal;
- loading, erro, vazio e conteudo;
- retries;
- filtros e busca;
- navegacao para detalhe e edicao;
- estados do vinculo de e-mail;
- fluxo do onboarding, Gmail `Em breve`, modo edit e preservacao apos falha.

Hooks de dados permanecem mockados nos testes de tela. Testes de integracao atuais
continuam cobrindo RLS, catalogo e mutations.

### Regressao

- Teste focado durante cada fatia.
- `npm test` ao fechar cada fatia.
- `npm run build` ao fechar cada fatia.
- Suite completa e build novamente no gate final.

### Gate visual

Playwright dirige um navegador real e captura evidencias para:

- mobile `390 x 844` claro;
- mobile `390 x 844` escuro;
- desktop `1440 x 900` claro;
- desktop `1440 x 900` escuro.

O gate verifica:

- ausencia de overflow horizontal;
- bottom nav somente no mobile;
- sidebar somente no desktop;
- conteudo nao oculto por navegacao fixa;
- controles e textos sem clipping;
- tema aplicado a toda a tela;
- estados principais navegaveis;
- screenshots comparadas de forma assistida aos `.dc.html`.

Nao havera baseline de pixel perfeito nesta frente. As assercoes automatizadas
cobrem geometria e comportamento; a fidelidade visual e revisada pelas capturas.

## Criterios de aceite

1. Painel, Busca, Detalhe, Perfil, shell e fluxo de onboarding reproduzem a
   estrutura e a hierarquia dos mockups de referencia usando dados reais.
2. Todas as rotas existentes continuam funcionando e o modo de edicao usa
   `/onboarding?mode=edit`.
3. Gmail aparece como `Em breve` e nao dispara navegacao ou escrita.
4. Loading, erro, vazio e conteudo estao completos nas telas aplicaveis.
5. Nao ha mudanca de backend, schema, migration, RPC ou contrato Supabase.
6. Mobile, desktop, claro e escuro passam no gate visual sem overflow ou clipping.
7. Testes existentes e novos passam; TypeScript e build de producao passam.

## Sequencia posterior

Depois desta frente, o trabalho segue em specs independentes:

1. Alinhamento visual e responsivo do admin.
2. Descoberta real por Gmail.
3. Alertas.
