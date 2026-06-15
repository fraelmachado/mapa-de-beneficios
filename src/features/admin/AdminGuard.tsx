import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useSession } from '../auth/AuthProvider'
import { useIsAdmin } from './useIsAdmin'

export function AdminGuard() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { data: isAdmin, isLoading, error } = useIsAdmin(session?.user.id)

  useEffect(() => {
    if (isLoading) return
    if (error || isAdmin === false) navigate('/admin/login', { replace: true })
  }, [isLoading, error, isAdmin, navigate])

  if (isLoading || isAdmin === undefined) {
    return <p className="p-6 text-slate-500">Verificando acesso…</p>
  }
  if (!isAdmin) return null
  return <Outlet />
}
