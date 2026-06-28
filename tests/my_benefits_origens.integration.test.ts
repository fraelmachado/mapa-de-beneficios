import { describe, it, expect } from 'vitest'
import { serviceClient, userClient } from './helpers/clients'

describe('my_benefits projeta origem primária e secundária', () => {
  it('origins traz {provider, category}; networks traz {brand, level} no caminho de bandeira', async () => {
    const db = serviceClient()
    const { data: item } = await db.from('source_items').select('id').eq('slug', 'xp-infinite').single()
    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [item!.id] })

    const { data, error } = await client
      .from('my_benefits')
      .select('title, benefit_source, origins, networks')
    expect(error).toBeNull()
    const rows = data ?? []
    expect(rows.length).toBeGreaterThan(0)

    expect(rows.every((r) => Array.isArray(r.origins) && r.origins.length > 0)).toBe(true)
    expect(rows.every((r) =>
      (r.origins as Array<{ provider: string; category: string }>).every(
        (o) => typeof o.provider === 'string' && typeof o.category === 'string',
      ),
    )).toBe(true)
    expect(rows.some((r) =>
      (r.origins as Array<{ provider: string; category: string }>).some(
        (o) => o.provider === 'XP' && o.category === 'bank_card',
      ),
    )).toBe(true)

    const cardNetwork = rows.filter((r) => r.benefit_source === 'card_network')
    expect(cardNetwork.length).toBeGreaterThan(0)
    expect(cardNetwork.some((r) =>
      (r.networks as Array<{ brand: string; level: string }>).some(
        (n) => n.brand === 'visa' && n.level === 'infinite',
      ),
    )).toBe(true)
  })

  it('networks é [] para benefício do caminho direto (sem bandeira)', async () => {
    const db = serviceClient()
    const { data: item } = await db.from('source_items').select('id').eq('slug', 'nubank-ultravioleta-black').single()
    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [item!.id] })

    const { data, error } = await client
      .from('my_benefits')
      .select('benefit_source, networks')
    expect(error).toBeNull()
    const direct = (data ?? []).filter((r) => r.benefit_source !== 'card_network')
    expect(direct.length).toBeGreaterThan(0)
    expect(direct.every((r) => Array.isArray(r.networks) && r.networks.length === 0)).toBe(true)
  })
})
