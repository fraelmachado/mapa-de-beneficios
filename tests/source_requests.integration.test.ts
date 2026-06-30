// tests/source_requests.integration.test.ts
import { describe, it, expect } from 'vitest'
import { userClient, adminClient } from './helpers/clients'

describe('source_requests RLS', () => {
  it('usuário insere pedido em seu próprio nome (user_id via default)', async () => {
    const { client, id } = await userClient()
    const { data, error } = await client
      .from('source_requests')
      .insert({ source_category: 'health', text: 'Unimed' })
      .select('id, user_id, source_category')
      .single()
    expect(error).toBeNull()
    expect(data!.user_id).toBe(id)
    expect(data!.source_category).toBe('health')
  })

  it('não permite inserir em nome de outro usuário', async () => {
    const { client } = await userClient()
    const { error } = await client
      .from('source_requests')
      .insert({ user_id: '00000000-0000-0000-0000-000000000000', source_category: 'retail', text: 'x' })
    expect(error).not.toBeNull()
  })

  it('usuário só enxerga os próprios pedidos', async () => {
    const a = await userClient()
    const b = await userClient()
    const ins = await a.client
      .from('source_requests')
      .insert({ source_category: 'mall', text: 'Iguatemi' })
      .select('id')
      .single()
    expect(ins.error).toBeNull() // garante que a linha existe antes de checar o isolamento
    expect(ins.data!.id).toBeTruthy()
    const { data, error } = await b.client.from('source_requests').select('id')
    expect(error).toBeNull()
    expect((data ?? []).length).toBe(0)
  })

  it('admin lê pedidos de outros usuários (curadoria P4); não-admin não', async () => {
    const u = await userClient()
    const seeded = await u.client
      .from('source_requests')
      .insert({ source_category: 'corporate_benefits', text: 'Caju' })
      .select('id')
      .single()
    expect(seeded.error).toBeNull()
    const adm = await adminClient()
    const { data: admData, error: admErr } = await adm.client
      .from('source_requests')
      .select('id')
      .eq('id', seeded.data!.id)
    expect(admErr).toBeNull()
    expect((admData ?? []).length).toBe(1) // admin enxerga o pedido do outro usuário
    const other = await userClient()
    const { data: otherData } = await other.client
      .from('source_requests')
      .select('id')
      .eq('id', seeded.data!.id)
    expect((otherData ?? []).length).toBe(0) // usuário comum não enxerga
  })
})
