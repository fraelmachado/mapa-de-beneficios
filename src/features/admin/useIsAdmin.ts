import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export function useIsAdmin(userId: string | undefined) {
  return useQuery({
    queryKey: ['is_admin', userId],
    enabled: !!userId,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId!)
        .single()
      if (error) throw error
      return Boolean(data.is_admin)
    },
  })
}
