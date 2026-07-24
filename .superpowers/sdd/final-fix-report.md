# Onda final — action links / whole-branch review

## Status

Implementação concluída em TDD. Os quatro achados Important foram cobertos, o artefato acidental
`task-1-report.md` foi removido e os Minors baratos foram incorporados.

## Diagnóstico

- `Input` declarava e repassava uma lista fechada de props; `aria-describedby` e `aria-invalid`
  chegavam ao componente React, mas nunca ao `<input>` real.
- `BenefitForm` usava `noValidate` para permitir normalizar o CTA antes da validação de `type="url"`,
  porém não substituía a validação nativa de `required` para título e resumo.
- Discovery já exigia o formato textual canônico
  `^https?://[^\s/?#]+[^\s]*$`, enquanto Admin e detalhe verificavam somente o resultado de
  `new URL` e o protocolo normalizado pelo parser.
- `CandidateTree` transformava `payload.action_url` de JSONB diretamente em `href`.
- `promote_discovery_candidate` fazia apenas `btrim`; não exigia o par completo e não validava o
  formato textual antes do insert/upsert.

## RED

Baseline focado antes dos novos testes:

```bash
npm test -- src/features/admin/benefits/actionLink.test.ts \
  src/features/admin/benefits/BenefitForm.test.tsx \
  src/features/admin/discovery/CandidateTree.test.tsx \
  src/features/detalhe/BenefitDetail.test.tsx \
  scripts/discovery/candidatesSchema.test.ts \
  tests/discovery_promote.integration.test.ts
```

Resultado: `6 passed`, `57 passed`.

Após adicionar as regressões:

```bash
npm test -- src/features/admin/benefits/actionLink.test.ts \
  src/features/admin/benefits/BenefitForm.test.tsx \
  src/features/admin/discovery/CandidateTree.test.tsx \
  src/features/detalhe/BenefitDetail.test.tsx \
  tests/discovery_promote.integration.test.ts
```

Resultado esperado: `5 failed`, `22 failed | 31 passed`.

- Admin aceitou `http:foo`, `https:////host`, protocolo em maiúsculas e whitespace interno.
- Os dois campos de CTA não receberam os atributos ARIA.
- O formulário vazio chamou `onSubmit`.
- Preview e detalhe renderizaram URLs não canônicas.
- A RPC promoveu os sete payloads negativos em vez de retornar erro.

## GREEN

Implementação:

- `src/lib/actionLink.ts` concentra o pattern textual e a normalização HTTP(S), reutilizados por
  Discovery, Admin, preview e detalhe público.
- `Input` agora aceita atributos nativos de input e repassa o restante ao elemento real.
- `BenefitForm` mantém `noValidate` para a normalização do CTA e implementa validação explícita,
  associada e acessível de título/resumo.
- `CandidateTree` só exibe o preview depois da normalização segura; o hostname continua textual no link.
- A migration `0022` normaliza whitespace externo com POSIX, rejeita par parcial e exige o mesmo
  formato HTTP(S) textual antes de persistir. Auth, lock, idempotência, inatividade de novos benefícios
  e preservação de CTA existente quando o par está ausente continuam exercitados.

Comandos e resultados:

```bash
npm test -- src/features/admin/benefits/actionLink.test.ts \
  src/features/admin/benefits/BenefitForm.test.tsx \
  src/features/admin/discovery/CandidateTree.test.tsx \
  src/features/detalhe/BenefitDetail.test.tsx \
  scripts/discovery/candidatesSchema.test.ts
```

Resultado: `5 passed`, `64 passed`.

```bash
npx -y supabase@2.95.0 db reset
```

Resultado: migrations `0001`–`0023` e seed aplicados; reset concluído em `develop`.

```bash
npm test -- tests/discovery_promote.integration.test.ts
```

Resultado: `1 passed`, `14 passed`.

```bash
npm test -- src/features/admin/benefits/actionLink.test.ts \
  src/features/admin/benefits/BenefitForm.test.tsx \
  src/features/admin/benefits/AdminBenefits.test.tsx \
  src/features/admin/discovery/CandidateTree.test.tsx \
  src/features/detalhe/BenefitDetail.test.tsx \
  scripts/discovery/candidatesSchema.test.ts \
  scripts/discovery/flatten.test.ts \
  scripts/discovery/discover.test.ts \
  tests/discovery_promote.integration.test.ts
```

Resultado: `9 passed`, `95 passed`.

## Verificação geral

```bash
npm test
```

Resultado: `94 passed`, `383 passed`.

```bash
npm run build
```

Resultado: `tsc` e `vite build` concluídos; somente o aviso preexistente de chunk acima de 500 kB.

```bash
git diff --check
```

Resultado: sem saída.

Avisos observados e já existentes: múltiplas instâncias de `GoTrueClient` nos testes de integração e
um aviso de `act(...)` em `AdminBenefits.test.tsx`; nenhum causou falha.

## Arquivos

- Criado: `src/lib/actionLink.ts`.
- Modificados: contrato Discovery, `Input`, Admin `actionLink`/`BenefitForm`, `CandidateTree`,
  `BenefitDetail`, migration `0022` e respectivos testes focados/de integração.
- Removido: `.superpowers/sdd/task-1-report.md`.
- Criado: `.superpowers/sdd/final-fix-report.md`.

## Self-review

- O regex JS é uma única fonte para Discovery/Admin/UI; o equivalente SQL é case-sensitive, exige
  `http://` ou `https://`, authority não vazia e ausência de whitespace interno.
- A UI nunca recebe um `href` do CTA sem passar pela unidade segura.
- A RPC valida antes do insert/upsert e retorna SQLSTATE `22023`; falhas não deixam benefício parcial.
- O caso CTA totalmente ausente continua válido e preserva o CTA atual em conflito.
- Nenhuma dependência foi adicionada e não houve refatoração fora do fluxo de action links.

## Minor deferido: cobertura isolada da migration 0023

Não foi adicionado teste estático do texto SQL. A infraestrutura de integração expõe apenas clientes
Supabase e não possui executor arbitrário de SQL; isolar a `0023` exigiria acoplar o Vitest a `psql`/
Docker ou criar uma função de produção exclusivamente para o teste. Isso seria menos idiomático e mais
frágil que o reset real já executado. O comportamento final continua coberto pelo contrato do seed,
enquanto o reset comprova que a migration aplica sem erro. Uma cobertura realmente isolada deve ficar
para um harness de migrations com banco efêmero e suporte a aplicar versões-alvo.
