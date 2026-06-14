import { Link } from 'react-router-dom'
import type { MyBenefit } from './types'

export function BenefitCard({ benefit }: { benefit: MyBenefit }) {
  return (
    <Link
      to={`/beneficio/${benefit.id}`}
      className="block rounded-xl border border-slate-200 p-4 hover:border-slate-300"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="font-semibold text-slate-900">{benefit.title}</h3>
        {benefit.partner_name && (
          <span className="shrink-0 text-xs text-slate-500">{benefit.partner_name}</span>
        )}
      </div>
      <p className="mt-1 text-sm text-slate-600">{benefit.summary}</p>
      {benefit.via.length > 0 && (
        <p className="mt-2 text-xs text-slate-400">via {benefit.via.join(', ')}</p>
      )}
    </Link>
  )
}
