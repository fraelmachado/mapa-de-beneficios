import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminSources, useSaveSource, useDeleteSource } from './useAdminSources'
import { useSourceCandidates } from '../discovery/useSourceCandidates'
import { useRejectCandidate, useReconsiderCandidate } from '../discovery/useDiscovery'
import { verificationLabel } from '../discovery/discoveryMeta'
import { SourceForm } from './SourceForm'
import { SourceItemsEditor } from './SourceItemsEditor'
import { RejectDialog } from './RejectDialog'
import { SegmentedControl } from '../../../ui/SegmentedControl'
import { AdminList } from '../AdminList'
import { AdminSheet } from '../../../ui/AdminSheet'
import { ConfirmDelete } from '../ConfirmDelete'
import { Skeleton } from '../../../ui/Skeleton'
import { PageState } from '../../../ui/PageState'
import { useToast } from '../../../ui/Toast'
import { categoryMeta } from '../../onboarding/categoryMeta'
import type { SourceInput, SourceRow } from './types'
import type { DiscoveryCandidate } from '../discovery/types'

type Tab = 'pending' | 'active' | 'rejected'
type Editing = SourceRow | 'new' | { id: string } | null

// D5: acessores tipados — payload/provenance são Record<string, unknown>.
const pname = (c: DiscoveryCandidate) => (c.payload as { name?: string }).name ?? c.fingerprint
const psrc = (c: DiscoveryCandidate) => (c.provenance as { source_url?: string }).source_url ?? ''
const pverif = (c: DiscoveryCandidate) => (c.provenance as { verification_status?: string }).verification_status

function hostOf(url: string): string {
  try {
    return new URL(url).host
  } catch {
    return url
  }
}

