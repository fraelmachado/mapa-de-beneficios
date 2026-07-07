import { describe, it, expect } from 'vitest'
import { serviceClient } from './helpers/clients'

describe('seed: catálogo real', () => {
  it('mantém as sources reais de base e nenhuma demo', async () => {
    const db = serviceClient()
    const { data } = await db.from('sources').select('slug, name').not('slug', 'is', null)
    const slugs = (data ?? []).map((r) => r.slug).sort()
    expect(slugs).toEqual(expect.arrayContaining(['inter', 'nubank', 'xp']))
    const names = (data ?? []).map((r) => r.name)
    expect(names).not.toContain('Itaú')
    expect(names).not.toContain('Claro')
    expect(names).not.toContain('Livelo')
  })

  it('source_items têm brand/level no vocabulário controlado', async () => {
    const db = serviceClient()
    const { data } = await db.from('source_items')
      .select('slug, card_brand, card_level')
      .in('slug', ['nubank-ultravioleta-black', 'xp-infinite', 'inter-duo-gourmet'])
    const bySlug = Object.fromEntries((data ?? []).map((r) => [r.slug, r]))
    expect(bySlug['nubank-ultravioleta-black']).toMatchObject({ card_brand: 'mastercard', card_level: 'black' })
    expect(bySlug['xp-infinite']).toMatchObject({ card_brand: 'visa', card_level: 'infinite' })
    expect(bySlug['inter-duo-gourmet'].card_brand).toBeNull()
  })
})
