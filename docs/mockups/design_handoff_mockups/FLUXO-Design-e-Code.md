# Fluxo de trabalho — Claude Design ↔ Claude Code

Guia rápido pra manter a comunicação entre as duas ferramentas sem ruído.

## Papéis (não misturar)

- **Claude Design** = fonte da verdade **visual**. Decide layout, hierarquia, estados,
  responsividade e copy. Entrega sempre um **mockup `.dc.html`** aprovado.
- **Claude Code** = **implementador**. Não decide design; **reproduz** o mockup
  aprovado no código real (React 18 + Vite, `src/ui`, TanStack Query, Supabase).

**Regra de ouro:** cada tela tem UM dono de design — o mockup. Mudança visual começa
no mockup, nunca direto no código. Assim nunca há duas "verdades" divergentes.

## Transporte: como os mockups chegam ao Claude Code

**Caminho principal — design-sync (pull):** o Claude Code lê os `.dc.html` direto
deste projeto do Claude Design (via `list_files` / `get_file` do design-sync), sem
download nem cópia manual. É mão única: **Design → Code**. Não vale empurrar o
`src/ui` (TSX) de volta pra cá — o Design guarda preview+bundle, não TSX.

Consequência prática: a responsabilidade do Design é só **manter os mockups
atualizados e bem nomeados neste projeto**. Nada de reenviar arquivo a cada mudança —
o Code puxa a versão atual quando precisar.

**Fallback — pasta `design_handoff_mockups/`:** use o zip só quando o design-sync não
estiver disponível (execução sem login claude.ai, headless/cron) ou pra quem não usa
o pull. Quando um mockup muda, o Design re-sincroniza a pasta.

## PULL sim, PUSH não (decisão travada)

"design-sync" cobre DUAS coisas com o mesmo nome — não confundir:

- **Ferramentas DesignSync (leves) = PULL.** `list_projects` / `list_files` /
  `get_file`. O Code lê um `.dc.html` daqui sob demanda. **É isto que usamos.**
- **Skill `/design-sync` (pesada) = PUSH.** Sobe uma lib de componentes em código
  PARA o Claude Design (código → Design). Demora horas, gasta tokens, pode
  **sobrescrever** mockups/templates. **NÃO rodar.**

Por que o push está descartado:
- O DS já vive no Claude Design (projeto `80471905`) — subir de novo é redundante.
- Seria circular: o `src/ui` nasceu desse DS (reskin P2).
- Inverte a regra de ouro (faria o código virar fonte da verdade do design).
- `src/ui` não é pacote standalone; buildar pra conversão dá trabalho sem retorno.

Regra: **Code puxa `.dc.html` com `get_file`; nunca roda a skill de push.**
(Só reconsiderar o push se um dia o CÓDIGO virar a fonte de verdade dos componentes —
não é o caso.)

## Loop por tela (sempre igual)

1. **No Claude Design:** conversar e iterar o `.dc.html` até aprovar.
2. **No Claude Code:** apontar o nome do `.dc.html` (o Code puxa via design-sync) + 1
   frase de intenção. Pedir um **plano** (arquivos + componentes de `src/ui`) ANTES de codar.
3. **Se o Code sugerir algo visual diferente:** a decisão volta pro Design (atualizar
   o mockup), não fica só no código.
4. **Se o design mudar depois:** atualizar o mockup no Design → avisar o Code "mudou X
   em `NomeDaTela.dc.html`, puxe de novo e atualize".

## Anti-ruído

- Não pedir design pro Code, nem código pro Design. Se você está explicando layout pro
  Code, falta um mockup — volte pro Design.
- **Consistência com os mockups existentes > instrução literal** quando houver conflito.
- Mantenha os mockups deste projeto atualizados e bem nomeados — é o que o design-sync
  puxa. A pasta `design_handoff_mockups/` é fallback, não o canal principal.

## Frases prontas

**Para o Claude Code (nova tela):**
> Puxe `NomeDaTela.dc.html` do meu projeto do Claude Design (design-sync) — é a
> referência de design aprovada. Recrie em React+Vite reaproveitando `src/ui`; não é
> pixel-copy, é estrutura+fluxo com o nosso DS. Me devolva um plano (arquivos +
> mapeamento de componentes) antes de codar.

**Para o Claude Code (mudança):**
> `NomeDaTela.dc.html` mudou: [o que mudou]. Puxe a versão atual e atualize a
> implementação correspondente, sem mexer no resto.

**Para o Claude Design (mim), quando o Code levantar dúvida visual:**
> O Claude Code perguntou [X]. Como fica no design? Atualize o mockup.
