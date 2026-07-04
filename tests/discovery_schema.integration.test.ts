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

    // drena qualquer pending pré-existente para eliminar não-determinismo
    await db.from('discovery_jobs').update({ status: 'done' }).eq('status', 'pending')

    const jobA = await db.from('discovery_jobs').insert({ brief: `CLAIM-A-${stamp()}` }).select('id').single()
    const jobB = await db.from('discovery_jobs').insert({ brief: `CLAIM-B-${stamp()}` }).select('id').single()
    expect(jobA.error).toBeNull()
    expect(jobB.error).toBeNull()
    const insertedIds = [jobA.data!.id, jobB.data!.id]

    type ClaimRow = { id: string; status: string; claimed_by: string }

    const first = await db.rpc('claim_discovery_job', { worker: 'w1' })
    expect(first.error).toBeNull()
    const firstClaimed = (first.data ?? []) as ClaimRow[]
    expect(firstClaimed.length).toBe(1)
    expect(insertedIds).toContain(firstClaimed[0].id)
    expect(firstClaimed[0].status).toBe('processing')
    expect(firstClaimed[0].claimed_by).toBe('w1')

    const second = await db.rpc('claim_discovery_job', { worker: 'w2' })
    expect(second.error).toBeNull()
    const secondClaimed = (second.data ?? []) as ClaimRow[]
    expect(secondClaimed.length).toBe(1)
    expect(insertedIds).toContain(secondClaimed[0].id)
    expect(secondClaimed[0].status).toBe('processing')
    expect(secondClaimed[0].claimed_by).toBe('w2')

    // os dois claims pegaram jobs diferentes, cobrindo exatamente os dois inseridos
    expect(secondClaimed[0].id).not.toBe(firstClaimed[0].id)
    expect([firstClaimed[0].id, secondClaimed[0].id].sort()).toEqual([...insertedIds].sort())

    // ambos os pending foram drenados; um terceiro claim não retorna nada
    const third = await db.rpc('claim_discovery_job', { worker: 'w3' })
    expect(third.error).toBeNull()
    expect((third.data ?? []).length).toBe(0)
  })
})
