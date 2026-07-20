import { useUserSources } from '../onboarding/useUserSources'
import { useSources } from '../onboarding/useSources'
import { useSourceEvidence } from './useSourceEvidence'
import { buildPrograms } from './buildPrograms'

export function useMyPrograms(userId: string | undefined) {
  const itemsQ = useUserSources(userId)
  const sourcesQ = useSources()
  const evidenceQ = useSourceEvidence(userId)
  const flatSources = (sourcesQ.data ?? []).flatMap((g) => g.sources)
  const { programs, summary } = buildPrograms(itemsQ.data ?? [], flatSources, evidenceQ.data ?? [])
  return {
    programs, summary,
    isLoading: itemsQ.isLoading || sourcesQ.isLoading || evidenceQ.isLoading,
    error: itemsQ.error || sourcesQ.error || evidenceQ.error,
    refetch: () => { void itemsQ.refetch(); void sourcesQ.refetch(); void evidenceQ.refetch() },
  }
}
