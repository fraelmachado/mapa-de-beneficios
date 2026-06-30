// src/features/onboarding/groupSourcesByCategory.test.ts
import { describe, it, expect } from 'vitest'
import { groupSourcesByCategory } from './groupSourcesByCategory'
import type { Source } from './types'

const mk = (over: Partial<Source>): Source => ({
  id: 'x', kind: 'card', name: 'N', logo_url: null, sort_order: 0, source_items: [], ...over,
})

describe('groupSourcesByCategory', () => {
  it('agrupa por source_category na ordem da taxonomia e ignora vazias', () => {
    const groups = groupSourcesByCategory([
      mk({ id: 'l', name: 'Livelo', source_category: 'loyalty', sort_order: 1 }),
      mk({ id: 'n', name: 'Nubank', source_category: 'bank_card', sort_order: 2 }),
    ])
    expect(groups.map((g) => g.category)).toEqual(['bank_card', 'loyalty'])
    expect(groups[0].meta.icon).toBe('🏦')
    expect(groups[0].sources[0].name).toBe('Nubank')
  })

  it('usa bank_card como fallback quando source_category falta', () => {
    const groups = groupSourcesByCategory([mk({ id: 'a', name: 'X' })])
    expect(groups[0].category).toBe('bank_card')
  })

  it('ordena fontes e itens por sort_order', () => {
    const groups = groupSourcesByCategory([
      mk({ id: 'b', name: 'B', source_category: 'bank_card', sort_order: 2,
        source_items: [{ id: 'i2', label: 'Plat', sort_order: 2 }, { id: 'i1', label: 'Gold', sort_order: 1 }] }),
      mk({ id: 'a', name: 'A', source_category: 'bank_card', sort_order: 1 }),
    ])
    expect(groups[0].sources.map((s) => s.name)).toEqual(['A', 'B'])
    expect(groups[0].sources[1].source_items.map((i) => i.label)).toEqual(['Gold', 'Plat'])
  })
})
