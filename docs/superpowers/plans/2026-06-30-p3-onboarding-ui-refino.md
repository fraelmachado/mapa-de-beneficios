# Refino de UI do wizard de onboarding (P3) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Status de execução (auditado em 2026-07-10):** implementação concluída no repositório (`43360de`, `d49006e`). Estrutura visual, CTA fixo e adaptação desktop estão presentes; suíte cumulativa e build aprovados. Publicação atual em produção não foi reauditada.

**Goal:** Elevar o visual do wizard de onboarding (já funcional do P3) à anatomia da tela 01 "Onboarding esperto" do mockup v3, sem mudar o comportamento (gate obrigatório, persistência, "Outro").

**Architecture:** O `OnboardingPage` hoje usa muitos `style` inline ad-hoc e renderiza os provedores como um accordion (`SourceBlock`) que esconde as variantes atrás de um clique. Este refino: (1) extrai a estilização para uma folha `onboarding.css` (importada no `index.css`, seguindo o padrão de `ds.css`/`layout.css`); (2) reestrutura a tela em **header** (logo + barra de progresso + eyebrow "Passo X de N" + título-pergunta + subtítulo), **gate**, **provedores como seções compactas com chips de variante inline (sem accordion)**, e **CTA fixo na base** (barra inferior, botão largo, desabilitado até responder o gate); (3) no desktop, centraliza tudo num **card** com largura confortável e respiro. Nenhuma mudança em hooks/dados/RLS.

**Tech Stack:** Vite + React 18 + TypeScript + Tailwind v3, TanStack Query, React Router, Vitest + Testing Library.

## Global Constraints

- **Branch:** trabalhar em `fix/p3-onboarding-ui` (criar a partir de `develop`).
- **Gate de tipos:** `npm test` (vitest) NÃO faz type-check — rodar `npm run build` (= `tsc && vite build`) ao final de cada task; só pronto com build verde. (ver [[mapa-de-beneficios-vitest-no-typecheck]])
- **Não regredir:** os 136 testes atuais devem continuar verdes (`npm test`).
- **Apenas visual/estrutura:** NÃO alterar comportamento — gate obrigatório (Avançar/Concluir desabilitado até responder), `setGate('no')` limpa a seleção da categoria, pré-gating em modo edição, persistência via `useSaveUserSources`, e "Outro" via `useSaveSourceRequest`. Tudo isso permanece idêntico.
- **Anatomia-alvo (mockup tela 01, `docs/mockups/2026-06-16-mapa-de-beneficios-reskin-full.html`):** header com logo + progresso + eyebrow "Passo X de N · sua carteira" + título caloroso + subtítulo; provedores como seções compactas com **chips de variante inline visíveis**; CTA forte/largo fixo na base. Visual "passe"/DS mantido (tokens de `ds.css`).
- **DS:** usar os primitivos `Button`/`Input` e tokens existentes; sem inventar cores/tokens novos. Estilos do wizard vão em `onboarding.css` com prefixo `.ob-` (sem colidir com `.pass/.chip/.btn/...`).
- **Dados (dev):** o catálogo-seed real é 100% `bank_card`, então a app local mostra **1 passo** ("Bancos & cartões"); o fluxo multi-step (eyebrow "Passo X de N", Avançar/Voltar) é coberto pelos testes (mock com 2 grupos). Ver [[mapa-de-beneficios-test-db-pollution]].

---

## File Structure

**Criar:**
- `src/features/onboarding/onboarding.css` — classes `.ob-*` do wizard (shell/scroll, card central no desktop, brand, progress, head, gate, provider, other, foot fixo).

**Modificar:**
- `src/index.css` — importar `./features/onboarding/onboarding.css`.
- `src/features/onboarding/OnboardingPage.tsx` — reescrever a marcação para a anatomia-alvo; trocar o `SourceBlock` accordion por `ProviderSection` (chips inline); CTA na barra inferior.
- `src/features/onboarding/OnboardingPage.test.tsx` — refletir o fim do accordion (variantes visíveis sem expandir) + assert do eyebrow de progresso.

