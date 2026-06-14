import { useState } from 'react'
import { useSession } from '../auth/AuthProvider'
import { useMyBenefits } from '../benefits/useMyBenefits'
import { filterBenefits } from '../benefits/filterBenefits'
import { BenefitCard } from '../benefits/BenefitCard'
import { CategoryChips } from '../benefits/CategoryChips'
import type { BenefitCategory } from '../benefits/types'

export function Search() {
  const { session } = useSession()
  const { data, isLoading, error } = useMyBenefits(session?.user.id)
  const [text, setText] = useState('')
  const [category, setCategory] = useState<BenefitCategory | null>(null)

  const all = data ?? []
  const results = filterBenefits(all, { category, text })

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-4 pb-24">
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Digite uma loja, produto ou benefício…"
        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base"
      />
      <CategoryChips selected={category} onChange={setCategory} />

      {isLoading && <p className="text-slate-500">Carregando…</p>}
      {error && <p className="text-red-600">Erro ao carregar.</p>}
      {!isLoading && !error && results.length === 0 && (
        <p className="text-slate-500">Nada encontrado.</p>
      )}
      <div className="flex flex-col gap-3">
        {results.map((b) => (
          <BenefitCard key={b.id} benefit={b} />
        ))}
      </div>
    </div>
  )
}
