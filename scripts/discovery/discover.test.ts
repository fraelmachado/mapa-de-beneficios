import { describe, it, expect } from 'vitest'
import { serviceClient } from '../../tests/helpers/clients'
import { runJob } from './discover'

const stamp = () => `${Date.now()}-${Math.floor(performance.now() * 1000)}`

const fixtureTree = (name: string) => ({
  sources: [
    {
      name, source_category: 'health', source_url: 'https://x.dev',
      items: [
        {
          label: 'Nacional', source_url: 'https://x.dev/n',
          benefits: [{ title: 'Farmácia', summary: 's', category: 'security', source_url: 'https://x.dev/f' }],
        },
      ],
    },
  ],
})

describe('runJob', () => {
  it('claim -> agente -> upsert de candidatos encadeados -> job done', async () => {
    const db = serviceClient()
    await db.from('discovery_jobs').update({ status: 'done' }).eq('status', 'pending')
    const name = `Unimed ${stamp()}`
    const job = await db.from('discovery_jobs').insert({ brief: name }).select('id').single()

    const res = await runJob({
      db, worker: 'test', workdir: '/tmp/ignored',
      runAgent: async () => fixtureTree(name),
    })
    expect(res.status).toBe('done')

    const cands = await db
      .from('discovery_candidates')
      .select('entity_type, fingerprint, parent_fingerprint, match_status')
      .eq('job_id', job.data!.id)
    expect((cands.data ?? []).length).toBe(3)
    const src = cands.data!.find((c) => c.entity_type === 'source')!
    const item = cands.data!.find((c) => c.entity_type === 'source_item')!
    const ben = cands.data!.find((c) => c.entity_type === 'benefit')!
    expect(src.parent_fingerprint).toBeNull()
    expect(item.parent_fingerprint).toBe(src.fingerprint)
    expect(ben.parent_fingerprint).toBe(item.fingerprint)

    const done = await db.from('discovery_jobs').select('status').eq('id', job.data!.id).single()
    expect(done.data!.status).toBe('done')
  })

  it('retry: 1ª saída inválida, 2ª válida -> done', async () => {
    const db = serviceClient()
    await db.from('discovery_jobs').update({ status: 'done' }).eq('status', 'pending')
    const name = `Retry ${stamp()}`
    await db.from('discovery_jobs').insert({ brief: name }).select('id').single()
    let calls = 0
    const res = await runJob({
      db, worker: 'test', workdir: '/tmp/ignored',
      runAgent: async () => {
        calls += 1
        return calls === 1 ? { sources: [{ name, source_category: 'NOPE' }] } : fixtureTree(name)
      },
    })
    expect(calls).toBe(2)
    expect(res.status).toBe('done')
  })

  it('saída inválida nas 2 tentativas -> job error, nada na fila', async () => {
    const db = serviceClient()
    await db.from('discovery_jobs').update({ status: 'done' }).eq('status', 'pending')
    const name = `Bad ${stamp()}`
    const job = await db.from('discovery_jobs').insert({ brief: name }).select('id').single()
    const res = await runJob({
      db, worker: 'test', workdir: '/tmp/ignored',
      runAgent: async () => ({ sources: [{ name, source_category: 'NOPE' }] }),
    })
    expect(res.status).toBe('error')
    const errored = await db.from('discovery_jobs').select('status, error').eq('id', job.data!.id).single()
    expect(errored.data!.status).toBe('error')
    const cands = await db.from('discovery_candidates').select('id').eq('job_id', job.data!.id)
    expect((cands.data ?? []).length).toBe(0)
  })
})
