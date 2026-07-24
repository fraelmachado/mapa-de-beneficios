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

## Segundo fix após revisão

### RED

Comando:

```bash
npm test -- scripts/discovery/candidatesSchema.test.ts
```

Resultado: `1 failed | 18 passed`. O novo teste que extrai o `pattern` de `action_url` do JSON Schema demonstrou que `https://` ainda era aceito pelo pattern `^https?://`.

### GREEN

Comandos:

```bash
npm test -- scripts/discovery/candidatesSchema.test.ts
npm test -- scripts/discovery/candidatesSchema.test.ts scripts/discovery/flatten.test.ts scripts/discovery/discover.test.ts
git diff --check
```

Resultados: schema `1 passed`, `19 passed`; suíte focada `3 passed`, `32 passed`; `git diff --check` sem problemas de whitespace. A suíte focada só exibiu os avisos preexistentes de múltiplas instâncias `GoTrueClient`.

### Alteração

- `action_url` agora usa `^https?://[^\\s/?#]+[^\\s]*$`: mantém apenas `http://` e `https://` minúsculos, requer authority não vazia e proíbe whitespace em toda a URL.
- `action_label` agora inclui o pattern `\\S`, exigindo ao menos um caractere não-whitespace além de `minLength`.
- O teste unitário extrai ambos os patterns de `candidatesJsonSchema`, cria `RegExp` e cobre URLs HTTP/HTTPS válidas, `https://`, URL com espaço e rótulo só de espaços.

## Terceiro fix após revisão

### RED

Comando:

```bash
npm test -- scripts/discovery/candidatesSchema.test.ts
```

Resultado: `1 failed | 19 passed`, com 6 falhas esperadas. O Zod aceitava `https:////unimed.coop.br/rede` e URLs com newline ou tab internos porque `new URL` as canonicaliza; o pattern do JSON Schema já as rejeitava.

### GREEN

Comando:

```bash
npm test -- scripts/discovery/candidatesSchema.test.ts scripts/discovery/flatten.test.ts scripts/discovery/discover.test.ts
```

Resultado: `3 passed`, `38 passed`. A saída mantém somente os avisos preexistentes de múltiplas instâncias `GoTrueClient` nos testes de discovery.

Também executado:

```bash
git diff --check
```

Resultado: sem problemas de whitespace.

### Alteração

- `ACTION_URL_PATTERN` é a única fonte do pattern `^https?://[^\\s/?#]+[^\\s]*$`: o Zod o aplica com `.regex(new RegExp(...))` antes de `new URL`, e o JSON Schema o expõe diretamente.
- A segunda validação com `new URL` continua protegida por `try/catch`; ela só é executada após a regra textual que exige prefixo minúsculo, authority não vazia e ausência de whitespace interno.
- `ACTION_LABEL_NON_WHITESPACE_PATTERN` também é reutilizado pelo Zod e JSON Schema para manter o rótulo não vazio em ambos os contratos.
- Os testes provam, para barra extra na authority, newline e tab internos, que tanto o parse Zod quanto o `RegExp` extraído do JSON Schema rejeitam a mesma entrada.
