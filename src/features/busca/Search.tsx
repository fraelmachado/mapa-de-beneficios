import { useState } from 'react'
import './search.css'
import { useSession } from '../auth/AuthProvider'
import { useMyBenefits } from '../benefits/useMyBenefits'
import { filterBenefits } from '../benefits/filterBenefits'
import { BenefitCard } from '../benefits/BenefitCard'
import { CategoryChips } from '../benefits/CategoryChips'
import { PageState, Skeleton } from '../../ui'
import type { BenefitCategory } from '../benefits/types'

export function Search() {
  const { session } = useSession()
  const { data, isLoading, error, refetch } = useMyBenefits(session?.user.id)
  const [text, setText] = useState('')
  const [category, setCategory] = useState<BenefitCategory | null>(null)
  const all = data ?? []
  const results = filterBenefits(all, { category, text })
  const filtering = text.trim().length > 0 || category !== null

  return (
    <div className="app-page app-page-wide search-page">
      <header>
        <p className="lbl">Seu catálogo</p>
        <h1>Buscar</h1>
        <p>Encontre benefícios por nome, programa ou categoria.</p>
      </header>
      <label className="search-field">
        <span aria-hidden="true">⌕</span>
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="buscar benefício, programa..."
          aria-label="Buscar benefício"
        />
        {text ? <button type="button" onClick={() => setText('')} aria-label="Limpar busca">×</button> : null}
      </label>
      <CategoryChips selected={category} onChange={setCategory} />
      {filtering && !isLoading && !error ? <p className="search-count">{results.length} resultado{results.length === 1 ? '' : 's'}</p> : null}
      {isLoading ? <div aria-label="Carregando resultados"><Skeleton variant="pass" /><Skeleton variant="pass" /></div> : null}
      {error ? <PageState title="Não foi possível buscar" action={{ label: 'Tentar novamente', onClick: () => void refetch() }} /> : null}
      {!isLoading && !error && all.length === 0 ? <PageState title="Seu catálogo ainda está vazio" description="Adicione programas no Perfil para começar." /> : null}
      {!isLoading && !error && all.length > 0 && results.length === 0 ? <PageState title="Nada encontrado" description="Tente outro termo ou remova os filtros." action={{ label: 'Limpar filtros', onClick: () => { setText(''); setCategory(null) } }} /> : null}
      {!isLoading && !error && results.length > 0 ? <div className="passes">{results.map((benefit) => <BenefitCard key={benefit.id} benefit={benefit} />)}</div> : null}
    </div>
  )
}
