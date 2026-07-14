import { useState } from 'react'
import { useAdminSources, useSaveSource, useDeleteSource } from './useAdminSources'
import { useSourceCandidates } from '../discovery/useSourceCandidates'
import { SourceForm } from './SourceForm'
import { SourceItemsEditor } from './SourceItemsEditor'
import { SegmentedControl } from '../../../ui/SegmentedControl'
import { AdminList } from '../AdminList'
import { AdminSheet } from '../../../ui/AdminSheet'
import { ConfirmDelete } from '../ConfirmDelete'
import { Skeleton } from '../../../ui/Skeleton'
import { PageState } from '../../../ui/PageState'
import { ToastHost, useToast } from '../../../ui/Toast'
import { categoryMeta } from '../../onboarding/categoryMeta'
import type { SourceInput, SourceRow } from './types'

type Tab = 'pending' | 'active' | 'rejected'
type Editing = SourceRow | 'new' | { id: string } | null

export function AdminSources() {
  return (
    <ToastHost>
      <AdminSourcesView />
    </ToastHost>
  )
}

function AdminSourcesView() {
  const { data, isLoading, error } = useAdminSources()
  const save = useSaveSource()
  const del = useDeleteSource()
  const pend = useSourceCandidates('pending')
  const rej = useSourceCandidates('rejected')
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('active')
  const [editing, setEditing] = useState<Editing>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (isLoading) return <Skeleton height="180px" radius="16px" />
  if (error) return <PageState title="Não foi possível carregar os programas." />

  const rows = data ?? []

  async function onSubmit(input: SourceInput) {
    const id = editing && editing !== 'new' ? editing.id : undefined
    const savedId = await save.mutateAsync({ ...input, id })
    toast.show('Programa salvo')
    setEditing({ id: savedId }) // permanece aberto em modo edição; a lista reinvalida e resolve a row completa
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

      {tab !== 'active' && (
        <PageState title="Em breve" description="Esta aba será preenchida na Task 6." />
      )}

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
        onClose={() => setEditing(null)}
      >
        {editing && <SourceForm initial={resolvedRow} onSubmit={onSubmit} onCancel={() => setEditing(null)} />}
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
