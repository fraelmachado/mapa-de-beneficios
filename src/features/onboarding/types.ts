import type { SourceCategory } from '../benefits/types'

export type SourceKind = 'card' | 'carrier' | 'loyalty' | 'cpf'

export interface SourceItem {
  id: string
  label: string
  sort_order: number
  /** nº de benefícios ativos ligados a este tier (para a sheet do wizard) */
  benefitCount?: number
  /** soma do valor estimado dos benefícios deste tier, em BRL */
  estValueBrl?: number
}

export interface Source {
  id: string
  kind: SourceKind
  name: string
  logo_url: string | null
  sort_order: number
  source_items: SourceItem[]
  source_category?: SourceCategory
}