---

## Task 1: Reskin do wizard (anatomia-alvo + chips inline + CTA fixo)

A tela é um deliverable coeso — header, provedores e CTA são revisados juntos.

**Files:**
- Create: `src/features/onboarding/onboarding.css`
- Modify: `src/index.css`, `src/features/onboarding/OnboardingPage.tsx`, `src/features/onboarding/OnboardingPage.test.tsx`

**Interfaces:**
- Consumes (inalterado): `useSources` → `CategoryGroup[]`, `useUserSources`, `useSaveUserSources`, `useSaveSourceRequest`, `selectionReducer`, `TransitionScreen`, `Button`, `Input`, `SourceCategory`, `Source`.
- Produces: `OnboardingPage` com a nova marcação; helper interno `ProviderSection` (substitui `SourceBlock`). Sem novas exportações.

- [ ] **Step 1: Atualizar os testes para refletir chips inline + eyebrow (falha primeiro)**

No `src/features/onboarding/OnboardingPage.test.tsx`, substituir o **primeiro** teste (`'mostra a 1ª categoria; gate "Tenho" revela provedores; seleciona e conclui'`, linhas 64–79) por esta versão — remove o clique de expandir (accordion não existe mais), passa a exigir que a variante esteja visível logo após "Tenho", e adiciona o eyebrow de progresso:
```tsx
  it('mostra a 1ª categoria; gate "Tenho" revela provedores (chips inline); seleciona e conclui', async () => {
    renderWithProviders(<OnboardingPage />)
    expect(screen.getByText(/Passo 1 de 2/i)).toBeInTheDocument()
    expect(screen.getByText(/Bancos & cartões/)).toBeInTheDocument()
    // provedores escondidos até "Tenho"
    expect(screen.queryByText('Itaú')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^tenho$/i }))
    // fim do accordion: o nome do provedor NÃO é mais um botão de expandir,
    // e a variante já está visível inline (sem clicar para abrir)
    expect(screen.getByText('Itaú')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Itaú' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /black/i }))
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))
    // passo 2: fidelidade — diz "Não tenho" e conclui
    expect(screen.getByText(/Passo 2 de 2/i)).toBeInTheDocument()
    expect(screen.getByText(/Fidelidade & pontos/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /não tenho/i }))
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith(expect.arrayContaining(['i1'])))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/painel'), { timeout: 2500 })
  })
```
Os demais testes (gate obrigatório, edição, "Não tenho" limpa, erro, busca, "Outro") permanecem **inalterados** — eles já não dependem do accordion (o nome do provedor continua presente; a variante passa a estar sempre visível, o que só fortalece os asserts existentes).

- [ ] **Step 2: Rodar — deve falhar**

Run: `npm test -- --run OnboardingPage`
Expected: FAIL no 1º teste — `getByText(/Passo 1 de 2/i)` não existe (a página atual não tem eyebrow de progresso).

- [ ] **Step 3: Criar `src/features/onboarding/onboarding.css`**

