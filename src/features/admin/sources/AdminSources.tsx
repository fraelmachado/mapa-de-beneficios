import { useState } from 'react'
import { useAdminSources, useSaveSource, useDeleteSource } from './useAdminSources'
import { SourceForm } from './SourceForm'
import { SourceItemsEditor } from './SourceItemsEditor'
import type { SourceInput, SourceRow } from './types'

export function AdminSources() {
  const { data, isLoading, error } = useAdminSources()
  const save = useSaveSource()
  const del = useDeleteSource()
  const [editing, setEditing] = useState<SourceRow | null | 'new'>(null)

  if (isLoading) return <p className="text-slate-500">Carregando…</p>
  if (error) return <p className="text-red-600">Erro ao carregar fontes.</p>

  async function onSubmit(input: SourceInput) {
    const current = editing
    const id = current && current !== 'new' ? current.id : undefined
    await save.mutateAsync({ ...input, id })
    setEditing(null)
  }

  if (editing) {
    const initial = editing === 'new' ? null : editing
    return (
      <div className="flex flex-col gap-3">
        <h1 className="text-xl font-bold">{initial ? `Editar ${initial.name}` : 'Nova fonte'}</h1>
        <SourceForm initial={initial} onSubmit={onSubmit} onCancel={() => setEditing(null)} />
        {initial && <SourceItemsEditor sourceId={initial.id} items={initial.source_items} />}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Fontes</h1>
        <button type="button" onClick={() => setEditing('new')} className="rounded bg-slate-800 px-3 py-2 text-sm text-white">Nova fonte</button>
      </div>
      <ul className="flex flex-col gap-2">
        {(data ?? []).map((s) => (
          <li key={s.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
            <span className="flex-1">{s.name} <span className="text-xs text-slate-400">({s.kind}{s.active ? '' : ' · inativo'})</span></span>
            <button type="button" onClick={() => setEditing(s)} className="text-sm text-slate-600">Editar</button>
            <button type="button" aria-label={`remover ${s.name}`} onClick={() => del.mutateAsync(s.id)} className="text-sm text-red-600">Remover</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
