import { Link } from 'react-router-dom'
import { Skeleton } from '../../ui/Skeleton'
import { PageState } from '../../ui/PageState'
import { StatGrid } from './StatGrid'
import { useAdminStats } from './useAdminStats'

export function AdminHome() {
  const { stats, isLoading, error } = useAdminStats()

  if (isLoading) return <Skeleton height="120px" radius="14px" />
  if (error) return <PageState title="Não foi possível carregar o painel" />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
      <div>
        <p className="aa-eyebrow">Bem-vinda</p>
        <h1 className="aa-h1">Painel do catálogo</h1>
      </div>
      <StatGrid
        stats={[
          { label: 'Programas', value: stats.programas },
          { label: 'Benefícios', value: stats.beneficios },
          { label: 'Pendentes', value: stats.pendentes },
          { label: 'Novos', value: stats.novos },
        ]}
      />
      <div className="aa-areagrid">
        <Link className="aa-area" to="/admin/sources">
          Gerenciar fontes e variantes
          <span className="muted" aria-hidden="true">
            →
          </span>
        </Link>
        <Link className="aa-area" to="/admin/benefits">
          Gerenciar benefícios
          <span className="muted" aria-hidden="true">
            →
          </span>
        </Link>
      </div>
    </div>
  )
}
