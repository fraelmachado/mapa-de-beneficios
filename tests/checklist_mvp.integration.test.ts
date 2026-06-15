import { describe, it, expect } from 'vitest'
import { serviceClient, userClient } from './helpers/clients'

async function titlesFor(slug: string) {
  const db = serviceClient()
  const { data: it } = await db.from('source_items').select('id').eq('slug', slug).single()
  const { client } = await userClient()
  await client.rpc('replace_user_sources', { item_ids: [it!.id] })
  const { data } = await client.from('my_benefits').select('title')
  return (data ?? []).map((r) => r.title as string)
}

describe('checklist MVP (doc §13)', () => {
  it('Inter Gold/Platinum/Prime/Win têm pontuação Loop', async () => {
    for (const slug of ['inter-gold', 'inter-platinum', 'inter-prime', 'inter-win']) {
      const titles = await titlesFor(slug)
      expect(titles.some((t) => /Loop/i.test(t))).toBe(true)
    }
  })

  it('XP Infinite vê 4 salas VIP + benefícios Visa Infinite', async () => {
    const titles = await titlesFor('xp-infinite')
    expect(titles.some((t) => /salas VIP|sala VIP/i.test(t))).toBe(true)
    expect(titles.some((t) => /Visa|Locadora|Emergência Médica/i.test(t))).toBe(true)
  })

  it('Mastercard Black (via Inter Prime) vê compra protegida, garantia estendida e concierge', async () => {
    const titles = await titlesFor('inter-prime')
    expect(titles.some((t) => /Compra Protegida/i.test(t))).toBe(true)
    expect(titles.some((t) => /Garantia Estendida/i.test(t))).toBe(true)
    expect(titles.some((t) => /Concierge/i.test(t))).toBe(true)
  })
})
