import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { groupSourcesByCategory } from './groupSourcesByCategory'
import { benefitValue } from '../benefits/estimatedValue'
import type { Source } from './types'

// Traz os tiers (source_items) com os benefícios ativos ligados a cada um,
// para a sheet do wizard mostrar "N benefícios · ≈R$X/ano" por tier.
const SELECT =
  'id, kind, name, logo_url, sort_order, source_category, ' +
  'source_items(id, label, sort_order, benefit_sources(benefits(estimated_value_brl, active)))'

interface RawBenefit {
  estimated_value_brl: number | null
  active: boolean
}
interface RawItem {
  id: string
  label: string
  sort_order: number
  benefit_sources: { benefits: RawBenefit | null }[] | null
}
type RawSource = Omit<Source, 'source_items'> & { source_items: RawItem[] | null }

function enrich(rows: RawSource[]): Source[] {
  return rows.map((s) => ({
    ...s,
    source_items: (s.source_items ?? []).map((it) => {
      const benefits = (it.benefit_sources ?? [])
        .map((bs) => bs.benefits)
        .filter((b): b is RawBenefit => !!b && b.active)
      return {
        id: it.id,
        label: it.label,
        sort_order: it.sort_order,
        benefitCount: benefits.length,
        estValueBrl: benefits.reduce((acc, b) => acc + benefitValue(b), 0),
      }
    }),
  }))
}

export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      const { data, error } = await supabase.from('sources').select(SELECT).eq('active', true)
      if (error) throw error
      return groupSourcesByCategory(enrich((data ?? []) as unknown as RawSource[]))
    },
  })
}
