import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useSources } from './useSources'
import { selectionReducer } from './selection'
import { useSaveUserSources } from './useSaveUserSources'
import { useSaveSourceRequest } from './useSaveSourceRequest'
import { TransitionScreen } from './TransitionScreen'
import { RadarMontado, type SummaryGroup } from './RadarMontado'
import { useSession } from '../auth/AuthProvider'
import { useUserSources } from './useUserSources'
import type { CategoryGroup } from './groupSourcesByCategory'
import type { Source } from './types'
import { formatBRL } from '../benefits/estimatedValue'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'
import { PageState, Skeleton } from '../../ui'
import { TierSheet } from './gmail/TierSheet'

// Copy curado por categoria (mockup Tela 06): eyebrow motivacional + pergunta natural.
const WIZ_COPY: Record<string, { eyebrow: string; question: string }> = {
  bank_card: { eyebrow: 'Seu tesouro escondido', question: 'Quais cartões você tem?' },
  carrier: { eyebrow: 'Quase lá', question: 'Qual sua operadora de celular?' },
  health: { eyebrow: 'Cuidando de você', question: 'Plano de saúde ou odonto?' },
  corporate_benefits: { eyebrow: 'Benefício da empresa', question: 'Tem cartão multibenefícios?' },
  loyalty: { eyebrow: 'Pontos que rendem', question: 'Programas de fidelidade e pontos?' },
  retail: { eyebrow: 'Quase lá', question: 'Assinaturas e streaming?' },
  mall: { eyebrow: 'Perto de você', question: 'Shoppings que você frequenta?' },
}

const SearchIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <circle cx="11" cy="11" r="7" />
    <line x1="21" y1="21" x2="16.5" y2="16.5" />
  </svg>
)

