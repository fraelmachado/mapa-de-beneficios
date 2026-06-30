import type { Source } from './types'
import type { SourceCategory } from '../benefits/types'
import { SOURCE_CATEGORY_META, categoryMeta, type CategoryMeta } from './categoryMeta'

export interface CategoryGroup {
  category: SourceCategory
  meta: CategoryMeta
  sources: Source[]
}

export function groupSourcesByCategory(sources: Source[]): CategoryGroup[] {
  const byCat = new Map<SourceCategory, Source[]>()
  for (const s of sources) {
    const cat: SourceCategory = s.source_category ?? 'bank_card'
    const withSortedItems: Source = {
      ...s,
      source_items: [...s.source_items].sort((a, b) => a.sort_order - b.sort_order),
    }
    byCat.set(cat, [...(byCat.get(cat) ?? []), withSortedItems])
  }
  return SOURCE_CATEGORY_META.map((m) => m.key)
    .filter((cat) => (byCat.get(cat)?.length ?? 0) > 0)
    .map((cat) => ({
      category: cat,
      meta: categoryMeta(cat),
      sources: (byCat.get(cat) ?? []).sort((a, b) => a.sort_order - b.sort_order),
    }))
}
