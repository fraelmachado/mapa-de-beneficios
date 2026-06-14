import { Link, useParams } from 'react-router-dom'
import { useSession } from '../auth/AuthProvider'
import { useBenefit } from '../benefits/useBenefit'

export function BenefitDetail() {
  const { id } = useParams()
  const { session } = useSession()
  const { benefit, isLoading, error } = useBenefit(session?.user.id, id)

  if (isLoading) return <p className="p-6 text-slate-500">Carregando…</p>
  if (error) return <p className="p-6 text-red-600">Erro ao carregar o benefício.</p>
  if (!benefit) {
    return (
      <div className="p-6">
        <Link to="/painel" className="text-sm text-slate-500">← Voltar</Link>
        <p className="mt-4 text-slate-700">Benefício não encontrado.</p>
      </div>
    )
  }

  const steps = (benefit.steps ?? '').split('\n').map((s) => s.trim()).filter(Boolean)

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4">
      <Link to="/painel" className="text-sm text-slate-500">← Voltar</Link>
      <h1 className="text-2xl font-bold text-slate-900">{benefit.title}</h1>
      {benefit.via.length > 0 && (
        <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600">
          via {benefit.via.join(', ')}
        </span>
      )}
      <p className="text-slate-700">{benefit.summary}</p>

      {steps.length > 0 && (
        <div>
          <h2 className="mb-2 font-semibold text-slate-900">Como usar</h2>
          <ol className="flex flex-col gap-1 text-sm text-slate-700">
            {steps.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ol>
        </div>
      )}

      {benefit.action_url && (
        <a
          href={benefit.action_url}
          target="_blank"
          rel="noreferrer"
          className="mt-2 rounded-lg bg-slate-800 px-4 py-3 text-center font-medium text-white"
        >
          {benefit.action_label ?? 'Resgatar benefício'}
        </a>
      )}
    </div>
  )
}
