import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Button } from '../../ui/Button'
import { Input } from '../../ui/Input'

export function AdminLogin() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(false)
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) {
      setError(true)
      return
    }
    navigate('/admin', { replace: true })
  }

  return (
    <main className="aa-login">
      <div className="aa-login-card">
        <h1 className="aa-h1">Admin · Mapa de Benefícios</h1>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
          <label className="lbl" htmlFor="email" style={{ margin: 0 }}>
            E-mail
          </label>
          <Input
            id="email"
            type="email"
            required
            ariaLabel="E-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label className="lbl" htmlFor="password" style={{ margin: 'var(--s2) 0 0' }}>
            Senha
          </label>
          <Input
            id="password"
            type="password"
            required
            ariaLabel="Senha"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" style={{ fontSize: 14, color: 'var(--warn)' }}>
              Não foi possível entrar. Verifique e-mail e senha.
            </p>
          )}
          <Button type="submit" disabled={loading}>
            Entrar
          </Button>
        </form>
        <p className="aa-login-foot muted">Instalável como app</p>
      </div>
    </main>
  )
}
