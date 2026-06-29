import { useEffect, useReducer, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSources } from './useSources'
import { selectionReducer } from './selection'
import { useSaveUserSources } from './useSaveUserSources'
import { TransitionScreen } from './TransitionScreen'
import { useSession } from '../auth/AuthProvider'
import { useUserSources } from './useUserSources'
import type { Source, SourceKind } from './types'

const STEP_DEFS: { kinds: SourceKind[]; title: string }[] = [
  { kinds: ['card'], title: 'Quais cartões ou bancos você usa?' },
  { kinds: ['carrier'], title: 'Qual sua operadora?' },
  { kinds: ['loyalty', 'cpf'], title: 'Programas de fidelidade?' },
]

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
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 'var(--r-sm)',
        padding: 'var(--s3)',
      }}
    >
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
  const { data, isLoading, error } = useSources()
  const [selected, dispatch] = useReducer(selectionReducer, new Set<string>())
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)
  const save = useSaveUserSources()

  const inited = useRef(false)
  useEffect(() => {
    if (!inited.current && existing) {
      dispatch({ type: 'set', ids: existing })
      inited.current = true
    }
  }, [existing])

  if (isLoading || loadingExisting) return <p className="p-6">Carregando…</p>
  if (error || existingError) return <p className="p-6 text-red-600">Erro ao carregar seus dados.</p>
  if (saving) return <TransitionScreen />

  // Só mostramos passos cujas kinds têm fontes no catálogo — evita passos
  // obrigatórios vazios quando o catálogo não cobre operadora/fidelidade.
  const steps = STEP_DEFS.filter((def) => def.kinds.some((k) => (data?.[k]?.length ?? 0) > 0))
  if (steps.length === 0) return <p className="p-6">Nenhuma fonte disponível ainda.</p>
  const current = steps[step]
  const sources: Source[] = current.kinds.flatMap((k) => data?.[k] ?? [])
  const isLast = step === steps.length - 1

  async function next() {
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
        <div
          style={{ height: '100%', background: 'var(--accent)', transition: 'width .25s', width: `${((step + 1) / steps.length) * 100}%` }}
        />
      </div>
      <h1 style={{ fontSize: 'var(--fz-h2)', fontWeight: 700, letterSpacing: '-.02em', margin: 0 }}>{current.title}</h1>
      <div className="flex flex-col gap-2">
        {sources.map((s) => (
          <SourceBlock key={s.id} source={s} selected={selected} onToggle={(id) => dispatch({ type: 'toggle', itemId: id })} />
        ))}
        {sources.length === 0 && <p className="muted" style={{ fontSize: 14 }}>Nada por aqui ainda.</p>}
      </div>
      {saveError && (
        <p style={{ fontSize: 14, color: 'var(--warn)' }}>Não foi possível salvar. Tente de novo.</p>
      )}
      <div className="mt-auto flex gap-2" style={{ alignItems: 'center' }}>
        {step > 0 && (
          <button
            type="button"
            className="btn ghost"
            style={{ width: 'auto', marginBottom: 0 }}
            onClick={() => setStep((s) => s - 1)}
          >
            Voltar
          </button>
        )}
        <button
          type="button"
          className="btn"
          style={{ width: 'auto', marginBottom: 0, marginLeft: 'auto' }}
          onClick={next}
        >
          {isLast ? 'Concluir' : 'Avançar'}
        </button>
      </div>
    </div>
  )
}
