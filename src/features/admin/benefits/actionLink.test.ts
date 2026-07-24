import { describe, expect, it } from 'vitest'
import { normalizeActionLink } from './actionLink'

describe('normalizeActionLink', () => {
  it('aceita ausência de CTA', () => {
    expect(normalizeActionLink('', '')).toEqual({
      ok: true,
      value: { action_url: null, action_label: null },
    })
  })

  it('remove espaços externos do par válido', () => {
    expect(normalizeActionLink('  https://amil.com.br/rede  ', '  Ver rede  ')).toEqual({
      ok: true,
      value: {
        action_url: 'https://amil.com.br/rede',
        action_label: 'Ver rede',
      },
    })
  })

  it.each([
    ['https://amil.com.br/rede', ''],
    ['', 'Ver rede'],
    ['javascript:alert(1)', 'Abrir'],
    ['ftp://amil.com.br/rede', 'Abrir'],
    ['amil.com.br/rede', 'Abrir'],
  ])('rejeita combinação inválida %s / %s', (url, label) => {
    expect(normalizeActionLink(url, label)).toMatchObject({ ok: false })
  })
})
