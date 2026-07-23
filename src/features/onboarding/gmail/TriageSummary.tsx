import { Button } from '../../../ui/Button'
import { formatBRL } from '../../benefits/estimatedValue'
import type { Finding } from './types'

// Conferência final: tudo que foi decidido, confirmados primeiro e descartados depois.
// "Editar" reabre o card daquela marca. Nada é salvo até o CTA.
export function TriageSummary({
  findings, decision, estValue, partial, saving, saveError, onEdit, onBack, onSubmit,
}: {
  findings: Finding[]
  decision: Map<string, string | null>
  estValue: number
  partial: boolean
  saving: boolean
  saveError: boolean
  onEdit: (idx: number) => void
  onBack: () => void
  onSubmit: () => void
}) {
  const rows = findings
    .map((f, idx) => ({ f, idx, itemId: decision.get(f.sourceId) ?? null }))
    // confirmados (itemId string) antes dos descartados (null)
    .sort((a, b) => Number(b.itemId != null) - Number(a.itemId != null))
  const haveCount = rows.filter((r) => r.itemId != null).length

  return (
    <div className="ob">
      <div className="ob-scroll">
        <div className="ob-card">
          <button type="button" className="ob-back-btn" aria-label="Voltar" onClick={onBack} disabled={saving} style={{ marginBottom: 'var(--s3)' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
          </button>
          <p className="lbl" style={{ color: 'var(--ok)' }}>Quase lá</p>
          <h1 className="ob-title">Confira antes de salvar</h1>
          {haveCount > 0 ? (
            <p className="review-progval">≈ <b>{formatBRL(estValue)}</b>/ano em benefícios</p>
          ) : null}

          <div className="review-list">
            {rows.map(({ f, idx, itemId }) => {
              const have = itemId != null
              const tier = have && f.items.length > 1 ? f.items.find((it) => it.id === itemId)?.label : null
              return (
                <div key={f.sourceId} className={'review-item' + (have ? '' : ' review-no')}>
                  <span className="review-item-mark" aria-hidden="true">{f.logo ? <img src={f.logo} alt="" /> : f.provider.charAt(0).toUpperCase()}</span>
                  <span className="review-item-body">
                    <strong>{f.provider}{tier ? ` ${tier}` : ''}</strong>
                    <span className={have ? 'ok' : ''}>{have ? 'tenho' : 'não tenho'}</span>
                  </span>
                  <span className="review-actions">
                    <button type="button" className="review-undo" disabled={saving} onClick={() => onEdit(idx)}>Editar</button>
                  </span>
                </div>
              )
            })}
          </div>

          <p className="review-note">
            Lemos os <b>metadados</b> (remetente, assunto e data) de e-mails das marcas do catálogo — nunca o corpo do e-mail. Guardamos só o que você confirmar aqui.
          </p>
          {partial ? <p className="review-note" role="status">Alguns programas não puderam ser verificados agora; você pode adicionar manualmente depois.</p> : null}
          {saveError ? <p role="alert" aria-live="assertive" className="review-error">Não foi possível salvar. Tente de novo.</p> : null}
        </div>
      </div>
      <div className="ob-foot">
        <div className="ob-foot-inner">
          <div className="ob-cta">
            <Button onClick={onSubmit} disabled={saving}>
              {saving ? 'Salvando…' : haveCount > 0 ? `Adicionar ${haveCount} ao radar` : 'Concluir'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
