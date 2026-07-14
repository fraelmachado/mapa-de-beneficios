import { NavLink } from 'react-router-dom'
const ITEMS = [
  { to: '/admin', label: 'Painel', end: true },
  { to: '/admin/sources', label: 'Programas', end: false },
  { to: '/admin/benefits', label: 'Benefícios', end: false },
  { to: '/admin/discovery', label: 'Discovery', end: false },
]
export function AdminNav({ pendingCount = 0 }: { pendingCount?: number }) {
  return (
    <>
      {ITEMS.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} className="aa-navbtn">
          <span>{it.label}</span>
          {it.to === '/admin/sources' && pendingCount > 0 ? <span className="aa-navcount">{pendingCount}</span> : null}
        </NavLink>
      ))}
    </>
  )
}
