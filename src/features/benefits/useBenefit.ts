import { useMyBenefits } from './useMyBenefits'
import { relatedBySource } from './relatedBySource'
import type { MyBenefit } from './types'

export function useBenefit(userId: string | undefined, id: string | undefined) {
  const q = useMyBenefits(userId)
  const all = q.data ?? []
  const benefit: MyBenefit | undefined = all.find((b) => b.id === id)
  const related: MyBenefit[] = benefit ? relatedBySource(all, benefit) : []
  return { ...q, benefit, related }
}
