import { describe, it, expect } from 'vitest'
import { serviceClient } from './helpers/clients'

describe('catalog schema', () => {
  it('insere source + source_item + benefit + mapping + location', async () => {
    const db = serviceClient()

    const { data: src, error: e1 } = await db
      .from('sources')
      .insert({ kind: 'card', name: 'TestBank', sort_order: 1 })
      .select()
      .single()
    expect(e1).toBeNull()

    const { data: item, error: e2 } = await db
      .from('source_items')
      .insert({ source_id: src!.id, label: 'Black', sort_order: 1 })
      .select()
      .single()
    expect(e2).toBeNull()

    const { data: ben, error: e3 } = await db
      .from('benefits')
      .insert({
        title: 'Sala VIP',
        summary: 'Acesso gratuito',
        category: 'viagem',
        scope: 'pontual',
      })
      .select()
      .single()
    expect(e3).toBeNull()

    const { error: e4 } = await db
      .from('benefit_sources')
      .insert({ benefit_id: ben!.id, source_item_id: item!.id })
    expect(e4).toBeNull()

    const { error: e5 } = await db.from('benefit_locations').insert({
      benefit_id: ben!.id,
      name: 'GRU T2',
      lat: -23.43,
      lng: -46.47,
    })
    expect(e5).toBeNull()

    // cleanup
    await db.from('sources').delete().eq('id', src!.id)
    await db.from('benefits').delete().eq('id', ben!.id)
  })

  it('cria profile automaticamente ao criar usuário', async () => {
    const { userClient } = await import('./helpers/clients')
    const { id } = await userClient()
    const db = serviceClient()
    const { data, error } = await db
      .from('profiles')
      .select('id, is_admin')
      .eq('id', id)
      .single()
    expect(error).toBeNull()
    expect(data!.is_admin).toBe(false)
  })
})
