import { useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useSession } from '../auth/AuthProvider'
import { useIsAdmin } from './useIsAdmin'
import { Skeleton } from '../../ui/Skeleton'

export function AdminGuard() {
  const navigate = useNavigate()
  const { session } = useSession()
  const { data: isAdmin, isLoading, error } = useIsAdmin(session?.user.id)

  useEffect(() => {
    if (isLoading) return
    if (error || isAdmin === false) navigate('/admin/login', { replace: true })
  }, [isLoading, error, isAdmin, navigate])

  if (isLoading || isAdmin === undefined) {
    return <div className="aa-main"><Skeleton height="120px" radius="14px" /></div>
  }
  if (!isAdmin) return null
  return <Outlet />
}
