import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'
import { ensureAnonymousSession } from './auth'

type AuthState = { session: Session | null; loading: boolean }

const AuthContext = createContext<AuthState>({ session: null, loading: true })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    let active = true
    ensureAnonymousSession()
      .then((s) => {
        if (active) setSession(s)
      })
      .catch(() => {
        if (active) setError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return
      if (s) {
        setSession(s)
        return
      }
      // Recria sessão anônima APENAS em logout explícito; ignora o
      // INITIAL_SESSION nulo do load (o mount já cria a sessão inicial),
      // evitando criar sessões anônimas duplicadas.
      if (event === 'SIGNED_OUT') {
        ensureAnonymousSession()
          .then((ns) => {
            if (active) setSession(ns)
          })
          .catch(() => {
            if (active) setError(true)
          })
      }
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">Preparando o Benefy…</p>
      </div>
    )
  }

  if (error || !session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-slate-700">Não foi possível conectar. Verifique sua internet.</p>
        <button
          type="button"
          className="rounded-lg bg-slate-800 px-4 py-2 text-white"
          onClick={() => window.location.reload()}
        >
          Tentar de novo
        </button>
      </div>
    )
  }

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>
}

export function useSession(): AuthState {
  return useContext(AuthContext)
}