```css
/* ============================================================
   Wizard de onboarding — anatomia "passe" (mockup tela 01)
   Shell com scroll + CTA fixo na base; card central no desktop.
   Prefixo .ob- para não colidir com as classes do ds.css.
   ============================================================ */
.ob { min-height: 100dvh; display: flex; flex-direction: column; background: var(--bg); }
.ob-scroll { flex: 1; min-height: 0; overflow-y: auto; } /* min-height:0 deixa o flex child rolar */
.ob-card { width: 100%; max-width: 480px; margin: 0 auto; padding: var(--s6) var(--s5) var(--s6); }

.ob-brand { display: flex; align-items: center; gap: var(--s2); font-weight: 800; font-size: var(--fz-title); letter-spacing: -.02em; margin-bottom: var(--s5); }
.ob-brand .mk { width: 26px; height: 26px; border-radius: 8px; background: linear-gradient(135deg, var(--c-airport), var(--c-viagem)); flex: none; }

.ob-progress { height: 6px; border-radius: var(--r-pill); background: var(--line); overflow: hidden; margin-bottom: var(--s4); }
.ob-progress > i { display: block; height: 100%; background: var(--accent); transition: width .25s var(--ease); }

.ob-title { font-size: var(--fz-h1); font-weight: 700; letter-spacing: -.03em; line-height: var(--lh-tight); margin: var(--s2) 0 var(--s2); }
.ob-sub { color: var(--muted); font-size: var(--fz-body); line-height: var(--lh-body); margin: 0 0 var(--s5); }

.ob-gate { display: flex; gap: var(--s2); margin-bottom: var(--s5); }
.ob-gate .chip { padding: var(--s3) var(--s5); font-size: var(--fz-body); }

.ob-providers { display: flex; flex-direction: column; }
.ob-provider { padding: var(--s3) 0; border-bottom: 1px solid var(--line-2); }
.ob-provider:last-child { border-bottom: 0; }
.ob-prov-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: var(--s2); }
.ob-prov-name { font-weight: 700; font-size: var(--fz-body); color: var(--ink); }

.ob-other { border-top: 1px solid var(--line-2); margin-top: var(--s3); padding-top: var(--s3); }
.ob-other-row { display: flex; gap: var(--s2); align-items: center; }
.ob-other-row .btn { width: auto; margin-bottom: 0; }

/* O footer é o ÚLTIMO filho do shell flex (100dvh) e o scroll vive em .ob-scroll,
   então o CTA fica preso à base SEM sobrepor conteúdo — robusto, sem position:sticky
   (que falha com teclado mobile / viewports baixos / listas longas). */
.ob-foot {
  flex: none;
  background: var(--surface);
  border-top: 1px solid var(--line);
  padding: var(--s3) var(--s5) calc(var(--s3) + env(safe-area-inset-bottom));
}
.ob-foot-inner { width: 100%; max-width: 480px; margin: 0 auto; display: flex; gap: var(--s3); align-items: center; }
.ob-foot .btn { margin-bottom: 0; }
.ob-back .btn { width: auto; }
.ob-cta { flex: 1; }

@media (min-width: 720px) {
  /* desktop: card central com respiro; o scroll deixa de ser a área rolável
     (a página rola normalmente) e o CTA fica ABAIXO do card, alinhado à mesma
     largura (decisão: fora do card, para não reestruturar o DOM). */
  .ob { justify-content: center; padding: var(--s8) var(--s4); }
  .ob-scroll { flex: none; min-height: auto; overflow: visible; }
  .ob-card {
    max-width: 520px; background: var(--surface); border: 1px solid var(--line);
    border-radius: var(--radius); box-shadow: var(--shadow); padding: var(--s8);
  }
  .ob-foot { background: transparent; border-top: 0; padding: 0; margin-top: var(--s5); }
  .ob-foot-inner { max-width: 520px; }
}
```

- [ ] **Step 4: Importar a folha no `index.css`**

Em `src/index.css`, adicionar a importação após `layout.css`:
```css
@import './ui/ds.css';
@import './ui/layout.css';
@import './features/onboarding/onboarding.css';

@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Reescrever `OnboardingPage.tsx`**

Substituir o componente `SourceBlock` (accordion) por `ProviderSection` (chips inline) e reescrever o `return`. **Manter todos os hooks, `setGate`, `submitOther`, `next` exatamente como estão** (linhas 57–150 do arquivo atual) — só muda a marcação a partir do `return`. Arquivo final:
```tsx
import { useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSources } from './useSources'
import { selectionReducer } from './selection'
import { useSaveUserSources } from './useSaveUserSources'
import { useSaveSourceRequest } from './useSaveSourceRequest'
import { TransitionScreen } from './TransitionScreen'
import { useSession } from '../auth/AuthProvider'
import { useUserSources } from './useUserSources'
import type { CategoryGroup } from './groupSourcesByCategory'
import type { SourceCategory } from '../benefits/types'
import type { Source } from './types'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'

