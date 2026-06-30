import type { SourceCategory } from '../benefits/types'

export interface CategoryMeta {
  key: SourceCategory
  label: string
  icon: string
}

// Ordem e rótulos travados na spec §2 (Global Constraints).
export const SOURCE_CATEGORY_META: CategoryMeta[] = [
  { key: 'bank_card', label: 'Bancos & cartões', icon: '🏦' },
  { key: 'carrier', label: 'Operadoras de celular', icon: '📶' },
  { key: 'health', label: 'Planos de saúde', icon: '🩺' },
  { key: 'corporate_benefits', label: 'Multibenefícios', icon: '💼' },
  { key: 'loyalty', label: 'Fidelidade & pontos', icon: '⭐' },
  { key: 'retail', label: 'Varejo & assinaturas', icon: '🛍️' },
  { key: 'mall', label: 'Shoppings', icon: '🏬' },
]

const BY_KEY = new Map(SOURCE_CATEGORY_META.map((m) => [m.key, m]))

export function categoryMeta(key: SourceCategory): CategoryMeta {
  return BY_KEY.get(key) ?? { key, label: key, icon: '🎁' }
}
