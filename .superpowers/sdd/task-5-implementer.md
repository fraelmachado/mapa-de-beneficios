# Tarefa 5 - perfil e modo de edicao

## Status

Implementada no worktree `app-layout-alignment`.

## Alteracoes

- O perfil agora separa identidade, garantia de acesso, programas e preferencias em secoes semanticas.
- O link de programas aponta para `/onboarding?mode=edit`.
- A falha no envio do e-mail fica no estado local do formulario, preservando o valor digitado e exibindo mensagem em pt-BR.
- O botao de envio fica desabilitado e passa a se chamar `Enviando...` durante a solicitacao pendente.
- O controle de tema usa um elemento `button` nativo; os estilos foram extraidos para `perfil.css` e usam somente tokens existentes.

## TDD

### RED

Depois de atualizar os cenarios de Perfil, `npm test -- Perfil` falhou como esperado:

- o link ainda era `Editar minhas fontes` com destino `/onboarding`;
- a rejeicao do envio nao exibia a mensagem de erro;
- o botao pendente ainda mantinha o rotulo `Salvar meu acesso`.

Resultado: 3 falhas e 2 testes aprovados, com codigo de saida 1.

### GREEN

Com a implementacao minima, `npm test -- Perfil` passou:

```text
Test Files  1 passed (1)
Tests       5 passed (5)
```

## Verificacao

- `npm test`: 67 arquivos e 197 testes aprovados.
- `npm run build`: aprovado; permanece somente o aviso preexistente do Vite sobre chunk JavaScript acima de 500 kB.
- `git diff --check`: sem problemas antes do commit.

## Self-review

- O estado local de erro evita depender da atualizacao assincrona de `link.isError`, preservando o e-mail depois da rejeicao.
- As interacoes permanecem acessiveis: o campo tem label, a confirmacao usa `role="status"`, os icones decorativos ficam em `aria-hidden` e o tema e um botao focavel nativo.
- Nao foram alterados hooks, dados, tokens nem arquivos fora do escopo da tarefa.

## Observacao

Esta tarefa produz a URL explicita de edicao definida no brief. A interpretacao do parametro pelo onboarding nao pertence aos arquivos autorizados desta tarefa.
