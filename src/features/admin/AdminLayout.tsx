import { Link, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function AdminLayout() {
  const navigate = useNavigate()
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--s4)',
          borderBottom: '1px solid var(--line)',
          background: 'var(--surface)',
          padding: 'var(--s3) var(--s4)',
        }}
      >
        <Link to="/admin" style={{ fontWeight: 700, color: 'var(--ink)', textDecoration: 'none' }}>
          Admin · Mapa de Benefícios
        </Link>
        <Link to="/admin/sources" className="muted" style={{ fontSize: 13, textDecoration: 'none' }}>
          Fontes
        </Link>
        <Link to="/admin/benefits" className="muted" style={{ fontSize: 13, textDecoration: 'none' }}>
          Benefícios
        </Link>
        <Link to="/admin/discovery" className="muted" style={{ fontSize: 13, textDecoration: 'none' }}>
          Discovery
        </Link>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut()
            navigate('/', { replace: true })
          }}
          className="muted"
          style={{ marginLeft: 'auto', fontSize: 13, background: 'transparent', border: 'none', cursor: 'pointer' }}
        >
          Sair
        </button>
      </header>
      <main className="mx-auto max-w-3xl p-4">
        <Outlet />
      </main>
    </div>
  )
}
