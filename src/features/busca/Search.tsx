import { useState } from 'react'
import { useSession } from '../auth/AuthProvider'
import { useMyBenefits } from '../benefits/useMyBenefits'
import { filterBenefits } from '../benefits/filterBenefits'
import { BenefitCard } from '../benefits/BenefitCard'
import { CategoryChips } from '../benefits/CategoryChips'
import { Input } from '../../ui/Input'
import { Skeleton } from '../../ui/Skeleton'
import type { BenefitCategory } from '../benefits/types'

export function Search() {
  const { session } = useSession()
  const { data, isLoading, error } = useMyBenefits(session?.user.id)
  const [text, setText] = useState('')
  const [category, setCategory] = useState<BenefitCategory | null>(null)

  const all = data ?? []
  const results = filterBenefits(all, { category, text })

  return (
    <div className="mx-auto max-w-md p-4 pb-24" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--s3)' }}>
      <h1 style={{ fontSize: 'var(--fz-h1)', fontWeight: 700, letterSpacing: '-.03em', margin: '0 0 var(--s2)' }}>
        Buscar
      </h1>
      <Input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="buscar benefício…"
        icon="⌕"
        ariaLabel="Buscar benefício"
      />
      <CategoryChips selected={category} onChange={setCategory} />

      {isLoading && <Skeleton variant="pass" />}
      {error && <p className="muted">Erro ao carregar.</p>}
      {!isLoading && !error && results.length === 0 && <p className="muted">Nada encontrado.</p>}

      <div className="passes">
        {results.map((b) => (
          <BenefitCard key={b.id} benefit={b} />
        ))}
      </div>
    </div>
  )
}
