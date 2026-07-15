import type { ReactNode } from 'react'
export function AdminList<T>({ ariaLabel, rows, keyOf, renderRow }: {
  ariaLabel: string; rows: T[]; keyOf: (r: T) => string; renderRow: (r: T) => ReactNode
}) {
  // role=list/listitem: estrutura ARIA completa. (Uma table exigiria role=cell nos filhos
  // do grid .aa-lrow, o que quebraria o layout; a lista é semanticamente correta p/ AT.)
  return (
    <div className="aa-list" role="list" aria-label={ariaLabel}>
      {rows.map((r) => <div className="aa-lrow" role="listitem" key={keyOf(r)}>{renderRow(r)}</div>)}
    </div>
  )
}
