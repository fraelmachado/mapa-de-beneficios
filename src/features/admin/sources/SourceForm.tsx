import { useState, type FormEvent } from 'react'
import { Input } from '../../../ui/Input'
import { Button } from '../../../ui/Button'
import { ImageUpload } from '../upload/ImageUpload'
import type { SourceInput, SourceRow } from './types'
import type { SourceKind } from '../../onboarding/types'
import type { SourceCategory } from '../../benefits/types'
import { SOURCE_CATEGORY_META } from '../../onboarding/categoryMeta'

const KINDS: SourceKind[] = ['card', 'carrier', 'loyalty', 'cpf']

export function SourceForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial: SourceRow | null
  onSubmit: (input: SourceInput) => void
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name ?? '')
  const [kind, setKind] = useState<SourceKind>(initial?.kind ?? 'card')
  const [sourceCategory, setSourceCategory] = useState<SourceCategory>(
    initial?.source_category ?? 'bank_card',
  )
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0)
  const [active, setActive] = useState(initial?.active ?? true)
  const [logoUrl, setLogoUrl] = useState<string | null>(initial?.logo_url ?? null)
  const [connectorType, setConnectorType] = useState(initial?.connector_type ?? '')
  const [pluggyId, setPluggyId] = useState<string>(initial?.pluggy_connector_id?.toString() ?? '')
  const [institutionUrl, setInstitutionUrl] = useState(initial?.institution_url ?? '')
  const [primaryColor, setPrimaryColor] = useState(initial?.primary_color ?? '')
  const [country, setCountry] = useState(initial?.country ?? 'BR')

  function submit(e: FormEvent) {
    e.preventDefault()
    onSubmit({
      name,
      kind,
      source_category: sourceCategory,
      sort_order: Number(sortOrder) || 0,
      active,
      logo_url: logoUrl,
      connector_type: connectorType || null,
      pluggy_connector_id: pluggyId ? Number(pluggyId) : null,
      institution_url: institutionUrl || null,
      primary_color: primaryColor || null,
      country: country || 'BR',
    })
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column' }}>
      <label className="aa-fieldlbl" htmlFor="s-name">Nome</label>
      <Input id="s-name" required value={name} onChange={(e) => setName(e.target.value)} />

      <label className="aa-fieldlbl" htmlFor="s-kind">Tipo (kind)</label>
      <select id="s-kind" className="aa-select" value={kind} onChange={(e) => setKind(e.target.value as SourceKind)}>
        {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
      </select>

      <label className="aa-fieldlbl" htmlFor="s-cat">Categoria</label>
      <select id="s-cat" className="aa-select" value={sourceCategory} onChange={(e) => setSourceCategory(e.target.value as SourceCategory)}>
        {SOURCE_CATEGORY_META.map((c) => <option key={c.key} value={c.key}>{c.icon} {c.label}</option>)}
      </select>

      <label className="aa-check">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /> Ativo
      </label>

      <details className="aa-more">
        <summary>Mais opções</summary>

        <label className="aa-fieldlbl" htmlFor="s-order">Ordem</label>
        <Input id="s-order" type="number" value={String(sortOrder)} onChange={(e) => setSortOrder(Number(e.target.value))} />

        <span className="aa-fieldlbl">Logo</span>
        <ImageUpload folder="sources" value={logoUrl} onChange={setLogoUrl} />

        <label className="aa-fieldlbl" htmlFor="s-ct">connector_type</label>
        <Input id="s-ct" value={connectorType} onChange={(e) => setConnectorType(e.target.value)} placeholder="PERSONAL_BANK / TELECOMMUNICATION / DIGITAL_ECONOMY" />

        <label className="aa-fieldlbl" htmlFor="s-pid">pluggy_connector_id</label>
        <Input id="s-pid" type="number" value={pluggyId} onChange={(e) => setPluggyId(e.target.value)} />

        <label className="aa-fieldlbl" htmlFor="s-iu">institution_url</label>
        <Input id="s-iu" value={institutionUrl} onChange={(e) => setInstitutionUrl(e.target.value)} />

        <label className="aa-fieldlbl" htmlFor="s-pc">primary_color</label>
        <Input id="s-pc" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} placeholder="#0f172a" />

        <label className="aa-fieldlbl" htmlFor="s-country">country</label>
        <Input id="s-country" value={country} onChange={(e) => setCountry(e.target.value)} />
      </details>

      <div className="aa-dialog-actions">
        <Button variant="ghost" type="button" onClick={onCancel}>Cancelar</Button>
        <Button variant="ink" type="submit">Salvar</Button>
      </div>
    </form>
  )
}
