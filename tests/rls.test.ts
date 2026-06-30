import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceClient, userClient, adminClient } from './helpers/clients'

let itemId: string
let rlsSrcId: string       // RLSProg — created in beforeAll
let adminBankId: string    // AdminBank — captured inside test

beforeAll(async () => {
  const db = serviceClient()
  const { data: src } = await db
    .from('sources')
    .insert({ kind: 'loyalty', name: 'RLSProg', sort_order: 99 })
    .select()
    .single()
  rlsSrcId = src!.id
  const { data: item } = await db
    .from('source_items')
    .insert({ source_id: src!.id, label: '—', sort_order: 1 })
    .select()
    .single()
  itemId = item!.id
})

// ponytail: deletes only tracked IDs — no risk of touching seed rows
afterAll(async () => {
  const ids = [rlsSrcId, adminBankId].filter(Boolean)
  if (ids.length) await serviceClient().from('sources').delete().in('id', ids)
})

describe('RLS catálogo', () => {
  it('usuário autenticado lê o catálogo', async () => {
    const { client } = await userClient()
    const { data, error } = await client.from('sources').select('id').limit(1)
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)
  })

  it('usuário comum NÃO escreve no catálogo', async () => {
    const { client } = await userClient()
    const { error } = await client
      .from('sources')
      .insert({ kind: 'card', name: 'Hacker', sort_order: 1 })
    expect(error).not.toBeNull()
  })
})

describe('RLS user_sources', () => {
  it('usuário só enxerga as próprias seleções', async () => {
    const a = await userClient()
    const b = await userClient()
    await a.client.from('user_sources').insert({ user_id: a.id, source_item_id: itemId })
    await b.client.from('user_sources').insert({ user_id: b.id, source_item_id: itemId })

    const { data } = await a.client.from('user_sources').select('user_id')
    expect(data!.every((r) => r.user_id === a.id)).toBe(true)
  })
})

describe('RLS is_admin imutável', () => {
  it('usuário não consegue se auto-promover a admin', async () => {
    const { client, id } = await userClient()
    const { error } = await client.from('profiles').update({ is_admin: true }).eq('id', id)
    expect(error).not.toBeNull()

    const db = serviceClient()
    const { data } = await db.from('profiles').select('is_admin').eq('id', id).single()
    expect(data!.is_admin).toBe(false)
  })

  it('usuário consegue atualizar o próprio display_name', async () => {
    const { client, id } = await userClient()
    const { error } = await client
      .from('profiles')
      .update({ display_name: 'Fulano' })
      .eq('id', id)
    expect(error).toBeNull()
  })
})

describe('RLS caminho admin', () => {
  it('admin consegue escrever no catálogo', async () => {
    const { client } = await adminClient()
    const { data, error } = await client
      .from('sources')
      .insert({ kind: 'card', name: 'AdminBank', sort_order: 1 })
      .select()
      .single()
    adminBankId = data?.id  // captured for afterAll teardown
    expect(error).toBeNull()
    expect(data!.name).toBe('AdminBank')
  })

  it('admin lê o profile de outro usuário', async () => {
    const other = await userClient()
    const { client } = await adminClient()
    const { data, error } = await client
      .from('profiles')
      .select('id')
      .eq('id', other.id)
      .single()
    expect(error).toBeNull()
    expect(data!.id).toBe(other.id)
  })
})
