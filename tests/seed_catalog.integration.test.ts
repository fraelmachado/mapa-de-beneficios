import { describe, it, expect } from 'vitest'
import { serviceClient } from './helpers/clients'

describe('seed: catálogo real', () => {
  it('contém o catálogo real expandido nas 5 categorias do mockup', async () => {
    const db = serviceClient()
    const { data } = await db.from('sources').select('slug, source_category').not('slug', 'is', null)
    const slugs = (data ?? []).map((r) => r.slug)
    // base (cartões) + ao menos uma marca de cada categoria do mockup
    expect(slugs).toEqual(
      expect.arrayContaining(['nubank', 'inter', 'xp', 'itau', 'vivo', 'spotify', 'sulamerica', 'latam-pass']),
    )
    // as 5 categorias de fonte que os mockups demonstram estão representadas
    const cats = [...new Set((data ?? []).map((r) => r.source_category))].sort()
    expect(cats).toEqual(['bank_card', 'carrier', 'health', 'loyalty', 'retail'])
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
