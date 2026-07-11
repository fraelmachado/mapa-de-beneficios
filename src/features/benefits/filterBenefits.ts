import type { BenefitCategory, MyBenefit } from './types'

export interface BenefitFilter {
  category: BenefitCategory | null
  text: string
}

export function filterBenefits(items: MyBenefit[], filter: BenefitFilter): MyBenefit[] {
  const q = filter.text.trim().toLowerCase()
  return items.filter((b) => {
    if (filter.category && b.category !== filter.category) return false
    if (!q) return true
    const providers = b.origins.map((origin) => origin.provider).join(' ')
    const haystack = `${b.title} ${b.summary} ${b.partner_name ?? ''} ${providers} ${b.via.join(' ')}`.toLowerCase()
    return haystack.includes(q)
  })
}
