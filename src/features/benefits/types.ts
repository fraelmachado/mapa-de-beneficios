export type BenefitCategory =
  | 'travel' | 'insurance' | 'cashback' | 'investback' | 'points' | 'miles'
  | 'shopping' | 'restaurant' | 'airport' | 'concierge' | 'investment'
  | 'security' | 'account_service' | 'international_purchase' | 'experience' | 'other'

export type SourceCategory =
  | 'bank_card' | 'carrier' | 'health' | 'corporate_benefits'
  | 'loyalty' | 'retail' | 'mall'

export type BenefitSourceKind = 'issuer' | 'card_network' | 'partner' | 'mixed'

export interface BenefitOrigin {
  provider: string
  category: SourceCategory
}

export interface BenefitNetwork {
  brand: string
  level: string
}

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
  benefit_source: BenefitSourceKind | null
  estimated_value_brl: number | null
  origins: BenefitOrigin[]
  networks: BenefitNetwork[]
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
