import type { SupabaseClient } from '@supabase/supabase-js'
import type { CatalogSnapshot } from './matchCatalog'

export async function loadCatalogSnapshot(db: SupabaseClient): Promise<CatalogSnapshot> {
  const [sources, items, benefits] = await Promise.all([
    db.from('sources').select('id, slug'),
    db.from('source_items').select('id, slug'),
    db.from('benefits').select('id, slug'),
  ])
  const toMap = (rows: { id: string; slug: string | null }[] | null) =>
    new Map((rows ?? []).filter((r) => r.slug).map((r) => [r.slug as string, r.id]))
  return {
    sources: toMap(sources.data as never),
    sourceItems: toMap(items.data as never),
    benefits: toMap(benefits.data as never),
  }
}
