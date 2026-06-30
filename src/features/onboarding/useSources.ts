import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { groupSourcesByKind } from './groupSources'
import type { Source } from './types'

export function useSources() {
  return useQuery({
    queryKey: ['sources'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sources')
        .select('id, kind, name, logo_url, sort_order, source_category, source_items(id, label, sort_order)')
        .eq('active', true)
      if (error) throw error
      return groupSourcesByKind((data ?? []) as unknown as Source[])
    },
  })
}
