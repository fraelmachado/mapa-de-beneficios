import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { readAlertPrefs, writeAlertPrefs, DEFAULT_PREFS } from './useAlertPrefs'

beforeEach(() => localStorage.clear())
afterEach(() => vi.restoreAllMocks())

describe('alert prefs storage', () => {
  it('returns defaults when nothing stored', () => {
    expect(readAlertPrefs()).toEqual(DEFAULT_PREFS)
  })
  it('round-trips written prefs', () => {
    writeAlertPrefs({ v: 1, optIn: true, novos: false, prazo: true, resumo: true })
    expect(readAlertPrefs()).toEqual({ v: 1, optIn: true, novos: false, prazo: true, resumo: true })
  })
  it('falls back to defaults on invalid JSON', () => {
    localStorage.setItem('mb-alerts', '{not json')
    expect(readAlertPrefs()).toEqual(DEFAULT_PREFS)
  })
  it('falls back to defaults on wrong version', () => {
    localStorage.setItem('mb-alerts', JSON.stringify({ v: 99, optIn: true }))
    expect(readAlertPrefs()).toEqual(DEFAULT_PREFS)
  })
  it('falls back to defaults when localStorage throws (indisponível)', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError') })
    expect(readAlertPrefs()).toEqual(DEFAULT_PREFS)
  })
  it('write swallows errors when localStorage throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('SecurityError') })
    expect(() => writeAlertPrefs(DEFAULT_PREFS)).not.toThrow()
  })
})
