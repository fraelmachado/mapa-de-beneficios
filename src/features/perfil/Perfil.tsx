import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import './perfil.css'
import { useSession } from '../auth/AuthProvider'
import { useLinkEmail } from './useLinkEmail'
import { Button } from '../../ui/Button'
import { toggleTheme } from '../../ui/theme'

export function Perfil() {
  const { session } = useSession()
  const user = session?.user
  const isAnon = user?.is_anonymous ?? true
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [submitError, setSubmitError] = useState(false)
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
              {submitError ? <p className="profile-error">Não foi possível enviar. Tente de novo.</p> : null}
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

      <section>
        <p className="lbl">Preferências</p>
        <button className="row profile-row-button" type="button" onClick={() => toggleTheme()}>
          Tema claro ou escuro
          <span className="muted" aria-hidden="true">
            ◑
          </span>
        </button>
      </section>
    </div>
  )
}
