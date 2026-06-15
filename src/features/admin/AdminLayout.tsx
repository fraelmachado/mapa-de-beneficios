import { Link, Outlet, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'

export function AdminLayout() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="flex items-center gap-4 border-b border-slate-200 bg-white px-4 py-3">
        <Link to="/admin" className="font-bold text-slate-900">Admin Benefy</Link>
        <Link to="/admin/sources" className="text-sm text-slate-600">Fontes</Link>
        <Link to="/admin/benefits" className="text-sm text-slate-600">Benefícios</Link>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut()
            navigate('/', { replace: true })
          }}
          className="ml-auto text-sm text-slate-500"
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
