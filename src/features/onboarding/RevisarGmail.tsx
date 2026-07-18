import { useMemo, useState } from 'react'
import { useAddGmailSources } from './useAddGmailSources'
import { TierSheet } from './gmail/TierSheet'
import { Button } from '../../ui/Button'
import { formatBRL } from '../benefits/estimatedValue'
import type { Finding } from './gmail/types'
import type { GmailSourcePayload } from './gmail/types'

export function RevisarGmail({
  findings, partial, onDone, onBack,
}: {
  findings: Finding[]
  partial: boolean
  onDone: (saved: Finding[]) => void
  onBack?: () => void
}) {
  const add = useAddGmailSources()
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  const [chosen, setChosen] = useState<Map<string, string>>(new Map()) // sourceId → itemId (multi)
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  const included = findings.filter((f) => !excluded.has(f.sourceId))
  // resolvido: item único (auto) ou multi com tier escolhido
  const resolvedItem = (f: Finding): string | null =>
    f.items.length === 1 ? f.items[0].id : chosen.get(f.sourceId) ?? null
  const blocked = included.some((f) => resolvedItem(f) === null)
  const estValue = useMemo(
    () => included.reduce((acc, f) => {
      const id = resolvedItem(f)
      const it = f.items.find((x) => x.id === id)
      return acc + (it?.estValueBrl ?? 0)
    }, 0),
    [included, chosen],
  )

  function toggle(sourceId: string) {
    setExcluded((prev) => { const n = new Set(prev); n.has(sourceId) ? n.delete(sourceId) : n.add(sourceId); return n })
  }

  async function submit() {
    if (blocked || included.length === 0 || saving) return
    setSaving(true); setSaveError(false)
    const payload: GmailSourcePayload[] = included.map((f) => ({
      item_id: resolvedItem(f)!, source_id: f.sourceId, gmail_account: f.evidence.gmailAccount,
      gmail_message_id: f.evidence.gmailMessageId, email_from: f.evidence.emailFrom,
      email_subject: f.evidence.emailSubject, email_date: f.evidence.emailDate,
    }))
    try {
      await add.mutateAsync(payload)
      onDone(included)
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
          <p className="review-count">incluídos <b>{formatBRL(estValue)}</b>/ano estimado</p>
          <div className="review-list">
            {findings.map((f) => {
              const on = !excluded.has(f.sourceId)
              const multi = f.items.length > 1
              const pickedId = chosen.get(f.sourceId)
              const pickedLabel = multi ? (f.items.find((it) => it.id === pickedId)?.label ?? 'Escolher versão') : f.items[0]?.label
              return (
                <button key={f.sourceId} type="button"
                  className={'review-item' + (on ? '' : ' off')}
                  aria-pressed={on}
                  aria-haspopup={multi ? 'dialog' : undefined}
                  onClick={() => (multi ? setSheetId(f.sourceId) : toggle(f.sourceId))}>
                  <span className="review-item-mark" aria-hidden="true">{f.logo ? <img src={f.logo} alt="" /> : f.provider.charAt(0).toUpperCase()}</span>
                  <span className="review-item-body"><strong>{f.provider} {pickedLabel}</strong><span>via {f.provider}</span></span>
                  <span className={'review-check' + (on ? ' on' : '')} aria-hidden="true">{on ? '✓' : '+'}</span>
                </button>
              )
            })}
          </div>
          <p className="review-note">
            Lemos os <b>metadados</b> (remetente, assunto e data) de e-mails das marcas do catálogo — nunca o corpo do e-mail. Guardamos só o que você confirmar aqui.
          </p>
          {partial ? <p className="review-note" role="status">Alguns programas não puderam ser verificados agora; você pode adicionar manualmente depois.</p> : null}
          {blocked ? <p className="review-note" role="status">Escolha a versão das marcas com “Escolher versão” para continuar.</p> : null}
          {saveError ? <p role="alert" aria-live="assertive" className="review-error">Não foi possível salvar. Tente de novo.</p> : null}
        </div>
      </div>
      <div className="ob-foot">
        <div className="ob-foot-inner">
          <div className="ob-cta">
            <Button onClick={submit} disabled={blocked || included.length === 0 || saving}>
              {saving ? 'Salvando…' : 'Adicionar ao radar'}
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
            setExcluded((prev) => { const n = new Set(prev); n.delete(sheetBrand.sourceId); return n })
            setSheetId(null)
          }}
          onClose={() => setSheetId(null)}
          onRemove={() => {
            setExcluded((prev) => new Set(prev).add(sheetBrand.sourceId))
            setChosen((prev) => { const n = new Map(prev); n.delete(sheetBrand.sourceId); return n })
            setSheetId(null)
          }}
        />
      ) : null}
    </div>
  )
}
