# Estado dos planos de implementação

Última auditoria: **2026-07-16**.

Este índice registra o estado consolidado dos planos. Os checklists dentro de cada
arquivo foram preservados como roteiro histórico de execução; eles não devem ser
interpretados isoladamente como o estado atual. O bloco **Status de execução** no
topo de cada plano e esta tabela são as referências de acompanhamento.

## Evidências da auditoria

- `main` local sincronizado com `origin/main` em `c57b56b` (0 commits à frente/atrás).
- Suíte local completa: **81 arquivos e 256 testes aprovados** em 2026-07-16.
- Build de produção aprovado (`tsc && vite build`) em 2026-07-16.
- Aplicação de produção respondeu **HTTP 200** em `https://mapadebeneficios.com.br/`.
- **Publicação resolvida:** o auto-deploy no push voltou a funcionar. O último
  commit que afeta o front — `776c9d2` (wizard Tela 06) — está publicado
  (`status: done`, `triggerType: push`, 2026-07-16 18:06 UTC). `c57b56b` (HEAD)
  altera apenas `seed.sql` (dados, já aplicados em prod via pg-meta), sem novo
  bundle. Logo o bundle no ar contém P4/Discovery e todas as frentes abaixo.
- **Não reauditado nesta rodada:** smoke funcional em browser (catálogo/wizard/admin
  renderizando) e o conteúdo dos dados em prod — a sonda REST anon não os enxerga
  por RLS (esperado). Os dados constam como aplicados via pg-meta nas mensagens de
  commit, sem reauditoria independente.

## Resumo

| Plano | Repositório | Operação/produção |
| --- | --- | --- |
| M1 - Fundação | Concluído | Validado localmente |
| M2 - Onboarding inicial | Concluído | Coberto pelo deploy do M5 |
| M3 - Painel | Concluído | Coberto pelo deploy do M5 |
| M4 - Perfil + PWA | Concluído | Coberto pelo deploy do M5 |
| M5 - Deploy Dokploy | Concluído | Infra ativa; auto-deploy no push funcionando; bundle atual no ar |
| M6a - Fundação admin | Concluído | Aplicação em produção não reauditada |
| M6b - Admin de fontes | Concluído | Aplicação em produção não reauditada |
| M6c - Admin de benefícios | Concluído | Aplicação em produção não reauditada |
| M7 - Catálogo real | Concluído | Migrações/seed em produção não reauditos nesta rodada |
| M8a - Fonte e transparência | Concluído | Migração/rebuild em produção não reauditos nesta rodada |
| P1 - Origem fonte-agnóstica | Concluído | Validado localmente |
| P2 - Reskin v3 | Concluído | Publicação atual não reauditada |
| P3 - Onboarding híbrido | Concluído | Publicação atual não reauditada |
| P3 - Refino visual | Concluído | Publicação atual não reauditada |
| P4 - Discovery | Concluído | No bundle publicado (776c9d2); fluxo admin não re-smoke-testado |
| Redesign de Discovery | Concluído | No bundle publicado (776c9d2); fluxo admin não re-smoke-testado |
| Alinhamento dos layouts do App | Concluído | No bundle publicado (776c9d2) |
| Fluxo do App: Gmail Prévia + Alertas | Concluído | No bundle publicado (776c9d2) |
| Alinhamento do fluxo Admin aos mockups | Concluído | No bundle publicado (776c9d2) |
| Paridade total com mockups + catálogo por tier | Concluído (só spec, sem plano) | Front no bundle (776c9d2); dados via pg-meta, não reauditados |

## Próximo gate

O gate anterior (reparar auto-deploy + publicar `main`) está **resolvido**: auto-deploy
voltou a disparar e o bundle atual está no ar. Restam dois passos, um operacional e um
de produto:

1. **Smoke funcional em produção** (opcional, para fechar `produção verificada`):
   drivar o app num browser e confirmar que catálogo, wizard por-marca e o fluxo
   admin/Discovery renderizam no ar — a única lacuna de verificação que sobra.
2. **Ingestão real — decidido (2026-07-18):** o escopo mock/cosmético acabou e o
   próximo marco é ler o Gmail de verdade. **Pluggy/Open Finance foi descartado do
   projeto.** Escopo travado: scan client-side one-shot com `gmail.readonly` (GIS no
   browser, sem backend), OAuth em modo Testing, detecção por marca, evidência
   (remetente/assunto/data) gravada por programa, scan anônimo com retenção de 30
   dias (pg_cron). Spec em
   `docs/superpowers/specs/2026-07-18-ingestao-gmail-real-design.md` (rev 3);
   plano em `docs/superpowers/plans/2026-07-18-ingestao-gmail-real.md` (14 tasks,
   pronto p/ execução).
