import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'

export interface EvidenceRow {
  source_id: string
  email_from: string
  email_date: string | null
  created_at: string
  gmail_account: string
}

export function useSourceEvidence(userId: string | undefined) {
  return useQuery({
    queryKey: ['source_evidence', userId],
    enabled: !!userId,
    queryFn: async (): Promise<EvidenceRow[]> => {
      const { data, error } = await supabase
        .from('source_evidence')
        .select('source_id, email_from, email_date, created_at, gmail_account')
      if (error) throw error
      return (data ?? []) as EvidenceRow[]
    },
  })
}
