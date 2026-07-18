import { describe, it, expect } from 'vitest'
import { gmailScan } from './gmailScan'
import type { Source } from '../types'

const sources: Source[] = [{
  id: 's1', kind: 'card', name: 'Spotify', logo_url: null, sort_order: 1,
  match_domains: ['spotify.com'], source_items: [{ id: 'i1', label: 'Premium', sort_order: 1 }],
}]

// fetcher fake: mapeia path → resposta
function fakeFetch(map: Record<string, any>) {
  return async (path: string) => {
    for (const key of Object.keys(map)) if (path.includes(key)) return map[key]
    throw new Error('404 ' + path)
  }
}

describe('gmailScan', () => {
  it('lista por domínio, busca headers e casa a marca', async () => {
    const fetchJson = fakeFetch({
      'messages?q=': { messages: [{ id: 'm1' }] },
      'messages/m1': {
        id: 'm1', internalDate: '5000',
        payload: { headers: [
          { name: 'From', value: 'no-reply@spotify.com' },
          { name: 'Subject', value: 'Seu recibo' },
        ] },
      },
    })
    const res = await gmailScan({ gmailAccount: 'me@gmail.com', sources, fetchJson })
    expect(res.partial).toBe(false)
    expect(res.findings).toHaveLength(1)
    expect(res.findings[0].evidence.emailFrom).toBe('no-reply@spotify.com')
  })

  it('domínio sem resultado não vira finding e não marca parcial', async () => {
    const fetchJson = fakeFetch({ 'messages?q=': { messages: [] } })
    const res = await gmailScan({ gmailAccount: 'me@gmail.com', sources, fetchJson })
    expect(res.findings).toHaveLength(0)
    expect(res.partial).toBe(false)
  })

  it('erro na busca de um domínio marca scan parcial', async () => {
    const fetchJson = async () => { throw new Error('429') }
    const res = await gmailScan({ gmailAccount: 'me@gmail.com', sources, fetchJson })
    expect(res.partial).toBe(true)
    expect(res.findings).toHaveLength(0)
  })
})
