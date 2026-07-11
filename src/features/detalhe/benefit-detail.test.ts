import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/features/detalhe/benefit-detail.css', 'utf8')

describe('benefit-detail.css', () => {
  it('preserva a safe area no fim do conteúdo', () => {
    const contentRule = css.match(/^\.detail-content \{[^}]+\}/m)?.[0] ?? ''

    expect(contentRule).toContain('env(safe-area-inset-bottom)')
  })

  it('usa o gradiente da categoria no hero', () => {
    const heroRule = css.match(/^\.detail-hero \{[^}]+\}/m)?.[0] ?? ''

    expect(heroRule).toContain('linear-gradient')
    expect(heroRule).toContain('var(--cat')
  })
})
