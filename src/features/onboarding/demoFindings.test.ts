import { describe, it, expect } from 'vitest'
import { demoFindings } from './demoFindings'
import type { CategoryGroup } from './groupSourcesByCategory'

const g = (over: Partial<CategoryGroup> = {}): CategoryGroup => ({
  category: 'bank_card', meta: { key: 'bank_card', label: 'Bancos & cartões', icon: '🏦' }, sources: [], ...over,
})
const src = (id: string, name: string, items: { id: string; label: string }[]) => ({
  id, kind: 'card' as const, name, logo_url: null, sort_order: 1, source_category: 'bank_card' as const,
  source_items: items.map((i, idx) => ({ ...i, sort_order: idx + 1 })),
})

describe('demoFindings', () => {
  it('pega até 3 fontes, primeiro item de cada', () => {
    const groups = [g({ sources: [
      src('s1', 'Nubank', [{ id: 'i1', label: 'Ultravioleta' }, { id: 'i1b', label: 'Gold' }]),
      src('s2', 'Itaú', [{ id: 'i2', label: 'Black' }]),
      src('s3', 'Inter', [{ id: 'i3', label: 'Prime' }]),
      src('s4', 'XP', [{ id: 'i4', label: 'One' }]),
    ] })]
    expect(demoFindings(groups)).toEqual([
      { itemId: 'i1', provider: 'Nubank', variant: 'Ultravioleta' },
      { itemId: 'i2', provider: 'Itaú', variant: 'Black' },
      { itemId: 'i3', provider: 'Inter', variant: 'Prime' },
    ])
  })
  it('pula fontes sem item', () => {
    const groups = [g({ sources: [src('s1', 'SemItem', []), src('s2', 'Itaú', [{ id: 'i2', label: 'Black' }])] })]
    expect(demoFindings(groups)).toEqual([{ itemId: 'i2', provider: 'Itaú', variant: 'Black' }])
  })
  it('retorna [] sem categorias', () => { expect(demoFindings([])).toEqual([]) })
})
