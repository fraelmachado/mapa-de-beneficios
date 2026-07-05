import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../../lib/supabase'
import type { DiscoveryCandidate, DiscoveryJob } from './types'

export function useDiscoveryJobs() {
  return useQuery({
    queryKey: ['discovery_jobs'],
    queryFn: async (): Promise<DiscoveryJob[]> => {
      const { data, error } = await supabase
        .from('discovery_jobs')
        .select('id, brief, status, error, created_at')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as unknown as DiscoveryJob[]
    },
  })
}

export function useCreateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (brief: string) => {
      const { error } = await supabase.from('discovery_jobs').insert({ brief } as never)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discovery_jobs'] }),
  })
}

export function useJobCandidates(jobId: string | null) {
  return useQuery({
    queryKey: ['discovery_candidates', jobId],
    enabled: !!jobId,
    queryFn: async (): Promise<DiscoveryCandidate[]> => {
      const { data, error } = await supabase
        .from('discovery_candidates')
        .select('*')
        .eq('job_id', jobId!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as unknown as DiscoveryCandidate[]
    },
  })
}

export function usePromoteCandidate(jobId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (candidateId: string) => {
      const { error } = await supabase.rpc('promote_discovery_candidate', { candidate_id: candidateId })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discovery_candidates', jobId] })
      qc.invalidateQueries({ queryKey: ['admin_benefits'] })
      qc.invalidateQueries({ queryKey: ['admin_sources'] })
    },
  })
}

export function useRejectCandidate(jobId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (candidateId: string) => {
      const { error } = await supabase
        .from('discovery_candidates')
        .update({ review_status: 'rejected' } as never)
        .eq('id', candidateId)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discovery_candidates', jobId] }),
  })
}

export function useUpdateCandidatePayload(jobId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, payload }: { id: string; payload: Record<string, unknown> }) => {
      const { error } = await supabase
        .from('discovery_candidates')
        .update({ payload } as never)
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['discovery_candidates', jobId] }),
  })
}
