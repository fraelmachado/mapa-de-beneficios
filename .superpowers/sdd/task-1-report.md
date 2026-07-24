# Task 1 — Contrato e transporte do CTA no Discovery

## Status

DONE.

## Implementação

- `BenefitNode` agora aceita o par opcional `action_url` e `action_label`.
- `action_url` é uma URL completa `http` ou `https`; `action_label` é texto não vazio após `trim`.
- A validação Zod exige que as duas propriedades sejam fornecidas juntas.
- O JSON Schema entregue ao agente inclui as duas propriedades e as regras condicionais equivalentes.
- `flattenTree` preserva o CTA no payload do candidato de benefício, usando `null` quando ausente.
- O prompt de descoberta instrui o agente a fornecer o par para destinos oficiais diretos e a preferir deep links à homepage.

## Arquivos

- Modificados: `scripts/discovery/candidatesSchema.ts`
- Modificados: `scripts/discovery/candidatesSchema.test.ts`
- Modificados: `scripts/discovery/flatten.ts`
- Modificados: `scripts/discovery/flatten.test.ts`
- Modificados: `scripts/discovery/discover.ts`
- Criado: `.superpowers/sdd/task-1-report.md`

## Evidência TDD

### RED — contrato

Comando:

```bash
npm test -- scripts/discovery/candidatesSchema.test.ts
```

Resultado antes da implementação: 5 falhas esperadas. CTAs incompletos, `javascript:` e `ftp:` eram aceitos porque os campos eram ignorados pelo schema; o JSON Schema não possuía `action_url`.

### GREEN — contrato

Comando:

```bash
npm test -- scripts/discovery/candidatesSchema.test.ts
```

Resultado: `1 passed`, `15 passed`.

### RED — transporte

Comando:

```bash
npm test -- scripts/discovery/flatten.test.ts
```

Resultado antes da implementação: 1 falha esperada. O payload do benefício não continha `action_url` nem `action_label`.

### GREEN — Discovery focado

Comando:

```bash
npm test -- scripts/discovery/candidatesSchema.test.ts scripts/discovery/flatten.test.ts scripts/discovery/discover.test.ts
```

Resultado: `3 passed`, `27 passed`.

## Verificação final

```bash
npm test
```

Resultado: `93 passed`, `337 passed`.

```bash
npm run build
```

Resultado: TypeScript e Vite concluíram com sucesso. O Vite emitiu somente o aviso já conhecido de bundle acima de 500 kB.

Também executado:

```bash
git diff --check
```

Resultado: sem problemas de whitespace.

## Self-review

- O contrato exige presença conjunta e valida o protocolo antes de qualquer transporte.
- O JSON Schema mantém o contrato equivalente para a saída estruturada do agente.
- O payload preserva o CTA sem alterar procedência, promoção, Admin ou UI.
- O prompt usa a redação e a posição solicitadas no brief.
- O diff está restrito aos cinco arquivos da tarefa e a este relatório.

## Preocupações

- Os testes de integração exibem avisos preexistentes de múltiplas instâncias `GoTrueClient`; não houve falhas.
- A suíte também exibe um aviso React `act(...)` em `AdminBenefits.test.tsx`, fora do escopo desta tarefa.
- O build avisa sobre um chunk acima de 500 kB; o build termina com sucesso e o aviso não foi introduzido por esta mudança.

## Fix após revisão

### RED

Comando:

```bash
npm test -- scripts/discovery/candidatesSchema.test.ts scripts/discovery/flatten.test.ts
```

Resultado: `1 failed | 1 passed`, com 3 falhas esperadas no schema: `https://` lançou `TypeError: Invalid URL`, e `http:foo` e `HTTPS://...` foram aceitos. O teste de flatten já comprovou que o parse normaliza os espaços antes de montar o payload.

### GREEN

Comando:

```bash
npm test -- scripts/discovery/candidatesSchema.test.ts scripts/discovery/flatten.test.ts scripts/discovery/discover.test.ts
```

Resultado: `3 passed`, `31 passed`. A saída mantém apenas os avisos preexistentes de múltiplas instâncias `GoTrueClient` nos testes de discovery.

### Arquivos

- Modificados: `scripts/discovery/candidatesSchema.ts`
- Modificados: `scripts/discovery/candidatesSchema.test.ts`
- Modificados: `scripts/discovery/flatten.test.ts`
- Modificado: `.superpowers/sdd/task-1-report.md`

### Self-review

- `action_url` é validada depois de `trim`, exige o prefixo literal minúsculo `http://` ou `https://` e só é aceita se `new URL` a analisar.
- A tentativa de analisar URL inválida está protegida por `try/catch`, portanto `safeParse` retorna falha em vez de lançar.
- Os casos `https://`, `http:foo` e protocolo maiúsculo cobrem a divergência entre Zod e o pattern `^https?://` do JSON Schema.
- O teste de flatten passa pela árvore parseada e confirma que URL e rótulo sem espaços são os valores transportados ao payload; não altera a persistência transacional da Task 3.
- `git diff --check` foi executado sem apontar problemas de whitespace.
