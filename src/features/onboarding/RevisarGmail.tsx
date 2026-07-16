import { useState } from 'react'
import { useUserSources } from './useUserSources'
import { useSaveUserSources } from './useSaveUserSources'
import { useSession } from '../auth/AuthProvider'
import { Button } from '../../ui/Button'
import type { Finding } from './demoFindings'

export function RevisarGmail({ findings, onDone, onBack }: { findings: Finding[]; onDone: (included: Finding[]) => void; onBack?: () => void }) {
  const { session } = useSession()
  const existingQuery = useUserSources(session?.user.id)
  const save = useSaveUserSources()
  const [included, setIncluded] = useState<Set<string>>(() => new Set(findings.map((f) => f.itemId)))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState(false)

  // Erro ao carregar os existentes NÃO substitui a tela (preserva as escolhas);
  // vira alerta inline com retry e trava a CTA (não dá pra fazer merge seguro sem eles).
  const existingError = !!existingQuery.error
  const existingLoading = existingQuery.isLoading || existingQuery.data === undefined
  const includedList = findings.filter((f) => included.has(f.itemId))
  const value = `R$ ${(includedList.length * 180).toLocaleString('pt-BR')}`

  function toggle(id: string) {
    setIncluded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }

  async function submit() {
    if (includedList.length === 0 || existingLoading || saving) return
    setSaving(true); setSaveError(false)
    try {
      const merged = new Set<string>([...(existingQuery.data ?? []), ...included])
      await save.mutateAsync([...merged])
      onDone(includedList)
    } catch {
      setSaving(false); setSaveError(true)
    }
  }

  return (
    <div className="ob">
      <div className="ob-scroll">
        <div className="ob-card">
          {onBack ? (
            <button type="button" className="ob-back-btn" aria-label="Voltar" onClick={onBack} style={{ marginBottom: 'var(--s3)' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          ) : null}
          <p className="lbl" style={{ color: 'var(--ok)' }}>Descoberta concluída</p>
          <h1 className="ob-title">Revise o que encontramos</h1>
          <p className="review-count">incluídos <b>{value}</b>/ano estimado</p>
          <div className="review-list">
            {findings.map((f) => {
              const on = included.has(f.itemId)
              return (
                <button key={f.itemId} type="button" className={'review-item' + (on ? '' : ' off')} aria-pressed={on} onClick={() => toggle(f.itemId)}>
                  <span className="review-item-mark" aria-hidden="true">{f.logo ? <img src={f.logo} alt="" /> : f.provider.charAt(0).toUpperCase()}</span>
                  <span className="review-item-body"><strong>{f.provider} {f.variant}</strong><span>via {f.provider}</span></span>
                  <span className={'review-check' + (on ? ' on' : '')} aria-hidden="true">{on ? '✓' : '+'}</span>
                </button>
              )
            })}
          </div>
          <p className="review-note">Prévia — nada foi lido do seu e-mail; descartar aqui só ajusta seu radar.</p>
          {existingError ? (
            <p role="alert" aria-live="assertive" className="review-error">
              Não foi possível preparar sua prévia.{' '}
              <button type="button" className="review-retry" onClick={() => void existingQuery.refetch()}>Tentar novamente</button>
            </p>
          ) : null}
          {saveError ? <p role="alert" aria-live="assertive" className="review-error">Não foi possível salvar. Tente de novo.</p> : null}
        </div>
      </div>
      <div className="ob-foot">
        <div className="ob-foot-inner">
          <div className="ob-cta">
            <Button onClick={submit} disabled={includedList.length === 0 || existingLoading || saving}>
              {saving ? 'Salvando…' : 'Adicionar ao radar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
