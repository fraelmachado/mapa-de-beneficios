# Estado dos planos de implementação

Última auditoria: **2026-07-10**.

Este índice registra o estado consolidado dos planos. Os checklists dentro de cada
arquivo foram preservados como roteiro histórico de execução; eles não devem ser
interpretados isoladamente como o estado atual. O bloco **Status de execução** no
topo de cada plano e esta tabela são as referências de acompanhamento.

## Evidências da auditoria

- Branches `main` e `develop` no mesmo commit (`00be236`) e sincronizadas com o remoto.
- Suíte local completa: **64 arquivos e 182 testes aprovados** em 2026-07-10.
- Build de produção aprovado (`tsc && vite build`) em 2026-07-10.
- Aplicação de produção respondeu HTTP 200 em `https://mapadebeneficios.com.br/`.
- O bundle publicado não continha os marcadores do P4/redesign de Discovery; a
  publicação do estado atual do repositório continua pendente de verificação/correção.

## Resumo

| Plano | Repositório | Operação/produção |
| --- | --- | --- |
| M1 - Fundação | Concluído | Validado localmente |
| M2 - Onboarding inicial | Concluído | Coberto pelo deploy do M5 |
| M3 - Painel | Concluído | Coberto pelo deploy do M5 |
| M4 - Perfil + PWA | Concluído | Coberto pelo deploy do M5 |
| M5 - Deploy Dokploy | Artefatos concluídos | Infra ativa; sincronização do bundle atual pendente |
| M6a - Fundação admin | Concluído | Aplicação em produção não reauditada |
| M6b - Admin de fontes | Concluído | Aplicação em produção não reauditada |
| M6c - Admin de benefícios | Concluído | Aplicação em produção não reauditada |
| M7 - Catálogo real | Concluído | Migrações/seed em produção não reauditos nesta rodada |
| M8a - Fonte e transparência | Concluído | Migração/rebuild em produção não reauditos nesta rodada |
| P1 - Origem fonte-agnóstica | Concluído | Validado localmente |
| P2 - Reskin v3 | Concluído | Publicação atual não reauditada |
| P3 - Onboarding híbrido | Concluído | Publicação atual não reauditada |
| P3 - Refino visual | Concluído | Publicação atual não reauditada |
| P4 - Discovery | Concluído | Não identificado no bundle publicado |
| Redesign de Discovery | Concluído | Não identificado no bundle publicado |

## Próximo gate

Reparar ou confirmar o auto-deploy do Dokploy, publicar o commit atual de `main` e
executar um smoke test de produção para P4/Discovery. Depois disso, atualizar este
índice e os dois planos de Discovery para `produção verificada`.
