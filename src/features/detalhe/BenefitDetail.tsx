import { Link, useParams } from 'react-router-dom'
import { useSession } from '../auth/AuthProvider'
import { useBenefit } from '../benefits/useBenefit'

function safeHttpUrl(url: string | null): string | null {
  if (!url) return null
  try {
    const u = new URL(url)
    return u.protocol === 'http:' || u.protocol === 'https:' ? url : null
  } catch {
    return null
  }
}

function sourceLabel(name: string | null, url: string): string {
  if (name) return name
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function formatDate(d: string | null): string | null {
  if (!d) return null
  const parsed = new Date(d + 'T00:00:00')
  return Number.isNaN(parsed.getTime()) ? null : parsed.toLocaleDateString('pt-BR')
}

export function BenefitDetail() {
  const { id } = useParams()
  const { session } = useSession()
  const { benefit, related, isLoading, error } = useBenefit(session?.user.id, id)

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
  const actionUrl = safeHttpUrl(benefit.action_url)
  const sourceUrl = safeHttpUrl(benefit.source_url)
  const collectedAt = formatDate(benefit.observed_at)

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

      {actionUrl && (
        <a
          href={actionUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-2 rounded-lg bg-slate-800 px-4 py-3 text-center font-medium text-white"
        >
          {benefit.action_label ?? 'Resgatar benefício'}
        </a>
      )}

      {sourceUrl && (
        <div className="mt-2 border-t border-slate-100 pt-4">
          <h2 className="mb-1 font-semibold text-slate-900">Fonte</h2>
          <a
            href={sourceUrl}
            target="_blank"
            rel="noreferrer"
            className="text-sm text-slate-700 underline"
          >
            {sourceLabel(benefit.source_name, sourceUrl)}
          </a>
          {collectedAt && (
            <p className="mt-1 text-xs text-slate-500">Informações coletadas em {collectedAt}</p>
          )}
        </div>
      )}

      {related.length > 0 && (
        <div className="mt-2">
          <h2 className="mb-2 font-semibold text-slate-900">Da mesma fonte</h2>
          <ul className="flex flex-col gap-1 text-sm">
            {related.map((r) => (
              <li key={r.id}>
                <Link to={`/beneficio/${r.id}`} className="text-slate-700 underline">
                  {r.title}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
