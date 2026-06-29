import { NavLink } from 'react-router-dom'
import { PainelIcon, SearchIcon, PerfilIcon } from './navIcons'

const items = [
  { to: '/painel', label: 'Painel', Icon: PainelIcon },
  { to: '/buscar', label: 'Buscar', Icon: SearchIcon },
  { to: '/perfil', label: 'Perfil', Icon: PerfilIcon },
]

export function BottomNav() {
  return (
    <nav className="tabbar" aria-label="Principal">
      <div className="nav">
        {items.map(({ to, label, Icon }) => (
          <NavLink key={to} to={to}>
            <span className="ic" aria-hidden="true">
              <Icon />
            </span>
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
