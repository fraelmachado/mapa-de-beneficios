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
  const rawName = session?.user?.email?.split('@')[0]
  const greetingName = rawName ? rawName.charAt(0).toUpperCase() + rawName.slice(1) : 'Visitante'
  // ponytail: placeholder estimate (~R$180/benefício) até o modelo ter valor real por benefício
  const estValue = `R$ ${(all.length * 180).toLocaleString('pt-BR')}`

  if (all.length === 0) {
    return (
      <div className="app-page radar-page">
        <header className="radar-head">
          <p className="lbl">Olá, {greetingName}</p>
          <h1>Seu radar de benefícios</h1>
        </header>
        <div className="radar-empty-body">
          <div className="radar-rings" aria-hidden="true">
            <span className="radar-ring" />
            <span className="radar-ring" />
            <span className="radar-ring" />
            <span className="radar-rings-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /><path d="M12 4v2M12 18v2M4 12h2M18 12h2" /></svg>
            </span>
          </div>
          <h2>Nenhum benefício no radar ainda</h2>
          <p>Adicione seus programas — a gente começa a mapear na hora.</p>
        </div>
        <div className="radar-empty-actions">
          <Link className="btn" to="/onboarding?mode=edit">Adicionar programas</Link>
          <button className="btn ghost" type="button" disabled>Conectar Gmail — Em breve</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-page app-page-wide radar-page">
      <div className="radar-banner">
        <span className="radar-banner-check" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
        </span>
        <span className="radar-banner-text">Radar montado — <b>{all.length} benefício{all.length === 1 ? '' : 's'}</b> a partir dos seus programas.</span>
      </div>
      <header className="radar-head">
        <p className="lbl">Olá, {greetingName}</p>
        <h1>Seu radar de benefícios</h1>
      </header>
      <HeroRadar count={all.length} label="Seu radar" value={estValue} />
      <h2 className="radar-section-title">Encontrados pra você</h2>
      <div className="radar-filters">
        <CategoryChips selected={category} onChange={setCategory} />
      </div>
      {visible.length === 0
        ? <PageState title="Nenhum benefício nesta categoria" description="Escolha outra categoria." action={{ label: 'Limpar filtro', onClick: () => setCategory(null) }} />
        : <div className="passes">{visible.map((benefit) => <BenefitCard key={benefit.id} benefit={benefit} />)}</div>}
    </div>
  )
}