function relTime(iso: string): string {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000))
  if (min < 1) return 'agora'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h`
  return `${Math.floor(h / 24)} d`
}

export function AdminSources() {
  const { data, isLoading, error } = useAdminSources()
  const save = useSaveSource()
  const del = useDeleteSource()
  const pend = useSourceCandidates('pending')
  const rej = useSourceCandidates('rejected')
  const reject = useRejectCandidate()
  const reconsider = useReconsiderCandidate()
  const toast = useToast()
  const navigate = useNavigate()

  const [tab, setTab] = useState<Tab>('active')
  const [editing, setEditing] = useState<Editing>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<string | null>(null)
  const [saveError, setSaveError] = useState(false)

  if (isLoading) return <Skeleton height="180px" radius="16px" />
  if (error) return <PageState title="Não foi possível carregar os programas." />

  const rows = data ?? []

  async function onSubmit(input: SourceInput) {
    setSaveError(false)
    const id = editing && editing !== 'new' ? editing.id : undefined
    try {
      const savedId = await save.mutateAsync({ ...input, id })
      toast.show('Programa salvo')
      setEditing({ id: savedId }) // permanece aberto em modo edição; a lista reinvalida e resolve a row completa
    } catch {
      setSaveError(true)
    }
  }

  const resolvedRow: SourceRow | null =
    editing && editing !== 'new' ? rows.find((s) => s.id === editing.id) ?? null : null

  function cascadeMsg(id: string | null): string {
    const row = id ? rows.find((s) => s.id === id) : undefined
    const n = row?.source_items.length ?? 0
    return n > 0
      ? `Remove também ${n} ${n === 1 ? 'variante' : 'variantes'} e os vínculos com benefícios.`
      : 'Remove também os vínculos com benefícios.'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
      <div className="aa-head">
        <div>
          <p className="aa-eyebrow">Catálogo</p>
          <h1 className="aa-h1">Programas</h1>
        </div>
        <button type="button" className="btn ink aa-add-txt" onClick={() => setEditing('new')}>
          <PlusIcon /> Novo programa
        </button>
        <button type="button" className="aa-add-ic" aria-label="Novo programa" onClick={() => setEditing('new')}>
          <PlusIcon />
        </button>
      </div>

      <SegmentedControl
        ariaLabel="Programas"
        options={[
          { label: 'Pendentes', value: 'pending', count: pend.data?.length ?? 0 },
          { label: 'Ativos', value: 'active', count: rows.length },
          { label: 'Rejeitados', value: 'rejected', count: rej.data?.length ?? 0 },
        ]}
        value={tab}
        onChange={(v) => setTab(v as Tab)}
      />

      {tab === 'active' && (
        <AdminList
          ariaLabel="Programas ativos"
          rows={rows}
          keyOf={(s) => s.id}
          renderRow={(s) => (
            <>
              <span className="aa-avatar">{(s.name.charAt(0) || '·').toUpperCase()}</span>
              <span className="aa-name">{s.name}</span>
              <span className="pill">{categoryMeta(s.source_category).label}</span>
              <span className="aa-act">
                <button type="button" aria-label={`editar ${s.name}`} onClick={() => setEditing(s)}>
                  Editar
                </button>
                <button type="button" aria-label={`remover ${s.name}`} onClick={() => setConfirmId(s.id)}>
                  Remover
                </button>
              </span>
            </>
          )}
        />
      )}

      {tab === 'pending' && (
        pend.error ? (
          <PageState title="Discovery indisponível" />
        ) : (
          <AdminList
            ariaLabel="Programas pendentes"
            rows={pend.data ?? []}
            keyOf={(c) => c.id}
            renderRow={(c) => (
              <>
                <span className="aa-name">{pname(c)}</span>
                <span className="aa-robo">
                  {hostOf(psrc(c))} · visto pela 1ª vez há {relTime(c.created_at)}
                  {verificationLabel(pverif(c)) ? <span className="pill">{verificationLabel(pverif(c))}</span> : null}
                </span>
                <span className="aa-act">
                  <button type="button" onClick={() => navigate(`/admin/discovery?fp=${c.fingerprint}`)}>
                    Revisar
                  </button>
                  <button type="button" onClick={() => setRejecting(c.id)}>
                    Rejeitar
                  </button>
                </span>
              </>
            )}
          />
        )
      )}

      {tab === 'rejected' && (
        rej.error ? (
          <PageState title="Discovery indisponível" />
        ) : (
          <AdminList
            ariaLabel="Programas rejeitados"
            rows={rej.data ?? []}
            keyOf={(c) => c.id}
            renderRow={(c) => (
              <>
                <span className="aa-name">{pname(c)}</span>
                <span className="aa-robo">{hostOf(psrc(c))} · visto pela 1ª vez há {relTime(c.created_at)}</span>
                <span className="aa-act">
                  <span className="aa-reason">{c.rejection_reason}</span>
                  <button type="button" onClick={() => reconsider.mutate({ candidateId: c.id })}>
                    Reconsiderar
                  </button>
                </span>
              </>
            )}
          />
        )
      )}

      <RejectDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        onConfirm={(reason) => {
          reject.mutate({ candidateId: rejecting!, reason })
          setRejecting(null)
        }}
      />

      <ConfirmDelete
        open={!!confirmId}
        title="Remover item?"
        message={cascadeMsg(confirmId)}
        onCancel={() => setConfirmId(null)}
        onConfirm={async () => {
          await del.mutateAsync(confirmId!)
          toast.show('Programa removido')
          setConfirmId(null)
        }}
      />

      <AdminSheet
        open={!!editing}
        title={editing === 'new' ? 'Novo programa' : 'Editar programa'}
        closeOnBackdrop={false}
        onClose={() => { setEditing(null); setSaveError(false) }}
      >
        {editing && <SourceForm initial={resolvedRow} onSubmit={onSubmit} onCancel={() => { setEditing(null); setSaveError(false) }} saving={save.isPending} saveError={saveError} />}
        {resolvedRow && <SourceItemsEditor sourceId={resolvedRow.id} items={resolvedRow.source_items} />}
      </AdminSheet>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}
