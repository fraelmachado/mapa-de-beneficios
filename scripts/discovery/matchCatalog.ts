import type { DiscoveryEntityType } from './flatten'

export interface CatalogSnapshot {
  sources: Map<string, string>      // slug -> id
  sourceItems: Map<string, string>  // slug -> id
  benefits: Map<string, string>     // slug -> id
}

export function matchStatus(
  entityType: DiscoveryEntityType,
  slug: string,
  snap: CatalogSnapshot,
): { match_status: 'new' | 'update' | 'duplicate'; matched_id: string | null } {
  const map =
    entityType === 'source' ? snap.sources
    : entityType === 'source_item' ? snap.sourceItems
    : snap.benefits
  const existing = map.get(slug)
  // ponytail: sem byte-diff em v1 -> qualquer slug existente é 'update' (admin decide no review).
  return existing ? { match_status: 'update', matched_id: existing } : { match_status: 'new', matched_id: null }
}
