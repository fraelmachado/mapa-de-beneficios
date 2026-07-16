import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

// Favoritos do usuário (mockup Tela 05). Ids dos benefícios salvos.
export function useFavorites(userId: string | undefined) {
  return useQuery({
    queryKey: ['favorites', userId],
    enabled: !!userId,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase.from('favorites').select('benefit_id')
      if (error) throw error
      return (data ?? []).map((r) => r.benefit_id as string)
    },
  })
}

export function useToggleFavorite(userId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ benefitId, on }: { benefitId: string; on: boolean }) => {
      if (on) {
        const { error } = await supabase.from('favorites').insert({ benefit_id: benefitId })
        if (error) throw error
      } else {
        const { error } = await supabase.from('favorites').delete().eq('benefit_id', benefitId)
        if (error) throw error
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['favorites', userId] }),
  })
}
