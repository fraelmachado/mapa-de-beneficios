import { Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { AdminNav } from './AdminNav'
import { useSourceCandidates } from './discovery/useSourceCandidates'
import { ToastHost } from '../../ui/Toast'
export function AdminAppShell() {
  const navigate = useNavigate()
  const pending = useSourceCandidates('pending') // D13: degrada — se falhar, count 0, sem quebrar
  const count = pending.data?.length ?? 0
  async function logout() { await supabase.auth.signOut(); navigate('/admin/login', { replace: true }) }
  return (
    <div className="aa-root">
      <div className="aa-shell">
        <aside className="aa-side">
          <div className="aa-brand">Mapa · Admin</div>
          <nav className="aa-sidenav"><AdminNav pendingCount={count} /></nav>
          <button type="button" className="aa-navbtn aa-side-foot" onClick={logout}>Sair</button>
        </aside>
        <main className="aa-main"><ToastHost><Outlet /></ToastHost></main>
      </div>
      <nav className="aa-tabbar"><AdminNav pendingCount={count} /></nav>
    </div>
  )
}
