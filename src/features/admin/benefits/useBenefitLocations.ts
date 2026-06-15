import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import type { BenefitLocationInput } from './types'

export function useSaveBenefitLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: BenefitLocationInput & { id?: string }) => {
      const { id, ...fields } = input
      const q = id
        ? supabase.from('benefit_locations').update(fields as never).eq('id', id)
        : supabase.from('benefit_locations').insert(fields as never)
      const { error } = await q
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin_benefits'] }),
  })
}

export function useDeleteBenefitLocation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('benefit_locations').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin_benefits'] }),
  })
}
