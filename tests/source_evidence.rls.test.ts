import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { serviceClient, userClient, anonClient } from './helpers/clients'

let srcId: string

beforeAll(async () => {
  const db = serviceClient()
  const stamp = `${Date.now()}-${Math.floor(performance.now() * 1000)}`
  const { data } = await db.from('sources')
    .insert({ kind: 'loyalty', name: `EvSrc-${stamp}`, sort_order: 99, slug: `evsrc-${stamp}` })
    .select().single()
  srcId = data!.id
})

afterAll(async () => {
  if (srcId) await serviceClient().from('sources').delete().eq('id', srcId)
})

describe('RLS source_evidence', () => {
  it('usuário só enxerga as próprias evidências', async () => {
    const a = await userClient()
    const b = await userClient()
    const row = (uid: string) => ({
      user_id: uid, source_id: srcId, gmail_account: 'x@gmail.com',
      gmail_message_id: `m-${uid}`, email_from: 'no-reply@x.com',
    })
    await a.client.from('source_evidence').insert(row(a.id))
    await b.client.from('source_evidence').insert(row(b.id))
    const { data } = await a.client.from('source_evidence').select('user_id')
    expect(data!.every((r) => r.user_id === a.id)).toBe(true)
  })

  it('não dá para inserir evidência em nome de outro (user_id forjado)', async () => {
    const a = await userClient()
    const b = await userClient()
    const { error } = await a.client.from('source_evidence').insert({
      user_id: b.id, source_id: srcId, gmail_account: 'x@gmail.com',
      gmail_message_id: 'forged', email_from: 'no-reply@x.com',
    })
    expect(error).not.toBeNull()
  })

  it('anônimo não-autenticado não lê evidências', async () => {
    const { error, data } = await anonClient().from('source_evidence').select('id')
    expect(error !== null || (data ?? []).length === 0).toBe(true)
  })

  it('delete só remove as próprias linhas', async () => {
    const a = await userClient()
    await a.client.from('source_evidence').insert({
      user_id: a.id, source_id: srcId, gmail_account: 'x@gmail.com',
      gmail_message_id: 'del', email_from: 'no-reply@x.com',
    })
    await a.client.from('source_evidence').delete().eq('user_id', a.id)
    const { data } = await a.client.from('source_evidence').select('id')
    expect(data!.length).toBe(0)
  })
})
