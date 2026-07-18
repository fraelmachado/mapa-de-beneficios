import { describe, it, expect } from 'vitest'
import { serviceClient } from './helpers/clients'

describe('seed match_domains', () => {
  it('marcas conhecidas têm domínios de remetente', async () => {
    const db = serviceClient()
    const { data } = await db.from('sources').select('name, match_domains').eq('active', true)
    const withDomains = (data ?? []).filter((s) => (s.match_domains ?? []).length > 0)
    // pelo menos as principais marcas mapeadas
    expect(withDomains.length).toBeGreaterThanOrEqual(15)
    const spotify = (data ?? []).find((s) => s.name.toLowerCase().includes('spotify'))
    expect(spotify?.match_domains).toContain('spotify.com')
  })
})
