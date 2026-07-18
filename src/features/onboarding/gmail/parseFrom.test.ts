import { describe, it, expect } from 'vitest'
import { parseFrom, domainMatches } from './parseFrom'

describe('parseFrom', () => {
  it('extrai domínio de "Nome <local@dominio>"', () => {
    expect(parseFrom('"Spotify" <no-reply@e.spotify.com>')).toBe('e.spotify.com')
  })
  it('extrai de endereço puro', () => {
    expect(parseFrom('billing@nubank.com.br')).toBe('nubank.com.br')
  })
  it('normaliza case e ponto final', () => {
    expect(parseFrom('X <A@Spotify.COM.>')).toBe('spotify.com')
  })
  it('primeiro endereço quando há vários', () => {
    expect(parseFrom('a@x.com, b@y.com')).toBe('x.com')
  })
  it('lixo → null', () => {
    expect(parseFrom('sem-arroba')).toBeNull()
    expect(parseFrom('')).toBeNull()
  })
})

describe('domainMatches', () => {
  it('casa domínio exato', () => {
    expect(domainMatches('spotify.com', 'spotify.com')).toBe(true)
  })
  it('casa subdomínio (boundary de label)', () => {
    expect(domainMatches('e.spotify.com', 'spotify.com')).toBe(true)
  })
  it('REJEITA colisão de sufixo', () => {
    expect(domainMatches('evilspotify.com', 'spotify.com')).toBe(false)
  })
  it('não casa domínio diferente', () => {
    expect(domainMatches('nubank.com.br', 'spotify.com')).toBe(false)
  })
})
