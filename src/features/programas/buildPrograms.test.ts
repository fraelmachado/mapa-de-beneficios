import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { buildPrograms } from './buildPrograms'
import type { Source } from '../onboarding/types'
import type { EvidenceRow } from './useSourceEvidence'

const sources: Source[] = [
  { id: 's1', kind: 'card', name: 'Nubank', logo_url: null, sort_order: 1,
    source_items: [{ id: 'gold', label: 'Gold', sort_order: 1 }, { id: 'plat', label: 'Platinum', sort_order: 2 }] },
  { id: 's2', kind: 'loyalty', name: 'Spotify', logo_url: '/l/spotify.svg', sort_order: 2,
    source_items: [{ id: 'prem', label: 'Premium', sort_order: 1 }] },
]

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-07-19T00:00:00Z')) })
afterEach(() => vi.useRealTimers())

describe('buildPrograms', () => {
  it('proveniência gmail vem da evidência do source_id; ordena por sort_order', () => {
    const evidence: EvidenceRow[] = [{ source_id: 's1', email_from: 'a@nubank.com.br', email_date: null, created_at: '2026-07-16T00:00:00Z', gmail_account: 'me@gmail.com' }]
    const { programs, summary } = buildPrograms(['prem', 'plat'], sources, evidence)
    expect(programs.map((p) => p.sourceId)).toEqual(['s1', 's2']) // Nubank (sort 1) antes de Spotify (sort 2)
    const nu = programs.find((p) => p.sourceId === 's1')!
    expect(nu.provenance).toBe('gmail'); expect(nu.tier).toBe('Platinum'); expect(nu.items).toHaveLength(2)
    expect(nu.when).toBe('há 3 dias')
    const sp = programs.find((p) => p.sourceId === 's2')!
    expect(sp.provenance).toBe('manual')
    expect(sp.tier).toBe('Premium') // single-item com label significativo aparece
    expect(summary).toMatchObject({ total: 2, gmailCount: 1, manualCount: 1, account: 'me@gmail.com', lastFound: 'há 3 dias' })
  })
  it('dedup por item + ignora item inexistente', () => {
    const { programs } = buildPrograms(['plat', 'plat', 'fantasma'], sources, [])
    expect(programs).toHaveLength(1)
  })
  it('single-tier não exibe rótulo de tier placeholder', () => {
    const s: Source[] = [{ id: 's3', kind: 'carrier', name: 'Vivo', logo_url: null, sort_order: 3, source_items: [{ id: 'v', label: '—', sort_order: 1 }] }]
    const { programs } = buildPrograms(['v'], s, [])
    expect(programs[0].tier).toBe('')
  })

  it.each([
    [0, 'hoje'],
    [1, 'ontem'],
    [6, 'há 6 dias'],
    [7, 'há 1 semana'],
    [14, 'há 2 semanas'],
    [30, 'há 1 mês'],
    [60, 'há 2 meses'],
    [365, 'há 1 ano'],
    [730, 'há 2 anos'],
  ])('relTime: %i dias atrás -> %s', (daysAgo, expected) => {
    const createdAt = new Date(Date.parse('2026-07-19T00:00:00Z') - daysAgo * 86400000).toISOString()
    const evidence: EvidenceRow[] = [{ source_id: 's1', email_from: 'a@nubank.com.br', email_date: null, created_at: createdAt, gmail_account: 'me@gmail.com' }]
    const { programs, summary } = buildPrograms(['plat'], sources, evidence)
    expect(programs[0].when).toBe(expected)
    expect(summary.lastFound).toBe(expected)
  })

  it('desempate de ordenação por marca (mesmo sort_order)', () => {
    const s: Source[] = [
      { id: 'z1', kind: 'card', name: 'Zara', logo_url: null, sort_order: 5, source_items: [{ id: 'zi', label: 'Item', sort_order: 1 }] },
      { id: 'a1', kind: 'card', name: 'Amazon', logo_url: null, sort_order: 5, source_items: [{ id: 'ai', label: 'Item', sort_order: 1 }] },
    ]
    const { programs } = buildPrograms(['zi', 'ai'], s, [])
    expect(programs.map((p) => p.brand)).toEqual(['Amazon', 'Zara'])
  })
})
