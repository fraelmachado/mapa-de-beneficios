import { describe, it, expect } from 'vitest'
import { toPassProps, categoryToDsCat } from './toPassProps'
import type { MyBenefit } from './types'

const base: MyBenefit = {
  id: '1', title: 'Sala VIP GRU', summary: '2 acessos/mês', category: 'airport',
  scope: 'national', uf: null, steps: null, partner_name: null, valid_until: null,
  image_url: null, action_url: null, action_label: null, created_at: '', source_url: null,
  source_name: null, observed_at: null, benefit_source: 'issuer', estimated_value_brl: null,
  origins: [{ provider: 'Nubank', category: 'bank_card' }], networks: [], via: ['Nubank Ultravioleta'],
}

describe('categoryToDsCat', () => {
  it('mapeia as 16 categorias do app nas 6 do DS', () => {
    expect(categoryToDsCat('airport')).toBe('airport')
    expect(categoryToDsCat('concierge')).toBe('airport')
    expect(categoryToDsCat('travel')).toBe('viagem')
    expect(categoryToDsCat('miles')).toBe('viagem')
    expect(categoryToDsCat('insurance')).toBe('seguro')
    expect(categoryToDsCat('security')).toBe('seguro')
    expect(categoryToDsCat('cashback')).toBe('cashback')
    expect(categoryToDsCat('investback')).toBe('cashback')
    expect(categoryToDsCat('points')).toBe('pontos')
    expect(categoryToDsCat('shopping')).toBe('compras')
    expect(categoryToDsCat('restaurant')).toBe('compras')
    expect(categoryToDsCat('other')).toBe('compras') // default neutro
  })
})

describe('toPassProps', () => {
  it('mapeia título, via, desc e categoria', () => {
    const p = toPassProps(base)
    expect(p.title).toBe('Sala VIP GRU')
    expect(p.via).toBe('Nubank Ultravioleta')
    expect(p.desc).toBe('2 acessos/mês')
    expect(p.category).toBe('airport')
  })
  it('deriva originType/originLabel de benefit_source + origins', () => {
    const p = toPassProps(base)
    expect(p.originType).toBe('emissor')
    expect(p.originLabel).toContain('Nubank')
  })
  it('usa a bandeira (networks) quando benefit_source = card_network', () => {
    const p = toPassProps({ ...base, benefit_source: 'card_network', networks: [{ brand: 'Visa', level: 'Infinite' }] })
    expect(p.originType).toBe('bandeira')
    expect(p.originLabel).toMatch(/Visa/)
  })
})
