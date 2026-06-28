import { describe, it, expect } from 'vitest'
import { filterBenefits } from './filterBenefits'
import type { MyBenefit } from './types'

const base = (over: Partial<MyBenefit>): MyBenefit => ({
  id: 'x', title: 'T', summary: 'S', category: 'shopping', scope: 'nacional',
  uf: null, steps: null, partner_name: null, valid_until: null, image_url: null,
  action_url: null, action_label: null, created_at: '', source_url: null, source_name: null, observed_at: null, benefit_source: null, origins: [], networks: [], via: [], ...over,
})

const list: MyBenefit[] = [
  base({ id: '1', title: 'Sala VIP', category: 'travel', partner_name: 'Mastercard' }),
  base({ id: '2', title: 'Cinema', category: 'experience', partner_name: 'Cinemark' }),
  base({ id: '3', title: 'Farmácia', category: 'insurance' }),
]

describe('filterBenefits', () => {
  it('sem filtros retorna tudo', () => {
    expect(filterBenefits(list, { category: null, text: '' })).toHaveLength(3)
  })
  it('filtra por categoria', () => {
    const r = filterBenefits(list, { category: 'travel', text: '' })
    expect(r.map((b) => b.id)).toEqual(['1'])
  })
  it('filtra por texto no título (case-insensitive)', () => {
    expect(filterBenefits(list, { category: null, text: 'cine' }).map((b) => b.id)).toEqual(['2'])
  })
  it('filtra por texto no partner_name', () => {
    expect(filterBenefits(list, { category: null, text: 'master' }).map((b) => b.id)).toEqual(['1'])
  })
  it('combina categoria e texto', () => {
    expect(filterBenefits(list, { category: 'insurance', text: 'farm' }).map((b) => b.id)).toEqual(['3'])
  })
})
