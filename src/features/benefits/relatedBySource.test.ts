import { describe, it, expect } from 'vitest'
import { relatedBySource } from './relatedBySource'
import type { MyBenefit } from './types'

function mk(id: string, source_url: string | null): MyBenefit {
  return {
    id, title: `B${id}`, summary: '', category: 'other', scope: 'nacional', uf: null,
    steps: null, partner_name: null, valid_until: null, image_url: null, action_url: null,
    action_label: null, created_at: '', via: [], source_url, source_name: null, observed_at: null,
    benefit_source: null, origins: [], networks: [],
  }
}

describe('relatedBySource', () => {
  it('retorna os de mesma source_url, exceto o próprio', () => {
    const a = mk('1', 'https://visa.com/x')
    const b = mk('2', 'https://visa.com/x')
    const c = mk('3', 'https://mastercard.com/y')
    const out = relatedBySource([a, b, c], a)
    expect(out.map((x) => x.id)).toEqual(['2'])
  })

  it('ignora benefícios com source_url nulo (inclusive o atual)', () => {
    const a = mk('1', null)
    const b = mk('2', null)
    expect(relatedBySource([a, b], a)).toEqual([])
  })

  it('lista vazia quando não há outros da mesma fonte', () => {
    const a = mk('1', 'https://x.test')
    const c = mk('3', 'https://y.test')
    expect(relatedBySource([a, c], a)).toEqual([])
  })
})
