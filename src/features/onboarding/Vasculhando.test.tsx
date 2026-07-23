import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent, act } from '@testing-library/react'
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

// Sem reduced-motion: o relógio da animação só pode contar tempo REALMENTE pintado.
// requestAnimationFrame não dispara com a aba escondida (é o que acontece durante o
// popup do Google no celular) — se o relógio contasse o tempo de parede, o 1º frame
// chegaria com segundos de atraso e a animação nasceria concluída.
describe('Vasculhando (aba escondida durante o login)', () => {
  let frames: FrameRequestCallback[]

  beforeEach(() => {
    vi.stubGlobal('matchMedia', (q: string) => ({
      matches: false, media: q, onchange: null,
      addEventListener: () => {}, removeEventListener: () => {}, addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
    }))
    frames = []
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.push(cb); return frames.length })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  const nextFrame = (t: number) => act(() => { frames.shift()?.(t) })
  const finalCta = () => screen.queryByRole('button', { name: /ver meus benefícios/i })

  it('primeiro frame atrasado (aba escondida) NÃO pula a animação', () => {
    renderWithProviders(<Vasculhando count={3} onDone={vi.fn()} />)
    nextFrame(performance.now() + 10_000) // voltou do OAuth 10s depois
    expect(finalCta()).toBeNull()          // ainda animando, não "Pronto!"
    expect(screen.getByText('0')).toBeInTheDocument()
  })

  it('conclui depois de frames pintados de verdade', () => {
    renderWithProviders(<Vasculhando count={3} onDone={vi.fn()} />)
    let t = performance.now()
    nextFrame(t) // 1º frame ancora o relógio
    for (let i = 0; i < 30 && finalCta() === null; i += 1) { t += 100; nextFrame(t) }
    expect(finalCta()).not.toBeNull()
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
