import type { BenefitCategory } from '../../benefits/types'

export type BenefitScope = 'nacional' | 'regional' | 'pontual'

export interface BenefitLocationRow {
  id: string
  benefit_id: string
  name: string
  lat: number
  lng: number
  address: string | null
  city: string | null
  uf: string | null
  radius_m: number | null
  active: boolean
}

export interface BenefitRow {
  id: string
  title: string
  summary: string
  category: BenefitCategory
  scope: BenefitScope
  uf: string | null
  steps: string | null
  partner_name: string | null
  valid_until: string | null
  image_url: string | null
  action_url: string | null
  action_label: string | null
  active: boolean
  benefit_sources: { source_item_id: string }[]
  benefit_locations: BenefitLocationRow[]
}

export type BenefitInput = Omit<BenefitRow, 'id' | 'benefit_sources' | 'benefit_locations'>
export type BenefitLocationInput = Omit<BenefitLocationRow, 'id'>
