import { Outlet, NavLink } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { PainelIcon, SearchIcon, PerfilIcon, ThemeIcon } from './navIcons'
import { toggleTheme } from '../../ui/theme'

const links = [
  { to: '/painel', label: 'Painel', Icon: PainelIcon },
  { to: '/buscar', label: 'Buscar', Icon: SearchIcon },
  { to: '/perfil', label: 'Perfil', Icon: PerfilIcon },
]

export function AppLayout() {
  return (
    <div className="app">
      <aside className="side" aria-label="Navegacao principal">
        <div className="brand"><span className="app-brand-mark" aria-hidden="true" />Mapa de Benefícios</div>
        <nav aria-label="Principal">
          {links.map(({ to, label, Icon }) => <NavLink key={to} to={to}><Icon />{label}</NavLink>)}
        </nav>
        <button className="btn ghost side-theme" type="button" onClick={() => toggleTheme()}><ThemeIcon /> Tema</button>
      </aside>
      <main className="main"><Outlet /></main>
      <BottomNav />
    </div>
  )
}
