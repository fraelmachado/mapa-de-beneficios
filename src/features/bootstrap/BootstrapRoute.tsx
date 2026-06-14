import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSession } from '../auth/AuthProvider'
import { useHasOnboarded } from './useHasOnboarded'

export function BootstrapRoute() {
  const navigate = useNavigate()
  const { session, loading } = useSession()
  const { data: onboarded, isLoading } = useHasOnboarded(!!session)

  useEffect(() => {
    if (loading || !session || isLoading || onboarded === undefined) return
    navigate(onboarded ? '/painel' : '/onboarding', { replace: true })
  }, [loading, session, isLoading, onboarded, navigate])

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-slate-500">Preparando o Benefy…</p>
    </div>
  )
}
