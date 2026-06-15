import { Link } from 'react-router-dom'

export function AdminHome() {
  return (
    <div className="flex flex-col gap-3">
      <h1 className="text-2xl font-bold text-slate-900">Painel do catálogo</h1>
      <div className="flex flex-col gap-2">
        <Link to="/admin/sources" className="rounded-lg border border-slate-200 p-4 hover:border-slate-300">
          Gerenciar fontes e variantes
        </Link>
        <Link to="/admin/benefits" className="rounded-lg border border-slate-200 p-4 hover:border-slate-300">
          Gerenciar benefícios
        </Link>
      </div>
    </div>
  )
}
