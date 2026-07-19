import { useState } from 'react'
import { useAddGmailSources } from './useAddGmailSources'
import { TierSheet } from './gmail/TierSheet'
import { Button } from '../../ui/Button'
import { formatBRL } from '../benefits/estimatedValue'
import type { Finding, GmailSourcePayload } from './gmail/types'

type Decision = 'have' | 'no'

export function RevisarGmail({
  findings, partial, onDone, onBack,
}: {
  findings: Finding[]
  partial: boolean
  onDone: (saved: Finding[]) => void
  onBack?: () => void
}) {
  const add = useAddGmailSources()
  // ausente = pendente; 'have' = tenho; 'no' = não tenho
  const [decision, setDecision] = useState<Map<string, Decision>>(new Map())
  const [chosen, setChosen] = useState<Map<string, string>>(new Map()) // sourceId → itemId (multi)
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const total = findings.length
  const pendingCount = findings.filter((f) => !decision.has(f.sourceId)).length
  const decided = total - pendingCount
  const haveList = findings.filter((f) => decision.get(f.sourceId) === 'have')
  // item resolvido de um finding "have": item único, ou o tier escolhido (multi)
  const resolvedItem = (f: Finding): string => (f.items.length === 1 ? f.items[0].id : chosen.get(f.sourceId)!)
  const estValue = haveList.reduce((acc, f) => {
    const it = f.items.find((x) => x.id === resolvedItem(f))
    return acc + (it?.estValueBrl ?? 0)
  }, 0)
  const blocked = pendingCount > 0

  function setHave(sourceId: string) {
    setDecision((prev) => new Map(prev).set(sourceId, 'have'))
  }
  function setNo(sourceId: string) {
    setDecision((prev) => new Map(prev).set(sourceId, 'no'))
    setChosen((prev) => { const n = new Map(prev); n.delete(sourceId); return n })
  }
  function setPending(sourceId: string) {
    setDecision((prev) => { const n = new Map(prev); n.delete(sourceId); return n })
    setChosen((prev) => { const n = new Map(prev); n.delete(sourceId); return n })
  }

  async function submit() {
    if (blocked || saving) return
    setSaving(true); setSaveError(false)
    try {
      if (haveList.length > 0) {
        const payload: GmailSourcePayload[] = haveList.map((f) => ({
          item_id: resolvedItem(f), source_id: f.sourceId, gmail_account: f.evidence.gmailAccount,
          gmail_message_id: f.evidence.gmailMessageId, email_from: f.evidence.emailFrom,
          email_subject: f.evidence.emailSubject, email_date: f.evidence.emailDate,
        }))
        await add.mutateAsync(payload)
      }
      onDone(haveList)
    } catch {
      setSaving(false); setSaveError(true)
    }
  }

  const sheetBrand = sheetId ? findings.find((f) => f.sourceId === sheetId) : null

  return (
    <div className="ob">
      <div className="ob-scroll">
        <div className="ob-card">
          {onBack ? (
            <button type="button" className="ob-back-btn" aria-label="Voltar" onClick={onBack} style={{ marginBottom: 'var(--s3)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          ) : null}
          <p className="lbl" style={{ color: 'var(--ok)' }}>{partial ? 'Descoberta parcial' : 'Descoberta concluída'}</p>
          <h1 className="ob-title">Revise o que encontramos</h1>

          <div className="review-prog">
            <span>confirme cada um</span>
            <span><b>{decided}</b> de {total}</span>
          </div>
          <div className="review-bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={decided}>
            <i style={{ width: total ? `${(decided / total) * 100}%` : '0%' }} />
          </div>
          {haveList.length > 0 ? (
            <p className="review-progval">≈ <b>{formatBRL(estValue)}</b>/ano em benefícios</p>
          ) : null}

          <div className="review-list">
            {findings.map((f) => {
              const status = decision.get(f.sourceId)
              const multi = f.items.length > 1
              const pickedLabel = f.items.find((it) => it.id === (multi ? chosen.get(f.sourceId) : f.items[0]?.id))?.label
              const cls = status === 'have' ? ' review-done' : status === 'no' ? ' review-no' : ' review-pend'
              const sub =
                status === 'have' ? `tenho • via ${f.provider}`
                : status === 'no' ? 'não tenho'
                : multi ? `escolher versão • via ${f.provider}`
                : `confirme • via ${f.provider}`
              return (
                <div key={f.sourceId} className={'review-item' + cls}>
                  <span className="review-item-mark" aria-hidden="true">{f.logo ? <img src={f.logo} alt="" /> : f.provider.charAt(0).toUpperCase()}</span>
                  <span className="review-item-body">
                    <strong>{f.provider}{status === 'have' && pickedLabel && multi ? ` ${pickedLabel}` : ''}</strong>
                    <span className={status === 'have' ? 'ok' : status === 'no' ? '' : 'pend'}>{sub}</span>
                  </span>
                  <span className="review-actions">
                    {status === undefined ? (
                      <>
                        <button type="button" className="review-yes" aria-haspopup={multi ? 'dialog' : undefined}
                          onClick={() => (multi ? setSheetId(f.sourceId) : setHave(f.sourceId))}>
                          {multi ? 'Tenho ›' : 'Tenho'}
                        </button>
                        <button type="button" className="review-no-btn" onClick={() => setNo(f.sourceId)}>Não</button>
                      </>
                    ) : status === 'have' ? (
                      <>
                        <span className="review-check ok" aria-hidden="true">✓</span>
                        <button type="button" className="review-undo"
                          onClick={() => (multi ? setSheetId(f.sourceId) : setPending(f.sourceId))}>
                          {multi ? 'trocar' : 'desfazer'}
                        </button>
                      </>
                    ) : (
                      <button type="button" className="review-undo" onClick={() => setPending(f.sourceId)}>desfazer</button>
                    )}
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
            <Button onClick={submit} disabled={blocked || saving}>
              {saving ? 'Salvando…'
                : blocked ? `Falta${pendingCount > 1 ? 'm' : ''} ${pendingCount}`
                : haveList.length > 0 ? `Adicionar ${haveList.length} ao radar`
                : 'Concluir'}
            </Button>
          </div>
        </div>
      </div>
      {sheetBrand ? (
        <TierSheet
          brand={{ id: sheetBrand.sourceId, name: sheetBrand.provider, logo_url: sheetBrand.logo, kind: 'card', sort_order: 0, source_items: sheetBrand.items }}
          selectedId={chosen.get(sheetBrand.sourceId) ?? null}
          onPick={(itemId) => {
            setChosen((prev) => new Map(prev).set(sheetBrand.sourceId, itemId))
            setDecision((prev) => new Map(prev).set(sheetBrand.sourceId, 'have'))
            setSheetId(null)
          }}
          onClose={() => setSheetId(null)}
          onRemove={() => {
            setNo(sheetBrand.sourceId)
            setSheetId(null)
          }}
        />
      ) : null}
    </div>
  )
}
