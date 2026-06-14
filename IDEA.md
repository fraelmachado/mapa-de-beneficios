# Benefy — App Agregador de Benefícios

## 💡 A Ideia

Um aplicativo que reúne **todos os benefícios** que você já tem — pelo plano do
celular, pelo e-mail, pelo cartão de crédito, pelo CPF ou por cadastros em
plataformas — e os centraliza na palma da mão.

É um **buscador de benefícios**: o usuário declara os serviços que possui e o app
cruza essas informações com uma base de regras para listar tudo a que ele tem
direito.

**A dor que resolve:** muita gente paga por assistência de viagem, seguro de tela
de celular ou assinatura de streaming sem saber que já tinha direito de graça pelo
cartão de crédito, pelo plano de internet ou pelo CPF. É um mercado gigante e
inexplorado.

---

## 1. Fluxo do Usuário

### Cadastro Simplificado
O usuário baixa o app e faz o login.

### A "Varredura" (Onboarding)
O app pede para selecionar/conectar os serviços que possui:

- **Cartão:** banco e bandeira (ex.: Itaú Visa Infinite)
- **Celular:** operadora e plano (ex.: Vivo Pós)
- **Fidelidade:** programas que participa (ex.: Livelo, Mercado Livre Nível 6)

### Dashboard de Benefícios
Centraliza tudo em categorias:

- **Viagem:** salas VIP disponíveis, seguros de viagem ativos
- **Streaming/Lazer:** assinaturas de vídeo ou música inclusas
- **Descontos:** farmácias, cinemas e lojas parceiras ligadas ao CPF ou cartões

### Notificações Inteligentes (o grande diferencial)
Se o usuário estiver perto de um aeroporto, o app avisa:
> "Você tem 2 acessos gratuitos à Sala VIP com o seu cartão X."

---

## 2. Desafio Técnico — Como o App Busca os Dados

Fazer uma varredura automática direto nos sistemas dos bancos e operadoras apenas
com CPF ou e-mail é inviável por questões de segurança e privacidade (LGPD).

Por isso, o MVP adota um **modelo declarativo combinado com inteligência**:

- **Banco de dados próprio (mapeamento):** o app é alimentado com as regras do
  mercado. Se o usuário marca que tem o "C6 Carbon Mastercard Black", o app já puxa
  automaticamente todos os benefícios daquela bandeira e banco.
- **Leitura de e-mail (opcional e avançado):** com permissão do usuário, o app pode
  buscar palavras-chave como "parabéns pelo seu novo plano", "sua fatura" ou
  "pontos acumulados" para sugerir benefícios automaticamente.

---

## 3. Modelos de Monetização

- **Freemium:** gratuito para listar benefícios básicos; alertas em tempo real e
  avisos de vencimento de pontos na versão Premium (paga).
- **Links de afiliados:** ao avisar sobre um desconto (ex.: 10% na Netshoes pelo
  cartão), o app gera o link de compra e ganha comissão pela venda.
