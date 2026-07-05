import type { DiscoveryCandidate } from './types'

const label = (c: DiscoveryCandidate): string => {
  const p = c.payload as { name?: string; label?: string; title?: string }
  return p.name ?? p.label ?? p.title ?? c.fingerprint
}

function Chip({ text }: { text: string }) {
  return (
    <span className="muted" style={{ fontSize: 11, border: '1px solid var(--line)', borderRadius: 6, padding: '0 6px' }}>
      {text}
    </span>
  )
}

function Node({
  c, depth, onPromote, onReject,
}: { c: DiscoveryCandidate; depth: number; onPromote: (id: string) => void; onReject: (id: string) => void }) {
  const prov = c.provenance as { verification_status?: string | null }
  return (
    <div style={{ paddingLeft: depth * 16, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0' }}>
      <strong>{label(c)}</strong>
      <Chip text={c.match_status} />
      {prov.verification_status ? <Chip text={prov.verification_status} /> : null}
      {c.review_status !== 'pending' ? <Chip text={c.review_status} /> : (
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => onPromote(c.id)}>Aprovar</button>
          <button type="button" className="muted" onClick={() => onReject(c.id)}>Rejeitar</button>
        </span>
      )}
    </div>
  )
}

export function CandidateTree({
  candidates, onPromote, onReject,
}: {
  candidates: DiscoveryCandidate[]
  onPromote: (id: string) => void
  onReject: (id: string) => void
}) {
  const byParent = new Map<string | null, DiscoveryCandidate[]>()
  for (const c of candidates) {
    const k = c.parent_fingerprint
    byParent.set(k, [...(byParent.get(k) ?? []), c])
  }

  const rows: { c: DiscoveryCandidate; depth: number }[] = []
  const walk = (parentFp: string | null, depth: number) => {
    for (const c of byParent.get(parentFp) ?? []) {
      rows.push({ c, depth })
      walk(c.fingerprint, depth + 1)
    }
  }
  walk(null, 0) // raízes = sources (parent_fingerprint null)

  if (rows.length === 0) return <p className="muted">Nenhum candidato ainda.</p>
  return (
    <div>
      {rows.map(({ c, depth }) => (
        <Node key={c.id} c={c} depth={depth} onPromote={onPromote} onReject={onReject} />
      ))}
    </div>
  )
}
