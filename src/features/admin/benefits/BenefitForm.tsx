import { useState, type FormEvent } from 'react'
import { ImageUpload } from '../upload/ImageUpload'
import { BenefitSourcesEditor } from './BenefitSourcesEditor'
import { CATEGORIES, type BenefitCategory } from '../../benefits/types'
import type { SourceRow } from '../sources/types'
import type { BenefitInput, BenefitRow, BenefitScope } from './types'

const SCOPES: BenefitScope[] = ['nacional', 'regional', 'pontual']

export function BenefitForm({
  initial,
  sources,
  onSubmit,
  onCancel,
}: {
  initial: BenefitRow | null
  sources: SourceRow[]
  onSubmit: (payload: { input: BenefitInput; sourceItemIds: string[] }) => void
  onCancel: () => void
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [summary, setSummary] = useState(initial?.summary ?? '')
  const [category, setCategory] = useState<BenefitCategory>(initial?.category ?? 'compras')
  const [scope, setScope] = useState<BenefitScope>(initial?.scope ?? 'nacional')
  const [uf, setUf] = useState(initial?.uf ?? '')
  const [steps, setSteps] = useState(initial?.steps ?? '')
  const [partner, setPartner] = useState(initial?.partner_name ?? '')
  const [validUntil, setValidUntil] = useState(initial?.valid_until ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null)
  const [actionUrl, setActionUrl] = useState(initial?.action_url ?? '')
  const [actionLabel, setActionLabel] = useState(initial?.action_label ?? '')
  const [active, setActive] = useState(initial?.active ?? true)
  const [sourceItemIds, setSourceItemIds] = useState<string[]>(
    initial?.benefit_sources.map((b) => b.source_item_id) ?? [],
  )

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      input: {
        title,
        summary,
        category,
        scope,
        uf: uf || null,
        steps: steps || null,
        partner_name: partner || null,
        valid_until: validUntil || null,
        image_url: imageUrl,
        action_url: actionUrl || null,
        action_label: actionLabel || null,
        active,
      },
      sourceItemIds,
    })
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4">
      <label className="text-sm font-medium" htmlFor="b-title">Título</label>
      <input id="b-title" required value={title} onChange={(e) => setTitle(e.target.value)} className="rounded border px-2 py-1" />

      <label className="text-sm font-medium" htmlFor="b-summary">Resumo</label>
      <input id="b-summary" required value={summary} onChange={(e) => setSummary(e.target.value)} className="rounded border px-2 py-1" />

      <label className="text-sm font-medium" htmlFor="b-cat">Categoria</label>
      <select id="b-cat" value={category} onChange={(e) => setCategory(e.target.value as BenefitCategory)} className="rounded border px-2 py-1">
        {CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
      </select>

      <label className="text-sm font-medium" htmlFor="b-scope">Abrangência</label>
      <select id="b-scope" value={scope} onChange={(e) => setScope(e.target.value as BenefitScope)} className="rounded border px-2 py-1">
        {SCOPES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>

      <label className="text-sm font-medium" htmlFor="b-uf">UF (se regional)</label>
      <input id="b-uf" value={uf} onChange={(e) => setUf(e.target.value)} className="rounded border px-2 py-1" />

      <label className="text-sm font-medium" htmlFor="b-steps">Passo a passo</label>
      <textarea id="b-steps" value={steps} onChange={(e) => setSteps(e.target.value)} className="rounded border px-2 py-1" rows={3} />

      <label className="text-sm font-medium" htmlFor="b-partner">Parceiro</label>
      <input id="b-partner" value={partner} onChange={(e) => setPartner(e.target.value)} className="rounded border px-2 py-1" />

      <label className="text-sm font-medium" htmlFor="b-valid">Validade</label>
      <input id="b-valid" type="date" value={validUntil ?? ''} onChange={(e) => setValidUntil(e.target.value)} className="rounded border px-2 py-1" />

      <span className="text-sm font-medium">Banner</span>
      <ImageUpload folder="benefits" value={imageUrl} onChange={setImageUrl} />

      <label className="text-sm font-medium" htmlFor="b-aurl">URL de ação</label>
      <input id="b-aurl" value={actionUrl} onChange={(e) => setActionUrl(e.target.value)} className="rounded border px-2 py-1" />

      <label className="text-sm font-medium" htmlFor="b-alabel">Rótulo da ação</label>
      <input id="b-alabel" value={actionLabel} onChange={(e) => setActionLabel(e.target.value)} className="rounded border px-2 py-1" />

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo
      </label>

      <BenefitSourcesEditor sources={sources} selected={sourceItemIds} onChange={setSourceItemIds} />

      <div className="mt-2 flex gap-2">
        <button type="submit" className="rounded bg-slate-800 px-4 py-2 text-white">Salvar</button>
        <button type="button" onClick={onCancel} className="rounded border px-4 py-2">Cancelar</button>
      </div>
    </form>
  )
}
