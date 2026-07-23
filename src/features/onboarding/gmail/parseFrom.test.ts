import { describe, it, expect } from 'vitest'
import { parseFrom, domainMatches, fromAddress } from './parseFrom'

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

describe('fromAddress', () => {
  it('descarta o nome de exibição (que repetiria a marca no card)', () => {
    expect(fromAddress('Nubank <todomundo@nubank.com.br>')).toBe('todomundo@nubank.com.br')
  })
  it('endereço puro passa intacto', () => {
    expect(fromAddress('no-reply@spotify.com')).toBe('no-reply@spotify.com')
  })
  it('usa só o primeiro de uma lista', () => {
    expect(fromAddress('A <a@x.com>, B <b@y.com>')).toBe('a@x.com')
  })
})
