import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const css = readFileSync('src/features/detalhe/benefit-detail.css', 'utf8')

describe('benefit-detail.css', () => {
  it('preserva espaço para a bottom nav e a safe area no mobile', () => {
    const mobileRule = css.match(/^\.detail-page \{[^}]+\}/m)?.[0] ?? ''

    expect(mobileRule).toContain('padding: var(--s5) var(--s4) calc(112px + env(safe-area-inset-bottom))')
  })

  it('mantém o padding adequado no desktop', () => {
    expect(css).toContain('@media (min-width: 960px) { .detail-page { padding: var(--s8); } }')
  })
})
