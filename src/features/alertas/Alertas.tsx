import { useNavigate, useSearchParams } from 'react-router-dom'
import './alertas.css'
import { useAlertPrefs } from './useAlertPrefs'
import { Button } from '../../ui/Button'

const ROWS = [
  { key: 'novos' as const, title: 'Novos benefícios', desc: 'Quando acharmos algo novo nos seus programas.' },
  { key: 'prazo' as const, title: 'Prazo de expiração', desc: 'Antes que um acesso ou promoção acabe.' },
  { key: 'resumo' as const, title: 'Resumo mensal', desc: 'Um panorama do que você deixou de usar.' },
]

export function Alertas() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const onboarding = params.get('from') === 'onboarding'
  const { prefs, set } = useAlertPrefs()

  function toggle(key: 'novos' | 'prazo' | 'resumo') {
    const next = { ...prefs, [key]: !prefs[key] }
    const optIn = onboarding ? prefs.optIn : next.novos || next.prazo || next.resumo
    set({ [key]: next[key], optIn })
  }

  return (
    <main className="alerts-page">
      <div className="alerts-inner">
        <header className="alerts-head">
          {!onboarding ? (
            <button type="button" className="ob-back-btn" aria-label="Voltar" onClick={() => navigate('/perfil')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          ) : null}
          <span className="alerts-bell" aria-hidden="true">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
          </span>
          <h1>Não perca um benefício</h1>
          <p>Escolha o que quer receber. Você pode mudar depois no seu perfil.</p>
        </header>

        <div className="alerts-list">
          {ROWS.map((r) => (
            <button key={r.key} type="button" role="switch" aria-checked={prefs[r.key]}
              className={'alerts-row' + (prefs[r.key] ? ' on' : '')} onClick={() => toggle(r.key)}>
              <span className="alerts-row-text"><strong>{r.title}</strong><span>{r.desc}</span></span>
              <span className="alerts-switch" aria-hidden="true"><span className="alerts-knob" /></span>
            </button>
          ))}
        </div>

        <p className="sr-only" role="status" aria-live="polite">
          {[prefs.novos && 'Novos benefícios', prefs.prazo && 'Prazo de expiração', prefs.resumo && 'Resumo mensal'].filter(Boolean).join(', ') || 'Nenhum alerta ativo'}
        </p>

        {onboarding ? (
          <div className="alerts-actions">
            <Button onClick={() => { set({ optIn: true }); navigate('/painel') }}>Ativar alertas</Button>
            <button type="button" className="ob-secondary" onClick={() => { set({ optIn: false }); navigate('/painel') }}>Agora não</button>
          </div>
        ) : null}
      </div>
    </main>
  )
}
