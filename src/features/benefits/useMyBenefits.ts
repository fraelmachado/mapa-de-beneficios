import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import type { MyBenefit } from './types'

export function useMyBenefits(userId: string | undefined) {
  return useQuery({
    queryKey: ['my_benefits', userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyBenefit[]> => {
      const { data, error } = await supabase
        .from('my_benefits')
        .select(
          'id, title, summary, category, scope, uf, steps, partner_name, valid_until, image_url, action_url, action_label, created_at, source_url, source_name, observed_at, benefit_source, estimated_value_brl, origins, networks, via',
        )
        .order('created_at', { ascending: true })
      if (error) throw error
      // database.types.ts tipa origins/networks como Json (view agregada); a forma real
      // é garantida pela view + testes de integração. Cast via unknown é intencional.
      return (data ?? []) as unknown as MyBenefit[]
    },
  })
}
