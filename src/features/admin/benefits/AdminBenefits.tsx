import { useState } from 'react'
import { useAdminBenefits, useSaveBenefit, useDeleteBenefit } from './useAdminBenefits'
import { useSaveBenefitSources } from './useBenefitSources'
import { useAdminSources } from '../sources/useAdminSources'
import { BenefitForm } from './BenefitForm'
import { BenefitLocationsEditor } from './BenefitLocationsEditor'
import { AdminList } from '../AdminList'
import { AdminSheet } from '../../../ui/AdminSheet'
import { ConfirmDelete } from '../ConfirmDelete'
import { Skeleton } from '../../../ui/Skeleton'
import { PageState } from '../../../ui/PageState'
import { Input } from '../../../ui/Input'
import { Chip } from '../../../ui/Chip'
import { useToast } from '../../../ui/Toast'
import { CATEGORIES, type BenefitCategory } from '../../benefits/types'
import type { BenefitInput, BenefitRow } from './types'

const BENEFIT_SOURCE_LABEL = { issuer: 'Emissor', card_network: 'Bandeira', partner: 'Parceiro', mixed: 'Misto' } as const
const BENEFIT_SOURCE_CLS = { issuer: 'iss', card_network: 'brand', partner: 'part', mixed: 'mixed' } as const
const isNew = (createdAt: string) => Date.now() - new Date(createdAt).getTime() < 14 * 86_400_000
const fonteNames = (b: BenefitRow) => b.benefit_sources.map((s) => s.source_items?.sources?.name).filter(Boolean).join(', ')
const categoryLabel = (k: BenefitCategory) => CATEGORIES.find((c) => c.key === k)?.label ?? k

type Editing = BenefitRow | 'new' | { id: string } | null

export function AdminBenefits() {
  const { data, isLoading, error } = useAdminBenefits()
  const { data: sources } = useAdminSources()
  const save = useSaveBenefit()
  const saveLinks = useSaveBenefitSources()
  const del = useDeleteBenefit()
  const toast = useToast()

  const [query, setQuery] = useState('')
  const [cat, setCat] = useState<BenefitCategory | null>(null)
  const [editing, setEditing] = useState<Editing>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)

  if (isLoading) return <Skeleton height="180px" radius="16px" />
  if (error) return <PageState title="Não foi possível carregar os benefícios." />

  const rows = data ?? []
  const filtered = rows.filter(
    (b) => b.title.toLowerCase().includes(query.toLowerCase()) && (!cat || b.category === cat),
  )

  async function onSubmit(payload: { input: BenefitInput; sourceItemIds: string[] }) {
    const cur = editing
    const id = cur && cur !== 'new' ? cur.id : undefined
    const savedId = await save.mutateAsync({ ...payload.input, id })
    await saveLinks.mutateAsync({ benefitId: savedId, sourceItemIds: payload.sourceItemIds })
    toast.show('Benefício salvo')
    setEditing({ id: savedId }) // permanece aberto em modo edição; a lista reinvalida e resolve a row completa
  }

  const resolvedRow: BenefitRow | null =
    editing && editing !== 'new' ? rows.find((b) => b.id === editing.id) ?? null : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
      <div className="aa-head">
        <div>
          <p className="aa-eyebrow">Catálogo</p>
          <h1 className="aa-h1">Benefícios</h1>
        </div>
        <button type="button" className="btn ink aa-add-txt" onClick={() => setEditing('new')}>
          <PlusIcon /> Novo benefício
        </button>
        <button type="button" className="aa-add-ic" aria-label="Novo benefício" onClick={() => setEditing('new')}>
          <PlusIcon />
        </button>
      </div>

      <Input className="aa-search" placeholder="Buscar benefício" value={query} onChange={(e) => setQuery(e.target.value)} />
      <div className="chips">
        {CATEGORIES.map((c) => (
          <Chip key={c.key} active={cat === c.key} onClick={() => setCat(cat === c.key ? null : c.key)}>
            {c.emoji} {c.label}
          </Chip>
        ))}
      </div>

      <AdminList
        ariaLabel="Benefícios"
        rows={filtered}
        keyOf={(b) => b.id}
        renderRow={(b) => (
          <>
            <span className="aa-name">
              {b.title}
              {isNew(b.created_at) && <span className="new">novo</span>}
            </span>
            <span className="aa-meta">
              <span className="tag">{categoryLabel(b.category)}</span>
              {b.benefit_source && (
                <span className={`pill ${BENEFIT_SOURCE_CLS[b.benefit_source]}`}>
                  {BENEFIT_SOURCE_LABEL[b.benefit_source]}
                </span>
              )}
              <span className="aa-fonte">{fonteNames(b)}</span>
            </span>
            <span className="aa-act">
              <button type="button" aria-label={`editar ${b.title}`} onClick={() => setEditing(b)}>
                Editar
              </button>
              <button type="button" aria-label={`remover ${b.title}`} onClick={() => setConfirmId(b.id)}>
                Remover
              </button>
            </span>
          </>
        )}
      />

      <ConfirmDelete
        open={!!confirmId}
        title="Remover item?"
        message="Remove também os locais e vínculos deste benefício."
        onCancel={() => setConfirmId(null)}
        onConfirm={async () => {
          await del.mutateAsync(confirmId!)
          toast.show('Benefício removido')
          setConfirmId(null)
        }}
      />

      <AdminSheet
        open={!!editing}
        title={editing === 'new' ? 'Novo benefício' : 'Editar benefício'}
        closeOnBackdrop={false}
        wide
        onClose={() => setEditing(null)}
      >
        {editing && (
          <BenefitForm
            initial={resolvedRow}
            sources={sources ?? []}
            saving={save.isPending || saveLinks.isPending}
            error={save.error?.message ?? null}
            onSubmit={onSubmit}
            onCancel={() => setEditing(null)}
          >
            {resolvedRow && <BenefitLocationsEditor benefitId={resolvedRow.id} locations={resolvedRow.benefit_locations} />}
          </BenefitForm>
        )}
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
