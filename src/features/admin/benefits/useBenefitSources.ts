import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'

export function useSaveBenefitSources() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ benefitId, sourceItemIds }: { benefitId: string; sourceItemIds: string[] }) => {
      const del = await supabase.from('benefit_sources').delete().eq('benefit_id', benefitId)
      if (del.error) throw del.error
      if (sourceItemIds.length) {
        const rows = sourceItemIds.map((source_item_id) => ({ benefit_id: benefitId, source_item_id }))
        const { error } = await supabase.from('benefit_sources').insert(rows)
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_benefits'] })
      qc.invalidateQueries({ queryKey: ['my_benefits'] })
    },
  })
}
