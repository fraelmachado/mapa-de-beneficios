import './discovery.css'
import type { CSSProperties } from 'react'
import type { DiscoveryCandidate } from './types'
import { benefitCategoryChip, sourceCategoryChip, verificationLabel } from './discoveryMeta'
import { normalizeHttpUrl } from '../../../lib/actionLink'

type P = Record<string, unknown>

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

function host(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function stateCls(review: string): string {
  return review === 'approved' ? 'is-approved' : review === 'rejected' ? 'is-rejected' : ''
}

const catStyle = (colorVar: string) => ({ '--cat': colorVar }) as CSSProperties

function Actions({
  c, locked, lockMsg, kind, onPromote, onReject,
}: {
  c: DiscoveryCandidate
  locked: boolean
  lockMsg: string
  kind: 'programa' | 'variante' | 'beneficio'
  onPromote: (id: string) => void
  onReject: (id: string) => void
}) {
  if (c.review_status === 'approved') {
    return <span className="dv-badge-ok">{kind === 'variante' ? 'aprovada' : 'aprovado'}</span>
  }
  if (c.review_status === 'rejected') {
    return <span className="dv-badge-rej">{kind === 'variante' ? 'rejeitada' : 'rejeitado'}</span>
  }
  return (
    <>
      {locked ? <span className="dv-lock">{lockMsg}</span> : null}
      <button
        type="button"
        className="dv-btn-ok"
        aria-label={kind === 'beneficio' ? 'Aprovar benefício' : undefined}
        disabled={locked}
        onClick={() => onPromote(c.id)}
      >
        {kind === 'programa' ? 'Aprovar programa' : 'Aprovar'}
      </button>
      <button type="button" className="dv-txtbtn" onClick={() => onReject(c.id)}>Rejeitar</button>
    </>
  )
}

export function CandidateTree({
  candidates, onPromote, onReject,
}: {
  candidates: DiscoveryCandidate[]
  onPromote: (id: string) => void
  onReject: (id: string) => void
}) {
  const byFp = new Map(candidates.map((c) => [c.fingerprint, c]))
  const childrenOf = (fp: string | null) => candidates.filter((c) => c.parent_fingerprint === fp)

  const unlocked = (c: DiscoveryCandidate): boolean => {
    if (!c.parent_fingerprint) return true
    const parent = byFp.get(c.parent_fingerprint)
    if (!parent) return true
    return parent.review_status === 'approved' || parent.matched_id != null
  }

  const sources = candidates.filter((c) => c.entity_type === 'source')
  if (sources.length === 0) return <div className="dv-empty">Nenhum candidato neste job.</div>

  return (
    <div>
      <div className="dv-legend">
        <span>
          Aprovação em cascata, nó a nó: <b>aprove o programa primeiro</b>, depois as variantes e,
          por fim, os benefícios. Nada entra no catálogo sem aprovação.
        </span>
      </div>

      {sources.map((s) => {
        const sp = s.payload as P
        const sChip = sourceCategoryChip(str(sp.source_category))
        const sProv = s.provenance as P
        const verif = verificationLabel(str(sProv.verification_status))
        const srcUrl = str(sProv.source_url)

        return (
          <div key={s.id} className={`dv-src ${stateCls(s.review_status)}`}>
            <div className="dv-node dv-node-src">
              <div className="dv-node-main">
                <div className="dv-title">
                  <span className="dv-kind">Programa</span>
                  <span className="dv-nm">{str(sp.name) || s.fingerprint}</span>
                </div>
                <div className="dv-chips">
                  <span className="tag" style={catStyle(sChip.colorVar)}>{sChip.label}</span>
                  {s.match_status === 'new' ? <span className="new">novo</span> : null}
                  {verif ? <span className="dv-verif">{verif}</span> : null}
                  {srcUrl ? <a className="dv-link" href={srcUrl} target="_blank" rel="noreferrer">{host(srcUrl)}</a> : null}
                </div>
              </div>
              <div className="dv-node-act">
                <Actions c={s} locked={false} lockMsg="" kind="programa" onPromote={onPromote} onReject={onReject} />
              </div>
            </div>

            <div className="dv-vars">
              {childrenOf(s.fingerprint).map((v) => {
                const vp = v.payload as P
                const sub = [str(vp.card_brand), str(vp.card_level)].filter(Boolean).join(' ')
                const vLocked = !unlocked(v)

                return (
                  <div key={v.id} className={`dv-var ${stateCls(v.review_status)}`}>
                    <div className="dv-node dv-node-var">
                      <div className="dv-node-main">
                        <div className="dv-title">
                          <span className="dv-kind">Variante</span>
                          <span className="dv-nm">{str(vp.label) || str(vp.display_name) || v.fingerprint}</span>
                          {sub ? <span className="dv-submeta">{sub}</span> : null}
                        </div>
                      </div>
                      <div className="dv-node-act">
                        <Actions
                          c={v}
                          locked={vLocked}
                          lockMsg="aprove o programa primeiro"
                          kind="variante"
                          onPromote={onPromote}
                          onReject={onReject}
                        />
                      </div>
                    </div>

                    <div className="dv-bens">
                      {childrenOf(v.fingerprint).map((b) => {
                        const bp = b.payload as P
                        const bChip = benefitCategoryChip(str(bp.category))
                        const bProv = b.provenance as P
                        const bUrl = str(bProv.source_url)
                        const actionUrl = normalizeHttpUrl(bp.action_url)
                        const actionLabel = str(bp.action_label).trim()
                        const bLocked = !unlocked(b)

                        return (
                          <div key={b.id} className={`dv-ben ${stateCls(b.review_status)}`}>
                            <div className="dv-node dv-node-ben">
                              <div className="dv-node-main">
                                <div className="dv-ben-title">{str(bp.title) || b.fingerprint}</div>
                                <div className="dv-ben-meta">
                                  <span className="tag" style={catStyle(bChip.colorVar)}>{bChip.label}</span>
                                  {str(bp.summary) ? <span className="dv-ben-sum">{str(bp.summary)}</span> : null}
                                  {bUrl ? <a className="dv-link" href={bUrl} target="_blank" rel="noreferrer">{host(bUrl)}</a> : null}
                                </div>
                                {actionUrl && actionLabel ? (
                                  <div className="dv-action-preview">
                                    <span>Destino do botão</span>
                                    <a href={actionUrl} target="_blank" rel="noreferrer">
                                      {actionLabel} · {host(actionUrl)}
                                    </a>
                                  </div>
                                ) : null}
                              </div>
                              <div className="dv-node-act">
                                <Actions
                                  c={b}
                                  locked={bLocked}
                                  lockMsg="aprove a variante primeiro"
                                  kind="beneficio"
                                  onPromote={onPromote}
                                  onReject={onReject}
                                />
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
