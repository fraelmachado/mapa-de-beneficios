import { useEffect, useState } from 'react'
import { Button } from '../../ui/Button'
import { Pass } from '../../ui/Pass'

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

function useCountUp(target: number, ms = 900) {
  const [n, setN] = useState(() => (prefersReducedMotion() ? target : 0))
  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame === 'undefined') {
      setN(target)
      return
    }
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / ms)
      setN(Math.round(target * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return n
}

function RadarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="#fff" strokeWidth="1.5">
      <circle cx="8" cy="8" r="6.4" />
      <circle cx="8" cy="8" r="3" />
      <circle cx="8" cy="8" r="1" fill="#fff" stroke="none" />
    </svg>
  )
}

export function WelcomeStep({
  onContinue,
  onSkip,
  onLogin,
}: {
  onContinue: () => void
  onSkip?: () => void
  onLogin?: () => void
}) {
  const value = useCountUp(2480)
  return (
    <main className="ob-welcome">
      <div className="ob-welcome-wash" aria-hidden="true" />
      <div className="ob-topbar">
        <span className="ob-wordmark">
          <span className="ob-wordmark-icon" aria-hidden="true"><RadarIcon /></span>
          Mapa de Benefícios
        </span>
        <button type="button" className="ob-skip" onClick={onSkip}>Pular</button>
      </div>
      <div className="ob-welcome-inner">
        <div className="ob-fan" aria-hidden="true">
          <div className="ob-fan-card ob-fan-left mb-bob">
            <div><Pass title="Cashback 5%" via="Nubank Ultravioleta" category="cashback" tag="ativo" originType="parceiro" originLabel="Parceiro" /></div>
          </div>
          <div className="ob-fan-card ob-fan-right mb-bob">
            <div><Pass title="Seguro viagem" via="Visa Infinite" category="seguro" isNew originType="bandeira" originLabel="Bandeira" /></div>
          </div>
          <div className="ob-fan-card ob-fan-center mb-bob">
            <div><Pass title="Sala VIP no aeroporto" via="Itaú Personnalité" category="airport" tag="ilimitado" originType="emissor" originLabel="Emissor" /></div>
          </div>
        </div>
        <div className="ob-welcome-copy">
          <p className="ob-welcome-eyebrow mb-rise">Seu radar de benefícios</p>
          <h1 className="mb-rise">Você tem benefícios esperando por você</h1>
          <p className="mb-rise">Salas VIP, seguros e cashback já estão inclusos nos seus cartões. A gente encontra tudo — e mostra como usar.</p>
        </div>
        <div className="ob-value-pill mb-rise">
          <span className="ob-value-pill-icon" aria-hidden="true">↑</span>
          <span className="ob-value-pill-text">em média<br /><b>R$ {value.toLocaleString('pt-BR')}</b> por ano em benefícios</span>
        </div>
        <div className="ob-welcome-actions">
          <Button onClick={onContinue}>Mapear meus benefícios →</Button>
          <button type="button" className="ob-secondary" onClick={onLogin}>Já tenho conta</button>
          <div className="ob-dots" aria-hidden="true"><i className="on" /><i /><i /></div>
        </div>
      </div>
    </main>
  )
}

function GmailGlyph() {
  return (
    <svg width="26" height="20" viewBox="0 0 48 38" aria-hidden="true">
      <rect x="3" y="6" width="42" height="27" rx="4.5" fill="#fff" stroke="#E8E8E8" strokeWidth="1.4" />
      <path d="M5.5 9.5 L24 24 L42.5 9.5" fill="none" stroke="#EA4335" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M5.5 9.5 V31" stroke="#4285F4" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M42.5 9.5 V31" stroke="#34A853" strokeWidth="3.4" strokeLinecap="round" />
      <path d="M5.5 9.5 L24 24" stroke="#FBBC04" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TwinkleStar({ size, style }: { size: number; style: React.CSSProperties }) {
  return (
    <span className="ob-twinkle" style={style}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c1 8 4 11 12 12-8 1-11 4-12 12-1-8-4-11-12-12 8-1 11-4 12-12Z" /></svg>
    </span>
  )
}

export function MethodStep({ onManual, onBack }: { onManual: () => void; onBack?: () => void }) {
  return (
    <main className="ob-method">
      <div className="ob-method-inner">
        <div className="ob-method-top">
          <button type="button" className="ob-back-btn" aria-label="Voltar" onClick={onBack}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <div className="ob-dots" aria-hidden="true"><i /><i className="on" /><i /></div>
          <span style={{ width: 38, height: 38 }} />
        </div>
        <div className="ob-method-head">
          <p className="lbl">Passo 2 de 3</p>
          <h1>Como quer encontrar seus benefícios?</h1>
          <p>Escolha um método — dá pra mudar depois.</p>
        </div>
        <div className="ob-options">
          <button type="button" className="ob-option ob-option-gmail" disabled>
            <span className="ob-option-fx" aria-hidden="true">
              <span className="ob-aurora ob-aurora-1" />
              <span className="ob-aurora ob-aurora-2" />
              <TwinkleStar size={13} style={{ top: 13, right: 54 }} />
              <TwinkleStar size={9} style={{ top: 32, right: 42, color: 'var(--c-pontos)' }} />
              <TwinkleStar size={9} style={{ left: 46, top: 9, color: 'var(--c-cashback)' }} />
            </span>
            <span className="ob-option-row">
              <span className="ob-option-icon gmail"><GmailGlyph /></span>
              <span className="ob-option-body">
                <span className="ob-option-titles">
                  <strong>Conectar Gmail</strong>
                  <span className="ob-badge-soon">Em breve</span>
                </span>
                <p>Revelamos os benefícios escondidos nos seus e-mails — em segundos, como num passe de mágica.</p>
                <span className="ob-tags">
                  <span className="ob-tag">Mais rápido</span>
                  <span className="ob-tag">Você revisa antes de salvar</span>
                </span>
              </span>
              <span className="ob-option-radio" aria-hidden="true" />
            </span>
          </button>
          <button type="button" className="ob-option" aria-pressed="true" onClick={onManual}>
            <span className="ob-option-row">
              <span className="ob-option-icon manual">
                <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2.5" y="6" width="19" height="12.5" rx="2.5" /><path d="M2.5 10h19" /><path d="M16.5 14.5h2.5" /></svg>
              </span>
              <span className="ob-option-body">
                <span className="ob-option-titles">
                  <strong>Adicionar manualmente</strong>
                  <span className="ob-badge-soon">No controle</span>
                </span>
                <p>Escolha seus programas de benefícios numa lista — cartões, assinaturas, saúde e mais. Sem conectar e-mail.</p>
                <span className="ob-tags"><span className="ob-tag">Leva ~2 min</span></span>
              </span>
              <span className="ob-option-radio" aria-hidden="true" />
            </span>
          </button>
        </div>
        <div className="ob-trust">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><rect x="4.5" y="10.5" width="15" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /></svg>
          <p>Acesso <b>somente leitura</b>. Lemos apenas e-mails sobre seus benefícios e programas — nada é compartilhado ou armazenado.</p>
        </div>
        <div className="ob-method-actions">
          <Button onClick={onManual}>Adicionar cartões →</Button>
        </div>
      </div>
    </main>
  )
}
