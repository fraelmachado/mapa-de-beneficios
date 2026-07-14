import { useState } from 'react'
import './discovery.css'
import { CandidateTree } from './CandidateTree'
import { jobStatusMeta } from './discoveryMeta'
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
  const reject = useRejectCandidate()

  const jobList = jobs.data ?? []
  const selectedJob = jobList.find((j) => j.id === selected) ?? null

  return (
    <div className="dv-root">
      <p style={{ margin: '0 0 3px', fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)' }}>
        Catálogo
      </p>
      <h1 style={{ margin: 0, fontSize: 'var(--fz-h1)', fontWeight: 800, letterSpacing: '-.03em' }}>
        Discovery
      </h1>
      <p className="dv-sub">
        Revise os candidatos propostos pelo agente antes de entrarem no catálogo. O agente nunca
        publica sozinho; nada entra no catálogo sem a sua aprovação.
      </p>

      <p className="dv-sublbl">Fila de jobs</p>
      <form
        className="dv-jobnew"
        onSubmit={(e) => {
          e.preventDefault()
          if (brief.trim()) createJob.mutate(brief.trim(), { onSuccess: () => setBrief('') })
        }}
      >
        <label className="input" style={{ flex: 1, minWidth: 0 }}>
          <input
            type="text"
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder="Novo job — ex.: Priority Pass, Wellhub…"
            style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', outline: 'none', font: 'inherit', fontSize: 14, color: 'var(--ink)' }}
          />
        </label>
        <button type="submit" className="dv-btn-ok" disabled={createJob.isPending}>Enfileirar</button>
      </form>

      <div className="dv-jobs">
        {jobList.map((j) => {
          const st = jobStatusMeta(j.status)
          return (
            <button
              key={j.id}
              type="button"
              className={`dv-job ${selected === j.id ? 'on' : ''}`}
              onClick={() => setSelected(j.id)}
            >
              <span className="dv-jname">{j.brief}</span>
              <span className={`dv-jst ${st.cls}`}>{st.label}</span>
            </button>
          )
        })}
      </div>

      {selected ? (
        <>
          <p className="dv-sublbl" style={{ margin: '0 0 10px' }}>
            Candidatos{selectedJob ? ` · ${selectedJob.brief}` : ''}
          </p>
          {candidates.isLoading ? (
            <div className="dv-empty">Carregando…</div>
          ) : (
            <CandidateTree
              candidates={candidates.data ?? []}
              onPromote={(id) => promote.mutate(id)}
              onReject={(id) => reject.mutate({ candidateId: id, reason: '' })}
            />
          )}
        </>
      ) : null}
    </div>
  )
}