export function ManualWizard() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const editing = params.get('mode') === 'edit'
  const { session } = useSession()
  const existingQuery = useUserSources(session?.user.id)
  const sourcesQuery = useSources()
  const existing = existingQuery.data
  const groups = sourcesQuery.data
  const steps: CategoryGroup[] = groups ?? []
  const lastStep = Math.max(steps.length - 1, 0)
  const [selected, dispatch] = useReducer(selectionReducer, new Set<string>())
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const save = useSaveUserSources()
  const saveRequest = useSaveSourceRequest()
  const [query, setQuery] = useState('')
  const [otherOpen, setOtherOpen] = useState(false)
  const [otherText, setOtherText] = useState('')
  const [otherSent, setOtherSent] = useState(false)
  const [sheetSourceId, setSheetSourceId] = useState<string | null>(null)
  const [unsure, setUnsure] = useState<Set<string>>(new Set())

  // resetar busca/sheet/Outro ao trocar de etapa
  useEffect(() => {
    setQuery('')
    setOtherOpen(false)
    setOtherText('')
    setOtherSent(false)
    setSheetSourceId(null)
  }, [step])

  useEffect(() => {
    if (steps.length === 0) return
    setStep((currentStep) => Math.min(currentStep, lastStep))
  }, [lastStep, steps.length])

  // Pré-marca os itens já salvos (modo edição).
  const inited = useRef(false)
  useEffect(() => {
    if (!inited.current && existing && groups) {
      dispatch({ type: 'set', ids: existing })
      inited.current = true
    }
  }, [existing, groups])

  // Economia potencial = soma real do valor estimado dos tiers selecionados (todas as etapas).
  const economia = useMemo(() => {
    let total = 0
    for (const g of steps)
      for (const s of g.sources)
        for (const it of s.source_items) if (selected.has(it.id)) total += it.estValueBrl ?? 0
    return total
  }, [steps, selected])

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
        items: g.sources
          .filter((s) => s.source_items.some((it) => selected.has(it.id)))
          .map((s) => {
            const chosen = s.source_items.find((it) => selected.has(it.id))
            const variant = unsure.has(s.id) ? 'A confirmar' : chosen?.label ?? s.name
            return { provider: s.name, variant }
          }),
      }))
      .filter((g) => g.items.length > 0)
    return <RadarMontado groups={summaryGroups} onView={() => navigate(editing ? '/painel' : '/alertas?from=onboarding')} />
  }

  if (steps.length === 0) {
    return <div className="ob-state"><PageState title="Nenhum programa disponível" description="O catálogo ainda não possui programas para esta etapa." /></div>
  }
  const currentStep = Math.min(step, lastStep)
  const current = steps[currentStep]
  const isLast = currentStep === lastStep
  const copy = WIZ_COPY[current.category] ?? { eyebrow: 'Mais uma etapa', question: `Você tem ${current.meta.label}?` }

  const brands = current.sources.filter(
    (s) => s.source_items.length > 0 && s.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const sheetBrand = sheetSourceId ? current.sources.find((s) => s.id === sheetSourceId) ?? null : null

  function pickTier(brand: Source, itemId: string, markUnsure = false) {
    dispatch({ type: 'pickTier', siblingIds: brand.source_items.map((it) => it.id), itemId })
    setUnsure((prev) => {
      const next = new Set(prev)
      if (markUnsure) next.add(brand.id)
      else next.delete(brand.id)
      return next
    })
    setSheetSourceId(null)
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
                <span>{formatBRL(economia)} <span className="ob-econ-up" aria-hidden="true">↑</span></span>
                <span className="ob-econ-cap">economia potencial</span>
              </span>
            </span>
          </div>

          <div className="ob-segments" role="group" aria-label={`Passo ${currentStep + 1} de ${steps.length}`}>
            {steps.map((s, i) => <span key={s.category} className={i <= currentStep ? 'on' : ''} />)}
          </div>

          <p className="ob-eyebrow">{copy.eyebrow}</p>
          <h1 className="ob-title">{copy.question}</h1>
          <p className="ob-sub">Marque o que você usa — a gente revela os benefícios escondidos aí.</p>

          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="buscar nesta categoria…"
            icon={SearchIcon}
            ariaLabel="Buscar programa"
          />

          {brands.length > 0 ? (
            <div className="ob-grid">
              {brands.map((brand) => {
                const multi = brand.source_items.length > 1
                const chosen = brand.source_items.find((it) => selected.has(it.id))
                const on = !!chosen
                const isUnsure = unsure.has(brand.id)
                const sub = multi ? (isUnsure ? 'A confirmar' : chosen?.label ?? '') : ''
                return (
                  <button
                    key={brand.id}
                    type="button"
                    className={'ob-tile' + (on ? ' on' : '')}
                    aria-pressed={on}
                    aria-haspopup={multi ? 'dialog' : undefined}
                    onClick={() =>
                      multi
                        ? setSheetSourceId(brand.id)
                        : dispatch({ type: 'toggle', itemId: brand.source_items[0].id })
                    }
                  >
                    {on ? (
                      <span className="ob-tile-check" aria-hidden="true">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                      </span>
                    ) : null}
                    <span className="ob-tile-logo" aria-hidden="true">
                      {brand.logo_url ? <img src={brand.logo_url} alt="" /> : brand.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="ob-tile-name">{brand.name}</span>
                    {sub ? <span className="ob-tile-sub">{sub}</span> : null}
                  </button>
                )
              })}
            </div>
          ) : (
            <p className="ob-grid-empty">Nenhum provedor encontrado.</p>
          )}

          <button
            type="button"
            className="ob-notfound"
            aria-expanded={otherOpen}
            onClick={() => setOtherOpen((v) => !v)}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            Não vejo o meu
          </button>

          {otherOpen ? (
            <div className="ob-other">
              <label className="lbl" htmlFor="other" style={{ margin: '0 0 var(--s2)' }}>
                Conta pra gente — a gente avalia incluir (Outro)
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
          ) : null}

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
            <Button onClick={next}>{isLast ? 'Concluir' : 'Continuar'}</Button>
          </div>
        </div>
        {!isLast ? (
          <button type="button" className="ob-skip" onClick={next}>Pular esta etapa</button>
        ) : null}
      </div>

      {sheetBrand ? (
        <TierSheet
          brand={sheetBrand}
          selectedId={unsure.has(sheetBrand.id) ? null : (sheetBrand.source_items.find((it) => selected.has(it.id))?.id ?? null)}
          onPick={(itemId, markUnsure) => pickTier(sheetBrand, itemId, markUnsure)}
          onClose={() => setSheetSourceId(null)}
        />
      ) : null}
    </div>
  )
}
