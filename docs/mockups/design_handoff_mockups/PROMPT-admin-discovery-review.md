# Prompt para o Claude Design — tela que falta: "Admin · Revisão do Discovery"

> Cole o bloco abaixo no Claude Design (projeto "Mapa de Benefícios"). Ele já tem o
> design system e todos os outros mockups, então mantém a consistência sozinho.
> Quando ele entregar o `.dc.html`, salve nesta mesma pasta
> (`docs/mockups/design_handoff_mockups/`) e me aponte o arquivo — eu implemento em TSX.

---

**Título da tela:** Admin · Revisão do Discovery (fila de curadoria)

**Contexto do produto:** "Mapa de Benefícios" — app React 18 + Vite, mobile-first
responsivo. Você já criou o design system e os mockups de todas as telas deste projeto
(Admin: login, home, Fontes e variantes, Benefícios; App: onboarding, painel, detalhe,
busca, perfil). **Falta UMA tela admin: a Revisão do Discovery.** Desenhe-a como um
`.dc.html` no mesmo formato dos outros mockups desta pasta, reaproveitando o mesmo
shell, tokens e componentes — mantendo consistência total com as telas admin existentes.

**O que a tela faz:** O catálogo é expandido por um agente de IA que pesquisa programas
de benefícios na web e propõe **candidatos** (fontes, variantes e benefícios) numa fila
de revisão. Esta tela é onde a curadora (admin) revisa esses candidatos e **aprova ou
rejeita cada um**; só o que ela aprova entra no catálogo real. A máquina nunca escreve no
catálogo sem aprovação humana.

**MOBILE-FIRST (regra central do produto):** desenhe a versão **mobile primeiro** — ela é
a fonte da verdade. A versão **desktop é a expansão responsiva da MESMA tela mobile**
(a coluna única cresce, a sidebar aparece, as ações reposicionam), **não** um design
desktop separado. Toda decisão de layout começa no mobile e depois se adapta pra cima.

**Consistência obrigatória (idêntica às telas admin já feitas — ver "Fontes e variantes"
e "Benefícios"):**
- **Mobile (padrão):** coluna única, navegação inferior (bottom nav), sem sidebar.
  Conteúdo começando com o eyebrow **"CATÁLOGO"** + `<h1>`.
- **Desktop (≥760px, expansão responsiva):** a mesma tela ganha a **sidebar** 256px à
  esquerda (logo no topo; itens **Painel · Fontes · Benefícios · Discovery**, com
  **Discovery ativo**; usuária no rodapé) + conteúdo à direita. A bottom nav some.
- Responsivo por `@container`, breakpoint **760px** — mobile abaixo, desktop acima.
- Use os componentes/classes do DS (`styles.css` + `_ds_bundle.js`): **Button**
  (primary/ghost), **Chip**, **Row**, **Input**, **Alert**. Tema claro/escuro via
  `[data-theme]`.

**Estrutura da tela (de cima pra baixo):**

1. **Header:** eyebrow "CATÁLOGO" + `<h1>` "Discovery" + subtítulo curto
   ("Revise os candidatos propostos pelo agente antes de entrarem no catálogo").

2. **Fila de jobs:** lista compacta de "jobs" (cada job = uma rodada de pesquisa sobre um
   alvo, ex.: "Wellhub") com chip de status (pendente / processando / concluído / erro).
   Um campo **"Novo job"** (Input + Button "Enfileirar"). Selecionar um job abre seus
   candidatos abaixo.

3. **Árvore de candidatos em CARDS ANINHADOS (a parte principal):**
   - Cada **fonte (source)** = um **card grande**. Cabeçalho: nome + chip de **categoria**
     colorido + chips de **estado** (novo / atualização / duplicado) + **verificação** +
     **procedência** (link para a fonte, ex.: wellhub.com). Ações: **Aprovar · Rejeitar**.
   - Dentro dela, as **variantes (source_item)** = **sub-cards** (fundo levemente distinto,
     recuados): label da variante (+ bandeira/nível quando for cartão). Ações Aprovar/Rejeitar.
   - Dentro da variante, os **benefícios** = **linhas (Row)**: título + chip de categoria +
     resumo de 1 linha + link de procedência. Ações Aprovar/Rejeitar.
   - **A hierarquia fonte → variante → benefício tem que ser VISUALMENTE ÓBVIA** por
     contenção (bordas, fundo, recuo). O problema #1 a resolver é: hoje "não dá pra
     distinguir o que é pai e o que é filho".
   - **Aprovação é granular, nó a nó.**
   - **Trava top-down:** o botão **Aprovar** de uma variante/benefício fica **desabilitado**
     enquanto o pai ainda não foi aprovado, com um micro-texto explicando
     ("aprove a fonte primeiro"). A árvore promove de cima pra baixo.
   - **Estados por nó:** *pendente* (mostra Aprovar/Rejeitar), *aprovado* (chip verde
     "aprovado", ações somem), *rejeitado* (nó esmaecido + chip "rejeitado").
   - **Ações responsivas:** no **mobile**, os botões Aprovar/Rejeitar ficam numa **linha
     própria abaixo** dos dados do nó; no **desktop**, ficam **à direita** (coluna de ações).

4. **Sem edição inline** nesta versão — só Aprovar/Rejeitar. (Editar campos fica pra depois.)

**Dados de exemplo (use estes — são reais do meu pipeline, deixam o mock fiel):**
- Job **"Wellhub"** (concluído). Duas fontes, categoria *multibenefícios corporativos*:
  - **Wellhub** (novo; verificação "oficial confirmado"; fonte wellhub.com) → variantes:
    "Wellhub para empresas", "Planos para colaboradores", "Gestão corporativa",
    "Desconto em folha" → benefícios como "Assinatura de bem-estar integral" (categoria
    *outro*), "Acesso a academias e estúdios" (*outro*), "Sem taxa de adesão ou
    cancelamento" (*serviço de conta*), "Plano Digital gratuito" (*outro*).
  - **Wellz by Wellhub** (novo) → variante "Saúde mental" → benefícios "Terapia online
    individual e em grupo" (*outro*), "Dashboard de saúde mental para o RH"
    (*serviço de conta*).
- Observação: **muitos benefícios têm categoria "outro"** — a tela precisa lidar bem com
  isso (não deixar feio nem vazio).

**Entrega:** um único arquivo **`.dc.html`** no mesmo formato/estrutura dos outros mockups
desta pasta (markup com estilos + uma classe de lógica JS inline com o estado dos
candidatos e os handlers de selecionar-job / aprovar / rejeitar), usando os mesmos caminhos
relativos `./support.js` e `./_ds/mapa-de-benef-cios-.../`. Precisa abrir no navegador
renderizado igual aos outros.
