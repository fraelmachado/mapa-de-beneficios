import type { Source } from '../types'
import { formatBRL } from '../../benefits/estimatedValue'

// tier "Mais completo": mais benefícios, desempate por maior valor estimado.
export function recommendedItemId(items: Source['source_items']): string {
  let bestId = ''
  let bestScore = -1
  for (const it of items) {
    const score = (it.benefitCount ?? 0) * 1e6 + (it.estValueBrl ?? 0)
    if (score > bestScore) { bestScore = score; bestId = it.id }
  }
  return bestId
}

export function TierSheet({
  brand, selectedId, onPick, onClose,
}: {
  brand: Source
  selectedId: string | null
  onPick: (itemId: string, markUnsure?: boolean) => void
  onClose: () => void
}) {
  const recId = recommendedItemId(brand.source_items)
  return (
    <div className="ob-sheet" role="dialog" aria-modal="true" aria-label={`Qual o seu ${brand.name}?`}>
      <div className="ob-sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div className="ob-sheet-panel">
        <div className="ob-sheet-grip" aria-hidden="true" />
        <h3 className="ob-sheet-title">Qual o seu {brand.name}?</h3>
        <p className="ob-sheet-sub">Os benefícios mudam conforme a versão. Escolha a sua para o radar acertar.</p>
        <div className="ob-sheet-list">
          {brand.source_items.map((it) => {
            const isRec = it.id === recId
            const picked = selectedId === it.id
            return (
              <button key={it.id} type="button" className={'ob-sheet-item' + (picked ? ' on' : '')}
                aria-pressed={picked} onClick={() => onPick(it.id)}>
                <span className="ob-sheet-item-main">
                  <span className="ob-sheet-item-head">
                    <span className="ob-sheet-item-name">{it.label}</span>
                    {isRec && (it.benefitCount ?? 0) > 0 ? <span className="ob-sheet-badge">Mais completo</span> : null}
                  </span>
                  <span className="ob-sheet-item-meta">
                    {it.benefitCount ? `${it.benefitCount} benefício${it.benefitCount > 1 ? 's' : ''}` : 'Benefícios em breve'}
                  </span>
                </span>
                <span className="ob-sheet-item-side">
                  {it.estValueBrl ? (
                    <span className="ob-sheet-item-est"><span className="ob-sheet-approx">≈</span>{formatBRL(it.estValueBrl)}<span className="ob-sheet-year">/ano</span></span>
                  ) : null}
                  <span className="ob-sheet-radio" aria-hidden="true" />
                </span>
              </button>
            )
          })}
          <button type="button" className="ob-sheet-unsure" onClick={() => onPick(recId, true)}>
            <span>
              <span className="ob-sheet-unsure-title">Não tenho certeza</span>
              <span className="ob-sheet-unsure-sub">Mostramos o potencial e você confirma depois</span>
            </span>
            <span className="ob-sheet-chevron" aria-hidden="true">›</span>
          </button>
        </div>
        <div className="ob-sheet-hint">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0c1 8 4 11 12 12-8 1-11 4-12 12-1-8-4-11-12-12 8-1 11-4 12-12Z" /></svg>
          <p>Conectando o Gmail, descobrimos sua versão exata automaticamente — sem precisar escolher.</p>
        </div>
      </div>
    </div>
  )
}
