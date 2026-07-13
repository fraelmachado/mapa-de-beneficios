import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import { Vasculhando } from './Vasculhando'

// força reduced-motion → componente conclui na hora, sem timers (determinístico)
beforeEach(() => {
  vi.stubGlobal('matchMedia', (q: string) => ({
    matches: q.includes('reduce'), media: q, onchange: null,
    addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
  }))
})
afterEach(() => vi.unstubAllGlobals())

describe('Vasculhando (reduced-motion)', () => {
  it('conclui imediatamente, sem animações, e dispara onDone', () => {
    const onDone = vi.fn()
    const { container } = renderWithProviders(<Vasculhando count={3} onDone={onDone} />)
    expect(screen.getByText('3')).toBeInTheDocument()
    // reduced-motion → estado concluído: sweep/ping não são renderizados
    expect(container.querySelector('.scan-sweep')).toBeNull()
    expect(container.querySelector('.scan-ping')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /ver meus benefícios/i }))
    expect(onDone).toHaveBeenCalledTimes(1)
  })
})
