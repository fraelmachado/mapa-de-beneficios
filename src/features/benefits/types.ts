export type BenefitCategory =
  | 'travel' | 'insurance' | 'cashback' | 'investback' | 'points' | 'miles'
  | 'shopping' | 'restaurant' | 'airport' | 'concierge' | 'investment'
  | 'security' | 'account_service' | 'international_purchase' | 'experience' | 'other'

export interface MyBenefit {
  id: string
  title: string
  summary: string
  category: BenefitCategory
  scope: string
  uf: string | null
  steps: string | null
  partner_name: string | null
  valid_until: string | null
  image_url: string | null
  action_url: string | null
  action_label: string | null
  created_at: string
  source_url: string | null
  source_name: string | null
  observed_at: string | null
  via: string[]
}

export const CATEGORIES: { key: BenefitCategory; label: string; emoji: string }[] = [
  { key: 'travel', label: 'Viagem', emoji: '✈️' },
  { key: 'airport', label: 'Aeroporto', emoji: '🛫' },
  { key: 'insurance', label: 'Seguros', emoji: '🛡️' },
  { key: 'shopping', label: 'Compras', emoji: '🛍️' },
  { key: 'cashback', label: 'Cashback', emoji: '💸' },
  { key: 'investback', label: 'Investback', emoji: '📈' },
  { key: 'points', label: 'Pontos', emoji: '⭐' },
  { key: 'miles', label: 'Milhas', emoji: '🪙' },
  { key: 'restaurant', label: 'Restaurantes', emoji: '🍽️' },
  { key: 'concierge', label: 'Concierge', emoji: '🛎️' },
  { key: 'investment', label: 'Investimentos', emoji: '🏦' },
  { key: 'security', label: 'Proteção', emoji: '🔒' },
  { key: 'account_service', label: 'Conta', emoji: '💳' },
  { key: 'international_purchase', label: 'Internacional', emoji: '🌎' },
  { key: 'experience', label: 'Experiências', emoji: '🎬' },
  { key: 'other', label: 'Outros', emoji: '🎁' },
]
