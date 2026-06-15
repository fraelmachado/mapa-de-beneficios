import { describe, it, expect } from 'vitest'
import { serviceClient, userClient } from './helpers/clients'

async function seedBenefit(itemLabel: string) {
  const db = serviceClient()
  const { data: src } = await db
    .from('sources')
    .insert({ kind: 'card', name: `MB-${itemLabel}-${Date.now()}`, sort_order: 1 })
    .select()
    .single()
  const { data: item } = await db
    .from('source_items')
    .insert({ source_id: src!.id, label: itemLabel, sort_order: 1 })
    .select()
    .single()
  const { data: ben } = await db
    .from('benefits')
    .insert({ title: `Benefício ${itemLabel}`, summary: 's', category: 'shopping' })
    .select()
    .single()
  await db.from('benefit_sources').insert({ benefit_id: ben!.id, source_item_id: item!.id })
  return { itemId: item!.id, benefitId: ben!.id }
}

describe('my_benefits', () => {
  it('mostra só benefícios cujas fontes o usuário marcou, com o selo via', async () => {
    const mine = await seedBenefit('Black')
    const other = await seedBenefit('Gold') // usuário NÃO terá esse

    const { client, id } = await userClient()
    await client.from('user_sources').insert({ user_id: id, source_item_id: mine.itemId })

    const { data, error } = await client.from('my_benefits').select('id, via')
    expect(error).toBeNull()
    const ids = data!.map((r) => r.id)
    expect(ids).toContain(mine.benefitId)
    expect(ids).not.toContain(other.benefitId)
    const row = data!.find((r) => r.id === mine.benefitId)
    expect(row!.via).toEqual(['Black'])
  })

  it('não vaza benefícios de um usuário para outro', async () => {
    const mine = await seedBenefit('Platinum')
    const a = await userClient()
    const b = await userClient()
    await a.client.from('user_sources').insert({ user_id: a.id, source_item_id: mine.itemId })

    const { data } = await b.client.from('my_benefits').select('id')
    expect(data!.map((r) => r.id)).not.toContain(mine.benefitId)
  })

  it('um item que destrava 2 benefícios retorna os 2', async () => {
    const db = serviceClient()
    const stamp = `${Date.now()}`
    const { data: src } = await db.from('sources')
      .insert({ kind: 'card', name: `Two-${stamp}`, sort_order: 1, slug: `two-${stamp}` })
      .select().single()
    const { data: item } = await db.from('source_items')
      .insert({ source_id: src!.id, label: 'Black', sort_order: 1, slug: `two-item-${stamp}` })
      .select().single()
    const mkBen = async (n: number) => {
      const { data: ben } = await db.from('benefits')
        .insert({ title: `B${n}-${stamp}`, summary: 's', category: 'shopping', slug: `two-b${n}-${stamp}` })
        .select().single()
      await db.from('benefit_sources').insert({ benefit_id: ben!.id, source_item_id: item!.id })
      return ben!.id
    }
    const ids = [await mkBen(1), await mkBen(2)]
    const { client, id } = await userClient()
    await client.from('user_sources').insert({ user_id: id, source_item_id: item!.id })
    const { data, error } = await client.from('my_benefits').select('id').in('id', ids)
    expect(error).toBeNull()
    expect(data!.length).toBe(2)
    await db.from('sources').delete().eq('id', src!.id)
  })
})
