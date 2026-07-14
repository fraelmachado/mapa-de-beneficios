import { useState } from 'react'
import { Input } from '../../../ui/Input'
import { Button } from '../../../ui/Button'
import { useSaveSourceItem, useDeleteSourceItem } from './useSourceItems'
import type { SourceItemRow } from './types'

export function SourceItemsEditor({ sourceId, items }: { sourceId: string; items: SourceItemRow[] }) {
  const save = useSaveSourceItem()
  const del = useDeleteSourceItem()
  const [label, setLabel] = useState('')
  const [brand, setBrand] = useState('')
  const [level, setLevel] = useState('')
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  async function add() {
    if (!label.trim()) return
    await save.mutateAsync({
      source_id: sourceId,
      label: label.trim(),
      sort_order: items.length + 1,
      card_brand: brand || null,
      card_level: level || null,
      pluggy_product: null,
    })
    setLabel(''); setBrand(''); setLevel('')
  }

  async function remove(id: string) {
    await del.mutateAsync(id)
    setConfirmingId(null)
  }

  return (
    <div className="aa-items">
      <h3 className="aa-fieldlbl">Variantes</h3>
      <ul className="aa-itemlist">
        {items.map((it) => (
          <li key={it.id} className="aa-itemrow">
            <span>{it.label}</span>
            {it.card_level && <span className="muted">{it.card_brand ?? ''} {it.card_level}</span>}
            {confirmingId === it.id ? (
              <span className="aa-act">
                <button type="button" onClick={() => remove(it.id)}>Confirmar?</button>
                <button type="button" onClick={() => setConfirmingId(null)}>Cancelar</button>
              </span>
            ) : (
              <button type="button" aria-label={`remover ${it.label}`} onClick={() => setConfirmingId(it.id)} className="aa-itemdel">×</button>
            )}
          </li>
        ))}
        {items.length === 0 && <li className="muted">Nenhuma variante.</li>}
      </ul>
      <div className="aa-itemadd">
        <label className="aa-fieldlbl" htmlFor="si-label">Nova variante</label>
        <Input id="si-label" ariaLabel="nova variante" value={label} onChange={(e) => setLabel(e.target.value)} />
        <label className="aa-fieldlbl" htmlFor="si-brand">brand</label>
        <Input id="si-brand" ariaLabel="card_brand" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="VISA" />
        <label className="aa-fieldlbl" htmlFor="si-level">level</label>
        <Input id="si-level" ariaLabel="card_level" value={level} onChange={(e) => setLevel(e.target.value)} placeholder="BLACK" />
        <Button variant="ink" onClick={add}>Adicionar</Button>
      </div>
    </div>
  )
}
