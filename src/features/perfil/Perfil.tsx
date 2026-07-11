import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import './perfil.css'
import { useSession } from '../auth/AuthProvider'
import { useLinkEmail } from './useLinkEmail'
import { Button } from '../../ui/Button'
import { toggleTheme } from '../../ui/theme'
import { supabase } from '../../lib/supabase'

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
        <p className="lbl">Conta e preferências</p>
        <h1>Seu perfil</h1>
      </header>

      <section className="profile-identity">
        <span className="profile-avatar" aria-hidden="true">
          {(user?.email ?? 'V').charAt(0).toUpperCase()}
        </span>
        <div>
          <strong>{isAnon ? 'Visitante' : user?.email}</strong>
          <span>{isAnon ? 'sessão anônima' : 'conta vinculada'}</span>
        </div>
      </section>

      {isAnon ? (
        <section>
          <p className="lbl">Garanta seu acesso</p>
          {sent ? (
            <div className="profile-confirmation" role="status">
              Enviamos um link de confirmação para <strong>{email}</strong>.
            </div>
          ) : (
            <form onSubmit={submit} className="profile-form">
              <p>Sua conta é temporária. Adicione um e-mail para não perder seus benefícios.</p>
              <label className="lbl" htmlFor="email">
                E-mail
              </label>
              <label className="input">
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

      <section>
        <p className="lbl">Seus programas</p>
        <Link className="row" to="/onboarding?mode=edit">
          Editar meus programas
          <span className="muted" aria-hidden="true">
            →
          </span>
        </Link>
      </section>

      {!isAnon ? (
        <section>
          <p className="lbl">Conta</p>
          <button className="row profile-row-button" type="button" disabled={isSigningOut} onClick={signOut}>
            {isSigningOut ? 'Saindo...' : 'Encerrar sessão'}
          </button>
          {signOutError ? <p className="profile-error" role="alert">Não foi possível encerrar a sessão. Tente de novo.</p> : null}
        </section>
      ) : null}

      <section>
        <p className="lbl">Preferências</p>
        <button
          aria-pressed={theme === 'dark'}
          className="row profile-row-button"
          type="button"
          onClick={changeTheme}
        >
          Tema {theme === 'dark' ? 'escuro' : 'claro'}
          <span className="muted" aria-hidden="true">
            ◑
          </span>
        </button>
        <p className="sr-only" role="status" aria-live="polite">Tema {theme === 'dark' ? 'escuro' : 'claro'} ativado</p>
      </section>
    </div>
  )
}
