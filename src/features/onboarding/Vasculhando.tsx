import { useEffect, useState } from 'react'
import { Button } from '../../ui/Button'

const LABELS = ['Procurando seus programas…', 'Cruzando com o catálogo…', 'Montando seu radar…']
const DURATION = 2400

const reduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

export function Vasculhando({ count, onDone, onBack }: { count: number; onDone: () => void; onBack?: () => void }) {
  const [done, setDone] = useState(() => reduced())
  const [n, setN] = useState(() => (reduced() ? count : 0))
  const [labelIdx, setLabelIdx] = useState(0)

  useEffect(() => {
    if (reduced() || typeof requestAnimationFrame === 'undefined') { setN(count); setDone(true); return }
    const start = performance.now()
    let raf = 0
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / DURATION)
      setN(Math.round(count * p))
      setLabelIdx(Math.min(LABELS.length - 1, Math.floor(p * LABELS.length)))
      if (p < 1) raf = requestAnimationFrame(tick)
      else setDone(true)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [count])

  return (
    <main className="scan-page">
      <div className="scan-inner">
        {onBack ? (
          <button type="button" className="ob-back-btn scan-back" aria-label="Voltar" onClick={onBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
        ) : null}
        <div className="scan-radar" aria-hidden="true">
          {!done ? <span className="scan-sweep" /> : null}
          {!done ? <span className="scan-ping" /> : null}
          <span className="scan-dot scan-dot-1" />
          <span className="scan-dot scan-dot-2" />
          <span className="scan-dot scan-dot-3" />
        </div>
        <div className="scan-count">{n}</div>
        <div className="scan-count-label">programas encontrados</div>
        <div className="scan-status" role="status">{done ? 'Pronto!' : LABELS[labelIdx]}</div>
        <div className="scan-progress"><span style={{ width: done ? '100%' : `${Math.round((n / Math.max(count, 1)) * 100)}%` }} /></div>
        {done ? <div className="scan-cta mb-rise"><Button onClick={onDone}>Ver meus benefícios →</Button></div> : null}
      </div>
    </main>
  )
}
