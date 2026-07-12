import type { MyBenefit, BenefitCategory, SourceCategory } from './types'
import type { PassProps } from '../../ui/Pass'

const SOURCE_CAT_LABEL: Record<SourceCategory, string> = {
  bank_card: 'Cartão',
  carrier: 'Operadora',
  health: 'Saúde',
  corporate_benefits: 'Benefícios',
  loyalty: 'Fidelidade',
  retail: 'Varejo',
  mall: 'Shopping',
}

// "novo" = adicionado ao catálogo nos últimos 14 dias (sinal real de created_at).
function isRecentlyAdded(iso: string): boolean {
  const t = Date.parse(iso)
  return Number.isFinite(t) && Date.now() - t < 14 * 24 * 60 * 60 * 1000
}

export type DsCat = 'airport' | 'seguro' | 'viagem' | 'cashback' | 'compras' | 'pontos'

const CAT_MAP: Record<BenefitCategory, DsCat> = {
  airport: 'airport', concierge: 'airport',
  travel: 'viagem', miles: 'viagem',
  insurance: 'seguro', security: 'seguro',
  cashback: 'cashback', investback: 'cashback',
  points: 'pontos',
  shopping: 'compras', restaurant: 'compras', international_purchase: 'compras',
  experience: 'compras', investment: 'compras', account_service: 'compras', other: 'compras',
}

export function categoryToDsCat(c: BenefitCategory): DsCat {
  return CAT_MAP[c] ?? 'compras'
}

const ORIGIN_MAP = { issuer: 'emissor', card_network: 'bandeira', partner: 'parceiro' } as const

export function toPassProps(b: MyBenefit): PassProps {
  const originType =
    b.benefit_source && b.benefit_source !== 'mixed' ? ORIGIN_MAP[b.benefit_source] : 'emissor'
  const provider = b.origins[0]?.provider ?? b.partner_name ?? b.source_name ?? ''
  let originLabel = provider
  if (originType === 'bandeira' && b.networks[0]) {
    originLabel = [b.networks[0].brand, b.networks[0].level].filter(Boolean).join(' ')
  } else {
    const cat = b.origins[0]?.category
    if (cat && provider) originLabel = `${SOURCE_CAT_LABEL[cat]} · ${provider}`
  }
  return {
    title: b.title,
    via: b.via[0] ?? provider,
    desc: b.summary,
    category: categoryToDsCat(b.category),
    originType,
    originLabel,
    isNew: isRecentlyAdded(b.created_at),
  }
}
