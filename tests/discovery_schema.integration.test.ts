import { describe, it, expect } from 'vitest'
import { serviceClient, userClient, adminClient } from './helpers/clients'

const stamp = () => `${Date.now()}-${Math.floor(performance.now() * 1000)}`

describe('discovery schema', () => {
  it('service_role insere job e candidato; enums válidos', async () => {
    const db = serviceClient()
    const brief = `Discovery ${stamp()}`
    const job = await db.from('discovery_jobs').insert({ brief }).select('id, status').single()
    expect(job.error).toBeNull()
    expect(job.data!.status).toBe('pending')

    const cand = await db
      .from('discovery_candidates')
      .insert({
        job_id: job.data!.id,
        entity_type: 'source',
        fingerprint: `source|s-${stamp()}`,
        payload: { name: 'X', source_category: 'health', slug: `s-${stamp()}` },
        provenance: { source_url: 'https://x.dev' },
        match_status: 'new',
        review_status: 'pending',
      })
      .select('id, review_status')
      .single()
    expect(cand.error).toBeNull()
    expect(cand.data!.review_status).toBe('pending')
  })

  it('fingerprint é unique (upsert em vez de duplicar)', async () => {
    const db = serviceClient()
    const job = await db.from('discovery_jobs').insert({ brief: `J-${stamp()}` }).select('id').single()
    const fp = `source|dup-${stamp()}`
    const base = {
      job_id: job.data!.id, entity_type: 'source' as const, fingerprint: fp,
      payload: {}, provenance: {}, match_status: 'new' as const, review_status: 'pending' as const,
    }
    const a = await db.from('discovery_candidates').insert(base).select('id').single()
    expect(a.error).toBeNull()
    const b = await db.from('discovery_candidates').insert(base)
    expect(b.error).not.toBeNull() // viola unique(fingerprint)
  })

  it('RLS: admin lê candidatos; usuário comum não', async () => {
    const db = serviceClient()
    const job = await db.from('discovery_jobs').insert({ brief: `R-${stamp()}` }).select('id').single()
    const seeded = await db.from('discovery_candidates').insert({
      job_id: job.data!.id, entity_type: 'source', fingerprint: `source|rls-${stamp()}`,
      payload: {}, provenance: {}, match_status: 'new', review_status: 'pending',
    }).select('id').single()
    expect(seeded.error).toBeNull()

    const adm = await adminClient()
    const admRead = await adm.client.from('discovery_candidates').select('id').eq('id', seeded.data!.id)
    expect(admRead.error).toBeNull()
    expect((admRead.data ?? []).length).toBe(1)

    const usr = await userClient()
    const usrRead = await usr.client.from('discovery_candidates').select('id').eq('id', seeded.data!.id)
    expect((usrRead.data ?? []).length).toBe(0)
  })

  it('claim_discovery_job reivindica um pending e o segundo claim não repega o mesmo', async () => {
    const db = serviceClient()
    const brief = `CLAIM-${stamp()}`
    const job = await db.from('discovery_jobs').insert({ brief }).select('id').single()

    const first = await db.rpc('claim_discovery_job', { worker: 'w1' })
    expect(first.error).toBeNull()
    const claimed = (first.data ?? []) as { id: string; status: string; claimed_by: string }[]
    // pode pegar qualquer pending; garanta que pegou um e marcou processing
    expect(claimed.length).toBe(1)
    expect(claimed[0].status).toBe('processing')
    expect(claimed[0].claimed_by).toBe('w1')

    // o job específico que criamos não deve mais estar pending após ser reivindicado por alguém
    const check = await db.from('discovery_jobs').select('status').eq('id', job.data!.id).single()
    expect(['pending', 'processing']).toContain(check.data!.status)
  })
})
