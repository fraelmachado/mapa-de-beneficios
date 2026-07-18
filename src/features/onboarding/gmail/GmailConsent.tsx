import { Button } from '../../../ui/Button'

export function GmailConsent({ onConnect, onBack, connecting, error }: {
  onConnect: () => void; onBack: () => void; connecting: boolean; error: boolean
}) {
  return (
    <div className="ob">
      <div className="ob-scroll">
        <div className="ob-card">
          <button type="button" className="ob-back-btn" aria-label="Voltar" onClick={onBack} style={{ marginBottom: 'var(--s3)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <h1 className="ob-title">Conectar seu Gmail</h1>
          <p className="ob-sub">Procuramos e-mails das marcas do catálogo dos últimos 2 anos para sugerir seus programas.</p>
          <ul className="ob-consent-list">
            <li>Lemos só os <b>metadados</b> (remetente, assunto, data) — nunca o conteúdo dos e-mails.</li>
            <li>O acesso é temporário e não fica guardado; você revoga quando quiser.</li>
            <li>Guardamos no servidor só o que você confirmar na próxima tela.</li>
            <li>Sem conta cadastrada, esses dados são apagados em 30 dias.</li>
          </ul>
          {error ? <p role="alert" className="review-error">Não foi possível conectar ao Google. Tente de novo.</p> : null}
        </div>
      </div>
      <div className="ob-foot"><div className="ob-foot-inner"><div className="ob-cta">
        <Button onClick={onConnect} disabled={connecting}>{connecting ? 'Conectando…' : 'Conectar Gmail'}</Button>
      </div></div></div>
    </div>
  )
}
