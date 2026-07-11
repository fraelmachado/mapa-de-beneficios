# Tarefa 7 - sincronizacao de modo de edicao

## Achado corrigido

`OnboardingPage` inicializava `screen` a partir de `mode=edit` apenas na
montagem. A tela agora sincroniza `screen` quando o valor de `editing` muda:
`/onboarding?mode=edit` abre o wizard manual e `/onboarding` retorna para a
boas-vindas. As transicoes internas de boas-vindas para metodo e manual
permanecem controladas pelo estado local enquanto a URL nao muda.

## TDD

### RED

Foi adicionado um teste com `useNavigate` que parte de `/onboarding`, navega
para `/onboarding?mode=edit` e retorna para `/onboarding`.

```text
npm test -- src/features/onboarding/OnboardingPage.test.tsx
1 teste falhou: Unable to find an element with the text: Wizard manual real
```

O erro confirmou que a tela de boas-vindas continuava ativa apos a navegacao
client-side para o modo de edicao.

### GREEN

Depois da sincronizacao por `useEffect`, o teste focado passou com 3 de 3
testes aprovados, incluindo o fluxo existente intro -> metodo -> manual.

## Escopo

Alterados somente `OnboardingPage.tsx`, `OnboardingPage.test.tsx` e este
relatorio. A verificacao final de testes focados e build esta registrada abaixo.

## Verificacao

### Testes focados

```text
npm test -- OnboardingPage ManualWizard router
Test Files  3 passed (3)
Tests       12 passed (12)
exit_code=0
```

### Build

```text
npm run build
tsc && vite build
exit_code=0
```

O build manteve o aviso preexistente de chunk JavaScript acima de 500 kB apos
a minificacao; nao houve falha.
