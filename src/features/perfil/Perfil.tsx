import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import './perfil.css'
import { useSession } from '../auth/AuthProvider'
import { useLinkEmail } from './useLinkEmail'
import { Button } from '../../ui/Button'
import { toggleTheme } from '../../ui/theme'
import { supabase } from '../../lib/supabase'

const stroke = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  width: 17,
  height: 17,
}

export function Perfil() {
  const { session } = useSession()
  const user = session?.user
  const isAnon = user?.is_anonymous ?? true
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const [isSigningOut, setIsSigningOut] = useState(false)
  const [signOutError, setSignOutError] = useState(false)
  const [theme, setTheme] = useState(() =>
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light',
  )
  const link = useLinkEmail()

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitError(false)
    try {
      await link.mutateAsync(email)
      setSent(true)
    } catch {
      setSubmitError(true)
    }
  }

  async function signOut() {
    setIsSigningOut(true)
    setSignOutError(false)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    } catch {
      setSignOutError(true)
    } finally {
      setIsSigningOut(false)
    }
  }

  function changeTheme() {
    setTheme(toggleTheme())
  }

  return (
    <div className="app-page profile-page">
      <header>
        <h1>Seu perfil</h1>
      </header>

      <section className="profile-identity">
        <span className="profile-avatar" aria-hidden="true">
          {(isAnon ? 'Visitante' : user?.email || 'V').charAt(0).toUpperCase()}
        </span>
        <div className="profile-identity-info">
          <strong>{isAnon ? 'Visitante' : user?.email}</strong>
          <span>{isAnon ? 'sessão anônima' : 'conta vinculada'}</span>
        </div>
      </section>

      {isAnon ? (
        <section className="profile-access">
          <p className="lbl">Garanta seu acesso</p>
          {sent ? (
            <div className="profile-confirmation" role="status">
              <span className="profile-confirmation-check" aria-hidden="true">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
              </span>
              <span>Enviamos um link de confirmação para <strong>{email}</strong>.</span>
            </div>
          ) : (
            <form onSubmit={submit} className="profile-form">
              <p>Sua conta é temporária. Adicione um e-mail para não perder seus benefícios ao trocar de aparelho.</p>
              <label className="lbl" htmlFor="email">E-mail</label>
              <label className="input">
                <svg {...stroke} aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="m3 7 9 6 9-6" /></svg>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="voce@email.com"
                />
              </label>
              {submitError ? <p className="profile-error" role="alert">Não foi possível enviar. Tente de novo.</p> : null}
              <Button type="submit" disabled={link.isPending}>
                {link.isPending ? 'Enviando...' : 'Salvar meu acesso'}
              </Button>
            </form>
          )}
        </section>
      ) : null}

      <section className="profile-conta">
        <p className="lbl">Conta</p>
        <div className="profile-rows">
          <Link className="profile-row" to="/onboarding?mode=edit">
            <span className="profile-row-icon" aria-hidden="true">
              <svg {...stroke}><rect x="3" y="5" width="18" height="13" rx="2.5" /><path d="M3 9h18" /></svg>
            </span>
            <span className="profile-row-label">Editar meus programas</span>
            <span className="profile-row-chev" aria-hidden="true">›</span>
          </Link>

          <Link className="profile-row" to="/alertas">
            <span className="profile-row-icon" aria-hidden="true">
              <svg {...stroke}><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
            </span>
            <span className="profile-row-label">Alertas</span>
            <span className="profile-row-chev" aria-hidden="true">›</span>
          </Link>

          <button className="profile-row" type="button" aria-pressed={theme === 'dark'} onClick={changeTheme}>
            <span className="profile-row-icon" aria-hidden="true">
              <svg {...stroke}><path d="M12 3a9 9 0 1 0 9 9c-5 0-9-4-9-9Z" /></svg>
            </span>
            <span className="profile-row-label">Tema <span className="profile-row-sub">{theme === 'dark' ? 'escuro' : 'claro'}</span></span>
            <span className="profile-row-chev" aria-hidden="true">◑</span>
          </button>

          {!isAnon ? (
            <button className="profile-row" type="button" disabled={isSigningOut} onClick={signOut}>
              <span className="profile-row-icon" aria-hidden="true">
                <svg {...stroke}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              </span>
              <span className="profile-row-label">{isSigningOut ? 'Saindo...' : 'Encerrar sessão'}</span>
            </button>
          ) : null}

          <a className="profile-row" href="#">
            <span className="profile-row-icon" aria-hidden="true">
              <svg {...stroke}><circle cx="12" cy="12" r="9" /><path d="M12 16v-4" /><path d="M12 8h.01" /></svg>
            </span>
            <span className="profile-row-label">Ajuda e privacidade</span>
            <span className="profile-row-chev" aria-hidden="true">›</span>
          </a>
        </div>
        {signOutError ? <p className="profile-error" role="alert">Não foi possível encerrar a sessão. Tente de novo.</p> : null}
      </section>

      <p className="profile-version">Mapa de Benefícios · v1.0</p>
      <p className="sr-only" role="status" aria-live="polite">Tema {theme === 'dark' ? 'escuro' : 'claro'} ativado</p>
    </div>
  )
}
