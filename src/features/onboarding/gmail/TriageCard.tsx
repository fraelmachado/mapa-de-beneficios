import { useEffect, useRef } from 'react'
import { formatBRL } from '../../benefits/estimatedValue'
import { relTime } from '../../programas/buildPrograms'
import { categoryMeta } from '../categoryMeta'
import { recommendedItemId } from './TierSheet'
import type { Finding } from './types'

// Um card da triagem: uma marca, uma decisão.
// decisão = itemId (tenho essa versão) | null (não tenho). undefined = ainda pendente.
export function TriageCard({
  finding, decision, position, total, hasNext, onDecide, onBack, disabled = false,
}: {
  finding: Finding
  decision: string | null | undefined
  position: number // 1-based
  total: number
  hasNext: boolean
  onDecide: (itemId: string | null) => void
  onBack: () => void
  disabled?: boolean
}) {
  const titleRef = useRef<HTMLHeadingElement>(null)
  // ao trocar de card o foco vai pro título; senão morreria no botão que desmontou.
  useEffect(() => { titleRef.current?.focus() }, [finding.sourceId])

  const cat = categoryMeta(finding.category)
  const multi = finding.items.length > 1
  const recId = multi ? recommendedItemId(finding.items) : ''
  const ev = finding.evidence

  return (
    <div className="ob">
      <div className="ob-scroll">
        <div className="ob-card ob-triage">
          <button type="button" className="ob-back-btn" aria-label="Voltar" onClick={onBack} disabled={disabled}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>

          <div className="ob-triage-prog">
            <div className="ob-triage-dots" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={position} aria-label={`Programa ${position} de ${total}`}>
              {total <= 8
                ? Array.from({ length: total }, (_, i) => (
                    <i key={i} aria-hidden="true" className={i < position - 1 ? 'on' : i === position - 1 ? 'cur' : ''} />
                  ))
                : <span className="ob-triage-bar" aria-hidden="true"><i style={{ width: `${(position / total) * 100}%` }} /></span>}
            </div>
            <span className="ob-triage-count" aria-live="polite">{position} de {total}</span>
          </div>

          <div className="ob-triage-stage">
            {hasNext ? <div className="ob-triage-peek" aria-hidden="true" /> : null}
            <div className="ob-triage-cardface">
              <span className="ob-triage-mark" aria-hidden="true">
                {finding.logo ? <img src={finding.logo} alt="" /> : finding.provider.charAt(0).toUpperCase()}
              </span>
              <p className="ob-triage-eyebrow">
                <i aria-hidden="true" style={{ background: cat.color }} />{cat.label}
              </p>
              <h2 className="ob-triage-name" ref={titleRef} tabIndex={-1}>{finding.provider}</h2>
              <p className="ob-triage-from">achamos no seu Gmail<br /><b>{ev.emailFrom}</b> · {relTime(new Date(ev.emailDate).getTime())}</p>

              {multi ? (
                <>
                  <div className="ob-triage-tiers">
                    {finding.items.map((it) => {
                      const isRec = it.id === recId
                      const picked = decision === it.id
                      return (
                        <button key={it.id} type="button" aria-pressed={picked} disabled={disabled}
                          className={'ob-triage-tier' + (picked ? ' on' : '')} onClick={() => onDecide(it.id)}>
                          <span className="ob-triage-tier-name">
                            {it.label}
                            {isRec && (it.benefitCount ?? 0) > 0 ? <span className="ob-triage-rec">mais completo</span> : null}
                          </span>
                          {it.estValueBrl
                            ? <b>≈ {formatBRL(it.estValueBrl)}/ano</b>
                            : <span className="ob-triage-soon">benefícios em breve</span>}
                        </button>
                      )
                    })}
                  </div>
                  <button type="button" className="ob-triage-unsure" disabled={disabled} onClick={() => onDecide(recId)}>
                    Não tenho certeza — usar a versão mais completa
                  </button>
                  <p className="ob-triage-hint">Qual é o seu? Toque no tipo, ou "Não tenho".</p>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="ob-triage-foot">
        <button type="button" className="ob-triage-no" disabled={disabled} onClick={() => onDecide(null)}>Não tenho</button>
        {!multi ? (
          <button type="button" className="ob-triage-yes" disabled={disabled} onClick={() => onDecide(finding.items[0].id)}>Tenho ›</button>
        ) : null}
      </div>
    </div>
  )
}
