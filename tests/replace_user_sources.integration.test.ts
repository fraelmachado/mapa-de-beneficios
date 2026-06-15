import { describe, it, expect } from 'vitest'
import { userClient, serviceClient } from './helpers/clients'

async function twoItems() {
  const db = serviceClient()
  const stamp = `${Date.now()}-${Math.floor(performance.now() * 1000)}`
  const { data: src } = await db.from('sources')
    .insert({ kind: 'card', name: `RUS-${stamp}`, sort_order: 1, slug: `rus-${stamp}` })
    .select().single()
  const mk = async (n: number) =>
    (await db.from('source_items')
      .insert({ source_id: src!.id, label: `L${n}`, sort_order: n, slug: `rus-${n}-${stamp}` })
      .select().single()).data!.id as string
  return { a: await mk(1), b: await mk(2), srcId: src!.id, db }
}

describe('replace_user_sources RPC', () => {
  it('substitui a seleção do usuário atomicamente', async () => {
    const { a, b, srcId, db } = await twoItems()
    const { client, id } = await userClient()
    let res = await client.rpc('replace_user_sources', { item_ids: [a] })
    expect(res.error).toBeNull()
    res = await client.rpc('replace_user_sources', { item_ids: [b] })
    expect(res.error).toBeNull()
    const { data } = await db.from('user_sources').select('source_item_id').eq('user_id', id)
    expect(data!.map((r) => r.source_item_id)).toEqual([b])
    await db.from('sources').delete().eq('id', srcId)
  })

  it('lista vazia limpa a seleção', async () => {
    const { a, srcId, db } = await twoItems()
    const { client, id } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [a] })
    const res = await client.rpc('replace_user_sources', { item_ids: [] })
    expect(res.error).toBeNull()
    const { count } = await db
      .from('user_sources')
      .select('source_item_id', { count: 'exact', head: true })
      .eq('user_id', id)
    expect(count).toBe(0)
    await db.from('sources').delete().eq('id', srcId)
  })

  it('só mexe nas linhas do próprio usuário', async () => {
    const { a, b, srcId, db } = await twoItems()
    const alice = await userClient()
    const bob = await userClient()
    await alice.client.rpc('replace_user_sources', { item_ids: [a] })
    await bob.client.rpc('replace_user_sources', { item_ids: [b] })
    // Alice substitui a dela; a do Bob deve permanecer intacta
    await alice.client.rpc('replace_user_sources', { item_ids: [b] })
    const { data: bobRows } = await db
      .from('user_sources')
      .select('source_item_id')
      .eq('user_id', bob.id)
    expect(bobRows!.map((r) => r.source_item_id)).toEqual([b])
    await db.from('sources').delete().eq('id', srcId)
  })
})
