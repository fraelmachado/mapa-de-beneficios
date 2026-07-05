import { useState } from 'react'
import { CandidateTree } from './CandidateTree'
import {
  useCreateJob, useDiscoveryJobs, useJobCandidates, usePromoteCandidate, useRejectCandidate,
} from './useDiscovery'

export function AdminDiscovery() {
  const jobs = useDiscoveryJobs()
  const createJob = useCreateJob()
  const [brief, setBrief] = useState('')
  const [selected, setSelected] = useState<string | null>(null)
  const candidates = useJobCandidates(selected)
  const promote = usePromoteCandidate(selected)
  const reject = useRejectCandidate(selected)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
      <h1 style={{ fontSize: 'var(--fz-h1)', fontWeight: 700, letterSpacing: '-.03em', margin: 0 }}>
        Discovery
      </h1>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (brief.trim()) createJob.mutate(brief.trim(), { onSuccess: () => setBrief('') })
        }}
        style={{ display: 'flex', gap: 8 }}
      >
        <input
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          placeholder="Novo job (ex.: Unimed, Wellhub, Livelo…)"
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={createJob.isPending}>Enfileirar</button>
      </form>

      <div>
        {(jobs.data ?? []).map((j) => (
          <button
            key={j.id}
            type="button"
            className="row"
            onClick={() => setSelected(j.id)}
            style={{ color: 'inherit', width: '100%', textAlign: 'left', background: selected === j.id ? 'var(--surface)' : 'transparent' }}
          >
            {j.brief}
            <span className="muted" aria-hidden="true">{j.status}</span>
          </button>
        ))}
      </div>

      {selected ? (
        candidates.isLoading ? <p className="muted">Carregando…</p> : (
          <CandidateTree
            candidates={candidates.data ?? []}
            onPromote={(id) => promote.mutate(id)}
            onReject={(id) => reject.mutate(id)}
          />
        )
      ) : null}
    </div>
  )
}
