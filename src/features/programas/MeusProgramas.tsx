import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../auth/AuthProvider'
import { useMyPrograms } from './useMyPrograms'
import { useUserSources } from '../onboarding/useUserSources'
import { useSaveUserSources } from '../onboarding/useSaveUserSources'
import { ProgramSheet } from './ProgramSheet'
import { PageState, Skeleton } from '../../ui'

export function MeusProgramas() {
  const { session } = useSession()
  const uid = session?.user.id
  const { programs, summary, isLoading, error, refetch } = useMyPrograms(uid)
  const savedIds = useUserSources(uid).data ?? []
  const [workingIds, setWorkingIds] = useState<string[] | null>(null)
  const currentIds = workingIds ?? savedIds // set autoritativo local após a 1ª op (evita snapshot velho antes do refetch)
  const save = useSaveUserSources()
  const navigate = useNavigate()
  const [sheetId, setSheetId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [opError, setOpError] = useState(false)

  async function apply(nextIds: string[]) {
    if (busy) return
    const deduped = [...new Set(nextIds)] // id repetido violaria a PK no replace
    setBusy(true); setOpError(false)
    try {
      await save.mutateAsync(deduped)
      setWorkingIds(deduped) // fixa o autoritativo p/ a próxima op não ressuscitar item removido
      setSheetId(null)
    } catch {
      setOpError(true)
    } finally {
      setBusy(false)
    }
  }
  const remove = (itemId: string) => apply(currentIds.filter((id) => id !== itemId))
  const swapTier = (oldId: string, newId: string) => (oldId === newId ? setSheetId(null) : apply(currentIds.map((id) => (id === oldId ? newId : id))))

  if (isLoading) return <div className="app-page"><Skeleton height="120px" radius="16px" /><Skeleton height="52px" radius="12px" /><Skeleton height="200px" radius="14px" /></div>
  if (error) return <div className="app-page"><PageState title="Não foi possível carregar seus programas" action={{ label: 'Tentar novamente', onClick: () => refetch() }} /></div>

  const sheetProg = sheetId ? programs.find((p) => p.itemId === sheetId) : null

  return (
    <div className="app-page programas-page">
      <header><h1>Programas</h1></header>

      <section className="prg-summary">
        <span className="prg-count">Você tem {summary.total} programa{summary.total === 1 ? '' : 's'}</span>
        {summary.total > 0 ? (
          <span className="prg-prov">
            {summary.gmailCount ? <span className="prg-chip g">{summary.gmailCount} via Gmail</span> : null}
            {summary.manualCount ? <span className="prg-chip m">{summary.manualCount} manua{summary.manualCount === 1 ? 'l' : 'is'}</span> : null}
          </span>
        ) : null}
        {summary.lastFound ? <span className="prg-sub">Último via Gmail {summary.lastFound}{summary.account ? ` · ${summary.account}` : ''}</span> : null}
      </section>

      <div className="prg-actions">
        <button type="button" className="prg-act p" onClick={() => navigate('/onboarding?method=gmail')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v11a2 2 0 0 1-2 2H8l-4 3V5Z" /><circle cx="11" cy="11" r="3" /><path d="m14.5 14.5 2 2" /></svg>
          Procurar no Gmail
        </button>
        <button type="button" className="prg-act g" onClick={() => navigate('/onboarding?mode=edit')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
          Do catálogo
        </button>
      </div>

      {opError ? <p role="alert" aria-live="assertive" className="prg-error">Não foi possível atualizar. Tente de novo.</p> : null}

      {programs.length === 0 ? (
        <div className="prg-empty">Nada aqui ainda. Use <b>Procurar no Gmail</b> ou <b>Do catálogo</b> para começar.</div>
      ) : (
        <>
          <p className="lbl">Seus programas</p>
          <div className="review-list">
            {programs.map((p) => (
              <div key={p.itemId} className="review-item">
                <span className="review-item-mark" aria-hidden="true">{p.logo ? <img src={p.logo} alt="" /> : p.brand.charAt(0).toUpperCase()}</span>
                <span className="review-item-body">
                  <strong>{p.brand}{p.tier ? ` ${p.tier}` : ''}</strong>
                  <span className="prg-meta">
                    <span className={'prg-tag ' + (p.provenance === 'gmail' ? 'g' : 'm')}>{p.provenance === 'gmail' ? 'Gmail' : 'Manual'}</span>
                    {p.provenance === 'gmail' && p.when ? <span className="prg-when">{p.when}</span> : null}
                  </span>
                </span>
                <button type="button" className="prg-more" aria-label={`Opções de ${p.brand}`} onClick={() => setSheetId(p.itemId)}>⋯</button>
              </div>
            ))}
          </div>
        </>
      )}

      {sheetProg ? (
        <ProgramSheet program={sheetProg} busy={busy}
          onPickTier={(itemId) => swapTier(sheetProg.itemId, itemId)}
          onRemove={() => remove(sheetProg.itemId)}
          onClose={() => { if (!busy) setSheetId(null) }} />
      ) : null}
    </div>
  )
}
