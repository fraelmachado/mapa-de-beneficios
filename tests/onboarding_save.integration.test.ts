import { describe, it, expect } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { serviceClient } from './helpers/clients'

const url = process.env.VITE_SUPABASE_URL!
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!

describe('fluxo de gravação do onboarding', () => {
  it('usuário anônimo grava seleção e vê a contagem de benefícios', async () => {
    const db = serviceClient()
    const stamp = `${Date.now()}`
    const { data: src } = await db.from('sources')
      .insert({ kind: 'card', name: `Onb-${stamp}`, sort_order: 1, slug: `onb-${stamp}` })
      .select().single()
    const { data: item } = await db.from('source_items')
      .insert({ source_id: src!.id, label: 'Black', sort_order: 1, slug: `onb-item-${stamp}` })
      .select().single()
    for (const n of [1, 2]) {
      const { data: ben } = await db.from('benefits')
        .insert({ title: `Onb B${n} ${stamp}`, summary: 's', category: 'shopping', slug: `onb-b${n}-${stamp}` })
        .select().single()
      await db.from('benefit_sources').insert({ benefit_id: ben!.id, source_item_id: item!.id })
    }

    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: signIn, error: authErr } = await client.auth.signInAnonymously()
    expect(authErr).toBeNull()
    const userId = signIn.user!.id
    const { error: insErr } = await client
      .from('user_sources')
      .insert({ user_id: userId, source_item_id: item!.id })
    expect(insErr).toBeNull()

    const { data, error } = await client.from('my_benefits').select('id')
    expect(error).toBeNull()
    const distinct = new Set((data ?? []).map((r) => r.id)).size
    expect(distinct).toBe(2)

    await db.from('sources').delete().eq('id', src!.id)
  })
})
