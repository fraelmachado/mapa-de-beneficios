import type { CategoryGroup } from './groupSourcesByCategory'

export interface Finding { itemId: string; provider: string; variant: string; logo: string | null }

export function demoFindings(groups: CategoryGroup[]): Finding[] {
  const first = groups[0]
  if (!first) return []
  return first.sources
    .filter((s) => s.source_items.length > 0)
    .slice(0, 3)
    .map((s) => ({ itemId: s.source_items[0].id, provider: s.name, variant: s.source_items[0].label, logo: s.logo_url }))
}
