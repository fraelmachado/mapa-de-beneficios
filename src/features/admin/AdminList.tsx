import type { ReactNode } from 'react'
export function AdminList<T>({ ariaLabel, rows, keyOf, renderRow }: {
  ariaLabel: string; rows: T[]; keyOf: (r: T) => string; renderRow: (r: T) => ReactNode
}) {
  return (
    <div className="aa-list" role="table" aria-label={ariaLabel}>
      {rows.map((r) => <div className="aa-lrow" role="row" key={keyOf(r)}>{renderRow(r)}</div>)}
    </div>
  )
}
