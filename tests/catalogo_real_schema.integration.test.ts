import { describe, it, expect } from 'vitest'
import { serviceClient, userClient } from './helpers/clients'

describe('M7 schema', () => {
  it('benefits aceita campos de compliance e categoria nova', async () => {
    const stamp = `${Date.now()}-${Math.floor(performance.now() * 1000)}`
    const db = serviceClient()
    const { data, error } = await db
      .from('benefits')
      .insert({
        title: 'T', summary: 's', category: 'airport',
        benefit_source: 'card_network', redemption_type: 'physical_access',
        verification_status: 'official_confirmed', observed_at: '2026-06-15',
        requires_activation: true, source_url: 'https://x.test', slug: `t-${stamp}`,
      })
      .select()
      .single()
    expect(error).toBeNull()
    expect(data!.category).toBe('airport')
    await db.from('benefits').delete().eq('id', data!.id)
  })

  it('benefit_card_tiers: leitura autenticada e herança por brand/level', async () => {
    const stamp = `${Date.now()}-${Math.floor(performance.now() * 1000)}`
    const db = serviceClient()
    const { data: ben } = await db.from('benefits')
      .insert({ title: 'Bandeira', summary: 's', category: 'insurance',
                benefit_source: 'card_network', slug: `band-${stamp}` })
      .select().single()
    await db.from('benefit_card_tiers')
      .insert({ benefit_id: ben!.id, card_brand: 'visa', card_level: 'infinite' })
    const { data: src } = await db.from('sources')
      .insert({ kind: 'card', name: `S-${stamp}`, sort_order: 1, slug: `s-${stamp}` })
      .select().single()
    const { data: item } = await db.from('source_items')
      .insert({ source_id: src!.id, label: 'XP Inf', sort_order: 1,
                card_brand: 'visa', card_level: 'infinite', slug: `i-${stamp}` })
      .select().single()

    const { client, id } = await userClient()
    await client.from('user_sources').insert({ user_id: id, source_item_id: item!.id })

    const { data: mine, error } = await client.from('my_benefits').select('id, via')
    expect(error).toBeNull()
    const row = (mine ?? []).find((r) => r.id === ben!.id)
    expect(row).toBeTruthy()
    expect(row!.via).toEqual(['XP Inf'])

    await db.from('sources').delete().eq('id', src!.id)
    await db.from('benefits').delete().eq('id', ben!.id)
  })

  it('não-admin não escreve em benefit_card_tiers', async () => {
    const { client } = await userClient()
    const { error } = await client.from('benefit_card_tiers')
      .insert({ benefit_id: '00000000-0000-0000-0000-000000000000',
                card_brand: 'visa', card_level: 'infinite' })
    expect(error).not.toBeNull()
  })
})
