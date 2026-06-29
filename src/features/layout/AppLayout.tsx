import { Outlet, NavLink } from 'react-router-dom'
import { BottomNav } from './BottomNav'
import { PainelIcon, SearchIcon, PerfilIcon, ThemeIcon } from './navIcons'
import { toggleTheme } from '../../ui/theme'

export function AppLayout() {
  return (
    <div className="app">
      <aside className="side">
        <div className="brand">
          <span
            style={{
              width: 30,
              height: 30,
              borderRadius: 9,
              background: 'linear-gradient(135deg,var(--c-airport),var(--c-viagem))',
              display: 'inline-block',
            }}
          />
          Mapa de Benefícios
        </div>
        <NavLink to="/painel">
          <PainelIcon /> Painel
        </NavLink>
        <NavLink to="/buscar">
          <SearchIcon /> Buscar
        </NavLink>
        <NavLink to="/perfil">
          <PerfilIcon /> Perfil
        </NavLink>
        <button
          className="btn ghost"
          type="button"
          onClick={() => toggleTheme()}
          style={{ marginTop: 'auto', width: 'auto' }}
        >
          <ThemeIcon /> Tema
        </button>
      </aside>

      <main className="main">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  )
}
