import { describe, it, expect } from 'vitest'
import { adminClient, userClient, serviceClient } from './helpers/clients'

describe('admin benefits CRUD (RLS)', () => {
  it('admin cria benefício, vincula variante e adiciona local; remove', async () => {
    const { client: admin } = await adminClient()
    const db = serviceClient()
    const stamp = `${Date.now()}`
    const { data: src } = await db.from('sources')
      .insert({ kind: 'card', name: `Adm-${stamp}`, sort_order: 1, slug: `adm-${stamp}` })
      .select().single()
    const { data: item } = await db.from('source_items')
      .insert({ source_id: src!.id, label: 'Black', sort_order: 1, slug: `adm-item-${stamp}` })
      .select().single()

    const { data: ben, error: e1 } = await admin
      .from('benefits')
      .insert({ title: 'Benefício Admin', summary: 's', category: 'shopping', scope: 'nacional' })
      .select()
      .single()
    expect(e1).toBeNull()

    const { error: e2 } = await admin
      .from('benefit_sources')
      .insert({ benefit_id: ben!.id, source_item_id: item!.id })
    expect(e2).toBeNull()

    const { error: e3 } = await admin.from('benefit_locations').insert({
      benefit_id: ben!.id, name: 'Loja Centro', lat: -23.5, lng: -46.6, city: 'SP', uf: 'SP',
    })
    expect(e3).toBeNull()

    await admin.from('benefits').delete().eq('id', ben!.id)
    await db.from('sources').delete().eq('id', src!.id)
  })

  it('não-admin não cria benefício', async () => {
    const { client: user } = await userClient()
    const { error } = await user.from('benefits').insert({ title: 'x', summary: 'y', category: 'shopping' })
    expect(error).not.toBeNull()
  })
})
