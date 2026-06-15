import { describe, it, expect } from 'vitest'
import { serviceClient, userClient } from './helpers/clients'

describe('my_benefits dedup', () => {
  it('1 linha por benefício; via agrega as fontes', async () => {
    const db = serviceClient()
    const stamp = `${Date.now()}`
    const { data: src } = await db.from('sources')
      .insert({ kind: 'card', name: `Dedup-${stamp}`, sort_order: 1, slug: `dedup-${stamp}` })
      .select().single()
    const mk = async (label: string) =>
      (await db.from('source_items')
        .insert({ source_id: src!.id, label, sort_order: 1, slug: `${label}-${stamp}` })
        .select().single()).data!
    const black = await mk('Black')
    const platinum = await mk('Platinum')
    const { data: ben } = await db.from('benefits')
      .insert({ title: `Dedup ${stamp}`, summary: 's', category: 'shopping', slug: `b-${stamp}` })
      .select().single()
    await db.from('benefit_sources').insert([
      { benefit_id: ben!.id, source_item_id: black.id },
      { benefit_id: ben!.id, source_item_id: platinum.id },
    ])

    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [black.id, platinum.id] })
    const { data, error } = await client.from('my_benefits').select('id, via')
    expect(error).toBeNull()
    const rows = (data ?? []).filter((r) => r.id === ben!.id)
    expect(rows.length).toBe(1)
    expect((rows[0].via as string[]).sort()).toEqual(['Black', 'Platinum'])

    await db.from('sources').delete().eq('id', src!.id)
    await db.from('benefits').delete().eq('id', ben!.id)
  })
})
