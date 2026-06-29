import { useState, type FormEvent, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
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
  const link = useLinkEmail()

  async function submit(e: FormEvent) {
    e.preventDefault()
    try {
      await link.mutateAsync(email)
      setSent(true)
    } catch {
      // erro exibido via link.isError
    }
  }

  return (
    <div className="mx-auto max-w-md p-4 pb-24" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s4)' }}>
      <h1 style={{ fontSize: 'var(--fz-h1)', fontWeight: 700, letterSpacing: '-.03em', margin: 0 }}>Seu perfil</h1>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--s3)',
          background: 'var(--surface)',
          border: '1px solid var(--line)',
          borderRadius: 'var(--radius)',
          padding: 'var(--s4)',
          boxShadow: 'var(--shadow)',
        }}
      >
        <span
          aria-hidden="true"
          style={{
            width: 44,
            height: 44,
            borderRadius: 13,
            background: 'linear-gradient(135deg,var(--c-airport),var(--c-viagem))',
            color: '#fff',
            display: 'grid',
            placeItems: 'center',
            fontWeight: 800,
            fontSize: 17,
          }}
        >
          {(user?.email ?? 'V').charAt(0).toUpperCase()}
        </span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{isAnon ? 'Visitante' : user?.email}</div>
          <div className="muted" style={{ fontSize: 12.5 }}>
            {isAnon ? 'sessão anônima' : 'conta vinculada'}
          </div>
        </div>
      </div>

      {isAnon ? (
        sent ? (
          <div
            className="pass"
            style={{ '--cat': 'var(--c-airport)' } as CSSProperties}
          >
            <div className="edge" />
            <div className="stub" style={{ padding: 'var(--s4)' }}>
              <p style={{ margin: 0, color: 'var(--ink-2)' }}>
                Enviamos um link de confirmação para <strong>{email}</strong>. Abra seu e-mail para
                garantir seu acesso.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>
              Sua conta é temporária. Adicione um e-mail para não perder seus benefícios ao trocar de
              aparelho.
            </p>
            <label className="lbl" htmlFor="email" style={{ margin: 'var(--s2) 0 0' }}>
              E-mail
            </label>
            <label className="input">
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="voce@email.com"
              />
            </label>
            {link.isError && (
              <p style={{ fontSize: 14, color: 'var(--warn)' }}>Não foi possível enviar. Tente de novo.</p>
            )}
            <Button type="submit" disabled={link.isPending}>
              Salvar meu acesso
            </Button>
          </form>
        )
      ) : null}

      <div>
        <p className="lbl" style={{ margin: '0 0 var(--s2)' }}>
          Conta
        </p>
        <Link className="row" to="/onboarding" style={{ color: 'inherit' }}>
          Editar minhas fontes
          <span className="muted" aria-hidden="true">
            →
          </span>
        </Link>
        <div className="row" role="button" tabIndex={0} onClick={() => toggleTheme()}>
          Tema (claro / escuro)
          <span className="muted" aria-hidden="true">
            ◑
          </span>
        </div>
      </div>
    </div>
  )
}
