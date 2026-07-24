import { describe, it, expect, afterAll } from 'vitest'
import { serviceClient, adminClient, userClient } from './helpers/clients'

const stamp = () => `${Date.now()}-${Math.floor(performance.now() * 1000)}`

async function seedTree(
  db: ReturnType<typeof serviceClient>,
  tag: string,
  action?: { action_url: string; action_label: string },
) {
  const job = await db.from('discovery_jobs').insert({ brief: `P-${tag}`, status: 'done' }).select('id').single()
  const jobId = job.data!.id
  const srcSlug = `src-${tag}`, itemSlug = `src-${tag}-nacional`, benSlug = `src-${tag}-nacional-farmacia`
  const srcFp = `source|${srcSlug}`, itemFp = `source_item|${srcSlug}|nacional`, benFp = `benefit|${itemSlug}|farmacia`
  await db.from('discovery_candidates').insert([
    { job_id: jobId, entity_type: 'source', fingerprint: srcFp, parent_fingerprint: null,
      payload: { slug: srcSlug, name: `Src ${tag}`, source_category: 'health', kind: 'cpf' },
      provenance: { source_url: 'https://x.dev', verification_status: 'official_confirmed' },
      match_status: 'new', review_status: 'pending' },
    { job_id: jobId, entity_type: 'source_item', fingerprint: itemFp, parent_fingerprint: srcFp,
      payload: { slug: itemSlug, label: 'Nacional', card_brand: null, card_level: null },
      provenance: { source_url: 'https://x.dev/n' }, match_status: 'new', review_status: 'pending' },
    { job_id: jobId, entity_type: 'benefit', fingerprint: benFp, parent_fingerprint: itemFp,
      payload: { slug: benSlug, title: 'Farmácia', summary: 'desconto', category: 'security',
                 scope: 'nacional', card_tiers: [], ...action },
      provenance: { source_url: 'https://x.dev/f', source_name: 'Site', observed_at: '2026-07-01',
                    verification_status: 'official_confirmed' },
      match_status: 'new', review_status: 'pending' },
  ])
  return { db, jobId, srcFp, itemFp, benFp, srcSlug, itemSlug, benSlug }
}

async function candId(db: ReturnType<typeof serviceClient>, fp: string) {
  const r = await db.from('discovery_candidates').select('id').eq('fingerprint', fp).single()
  return r.data!.id as string
}

afterAll(async () => {
  // ponytail: this test promotes rows into the real catalog tables; slugs all
  // start with "src-" (never colliding with seed data), so a prefix delete
  // is enough teardown. benefits/sources cascade-delete their children.
  const db = serviceClient()
  await db.from('benefits').delete().like('slug', 'src-%')
  await db.from('sources').delete().like('slug', 'src-%')
  // candidates cascade via job_id on delete cascade
  await db.from('discovery_jobs').delete().like('brief', 'P-%')
})

