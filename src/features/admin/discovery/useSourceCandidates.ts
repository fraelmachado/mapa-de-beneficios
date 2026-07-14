import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import type { DiscoveryCandidate, DiscoveryReviewStatus } from './types'

// D2: candidatos-fonte de TODOS os jobs por status. fingerprint é UNIQUE global — sem dedupe manual.
export function useSourceCandidates(status: DiscoveryReviewStatus) {
  return useQuery({
    queryKey: ['source_candidates', status],
    queryFn: async (): Promise<DiscoveryCandidate[]> => {
      const { data, error } = await supabase
        .from('discovery_candidates').select('*')
        .eq('entity_type', 'source').eq('review_status', status)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as DiscoveryCandidate[]
    },
  })
}

// D3: subárvore de uma fonte por parent_fingerprint, cross-job (não filtra job_id). BFS 2 níveis.
export function useCandidateSubtree(sourceFingerprint: string | null) {
  return useQuery({
    queryKey: ['candidate_subtree', sourceFingerprint],
    enabled: !!sourceFingerprint,
    queryFn: async (): Promise<DiscoveryCandidate[]> => {
      const all: DiscoveryCandidate[] = []
      const root = await supabase.from('discovery_candidates').select('*').eq('fingerprint', sourceFingerprint!)
      if (root.error) throw root.error
      all.push(...((root.data ?? []) as unknown as DiscoveryCandidate[]))
      let frontier = all.map((r) => r.fingerprint)
      for (let depth = 0; depth < 2 && frontier.length; depth += 1) {
        const kids = await supabase.from('discovery_candidates').select('*').in('parent_fingerprint', frontier)
        if (kids.error) throw kids.error
        const rows = (kids.data ?? []) as unknown as DiscoveryCandidate[]
        all.push(...rows)
        frontier = rows.map((r) => r.fingerprint)
      }
      return all
    },
  })
}
