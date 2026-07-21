import type { ReactNode } from 'react'
import { Button } from '../../../ui/Button'

// Fiel ao handoff "Tela 13 - Conectar Gmail": 3 cards de confiança com ícone
// tingido por categoria (verde/cobalt/roxo), cópia honesta e amigável.
const POINTS: { t: string; d: ReactNode; tone: string; ic: ReactNode }[] = [
  {
    t: 'Só o essencial, nada do conteúdo',
    d: <>Lemos apenas os <b>metadados</b> (remetente, assunto, data). O corpo dos e-mails fica intocado.</>,
    tone: 'ok',
    ic: <><rect x="4" y="11" width="16" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  },
  {
    t: 'Você manda no acesso',
    d: 'É temporário e não fica guardado — dá pra revogar quando quiser.',
    tone: 'accent',
    ic: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  },
  {
    t: 'Você decide o que fica',
    d: 'Só guardamos o que você confirmar na próxima tela. Sem conta, apagamos tudo em 30 dias.',
    tone: 'compras',
    ic: <><path d="m9 12 2 2 4-4" /><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></>,
  },
]

const svg = { width: 17, height: 17, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }

// Logo do Gmail (cores do Google) — decorativo; o rótulo acessível do botão continua "Conectar Gmail".
const GmailGlyph = (
  <svg width="18" height="15" viewBox="0 0 48 38" aria-hidden="true">
    <rect x="3" y="6" width="42" height="27" rx="4.5" fill="#fff" stroke="#E8E8E8" strokeWidth="1.4" />
    <path d="M5.5 9.5 L24 24 L42.5 9.5" fill="none" stroke="#EA4335" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M5.5 9.5 V31" stroke="#4285F4" strokeWidth="3.4" strokeLinecap="round" />
    <path d="M42.5 9.5 V31" stroke="#34A853" strokeWidth="3.4" strokeLinecap="round" />
    <path d="M5.5 9.5 L24 24" stroke="#FBBC04" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function GmailConsent({ onConnect, onBack, connecting, error }: {
  onConnect: () => void; onBack: () => void; connecting: boolean; error: boolean
}) {
  return (
    <div className="ob">
      <div className="ob-scroll">
        <div className="ob-card">
          <button type="button" className="ob-back-btn" aria-label="Voltar" onClick={onBack} style={{ marginBottom: 'var(--s4)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>

          <h1 className="gc-title">Vamos achar seus benefícios 🔎</h1>
          <p className="gc-sub">Damos uma olhada nos e-mails das marcas do catálogo (últimos 2 anos) só para sugerir seus programas — combinado?</p>

          <div className="gc-list">
            {POINTS.map((p) => (
              <div key={p.t} className="gc-item">
                <span className={`gc-item-ic ${p.tone}`} aria-hidden="true">
                  <svg {...svg}>{p.ic}</svg>
                </span>
                <div className="gc-item-tx">
                  <p className="gc-item-lead">{p.t}</p>
                  <p className="gc-item-det">{p.d}</p>
                </div>
              </div>
            ))}
          </div>

          {error ? <p role="alert" className="review-error">Não foi possível conectar ao Google. Tente de novo.</p> : null}
        </div>
      </div>
      <div className="ob-foot"><div className="ob-foot-inner"><div className="ob-cta gc-cta">
        <Button onClick={onConnect} disabled={connecting} icon={GmailGlyph}>{connecting ? 'Conectando…' : 'Conectar Gmail'}</Button>
        <p className="gc-reassure">Leva alguns segundos · você aprova tudo antes de salvar</p>
      </div></div></div>
    </div>
  )
}
