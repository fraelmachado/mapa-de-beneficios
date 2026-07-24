import { Link, useParams } from 'react-router-dom'
import { useSession } from '../auth/AuthProvider'
import { useBenefit } from '../benefits/useBenefit'
import { useFavorites, useToggleFavorite } from '../benefits/useFavorites'
import { Checklist } from '../../ui/Checklist'
import { Alert } from '../../ui/Alert'
import { PageState } from '../../ui/PageState'
import { Skeleton } from '../../ui/Skeleton'
import { categoryToDsCat } from '../benefits/toPassProps'
import { formatBRL } from '../benefits/estimatedValue'
import { CATEGORIES } from '../benefits/types'
import type { CSSProperties } from 'react'
import { normalizeHttpUrl } from '../../lib/actionLink'
import './benefit-detail.css'

function safeHttpUrl(url: string | null): string | null {
  return normalizeHttpUrl(url)
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
  const { benefit, related, isLoading, error, refetch } = useBenefit(session?.user.id, id)
  const { data: favIds } = useFavorites(session?.user.id)
  const toggleFav = useToggleFavorite(session?.user.id)

  if (isLoading) return <div className="detail-loading" role="status" aria-label="Carregando benefício" aria-busy="true"><Skeleton height="24px" width="90px" /><Skeleton height="38px" /><Skeleton variant="pass" /></div>
  if (error) return <div className="detail-notfound"><PageState title="Não foi possível carregar este benefício" action={{ label: 'Tentar novamente', onClick: () => void refetch() }} /></div>
  if (!benefit) return <div className="detail-notfound"><Link to="/painel" className="detail-back">← Voltar</Link><PageState title="Benefício não encontrado" description="Ele pode ter sido removido do seu radar." /></div>

  const steps = (benefit.steps ?? '').split('\n').map((s) => s.trim()).filter(Boolean)
  const actionUrl = safeHttpUrl(benefit.action_url)
  const sourceUrl = safeHttpUrl(benefit.source_url)
  const collectedAt = formatDate(benefit.observed_at)

  const isFav = !!favIds?.includes(benefit.id)
  const dsCat = categoryToDsCat(benefit.category)
  const catLabel = CATEGORIES.find((c) => c.key === benefit.category)?.label ?? 'Benefício'
  const heroStyle = { '--cat': `var(--c-${dsCat})` } as CSSProperties

  return (
    <article className="detail-page">
      <div className="detail-hero" style={heroStyle}>
        <div className="detail-hero-inner">
          <div className="detail-hero-top">
            <Link to="/painel" className="detail-hero-btn" aria-label="Voltar">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </Link>
            <button
              type="button"
              className={`detail-hero-btn${isFav ? ' is-on' : ''}`}
              aria-label={isFav ? 'Remover dos salvos' : 'Salvar benefício'}
              aria-pressed={isFav}
              disabled={toggleFav.isPending}
              onClick={() => toggleFav.mutate({ benefitId: benefit.id, on: !isFav })}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" /></svg>
            </button>
          </div>
          <div className="detail-hero-body">
            <span className="detail-hero-tag">{catLabel}</span>
            <h1>{benefit.title}</h1>
            {benefit.via.length > 0 ? <div><span className="detail-hero-via">via&nbsp;<b>{benefit.via.join(', ')}</b></span></div> : null}
            {benefit.summary ? <p>{benefit.summary}</p> : null}
            {benefit.estimated_value_brl != null ? (
              <div className="detail-hero-value">valor estimado <b>≈ {formatBRL(benefit.estimated_value_brl)}</b><span>/ano</span></div>
            ) : null}
          </div>
        </div>
      </div>
      <div className="detail-content">
        <Alert><b>Confirme antes de usar.</b> A cobertura depende do produto elegível e das regras oficiais, que podem mudar.</Alert>
        {steps.length > 0 ? <section><p className="lbl">Como usar</p><Checklist items={steps.map((label) => ({ label }))} /></section> : null}
        {actionUrl ? <a href={actionUrl} target="_blank" rel="noreferrer" className="btn ink">{benefit.action_label ?? 'Resgatar benefício'} ↗</a> : null}
        {sourceUrl ? (
          <section>
            <p className="lbl">Fonte oficial</p>
            <a className="row" href={sourceUrl} target="_blank" rel="noreferrer">
              <span className="detail-source"><span aria-hidden="true">{sourceLabel(benefit.source_name, sourceUrl).charAt(0).toUpperCase()}</span>{sourceLabel(benefit.source_name, sourceUrl)}</span>
              <span className="muted" aria-hidden="true">↗</span>
            </a>
            {collectedAt ? <p className="detail-date"><i />Informações coletadas em {collectedAt}</p> : null}
          </section>
        ) : null}
        {related.length > 0 ? (
          <section>
            <p className="lbl">Da mesma fonte</p>
            {related.map((item) => <Link key={item.id} className="row" to={`/beneficio/${item.id}`}>{item.title}<span className="muted" aria-hidden="true">→</span></Link>)}
          </section>
        ) : null}
      </div>
    </article>
  )
}
