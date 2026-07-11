# Tarefa 3: busca recuperável completa

## Escopo entregue

- Ampliei a busca textual para incluir provedores em `origins` e entradas em `via`.
- Substituí a tela de busca pelos estados recuperáveis especificados: carregamento, erro com retry, catálogo vazio, filtros sem resultados, contagem e ações de limpar.
- Adicionei os estilos da busca e o import global antes das diretivas Tailwind.
- Preservei `useMyBenefits`, dados reais, mutações inexistentes neste fluxo, tokens existentes e textos em pt-BR.

## TDD

### RED

Com os novos testes de limpeza, contagem, retry e busca por provedor/via, `npm test -- Search filterBenefits` falhou como esperado:

- limpeza: botão `Limpar busca` inexistente;
- contagem: `1 resultado` inexistente;
- retry: botão `Tentar novamente` inexistente;
- haystack: `nubank` não encontrava o benefício por `origins`.

Resultado: 4 falhas, 7 testes passando.

### GREEN

Após a implementação, `npm test -- Search filterBenefits` passou:

- 2 arquivos de teste;
- 11 testes passando.

## Verificação final

- `npm test`: 66 arquivos, 192 testes passando.
- `npm run build`: passou (`tsc && vite build`).
- `git diff --check`: sem problemas de whitespace.
- Self-review: nenhum problema Critical ou Important encontrado no escopo da Tarefa 3.

## Observações

- A suíte continua emitindo o aviso preexistente de múltiplas instâncias GoTrueClient.
- O build continua emitindo o aviso preexistente de chunk JavaScript acima de 500 kB.
