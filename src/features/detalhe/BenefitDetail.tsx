import { Link, useParams } from 'react-router-dom'
import { useSession } from '../auth/AuthProvider'
import { useBenefit } from '../benefits/useBenefit'
import { Checklist } from '../../ui/Checklist'
import { Alert } from '../../ui/Alert'
import { categoryToDsCat } from '../benefits/toPassProps'
import { CATEGORIES } from '../benefits/types'
import type { CSSProperties } from 'react'

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

  if (isLoading) return <p className="p-6 muted">Carregando…</p>
  if (error) return <p className="p-6 text-red-600">Erro ao carregar o benefício.</p>
  if (!benefit) {
    return (
      <div className="mx-auto max-w-md p-4">
        <Link to="/painel" className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
          ← Voltar
        </Link>
        <p style={{ marginTop: 'var(--s4)' }}>Benefício não encontrado.</p>
      </div>
    )
  }

  const steps = (benefit.steps ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
  const actionUrl = safeHttpUrl(benefit.action_url)
  const sourceUrl = safeHttpUrl(benefit.source_url)
  const collectedAt = formatDate(benefit.observed_at)

  const dsCat = categoryToDsCat(benefit.category)
  const catLabel = CATEGORIES.find((c) => c.key === benefit.category)?.label ?? 'Benefício'
  const tagStyle = { '--cat': `var(--c-${dsCat})` } as CSSProperties

  return (
    <div className="mx-auto max-w-md p-4 pb-24" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
      <Link to="/painel" className="muted" style={{ fontSize: 13, fontWeight: 600 }}>
        ← Voltar
      </Link>

      <span className="tag" style={{ ...tagStyle, alignSelf: 'flex-start' }}>
        {catLabel}
      </span>
      <h1 style={{ fontSize: 'var(--fz-h1)', fontWeight: 700, letterSpacing: '-.03em', lineHeight: 1.12, margin: 0 }}>
        {benefit.title}
      </h1>

      {benefit.via.length > 0 && (
        <span className="chip" style={{ alignSelf: 'flex-start' }}>
          via&nbsp;<b>{benefit.via.join(', ')}</b>
        </span>
      )}

      {benefit.summary && <p style={{ color: 'var(--ink-2)', margin: 0 }}>{benefit.summary}</p>}

      <Alert>
        <b>Confirme antes de usar.</b> A cobertura depende do cartão elegível e das regras do
        programa, que podem mudar. Cheque o regulamento oficial.
      </Alert>

      {steps.length > 0 && (
        <div>
          <p className="lbl" style={{ margin: '0 0 var(--s2)' }}>
            Como usar
          </p>
          <Checklist items={steps.map((label) => ({ label }))} />
        </div>
      )}

      {actionUrl && (
        <a href={actionUrl} target="_blank" rel="noreferrer" className="btn ink" style={{ textDecoration: 'none' }}>
          {benefit.action_label ?? 'Resgatar benefício'} ↗
        </a>
      )}

      {sourceUrl && (
        <div>
          <p className="lbl" style={{ margin: 'var(--s2) 0 var(--s2)' }}>
            Fonte oficial
          </p>
          <a className="row" href={sourceUrl} target="_blank" rel="noreferrer">
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--s3)' }}>
              <span
                aria-hidden="true"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 800,
                }}
              >
                {sourceLabel(benefit.source_name, sourceUrl).charAt(0).toUpperCase()}
              </span>
              {sourceLabel(benefit.source_name, sourceUrl)}
            </span>
            <span className="muted" aria-hidden="true">
              ↗
            </span>
          </a>
          {collectedAt && (
            <p
              className="muted"
              style={{ fontSize: 12, fontWeight: 500, margin: '4px 2px 0', display: 'flex', alignItems: 'center', gap: 7 }}
            >
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--ok)' }} />
              Informações coletadas em {collectedAt}
            </p>
          )}
        </div>
      )}

      {related.length > 0 && (
        <div>
          <p className="lbl" style={{ margin: 'var(--s2) 0 var(--s2)' }}>
            Da mesma fonte
          </p>
          {related.map((r) => (
            <Link key={r.id} className="row" to={`/beneficio/${r.id}`} style={{ color: 'inherit' }}>
              {r.title}
              <span className="muted" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
