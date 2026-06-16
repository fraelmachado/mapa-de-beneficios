import { describe, it, expect } from 'vitest'
import { serviceClient, userClient } from './helpers/clients'

describe('my_benefits expõe fonte/data', () => {
  it('projeta source_url, source_name e observed_at para um benefício do catálogo', async () => {
    const db = serviceClient()
    const { data: item } = await db.from('source_items').select('id').eq('slug', 'xp-infinite').single()
    const { client } = await userClient()
    await client.rpc('replace_user_sources', { item_ids: [item!.id] })

    const { data, error } = await client
      .from('my_benefits')
      .select('title, source_url, source_name, observed_at')
    expect(error).toBeNull()
    const rows = data ?? []
    expect(rows.some((r) => typeof r.source_url === 'string' && r.source_url!.startsWith('http'))).toBe(true)
    expect(rows.some((r) => typeof r.observed_at === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.observed_at!))).toBe(true)
    expect(rows.some((r) => typeof r.source_name === 'string' && r.source_name!.length > 0)).toBe(true)
  })
})
