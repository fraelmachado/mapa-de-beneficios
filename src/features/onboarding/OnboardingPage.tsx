import { useReducer, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSources } from './useSources'
import { selectionReducer } from './selection'
import { useSaveUserSources } from './useSaveUserSources'
import { TransitionScreen } from './TransitionScreen'
import type { Source, SourceKind } from './types'

const STEPS: { kinds: SourceKind[]; title: string; cta: string }[] = [
  { kinds: ['card'], title: 'Quais cartões ou bancos você usa?', cta: 'Avançar' },
  { kinds: ['carrier'], title: 'Qual sua operadora?', cta: 'Avançar' },
  { kinds: ['loyalty', 'cpf'], title: 'Programas de fidelidade?', cta: 'Concluir' },
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
    <div className="rounded-lg border border-slate-200 p-3">
      <button
        type="button"
        className="w-full text-left font-medium"
        onClick={() => setOpen((o) => !o)}
      >
        {source.name}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-2">
          {source.source_items.map((it) => (
            <button
              key={it.id}
              type="button"
              onClick={() => onToggle(it.id)}
              className={
                'rounded-full border px-3 py-1 text-sm ' +
                (selected.has(it.id)
                  ? 'border-slate-800 bg-slate-800 text-white'
                  : 'border-slate-300 text-slate-700')
              }
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
  const { data, isLoading, error } = useSources()
  const [selected, dispatch] = useReducer(selectionReducer, new Set<string>())
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const save = useSaveUserSources()

  if (isLoading) return <p className="p-6">Carregando…</p>
  if (error) return <p className="p-6 text-red-600">Erro ao carregar o catálogo.</p>
  if (saving) return <TransitionScreen />

  const current = STEPS[step]
  const sources: Source[] = current.kinds.flatMap((k) => data?.[k] ?? [])
  const isLast = step === STEPS.length - 1

  async function next() {
    if (!isLast) {
      setStep((s) => s + 1)
      return
    }
    setSaving(true)
    await save.mutateAsync([...selected])
    await new Promise((r) => setTimeout(r, 1200))
    navigate('/painel')
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-6">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div
          className="h-full bg-slate-800 transition-all"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>
      <h1 className="text-xl font-semibold">{current.title}</h1>
      <div className="flex flex-col gap-2">
        {sources.map((s) => (
          <SourceBlock key={s.id} source={s} selected={selected} onToggle={(id) => dispatch({ type: 'toggle', itemId: id })} />
        ))}
        {sources.length === 0 && <p className="text-sm text-slate-500">Nada por aqui ainda.</p>}
      </div>
      <div className="mt-auto flex gap-2">
        {step > 0 && (
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2"
            onClick={() => setStep((s) => s - 1)}
          >
            Voltar
          </button>
        )}
        <button
          type="button"
          className="ml-auto rounded-lg bg-slate-800 px-4 py-2 text-white"
          onClick={next}
        >
          {current.cta}
        </button>
      </div>
    </div>
  )
}
