import { Link } from 'react-router-dom'

export function AdminHome() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
      <h1 style={{ fontSize: 'var(--fz-h1)', fontWeight: 700, letterSpacing: '-.03em', margin: 0 }}>
        Painel do catálogo
      </h1>
      <div>
        <Link className="row" to="/admin/sources" style={{ color: 'inherit' }}>
          Gerenciar fontes e variantes
          <span className="muted" aria-hidden="true">
            →
          </span>
        </Link>
        <Link className="row" to="/admin/benefits" style={{ color: 'inherit' }}>
          Gerenciar benefícios
          <span className="muted" aria-hidden="true">
            →
          </span>
        </Link>
        <Link className="row" to="/admin/discovery" style={{ color: 'inherit' }}>
          Discovery (fila de revisão)
          <span className="muted" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </div>
  )
}
