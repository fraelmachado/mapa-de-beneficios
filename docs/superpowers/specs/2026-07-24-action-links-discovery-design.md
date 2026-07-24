# Links de ação confiáveis no catálogo

**Data:** 2026-07-24  
**Status:** aprovado para planejamento

## Objetivo

Corrigir de forma durável o CTA “Ver rede” do benefício “Rede de hospitais e clínicas Amil” e permitir que o Discovery sugira links diretos de ação para novos benefícios, mantendo a publicação sob aprovação explícita de um administrador.

## Escopo

Esta entrega:

- troca o link da rede Amil pelo destino direto oficial;
- corrige tanto instalações futuras, por meio do seed, quanto o catálogo já existente, por meio de migration;
- adiciona `action_url` e `action_label` opcionais ao contrato do Discovery;
- mostra a sugestão de CTA na revisão administrativa;
- transporta o CTA aprovado ao catálogo;
- valida a combinação de URL e rótulo no Discovery e no formulário administrativo;
- preserva a proteção da tela pública contra esquemas de URL perigosos;
- adiciona testes de regressão para todo o fluxo.

Esta entrega não cria monitoramento periódico de disponibilidade, redirects ou expiração de links. Esse monitoramento exigiria um job externo e regras próprias para sites que bloqueiam robôs ou respondem de maneira diferente por região.

## Regras de negócio

1. A URL canônica do benefício `amil-rede-hospitais` será:
   `https://www.amil.com.br/institucional/#/servicos/saude/rede-credenciada/amil/busca-avancada`.
2. O rótulo continuará sendo `Ver rede`.
3. Um CTA é opcional, mas seus dois campos formam um par:
   - ambos ausentes: válido;
   - `action_url` e `action_label` presentes e não vazios: válido;
   - somente um dos campos presente: inválido.
4. `action_url` deve ser uma URL absoluta com protocolo `http:` ou `https:`.
5. Espaços externos são removidos antes do salvamento.
6. A aprovação de um candidato com CTA grava o par no benefício.
7. A aprovação de um candidato sem CTA não apaga um CTA existente.
8. Quando um candidato de atualização contém um CTA diferente, a aprovação explícita substitui o par existente. A tela de revisão deve mostrar o destino proposto antes dessa ação.
9. Benefícios novos promovidos pelo Discovery continuam inativos até a ativação administrativa já prevista no fluxo atual.

## Arquitetura e fluxo de dados

### Correção da Amil

O seed passa a conter o deep link oficial. Uma nova migration atualiza por `slug = 'amil-rede-hospitais'` o `action_url` e o `action_label` do registro existente. A migration é idempotente e não depende do UUID gerado em cada ambiente.

### Discovery

O nó de benefício no schema de candidatos recebe `action_url` e `action_label` opcionais, com refinamento para validar o par e limitar o protocolo. O JSON Schema usado pelo agente é atualizado com as mesmas propriedades e instruções.

`flattenTree` transporta os campos para `discovery_candidates.payload`. A proveniência oficial continua em `provenance.source_url`; o CTA proposto é um dado publicável, não uma substituição da fonte usada para verificá-lo.

Na árvore de revisão, benefícios com CTA mostram:

- rótulo sugerido;
- hostname e URL clicável;
- indicação visual de que esse é o destino do botão público.

A função `promote_discovery_candidate` lê o par do payload. Para candidatos novos, insere os campos. Em conflito por slug:

- usa os valores aprovados quando o candidato contém os dois campos;
- mantém os valores atuais quando o candidato não contém CTA;
- continua atualizando os demais campos já previstos pelo fluxo.

### Administração manual

O formulário de benefícios usa entrada semântica de URL e valida o mesmo contrato de par antes de chamar a mutation. Mensagens de erro ficam associadas aos campos e o formulário não é enviado com protocolo inseguro ou par incompleto.

A mutation continua protegida pela RLS administrativa existente. Não haverá alteração de permissões.

### Tela pública

`BenefitDetail` continua tratando `action_url` como dado não confiável e só renderiza o link quando `safeHttpUrl` aceitar `http:` ou `https:`. O destino é usado diretamente, sem resolução ou busca no momento do clique.

## Tratamento de erros

- Saída inválida do Discovery falha na validação já existente e passa pelo retry normal do job.
- URL sem protocolo, com protocolo diferente de HTTP(S), vazia ou sem rótulo é rejeitada.
- No Admin, a validação ocorre antes da mutation e mantém os dados digitados para correção.
- A migration da Amil identifica o benefício por slug; se o registro não existir, não cria um benefício parcial.
- Ausência de CTA permanece um estado válido e não exibe botão na tela pública.

## Testes

### Unitários

- schema do Discovery aceita CTA completo e ausência de CTA;
- schema rejeita par incompleto e protocolo inseguro;
- `flattenTree` preserva URL e rótulo;
- formulário administrativo aceita par válido e bloqueia combinações inválidas;
- detalhe público usa o deep link e continua ocultando URL perigosa;
- teste de contrato do seed fixa o destino canônico da Amil.

### Integração

- promoção de benefício novo grava o CTA;
- promoção de atualização com CTA substitui o par existente;
- promoção sem CTA preserva o par existente;
- migration atualiza o benefício da Amil por slug.

### Verificação geral

- testes focados em cada ciclo TDD;
- suíte completa;
- checagem de tipos;
- build de produção.

## Critérios de aceite

1. “Ver rede” abre diretamente a busca avançada da rede credenciada Amil.
2. Reaplicar o seed não reverte o link.
3. Aplicar migrations corrige catálogos existentes.
4. O Discovery consegue sugerir um CTA completo, mas não o publica sem aprovação administrativa.
5. O administrador vê o destino sugerido antes de aprová-lo.
6. CTA incompleto ou com protocolo inseguro não pode ser persistido pelos fluxos de Discovery ou Admin.
7. Aprovar candidato sem CTA não remove um link existente.
8. Todos os testes, a checagem de tipos e o build passam.

