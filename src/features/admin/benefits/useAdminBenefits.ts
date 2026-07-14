import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import type { BenefitInput, BenefitRow } from './types'

const SELECT =
  'id, title, summary, category, scope, uf, steps, partner_name, valid_until, image_url, action_url, action_label, active, benefit_source, created_at, benefit_sources(source_item_id, source_items(sources(name))), benefit_locations(id, benefit_id, name, lat, lng, address, city, uf, radius_m, active)'

export function useAdminBenefits() {
  return useQuery({
    queryKey: ['admin_benefits'],
    queryFn: async (): Promise<BenefitRow[]> => {
      const { data, error } = await supabase.from('benefits').select(SELECT).order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as BenefitRow[]
    },
  })
}

export function useSaveBenefit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: BenefitInput & { id?: string }) => {
      const { id, ...fields } = input
      const q = id
        ? supabase.from('benefits').update(fields as never).eq('id', id)
        : supabase.from('benefits').insert(fields as never)
      const { data, error } = await q.select('id').single()
      if (error) throw error
      return (data as { id: string }).id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_benefits'] })
      qc.invalidateQueries({ queryKey: ['my_benefits'] })
    },
  })
}

export function useDeleteBenefit() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('benefits').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin_benefits'] })
      qc.invalidateQueries({ queryKey: ['my_benefits'] })
    },
  })
}
