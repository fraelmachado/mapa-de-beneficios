import { useState } from 'react'
import './search.css'
import { useSession } from '../auth/AuthProvider'
import { useMyBenefits } from '../benefits/useMyBenefits'
import { filterBenefits } from '../benefits/filterBenefits'
import { BenefitCard } from '../benefits/BenefitCard'
import { CategoryChips } from '../benefits/CategoryChips'
import { PageState, Skeleton } from '../../ui'
import { CATEGORIES, type BenefitCategory } from '../benefits/types'

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
        <h1>Buscar</h1>
      </header>
      <label className="search-field">
        <span className="search-field-icon" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /></svg>
        </span>
        <input
          type="search"
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="buscar benefício, cartão…"
          aria-label="Buscar benefício"
        />
        {text ? (
          <button type="button" className="search-clear" onClick={() => setText('')} aria-label="Limpar busca">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></svg>
          </button>
        ) : null}
      </label>
      <CategoryChips selected={category} onChange={setCategory} />
      {filtering && !isLoading && !error ? <p className="search-count">{results.length} resultado{results.length === 1 ? '' : 's'}</p> : null}
      {isLoading ? <div aria-label="Carregando resultados"><Skeleton variant="pass" /><Skeleton variant="pass" /></div> : null}
      {error ? <PageState title="Não foi possível buscar" action={{ label: 'Tentar novamente', onClick: () => void refetch() }} /> : null}
      {!isLoading && !error && all.length === 0 ? <PageState title="Seu catálogo ainda está vazio" description="Adicione programas no Perfil para começar." /> : null}
      {!isLoading && !error && all.length > 0 && results.length === 0 ? (
        <div className="search-empty">
          <span className="search-empty-icon" aria-hidden="true">
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7" /><line x1="21" y1="21" x2="16.5" y2="16.5" /><line x1="8" y1="11" x2="14" y2="11" /></svg>
          </span>
          <h2>Nada encontrado</h2>
          <p>{text.trim() ? <>Não achamos benefícios para <b>&quot;{text.trim()}&quot;</b>. </> : null}Tente outro termo ou remova os filtros.</p>
          <div className="search-suggestions">
            <p className="lbl">Sugestões</p>
            <div className="chips">
              {CATEGORIES.slice(0, 4).map((c) => (
                <button key={c.key} type="button" className="chip" onClick={() => { setText(''); setCategory(c.key) }}>{c.label}</button>
              ))}
            </div>
          </div>
          <button type="button" className="btn ghost search-empty-clear" onClick={() => { setText(''); setCategory(null) }}>Limpar filtros</button>
        </div>
      ) : null}
      {!isLoading && !error && results.length > 0 ? <div className="passes">{results.map((benefit) => <BenefitCard key={benefit.id} benefit={benefit} />)}</div> : null}
    </div>
  )
}
