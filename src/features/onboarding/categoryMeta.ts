import type { SourceCategory } from '../benefits/types'

export interface CategoryMeta {
  key: SourceCategory
  label: string
  icon: string
  /** cor de MARCADOR (ponto/pastilha) — não usar em texto pequeno: reprova contraste AA. */
  color: string
}

// Ordem, rótulos e cores travados aqui — fonte única para label + ícone + cor de categoria.
// (As cores vinham de admin/discovery; centralizadas para o onboarding não importar do admin.)
export const SOURCE_CATEGORY_META: CategoryMeta[] = [
  { key: 'bank_card', label: 'Bancos & cartões', icon: '🏦', color: 'var(--accent)' },
  { key: 'carrier', label: 'Operadoras de celular', icon: '📶', color: 'var(--c-pontos)' },
  { key: 'health', label: 'Planos de saúde', icon: '🩺', color: 'var(--c-seguro)' },
  { key: 'corporate_benefits', label: 'Multibenefícios', icon: '💼', color: 'var(--c-cashback)' },
  { key: 'loyalty', label: 'Fidelidade & pontos', icon: '⭐', color: 'var(--c-pontos)' },
  { key: 'retail', label: 'Varejo & assinaturas', icon: '🛍️', color: 'var(--c-compras)' },
  { key: 'mall', label: 'Shoppings', icon: '🏬', color: 'var(--c-viagem)' },
]

const BY_KEY = new Map(SOURCE_CATEGORY_META.map((m) => [m.key, m]))

export function categoryMeta(key: SourceCategory): CategoryMeta {
  return BY_KEY.get(key) ?? { key, label: key, icon: '🎁', color: 'var(--muted)' }
}
