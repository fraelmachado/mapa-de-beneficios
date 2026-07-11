import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useSession } from '../auth/AuthProvider'
import { useMyBenefits } from '../benefits/useMyBenefits'
import { filterBenefits } from '../benefits/filterBenefits'
import { BenefitCard } from '../benefits/BenefitCard'
import { CategoryChips } from '../benefits/CategoryChips'
import { HeroRadar } from '../../ui/HeroRadar'
import { PageState } from '../../ui/PageState'
import { Skeleton } from '../../ui/Skeleton'
import type { BenefitCategory } from '../benefits/types'
import './painel.css'

export function Painel() {
  const { session } = useSession()
  const { data, isLoading, error, refetch } = useMyBenefits(session?.user.id)
  const [category, setCategory] = useState<BenefitCategory | null>(null)

  if (isLoading) {
    return (
      <div className="app-page app-page-wide radar-loading" aria-label="Carregando seu radar">
        <Skeleton height="132px" radius="18px" />
        <Skeleton variant="pass" />
        <Skeleton variant="pass" />
      </div>
    )
  }
  if (error) {
    return (
      <div className="app-page">
        <PageState
          title="Não foi possível carregar seu radar"
          description="Confira sua conexão e tente novamente."
          action={{ label: 'Tentar novamente', onClick: () => void refetch() }}
        />
      </div>
    )
  }

  const all = data ?? []
  const visible = filterBenefits(all, { category, text: '' })

  if (all.length === 0) {
    return (
      <div className="app-page radar-page">
        <p className="lbl">Seu radar de benefícios</p>
        <PageState title="Nenhum benefício no seu radar ainda" description="Adicione seus programas para revelar seus benefícios.">
          <span className="radar-empty-mark">0</span>
        </PageState>
        <div className="radar-empty-actions">
          <Link className="btn" to="/onboarding?mode=edit">Adicionar programas</Link>
          <button className="btn ghost" type="button" disabled>Conectar Gmail - Em breve</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-page app-page-wide radar-page">
      <p className="lbl">Seu radar de benefícios</p>
      <HeroRadar count={all.length} label="Seu radar" caption={`${all.length} benefício${all.length === 1 ? '' : 's'} ativo${all.length === 1 ? '' : 's'}`} />
      <div className="radar-filters">
        <CategoryChips selected={category} onChange={setCategory} />
      </div>
      {visible.length === 0
        ? <PageState title="Nenhum benefício nesta categoria" description="Escolha outra categoria." action={{ label: 'Limpar filtro', onClick: () => setCategory(null) }} />
        : <div className="passes">{visible.map((benefit) => <BenefitCard key={benefit.id} benefit={benefit} />)}</div>}
    </div>
  )
}