describe('promote_discovery_candidate', () => {
  it('promove árvore de cima pra baixo: source -> item -> benefit com procedência', async () => {
    const db = serviceClient()
    const t = stamp()
    const s = await seedTree(db, t)
    const adm = await adminClient()

    const srcRes = await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.srcFp) })
    expect(srcRes.error).toBeNull()
    const srcId = srcRes.data as string
    const src = await db.from('sources').select('source_category, slug').eq('id', srcId).single()
    expect(src.data!.source_category).toBe('health')

    const itemRes = await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.itemFp) })
    expect(itemRes.error).toBeNull()

    const benRes = await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.benFp) })
    expect(benRes.error).toBeNull()
    const benId = benRes.data as string
    const ben = await db.from('benefits')
      .select('active, source_url, source_name, verification_status').eq('id', benId).single()
    expect(ben.data!.active).toBe(false) // rascunho publicável
    expect(ben.data!.source_url).toBe('https://x.dev/f')
    expect(ben.data!.verification_status).toBe('official_confirmed')

    const link = await db.from('benefit_sources').select('source_item_id').eq('benefit_id', benId)
    expect((link.data ?? []).length).toBe(1)
  })

  it('re-promover é no-op idempotente (mesmo id, sem duplicar)', async () => {
    const db = serviceClient()
    const s = await seedTree(db, stamp())
    const adm = await adminClient()
    const id = await candId(db, s.srcFp)
    const a = await adm.client.rpc('promote_discovery_candidate', { candidate_id: id })
    const b = await adm.client.rpc('promote_discovery_candidate', { candidate_id: id })
    expect(a.data).toBe(b.data)
    const count = await db.from('sources').select('id', { count: 'exact', head: true }).eq('slug', s.srcSlug)
    expect(count.count).toBe(1)
  })

  it('promover benefit antes do item pai levanta erro', async () => {
    const db = serviceClient()
    const s = await seedTree(db, stamp())
    const adm = await adminClient()
    const res = await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.benFp) })
    expect(res.error).not.toBeNull() // pai não promovido
  })

  it('não-admin não promove', async () => {
    const db = serviceClient()
    const s = await seedTree(db, stamp())
    const usr = await userClient()
    const res = await usr.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.srcFp) })
    expect(res.error).not.toBeNull()
  })

  it('grava o CTA de um benefício novo aprovado', async () => {
    const db = serviceClient()
    const s = await seedTree(db, stamp(), {
      action_url: 'https://x.dev/f/rede',
      action_label: 'Ver rede',
    })
    const adm = await adminClient()
    await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.srcFp) })
    await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.itemFp) })
    const promoted = await adm.client.rpc('promote_discovery_candidate', {
      candidate_id: await candId(db, s.benFp),
    })

    const benefit = await db.from('benefits')
      .select('action_url, action_label')
      .eq('id', promoted.data as string)
      .single()
    expect(benefit.data).toMatchObject({
      action_url: 'https://x.dev/f/rede',
      action_label: 'Ver rede',
    })
  })

  it('substitui o CTA existente quando a atualização aprovada traz outro par', async () => {
    const db = serviceClient()
    const s = await seedTree(db, stamp(), {
      action_url: 'https://x.dev/f/rede-nova',
      action_label: 'Consultar rede',
    })
    await db.from('benefits').insert({
      slug: s.benSlug,
      title: 'Farmácia antiga',
      summary: 'antigo',
      category: 'security',
      scope: 'nacional',
      action_url: 'https://x.dev/f/rede-antiga',
      action_label: 'Ver rede antiga',
    })
    const adm = await adminClient()
    await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.srcFp) })
    await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.itemFp) })
    const promoted = await adm.client.rpc('promote_discovery_candidate', {
      candidate_id: await candId(db, s.benFp),
    })

    const benefit = await db.from('benefits')
      .select('action_url, action_label')
      .eq('id', promoted.data as string)
      .single()
    expect(benefit.data).toMatchObject({
      action_url: 'https://x.dev/f/rede-nova',
      action_label: 'Consultar rede',
    })
  })

  it('preserva o CTA existente quando a atualização aprovada não traz CTA', async () => {
    const db = serviceClient()
    const s = await seedTree(db, stamp())
    await db.from('benefits').insert({
      slug: s.benSlug,
      title: 'Farmácia antiga',
      summary: 'antigo',
      category: 'security',
      scope: 'nacional',
      action_url: 'https://x.dev/f/rede-existente',
      action_label: 'Ver rede existente',
    })
    const adm = await adminClient()
    await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.srcFp) })
    await adm.client.rpc('promote_discovery_candidate', { candidate_id: await candId(db, s.itemFp) })
    const promoted = await adm.client.rpc('promote_discovery_candidate', {
      candidate_id: await candId(db, s.benFp),
    })

    const benefit = await db.from('benefits')
      .select('action_url, action_label')
      .eq('id', promoted.data as string)
      .single()
    expect(benefit.data).toMatchObject({
      action_url: 'https://x.dev/f/rede-existente',
      action_label: 'Ver rede existente',
    })
  })
})
