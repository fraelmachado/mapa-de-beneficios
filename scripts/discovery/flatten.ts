import { slugify, sourceFingerprint, sourceItemFingerprint, benefitFingerprint } from './fingerprint'
import { matchStatus, type CatalogSnapshot } from './matchCatalog'
import type { CandidatesTree } from './candidatesSchema'

export type DiscoveryEntityType = 'source' | 'source_item' | 'benefit'

export interface FlatCandidate {
  entity_type: DiscoveryEntityType
  fingerprint: string
  parent_fingerprint: string | null
  payload: Record<string, unknown>
  provenance: Record<string, unknown>
  match_status: 'new' | 'update' | 'duplicate'
  matched_id: string | null
}

export function flattenTree(tree: CandidatesTree, snap: CatalogSnapshot): FlatCandidate[] {
  const out: FlatCandidate[] = []

  for (const s of tree.sources) {
    const sourceSlug = slugify(s.name)
    const sourceFp = sourceFingerprint(sourceSlug)
    out.push({
      entity_type: 'source',
      fingerprint: sourceFp,
      parent_fingerprint: null,
      payload: { slug: sourceSlug, name: s.name, source_category: s.source_category, kind: s.kind ?? null },
      provenance: { source_url: s.source_url, verification_status: s.verification_status ?? null },
      ...matchStatus('source', sourceSlug, snap),
    })

    for (const it of s.items) {
      const itemSlug = `${sourceSlug}-${slugify(it.label)}`
      const itemFp = sourceItemFingerprint(sourceSlug, it.label)
      out.push({
        entity_type: 'source_item',
        fingerprint: itemFp,
        parent_fingerprint: sourceFp,
        payload: {
          slug: itemSlug, label: it.label, display_name: it.display_name ?? null,
          card_brand: it.card_brand ?? null, card_level: it.card_level ?? null,
          product_type: it.product_type ?? null,
        },
        provenance: { source_url: it.source_url, verification_status: it.verification_status ?? null },
        ...matchStatus('source_item', itemSlug, snap),
      })

      for (const b of it.benefits) {
        const benefitSlug = `${itemSlug}-${slugify(b.title)}`
        out.push({
          entity_type: 'benefit',
          fingerprint: benefitFingerprint(itemSlug, b.title),
          parent_fingerprint: itemFp,
          payload: {
            slug: benefitSlug, title: b.title, summary: b.summary, category: b.category,
            scope: b.scope ?? 'nacional', redemption_type: b.redemption_type ?? null,
            benefit_source: b.benefit_source ?? null, long_description: b.long_description ?? null,
            program: b.program ?? null, card_tiers: b.card_tiers ?? [],
            action_url: b.action_url ?? null,
            action_label: b.action_label ?? null,
          },
          provenance: {
            source_url: b.source_url, source_name: b.source_name ?? null,
            observed_at: b.observed_at ?? null, verification_status: b.verification_status ?? null,
          },
          ...matchStatus('benefit', benefitSlug, snap),
        })
      }
    }
  }

  return out
}
