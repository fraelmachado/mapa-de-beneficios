import { useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSources } from './useSources'
import { selectionReducer } from './selection'
import { useSaveUserSources } from './useSaveUserSources'
import { TransitionScreen } from './TransitionScreen'
import { useSession } from '../auth/AuthProvider'
import { useUserSources } from './useUserSources'
import type { CategoryGroup } from './groupSourcesByCategory'
import type { SourceCategory } from '../benefits/types'
import type { Source } from './types'
import { Button } from '../../ui/Button'

type Gate = 'yes' | 'no' | undefined

function SourceBlock({
  source,
  selected,
  onToggle,
}: {
  source: Source
  selected: Set<string>
  onToggle: (itemId: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-sm)', padding: 'var(--s3)' }}>
      <button
        type="button"
        className="w-full text-left"
        style={{ fontWeight: 700, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--ink)' }}
        onClick={() => setOpen((o) => !o)}
      >
        {source.name}
      </button>
      {open && (
        <div className="chips" style={{ marginTop: 'var(--s2)' }}>
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
      )}
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
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <div style={{ height: 6, width: '100%', overflow: 'hidden', borderRadius: 99, background: 'var(--line)' }}>
        <div style={{ height: '100%', background: 'var(--accent)', transition: 'width .25s', width: `${((step + 1) / steps.length) * 100}%` }} />
      </div>

      <h1 style={{ fontSize: 'var(--fz-h2)', fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>
        Você tem {current.meta.icon} {current.meta.label}?
      </h1>

      <div className="chips">
        <button type="button" className={'chip' + (gate === 'yes' ? ' on' : '')} aria-pressed={gate === 'yes'} onClick={() => setGate(current.category, 'yes')}>
          Tenho
        </button>
        <button type="button" className={'chip' + (gate === 'no' ? ' on' : '')} aria-pressed={gate === 'no'} onClick={() => setGate(current.category, 'no')}>
          Não tenho
        </button>
      </div>

      {gate === 'yes' && (
        <div className="flex flex-col gap-2">
          {current.sources.map((s) => (
            <SourceBlock key={s.id} source={s} selected={selected} onToggle={(id) => dispatch({ type: 'toggle', itemId: id })} />
          ))}
        </div>
      )}

      {saveError && <p style={{ fontSize: 14, color: 'var(--warn)' }}>Não foi possível salvar. Tente de novo.</p>}

      <div className="mt-auto flex gap-2" style={{ alignItems: 'center' }}>
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
            Voltar
          </Button>
        )}
        <div style={{ marginLeft: 'auto', width: 'auto' }}>
          <Button onClick={next} disabled={gate === undefined}>
            {isLast ? 'Concluir' : 'Avançar'}
          </Button>
        </div>
      </div>
    </div>
  )
}
