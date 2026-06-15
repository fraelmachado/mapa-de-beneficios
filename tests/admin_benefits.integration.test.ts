import { describe, it, expect } from 'vitest'
import { adminClient, userClient } from './helpers/clients'

describe('admin benefits CRUD (RLS)', () => {
  it('admin cria benefício, vincula variante (via seed) e adiciona local; remove', async () => {
    const { client: admin } = await adminClient()
    const BLACK = 'aaaaaaa1-0000-0000-0000-000000000001'

    const { data: ben, error: e1 } = await admin
      .from('benefits')
      .insert({ title: 'Benefício Admin', summary: 's', category: 'compras', scope: 'nacional' })
      .select()
      .single()
    expect(e1).toBeNull()

    const { error: e2 } = await admin
      .from('benefit_sources')
      .insert({ benefit_id: ben!.id, source_item_id: BLACK })
    expect(e2).toBeNull()

    const { error: e3 } = await admin.from('benefit_locations').insert({
      benefit_id: ben!.id, name: 'Loja Centro', lat: -23.5, lng: -46.6, city: 'SP', uf: 'SP',
    })
    expect(e3).toBeNull()

    await admin.from('benefits').delete().eq('id', ben!.id)
  })

  it('não-admin não cria benefício', async () => {
    const { client: user } = await userClient()
    const { error } = await user.from('benefits').insert({ title: 'x', summary: 'y', category: 'compras' })
    expect(error).not.toBeNull()
  })
})
