# Tarefa 4 - detalhe com loading, retry e composição do mockup

## Status

Implementada no worktree `app-layout-alignment`.

## Alterações

- O detalhe agora apresenta skeleton estável durante o carregamento.
- Erros de consulta usam `PageState` com ação `Tentar novamente`, delegando para o `refetch` retornado por `useBenefit`.
- Estados vazio e sucesso foram compostos com os componentes e tokens existentes, incluindo fonte oficial, data de coleta e benefícios relacionados.
- Os estilos da tela foram extraídos para `benefit-detail.css` e importados antes das diretivas Tailwind.

## TDD

- RED observado com os testes de loading e retry: faltavam o rótulo acessível e o botão de recuperação.
- GREEN: `npm test -- BenefitDetail` passou com 10 testes.

## Verificação

- `npm test`: 66 arquivos, 194 testes aprovados.
- `npm run build`: aprovado.
- `git diff --check`: sem problemas.

## Self-review

Não foram encontrados regressões no uso do hook, validação de URLs HTTP(S), transparência de fonte ou benefícios relacionados. O matcher do teste de loading usa `benefício` com acento para corresponder ao rótulo acessível em pt-BR.

## Observação

O build mantém o aviso já existente do Vite sobre o chunk JavaScript acima de 500 kB; não faz parte do escopo da tarefa.
