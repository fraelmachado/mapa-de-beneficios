import { describe, it, expect } from 'vitest'
import { userClient, serviceClient } from './helpers/clients'

async function oneItem() {
  const db = serviceClient()
  const stamp = `${Date.now()}-${Math.floor(performance.now() * 1000)}`
  const { data: src } = await db.from('sources')
    .insert({ kind: 'card', name: `AGS-${stamp}`, sort_order: 1, slug: `ags-${stamp}` })
    .select().single()
  const { data: item } = await db.from('source_items')
    .insert({ source_id: src!.id, label: 'L1', sort_order: 1, slug: `ags-i-${stamp}` })
    .select().single()
  return { srcId: src!.id as string, itemId: item!.id as string, db }
}

function payload(srcId: string, itemId: string, messageId: string) {
  return [{
    item_id: itemId, source_id: srcId, gmail_account: 'me@gmail.com',
    gmail_message_id: messageId, email_from: 'no-reply@brand.com',
    email_subject: 'Sua fatura', email_date: '2026-07-01T10:00:00Z',
  }]
}

describe('add_gmail_sources RPC', () => {
  it('grava source + evidência juntos', async () => {
    const { srcId, itemId, db } = await oneItem()
    const { client, id } = await userClient()
    const res = await client.rpc('add_gmail_sources', { payload: payload(srcId, itemId, 'm1') })
    expect(res.error).toBeNull()
    const us = await db.from('user_sources').select('source_item_id').eq('user_id', id)
    expect(us.data!.map((r) => r.source_item_id)).toEqual([itemId])
    const ev = await db.from('source_evidence').select('gmail_message_id').eq('user_id', id)
    expect(ev.data!.map((r) => r.gmail_message_id)).toEqual(['m1'])
    await db.from('sources').delete().eq('id', srcId)
  })

  it('rescan da mesma mensagem é idempotente', async () => {
    const { srcId, itemId, db } = await oneItem()
    const { client, id } = await userClient()
    await client.rpc('add_gmail_sources', { payload: payload(srcId, itemId, 'dup') })
    await client.rpc('add_gmail_sources', { payload: payload(srcId, itemId, 'dup') })
    const ev = await db.from('source_evidence').select('id').eq('user_id', id)
    expect(ev.data!.length).toBe(1)
    await db.from('sources').delete().eq('id', srcId)
  })

  it('é aditivo: não apaga seleção anterior', async () => {
    const { srcId, itemId, db } = await oneItem()
    const { client, id } = await userClient()
    // seleção prévia via replace (outro item)
    const { data: item2 } = await db.from('source_items')
      .insert({ source_id: srcId, label: 'L2', sort_order: 2, slug: `ags-i2-${Date.now()}` })
      .select().single()
    await client.rpc('replace_user_sources', { item_ids: [item2!.id] })
    await client.rpc('add_gmail_sources', { payload: payload(srcId, itemId, 'm2') })
    const us = await db.from('user_sources').select('source_item_id').eq('user_id', id)
    expect(us.data!.map((r) => r.source_item_id).sort()).toEqual([itemId, item2!.id].sort())
    await db.from('sources').delete().eq('id', srcId)
  })
})
