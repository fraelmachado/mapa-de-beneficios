import { useAdminSources } from './sources/useAdminSources'
import { useAdminBenefits } from './benefits/useAdminBenefits'
import { useSourceCandidates } from './discovery/useSourceCandidates'

const DAY = 86_400_000
export function useAdminStats() {
  const sources = useAdminSources()
  const benefits = useAdminBenefits()
  const pending = useSourceCandidates('pending')
  const cutoff = Date.now() - 14 * DAY
  const novos = (benefits.data ?? []).filter((b) => new Date(b.created_at).getTime() >= cutoff).length
  return {
    stats: {
      programas: sources.data?.length ?? 0,
      beneficios: benefits.data?.length ?? 0,
      pendentes: pending.data?.length ?? 0, // D13: degrada a 0 se discovery indisponível
      novos,
    },
    isLoading: sources.isLoading || benefits.isLoading,
    error: sources.error || benefits.error,
  }
}
