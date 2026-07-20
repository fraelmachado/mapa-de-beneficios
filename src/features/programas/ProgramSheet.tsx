// src/features/programas/ProgramSheet.tsx
import { useEffect, useRef } from 'react'
import type { Program } from './buildPrograms'
import { formatBRL } from '../benefits/estimatedValue'
import { recommendedItemId } from '../onboarding/gmail/TierSheet'

export function ProgramSheet({
  program, onPickTier, onRemove, onClose, busy = false,
}: {
  program: Program
  onPickTier: (itemId: string) => void
  onRemove: () => void
  onClose: () => void
  busy?: boolean
}) {
  const multi = program.items.length > 1
  const title = multi ? `Qual o seu ${program.brand}?` : `${program.brand}${program.tier ? ' ' + program.tier : ''}`
  const sub = program.provenance === 'gmail' ? `Encontrado no Gmail · ${program.from}` : 'Adicionado manualmente'
  const recId = multi ? recommendedItemId(program.items) : ''
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    panel.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="ob-sheet" role="dialog" aria-modal="true" aria-label={title}>
      <div className="ob-sheet-scrim" onClick={onClose} aria-hidden="true" />
      <div className="ob-sheet-panel" ref={panel} tabIndex={-1}>
        <div className="ob-sheet-grip" aria-hidden="true" />
        <h3 className="ob-sheet-title">{title}</h3>
        <p className="ob-sheet-sub">{sub}</p>
        <div className="ob-sheet-list">
          {multi ? program.items.map((it) => {
            const on = it.id === program.itemId
            const isRec = it.id === recId
            return (
              <button key={it.id} type="button" className={'ob-sheet-item' + (on ? ' on' : '')} aria-pressed={on} disabled={busy} onClick={() => onPickTier(it.id)}>
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
                  {it.estValueBrl ? <span className="ob-sheet-item-est"><span className="ob-sheet-approx">≈</span>{formatBRL(it.estValueBrl)}<span className="ob-sheet-year">/ano</span></span> : null}
                  <span className="ob-sheet-radio" aria-hidden="true" />
                </span>
              </button>
            )
          }) : null}
          {multi ? <div className="prg-sheet-div" /> : null}
          <button type="button" className="prg-remove" disabled={busy} onClick={onRemove}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
            Remover do radar
          </button>
        </div>
      </div>
    </div>
  )
}