- **Upgrade de cartões/planos:** analisa o perfil e sugere trocas ("troque o cartão
  X pelo Y e ganhe 4 benefícios que você usa muito"). O banco paga pela indicação.

---

## 4. Fluxo de Telas (Wireframe do MVP)

### 📱 Tela 1 — Boas-Vindas & Onboarding
Explicar o valor em segundos e passar segurança (privacidade).

- **Topo:** logotipo discreto + frase de impacto: *"Descubra os benefícios que você
  já tem, mas não sabe."*
- **Centro:** carrossel de 3 telas:
  - *"Economize:* não pague por seguros ou assistências que seus cartões já cobrem."
  - *"Lazer & Viagens:* acesse salas VIP, streamings e descontos no cinema."
  - *"Segurança total:* seus dados protegidos de acordo com a LGPD."
- **Base:** botão **[ Começar Varredura ]** ou **[ Criar Minha Conta ]**

### 📱 Tela 2 — Varredura / Conexão (a "Mágica")
Onde o usuário insere as informações para o app mapear seu consumo.

- **Topo:** *"O que você utiliza no dia a dia?"*
- **Bloco 1 — Cartões e Bancos:** grid com logos (Itaú, Bradesco, Nubank, C6…). Ao
  clicar, abre menu rápido: *"Qual a variante? (Gold, Platinum, Black/Infinite)"*
- **Bloco 2 — Operadora:** botões [Vivo] [Claro] [TIM] + *"Qual seu plano?
  (Controle, Pós, Fibra)"*
- **Bloco 3 — CPF & Fidelidade:** campo de CPF (convênios e Nota Fiscal
  Paulista/Gaúcha) + checkboxes: Livelo, Esfera, Mercado Livre (Meli+)
- **Base:** botão **[ Gerar Meu Painel de Benefícios ]**

### 📱 Tela 3 — Início / Dashboard (a "Palma da Mão")
A tela mais importante — organiza a bagunça e mostra o valor real imediatamente.

- **Topo:** saudação personalizada: *"Olá, Alan. Você tem 24 benefícios ativos
  hoje."*
- **Destaque do Dia (card grande):**
  > 💡 Você sabia? Seu cartão Visa Platinum oferece proteção de preço e seguro para
  > eletrônicos que você comprou nos últimos 30 dias.
- **Categorias (ícones estilo stories):** ✈️ Viagem | 🎬 Entretenimento | 💊
  Saúde/Farmácia | 🛡️ Seguros | 🛍️ Compras
- **Feed de benefícios recentes/populares:**
  - **Claro Pass** — direito a 1 assinatura de streaming (Max ou Disney+)
  - **Itaú** — 50% de desconto no cinema (Cinemark)
  - **Mastercard Black** — acesso gratuito à Sala VIP de Guarulhos

### 📱 Tela 4 — Detalhes do Benefício (o "Como Usar")
Direto e prático.

- **Topo:** botão voltar + nome do benefício (ex.: Seguro Viagem Gratuito)
- **Origem:** selo de procedência — *"Através do seu cartão C6 Carbon"*
- **O que inclui:**
  - ✔️ Cobertura médica internacional de até $150.000
  - ✔️ Seguro para perda ou extravio de bagagem
  - ✔️ Válido para titular, cônjuge e filhos
- **Passo a passo:**
  1. Clique no botão abaixo para emitir a apólice antes de viajar.
  2. Apresente o bilhete se necessário.
- **Base:** botão **[ Resgatar Benefício / Emitir ]** (direciona ao link oficial)

### 📱 Tela 5 — Busca & Alertas (o Buscador)
Para quando o usuário está na rua ou prestes a comprar algo.

- **Topo:** barra de pesquisa gigante: *"Digite uma loja, produto ou aeroporto…"*
- **Resultados rápidos enquanto digita:** ex. "Farmácia" →  *"Você tem 20% na
  Drogasil pelo seu CPF e 15% na Droga Raia pelo cartão X."*
- **Seção "Próximos a Você" (geolocalização opcional):** *"Você está no Shopping X.
  Seu cartão dá direito a estacionamento gratuito por 2 horas."*

---

## 5. Conceito Visual do Dashboard

Estilo **Premium e Transparente** — transmite confiança e mostra o valor real em
segundos.

- **Cabeçalho personalizado:** nome do usuário + total de benefícios detectados
  (efeito "uau" imediato)
- **Cartão de destaque (💡):** notificação inteligente sobre benefício de alto valor
- **Barra de categorias:** ícones limpos e coloridos para filtrar
- **Feed de benefícios:** cards que consolidam fontes diferentes (operadora, banco,
  bandeira, CPF/cadastro)
- **Navegação inferior:** Painel · Buscar · Meu Perfil · Avisos

**Paleta:** tons de azul suave e branco para profissionalismo e segurança, com
cores de destaque (teal ou dourado) nos benefícios. Aposta em leitura fácil e
navegação simples.

---

## 6. O "Coração" do App — Lógica de Cruzamento de Dados

A tabela que cruza a entrada do usuário com os benefícios reais. Exemplos:

| Entrada do Usuário        | Benefícios que o App Dispara                                                  |
| ------------------------- | ----------------------------------------------------------------------------- |
| Cartão = Visa Platinum    | Seguro Emergência Médica Internacional, Proteção de Preço, Compra Protegida, Vai de Visa |
| Operadora = Claro Pós     | Passaporte América (roaming), desconto no Claro Clube, streamings inclusos     |

---

## 7. Onboarding Detalhado (Modelo de Cadastro / Varredura)

A parte mais crítica: convencer o usuário a fornecer informações sem que o processo
pareça chato ou inseguro. Dividido em **3 passos rápidos** com progresso visual.

### Passo 1 — Bancos e Cartões (maior gerador de benefícios)
- **Pergunta:** *"Quais cartões ou bancos você utiliza?"*
- **Interface:** grid de logos (Itaú, Nubank, Bradesco, Santander, C6, Inter, Caixa,
  Banco do Brasil)
- **Desdobramento:** ao tocar num banco, abre menu da variante:
  - [ ] Internacional / Gold
  - [ ] Platinum / Signature
  - [ ] Black / Infinite / Pão de Açúcar
- **Nota de privacidade:** *"Não pedimos sua senha ou número do cartão. Apenas a
  variante para mapear seus direitos."*

### Passo 2 — Operadora de Telefonia e Internet
- **Pergunta:** *"Qual é a sua operadora de celular ou internet residencial?"*
- **Interface:** botões grandes (Vivo, Claro, TIM)
- **Tipo de plano:**
  - [ ] Pré-pago
  - [ ] Controle
  - [ ] Pós-pago (Individual ou Familiar)
  - [ ] Internet Banda Larga/Fibra

### Passo 3 — Programas de Fidelidade e CPF
- **Pergunta:** *"Você participa de algum destes programas?"*
- **Checkboxes:** Livelo · Esfera (Santander) · Meli+ (Mercado Livre/Pago) · Km de
  Vantagens / Premmia
- **Campo opcional (Buscador de CPF):** *"Deseja incluir seu CPF para buscarmos
  convênios automáticos (descontos em farmácias e sindicatos)?"*

### Tela de Transição — "Fazendo a Varredura…"
Tela de carregamento com animação para dar sensação de trabalho.

- **Texto:** *"Cruzando seus dados com nossa base de benefícios…"*
- **Animação:** gráfico de radar ou linhas brilhantes passando pelos logos
- **Gatilho psicológico (mensagens durante o carregamento de ~3-4s):**
  - "Verificando seguros de viagem ocultos…"
  - "Buscando acessos a Salas VIP disponíveis…"
  - "Mapeando descontos em cinemas e farmácias…"

Ao terminar, abre o Dashboard já mostrando o total de benefícios encontrados.

---

## 8. Nome e Identidade

| Nome                    | Ideia transmitida                                                        |
| ----------------------- | ------------------------------------------------------------------------ |
| **Benefy**              | Curto, moderno e direto: benefícios de forma simples.                    |
| **Meu Benefício**       | Nome claro, popular e fácil de entender.                                 |
| **Benefícios Já**       | Passa ideia de descoberta rápida e prática.                              |
| **Vantagens Ocultas**   | Destaca o conceito de benefícios que o usuário talvez nem saiba que tem. |
| **Clube de Benefícios** | Dá sensação de acesso a vantagens reunidas em um só lugar.               |
| **Descubra Vantagens**  | Focado na jornada do questionário.                                       |
| **Mapa de Benefícios**  | Sugere que o app guia o usuário até os benefícios certos.                |
| **Radar de Vantagens**  | Nome forte para um app que identifica oportunidades.                     |
| **Benefícios na Mão**   | Popular, simples e com sensação de praticidade.                          |
| **Vantajou**            | Nome criativo e "de marca", com tom digital.                             |

**Seleção mais forte:**

- **Benefy** — melhor para marca moderna e escalável ✅
- **Radar de Vantagens** — melhor para explicar o produto rapidamente
- **Benefícios na Mão** — melhor para comunicação popular e direta
- **Vantagens Ocultas** — melhor para despertar curiosidade

---

## 9. Stack & Próximos Passos

### Ferramentas de Desenvolvimento
- **FlutterFlow** (recomendado para começar) — No-Code/Low-Code, gera o app pronto
  para Android e iOS arrastando componentes.
- **Desenvolvimento tradicional** — banco em Firebase ou Supabase + frontend em
  React Native ou Flutter.

### Próximos Passos
1. **Montar a Matriz de Benefícios:** escolher 3-4 grandes bancos/operadoras e listar
   exatamente quais benefícios o app dispara para cada seleção.
2. **Cadastrar os primeiros benefícios reais** na base para testar o app.
3. **Definir paleta de cores e identidade visual** final.
