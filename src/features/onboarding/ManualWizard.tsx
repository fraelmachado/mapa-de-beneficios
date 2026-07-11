import { useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSources } from './useSources'
import { selectionReducer } from './selection'
import { useSaveUserSources } from './useSaveUserSources'
import { useSaveSourceRequest } from './useSaveSourceRequest'
import { TransitionScreen } from './TransitionScreen'
import { RadarMontado, type SummaryGroup } from './RadarMontado'
import { useSession } from '../auth/AuthProvider'
import { useUserSources } from './useUserSources'
import type { CategoryGroup } from './groupSourcesByCategory'
import type { SourceCategory } from '../benefits/types'
import type { Source } from './types'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { PageState, Skeleton } from '../../ui'

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

export function ManualWizard() {
  const navigate = useNavigate()
  const { session } = useSession()
  const existingQuery = useUserSources(session?.user.id)
  const sourcesQuery = useSources()
  const existing = existingQuery.data
  const groups = sourcesQuery.data
  const steps: CategoryGroup[] = groups ?? []
  const lastStep = Math.max(steps.length - 1, 0)
  const [selected, dispatch] = useReducer(selectionReducer, new Set<string>())
  const [step, setStep] = useState(0)
  const [gates, setGates] = useState<Record<SourceCategory, Gate>>({} as Record<SourceCategory, Gate>)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
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

  useEffect(() => {
    if (steps.length === 0) return
    setStep((currentStep) => Math.min(currentStep, lastStep))
  }, [lastStep, steps.length])

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

  if (sourcesQuery.isLoading || existingQuery.isLoading) {
    return <div className="ob-state" role="status" aria-label="Carregando seus programas" aria-busy="true"><Skeleton height="28px" /><Skeleton height="180px" radius="18px" /><Skeleton height="52px" radius="13px" /></div>
  }
  if (sourcesQuery.error || existingQuery.error) {
    return <div className="ob-state"><PageState title="Não foi possível carregar seus programas" action={{ label: 'Tentar novamente', onClick: () => { void sourcesQuery.refetch(); void existingQuery.refetch() } }} /></div>
  }
  if (saving) return <TransitionScreen />

  if (done) {
    const summaryGroups: SummaryGroup[] = steps
      .map((g) => ({
        label: g.meta.label,
        items: g.sources.flatMap((s) =>
          s.source_items.filter((it) => selected.has(it.id)).map((it) => ({ provider: s.name, variant: it.label })),
        ),
      }))
      .filter((g) => g.items.length > 0)
    return <RadarMontado groups={summaryGroups} onView={() => navigate('/painel')} />
  }

  if (steps.length === 0) {
    return <div className="ob-state"><PageState title="Nenhum programa disponível" description="O catálogo ainda não possui programas para esta etapa." /></div>
  }
  const currentStep = Math.min(step, lastStep)
  const current = steps[currentStep]
  const isLast = currentStep === lastStep
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
      setStep((currentStep) => Math.min(currentStep + 1, lastStep))
      return
    }
    setSaving(true)
    setSaveError(false)
    try {
      await save.mutateAsync([...selected])
      await new Promise((r) => setTimeout(r, 1200))
      setSaving(false)
      setDone(true)
    } catch {
      setSaving(false)
      setSaveError(true)
    }
  }

  return (
    <div className="ob">
      <div className="ob-scroll">
        <div className="ob-card">
          <div className="ob-wiz-top">
            {currentStep > 0 ? (
              <button
                type="button"
                className="ob-back-btn"
                aria-label="Voltar"
                onClick={() => setStep((s) => Math.max(s - 1, 0))}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
              </button>
            ) : (
              <span style={{ width: 38, height: 38 }} />
            )}
            <span className="ob-econ">
              <span className="ob-econ-val">
                <span>R$ {(selected.size * 180).toLocaleString('pt-BR')} <span className="ob-econ-up" aria-hidden="true">↑</span></span>
                <span className="ob-econ-cap">economia potencial</span>
              </span>
            </span>
          </div>

          <div className="ob-segments" aria-hidden="true">
            {steps.map((s, i) => <span key={s.category} className={i <= currentStep ? 'on' : ''} />)}
          </div>
          <p className="lbl" style={{ margin: 0 }}>
            Passo {currentStep + 1} de {steps.length} · sua carteira
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
            <p role="alert" aria-live="assertive" style={{ fontSize: 14, color: 'var(--warn)', marginTop: 'var(--s3)' }}>
              Não foi possível salvar. Tente de novo.
            </p>
          )}
        </div>
      </div>

      <div className="ob-foot">
        <div className="ob-foot-inner">
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
