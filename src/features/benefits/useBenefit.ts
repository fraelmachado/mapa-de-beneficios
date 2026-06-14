import { useMyBenefits } from './useMyBenefits'
import type { MyBenefit } from './types'

export function useBenefit(userId: string | undefined, id: string | undefined) {
  const q = useMyBenefits(userId)
  const benefit: MyBenefit | undefined = (q.data ?? []).find((b) => b.id === id)
  return { ...q, benefit }
}
