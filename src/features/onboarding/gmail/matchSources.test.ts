import { describe, it, expect } from 'vitest'
import { matchSources } from './matchSources'
import type { ScanEmail } from './types'
import type { Source } from '../types'

const src = (over: Partial<Source>): Source => ({
  id: 's1', kind: 'card', name: 'Spotify', logo_url: null, sort_order: 1,
  match_domains: ['spotify.com'],
  source_items: [{ id: 'i1', label: 'Premium', sort_order: 1 }],
  ...over,
})
const mail = (over: Partial<ScanEmail>): ScanEmail => ({
  domain: 'spotify.com', from: 'no-reply@spotify.com', subject: 'oi',
  internalDate: 1000, messageId: 'm1', ...over,
})

describe('matchSources', () => {
  it('casa marca por domínio e monta evidência', () => {
    const f = matchSources([mail({})], [src({})], 'me@gmail.com')
    expect(f).toHaveLength(1)
    expect(f[0].sourceId).toBe('s1')
    expect(f[0].items).toHaveLength(1)
    expect(f[0].evidence.gmailAccount).toBe('me@gmail.com')
    expect(f[0].evidence.gmailMessageId).toBe('m1')
  })

  it('ignora domínio desconhecido', () => {
    const f = matchSources([mail({ domain: 'x.com', from: 'a@x.com' })], [src({})], 'me@gmail.com')
    expect(f).toHaveLength(0)
  })

  it('rejeita colisão de sufixo', () => {
    const f = matchSources([mail({ domain: 'evilspotify.com', from: 'a@evilspotify.com' })], [src({})], 'me@gmail.com')
    expect(f).toHaveLength(0)
  })

  it('dedupe por marca mantendo o e-mail mais recente (internalDate)', () => {
    const emails = [mail({ messageId: 'old', internalDate: 1000 }), mail({ messageId: 'new', internalDate: 5000 })]
    const f = matchSources(emails, [src({})], 'me@gmail.com')
    expect(f).toHaveLength(1)
    expect(f[0].evidence.gmailMessageId).toBe('new')
  })

  it('converte internalDate para ISO em email_date', () => {
    const f = matchSources([mail({ internalDate: 0 })], [src({})], 'me@gmail.com')
    expect(f[0].evidence.emailDate).toBe('1970-01-01T00:00:00.000Z')
  })

  it('propaga a categoria da marca (default bank_card)', () => {
    const withCat = matchSources([mail({})], [src({ source_category: 'retail' })], 'me@gmail.com')
    expect(withCat[0].category).toBe('retail')
    const noCat = matchSources([mail({})], [src({ source_category: undefined })], 'me@gmail.com')
    expect(noCat[0].category).toBe('bank_card')
  })

  it('descarta marca sem nenhum tier (não há o que confirmar)', () => {
    const f = matchSources([mail({})], [src({ source_items: [] })], 'me@gmail.com')
    expect(f).toHaveLength(0)
  })
})
