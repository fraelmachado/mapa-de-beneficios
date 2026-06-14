import { describe, it, expect } from 'vitest'
import { selectionReducer, type SelectionState } from './selection'

describe('selectionReducer', () => {
  it('adiciona e remove um item ao alternar', () => {
    let s: SelectionState = new Set()
    s = selectionReducer(s, { type: 'toggle', itemId: 'a' })
    expect(s.has('a')).toBe(true)
    s = selectionReducer(s, { type: 'toggle', itemId: 'a' })
    expect(s.has('a')).toBe(false)
  })

  it('mantém múltiplos itens', () => {
    let s: SelectionState = new Set()
    s = selectionReducer(s, { type: 'toggle', itemId: 'a' })
    s = selectionReducer(s, { type: 'toggle', itemId: 'b' })
    expect([...s].sort()).toEqual(['a', 'b'])
  })

  it('reset limpa tudo', () => {
    let s: SelectionState = new Set(['a', 'b'])
    s = selectionReducer(s, { type: 'reset' })
    expect(s.size).toBe(0)
  })

  it('é imutável (não muta o estado de entrada)', () => {
    const s: SelectionState = new Set(['a'])
    const next = selectionReducer(s, { type: 'toggle', itemId: 'b' })
    expect(s.has('b')).toBe(false)
    expect(next.has('b')).toBe(true)
  })
})
