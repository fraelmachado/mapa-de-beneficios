import { describe, it, expect } from 'vitest'
import {
  normalize, slugify, sourceFingerprint, sourceItemFingerprint, benefitFingerprint,
} from './fingerprint'

describe('fingerprint', () => {
  it('normalize remove acentos, caixa e espaços extras', () => {
    expect(normalize('  Unimed  Saúde ')).toBe('unimed saude')
  })

  it('slugify produz kebab-case estável', () => {
    expect(slugify('Cartão Nubank Ultravioleta!')).toBe('cartao-nubank-ultravioleta')
    expect(slugify('C6  Carbon')).toBe('c6-carbon')
  })

  it('fingerprints são determinísticas e insensíveis a caixa/acento', () => {
    expect(sourceFingerprint('unimed')).toBe('source|unimed')
    expect(sourceItemFingerprint('nubank', 'Gold')).toBe('source_item|nubank|gold')
    expect(sourceItemFingerprint('nubank', ' góld ')).toBe('source_item|nubank|gold')
    expect(benefitFingerprint('nubank-gold', 'Sala VIP no Aeroporto'))
      .toBe('benefit|nubank-gold|sala-vip-no-aeroporto')
  })
})
