# Tarefa 4 - correcao do padding inferior no detalhe

## Achado corrigido

`BenefitDetail` usa `.detail-page` diretamente, sem a classe `.app-page`.
No mobile, o padding inferior era `var(--s10)` (`40px`), menor que o
contrato de `112px` do layout e sem considerar `env(safe-area-inset-bottom)`.
O padding mobile agora e `calc(112px + env(safe-area-inset-bottom))`,
preservando espaco para a bottom nav fixa e para a safe area. O override de
desktop continua usando `var(--s8)`.

## TDD

### RED

Foi criado `src/features/detalhe/benefit-detail.test.ts` para verificar o
contrato mobile e o override desktop. Antes da alteracao no CSS:

```text
npx vitest run src/features/detalhe/benefit-detail.test.ts
1 teste falhou: expected ... to contain 'padding: var(--s5) var(--s4) calc(112px + env(safe-area-inset-bottom))'
1 teste passou
exit_code=1
```

### GREEN

Depois da alteracao minima em `benefit-detail.css`, o teste focado e os testes
existentes do detalhe passaram:

```text
npx vitest run src/features/detalhe/benefit-detail.test.ts src/features/detalhe/BenefitDetail.test.tsx
Test Files  2 passed (2)
Tests       12 passed (12)
exit_code=0
```

## Verificacao

### `npm test -- BenefitDetail`

```text
✓ src/features/detalhe/BenefitDetail.test.tsx (10 tests)
Test Files  1 passed (1)
Tests       10 passed (10)
exit_code=0
```

### `npm run build`

```text
✓ 200 modules transformed.
✓ built in 857ms
PWA v1.3.0
files generated
exit_code=0
```

O build emitiu o aviso preexistente sobre o chunk JavaScript acima de 500 kB
apos minificacao; nao houve falha.

### `git diff --check`

```text
exit_code=0
```

## Escopo

Alterados somente `src/features/detalhe/benefit-detail.css`,
`src/features/detalhe/benefit-detail.test.ts` e este relatorio.