type Gate = 'yes' | 'no' | undefined

function ProviderSection({
  source,
  selected,
  onToggle,
}: {
  source: Source
  selected: Set<string>
  onToggle: (itemId: string) => void
}) {
  return (
    <div className="ob-provider">
      <div className="ob-prov-head">
        <span className="ob-prov-name">{source.name}</span>
      </div>
      <div className="chips">
        {source.source_items.map((it) => (
          <button
            key={it.id}
            type="button"
            onClick={() => onToggle(it.id)}
            className={'chip' + (selected.has(it.id) ? ' on' : '')}
            aria-pressed={selected.has(it.id)}
          >
            {it.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function OnboardingPage() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { data: existing, isLoading: loadingExisting, error: existingError } = useUserSources(session?.user.id)
  const { data: groups, isLoading, error } = useSources()
  const [selected, dispatch] = useReducer(selectionReducer, new Set<string>())
  const [step, setStep] = useState(0)
  const [gates, setGates] = useState<Record<SourceCategory, Gate>>({} as Record<SourceCategory, Gate>)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const save = useSaveUserSources()
  const saveRequest = useSaveSourceRequest()
  const [query, setQuery] = useState('')
  const [otherText, setOtherText] = useState('')
  const [otherSent, setOtherSent] = useState(false)

  // resetar busca/Outro ao trocar de etapa
  useEffect(() => {
    setQuery('')
    setOtherText('')
    setOtherSent(false)
  }, [step])

  // Conjunto de item ids existentes (modo edição) para pré-marcar gates "yes".
  const inited = useRef(false)
  useEffect(() => {
    if (!inited.current && existing && groups) {
      dispatch({ type: 'set', ids: existing })
      const existingSet = new Set(existing)
      const preGates = {} as Record<SourceCategory, Gate>
      for (const g of groups) {
        const hasAny = g.sources.some((s) => s.source_items.some((it) => existingSet.has(it.id)))
        if (hasAny) preGates[g.category] = 'yes'
      }
      setGates(preGates)
      inited.current = true
    }
  }, [existing, groups])

  if (isLoading || loadingExisting) return <p className="p-6">Carregando…</p>
  if (error || existingError) return <p className="p-6 text-red-600">Erro ao carregar seus dados.</p>
  if (saving) return <TransitionScreen />

  const steps: CategoryGroup[] = groups ?? []
  if (steps.length === 0) return <p className="p-6">Nenhuma fonte disponível ainda.</p>
  const current = steps[step]
  const isLast = step === steps.length - 1
  const gate = gates[current.category]

  const filteredSources = current.sources.filter((s) =>
    s.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  function setGate(cat: SourceCategory, g: Gate) {
    setGates((prev) => ({ ...prev, [cat]: g }))
    // "Não tenho" remove os itens dessa categoria da seleção — senão, no modo
    // edição, fontes pré-selecionadas continuariam salvas mesmo após o usuário
    // dizer que não as tem (a UI mentiria e não daria pra remover fontes).
    if (g === 'no') {
      const group = steps.find((s) => s.category === cat)
      const catIds = new Set(group?.sources.flatMap((s) => s.source_items.map((it) => it.id)) ?? [])
      dispatch({ type: 'set', ids: [...selected].filter((id) => !catIds.has(id)) })
    }
  }

  async function submitOther() {
    const text = otherText.trim()
    if (!text) return
    try {
      await saveRequest.mutateAsync({ source_category: current.category, text })
      setOtherSent(true)
      setOtherText('')
    } catch {
      // silencioso; o usuário pode tentar de novo
    }
  }

  async function next() {
    if (gate === undefined) return // exige responder "Tenho/Não tenho" antes de prosseguir
    if (!isLast) {
      setStep((s) => s + 1)
      return
    }
    setSaving(true)
    setSaveError(false)
    try {
      await save.mutateAsync([...selected])
      await new Promise((r) => setTimeout(r, 1200))
      navigate('/painel')
    } catch {
      setSaving(false)
      setSaveError(true)
    }
  }

  return (
    <div className="ob">
      <div className="ob-scroll">
        <div className="ob-card">
          <div className="ob-brand">
            <span className="mk" aria-hidden="true" /> Mapa de Benefícios
          </div>

          <div className="ob-progress">
            <i style={{ width: `${((step + 1) / steps.length) * 100}%` }} />
          </div>
          <p className="lbl" style={{ margin: 0 }}>
            Passo {step + 1} de {steps.length} · sua carteira
          </p>

          <h1 className="ob-title">
            Você tem {current.meta.icon} {current.meta.label}?
          </h1>
          <p className="ob-sub">Marque o que você usa — a gente revela os benefícios escondidos aí.</p>

          <div className="ob-gate">
            <button
              type="button"
              className={'chip' + (gate === 'yes' ? ' on' : '')}
              aria-pressed={gate === 'yes'}
              onClick={() => setGate(current.category, 'yes')}
            >
              Tenho
            </button>
            <button
              type="button"
              className={'chip' + (gate === 'no' ? ' on' : '')}
              aria-pressed={gate === 'no'}
              onClick={() => setGate(current.category, 'no')}
            >
              Não tenho
            </button>
          </div>

          {gate === 'yes' && (
            <div>
              <Input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="buscar provedor…"
                icon="⌕"
                ariaLabel="Buscar provedor"
              />
              <div className="ob-providers">
                {filteredSources.map((s) => (
                  <ProviderSection
                    key={s.id}
                    source={s}
                    selected={selected}
                    onToggle={(id) => dispatch({ type: 'toggle', itemId: id })}
                  />
                ))}
              </div>
              {filteredSources.length === 0 && (
                <p className="muted" style={{ fontSize: 14 }}>Nenhum provedor encontrado.</p>
              )}

              <div className="ob-other">
                <label className="lbl" htmlFor="other" style={{ margin: '0 0 var(--s2)' }}>
                  Não está na lista? Conta pra gente (Outro)
                </label>
                {otherSent ? (
                  <p className="muted" style={{ fontSize: 14 }}>Recebemos! Vamos avaliar incluir essa fonte. ✓</p>
                ) : (
                  <div className="ob-other-row">
                    <label className="input" style={{ flex: 1, marginBottom: 0 }}>
                      <input
                        id="other"
                        value={otherText}
                        onChange={(e) => setOtherText(e.target.value)}
                        placeholder="ex.: C6 Bank"
                        aria-label="Outro provedor"
                      />
                    </label>
                    <Button onClick={submitOther}>Adicionar</Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {saveError && (
            <p style={{ fontSize: 14, color: 'var(--warn)', marginTop: 'var(--s3)' }}>
              Não foi possível salvar. Tente de novo.
            </p>
          )}
        </div>
      </div>

      <div className="ob-foot">
        <div className="ob-foot-inner">
          {step > 0 && (
            <div className="ob-back">
              <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
                Voltar
              </Button>
            </div>
          )}
          <div className="ob-cta">
            <Button onClick={next} disabled={gate === undefined}>
              {isLast ? 'Concluir' : 'Avançar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Rodar testes + build**

Run: `npm test -- --run OnboardingPage && npm run build`
Expected: PASS (todos os testes do OnboardingPage) + build verde.

- [ ] **Step 7: Suíte completa (não regredir)**

Run: `npm test -- --run`
Expected: 136/136 verdes.

- [ ] **Step 8: Commit**

```bash
git add src/features/onboarding/onboarding.css src/index.css src/features/onboarding/OnboardingPage.tsx src/features/onboarding/OnboardingPage.test.tsx
git commit -m "fix(p3): reskin do wizard de onboarding (header, chips inline, CTA fixo, card desktop)"
```

---

## Task 2: Verificação visual (gate por screenshots)

Como jsdom não computa layout (sticky/card/posição não são testáveis em vitest), o layout é validado aqui por **captura de tela**, e isto é um **gate** — não um checklist opcional. Use chrome-devtools MCP (ou outro navegador headless) e **anexe os screenshots**.

**Files:** nenhum (verificação).

- [ ] **Step 1: Capturar e conferir o wizard em 4 combinações + lista longa**

`npm run dev`; abrir `/onboarding` (sessão anônima). Capturar e inspecionar:
1. **Mobile (390px) claro** — gate inicial (sem responder) e estado "Tenho".
2. **Mobile (390px) escuro** — idem (alternar tema via Perfil ou `localStorage mb-theme=dark`).
3. **Desktop (1280px) claro** — card central.
4. **Desktop (1280px) escuro** — card central.
5. **Lista longa** (≥10 provedores): com o seed de dev OU mockando muitos provedores, confirmar que ao rolar **o CTA fixo na base NÃO cobre o último provedor / o "Outro"**, e que o scroll fica contido na área de conteúdo.

Critérios de aprovação (cada um verificável na imagem):
- header com logo + barra de progresso com respiro + eyebrow "Passo X de N · sua carteira" + título + subtítulo;
- gate "Tenho/Não tenho" maiores;
- ao "Tenho": busca + provedores como seções compactas com **variantes (chips) já visíveis** (sem expandir);
- "Outro" com input + "Adicionar" (largura automática) e confirmação "Recebemos!";
- **CTA na base** (Avançar/Concluir largo, desabilitado até responder; Voltar ghost quando há passo anterior) **sem cobrir conteúdo**;
- desktop: conteúdo num **card central** com respiro (sem oceano vazio), CTA logo abaixo do card alinhado à largura.

> Nota multi-step: com o seed real (só `bank_card`) a app mostra **1 passo**; o fluxo multi-step (Avançar/Voltar, "Passo X de N") é coberto pelos testes (Task 1). Para exercitar multi-step e a lista longa no navegador, peça ao controlador um **seed de dev** com ≥2 categorias e vários provedores (fora do escopo de código deste plano) ou mocke `useSources` numa página de teste. Se nenhum estiver disponível, registre no relatório que o item 5 (lista longa) ficou validado apenas por inspeção do CSS + 1 categoria.

- [ ] **Step 2: Commit (se houver ajuste fino de CSS)**

```bash
git add -A && git commit -m "chore(p3): ajustes finais do reskin do onboarding"
```

---

## Self-Review (cobertura)

- **Header (logo+progresso+eyebrow+título+subtítulo)** → Task 1 (marcação + `.ob-brand/.ob-progress/.lbl/.ob-title/.ob-sub`) + teste do eyebrow "Passo X de N".
- **Provedores com chips inline (fim do accordion)** → Task 1 (`ProviderSection` + `.ob-provider`); travado por teste estrutural: o nome do provedor **não é mais um botão** (`queryByRole('button', {name:'Itaú'})` ausente) e a variante é clicável sem expandir.
- **CTA na base + Voltar** → Task 1 (`.ob-foot/.ob-cta/.ob-back`), app-shell flex robusto (footer como último filho, sem `position:sticky`); comportamento `disabled`/`next()` inalterado. Layout validado por screenshots na Task 2 (jsdom não computa CSS).
- **Card central no desktop** → Task 1 (media query `.ob-card`/`.ob-foot`); validado por screenshots na Task 2.
- **Comportamento inalterado** (gate obrigatório, "Não tenho" limpa seleção, edição, persistência, "Outro") → hooks/funções idênticos; testes existentes preservados.
- **Gate de build** em cada task; **136 testes** verdes garantidos no Step 7. **Gate visual** (screenshots, mobile/desktop, claro/escuro, lista longa) na Task 2.
- **Achados da review adversarial Codex aplicados:** teste estrutural anti-accordion (não só texto/clique); app-shell flex robusto em vez de `position:sticky` (`100dvh` + `min-height:0`, footer não sobrepõe conteúdo); Task 2 vira gate de screenshots cobrindo lista longa.
- **Fora de escopo:** popular outras categorias/seed de dev (P4); refino das outras telas (Painel/Detalhe/Busca/Perfil) — só o wizard agora.
```
