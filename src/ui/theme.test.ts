import { describe, it, expect, beforeEach } from 'vitest'
import { toggleTheme, initTheme } from './theme'

beforeEach(() => {
  localStorage.clear()
  document.documentElement.removeAttribute('data-theme')
})

describe('theme', () => {
  it('alterna e persiste o tema', () => {
    initTheme()
    const first = document.documentElement.getAttribute('data-theme')
    toggleTheme()
    expect(document.documentElement.getAttribute('data-theme')).not.toBe(first)
    expect(localStorage.getItem('mb-theme')).toBeTruthy()
  })

  it('initTheme respeita a preferência salva', () => {
    localStorage.setItem('mb-theme', 'dark')
    expect(initTheme()).toBe('dark')
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
  })
})
