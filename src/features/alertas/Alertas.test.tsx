import { describe, it, expect, beforeEach, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

import { Alertas } from './Alertas'

beforeEach(() => { localStorage.clear(); navigateMock.mockReset() })

describe('Alertas', () => {
  it('onboarding: "Ativar alertas" grava optIn e vai ao painel', () => {
    renderWithProviders(<Alertas />, { route: '/alertas?from=onboarding' })
    fireEvent.click(screen.getByRole('button', { name: /ativar alertas/i }))
    expect(JSON.parse(localStorage.getItem('mb-alerts')!).optIn).toBe(true)
    expect(navigateMock).toHaveBeenCalledWith('/painel')
  })
  it('onboarding: "Agora não" grava optIn=false e vai ao painel', () => {
    renderWithProviders(<Alertas />, { route: '/alertas?from=onboarding' })
    fireEvent.click(screen.getByRole('button', { name: /agora não/i }))
    expect(JSON.parse(localStorage.getItem('mb-alerts')!).optIn).toBe(false)
    expect(navigateMock).toHaveBeenCalledWith('/painel')
  })
  it('toggle switch alterna e persiste', () => {
    renderWithProviders(<Alertas />, { route: '/alertas?from=onboarding' })
    const resumo = screen.getByRole('switch', { name: /resumo mensal/i })
    expect(resumo).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(resumo)
    expect(resumo).toHaveAttribute('aria-checked', 'true')
    expect(JSON.parse(localStorage.getItem('mb-alerts')!).resumo).toBe(true)
  })
  it('edição: sem "Agora não"; Voltar vai ao perfil; ligar toggle deriva optIn=true', () => {
    renderWithProviders(<Alertas />, { route: '/alertas' })
    expect(screen.queryByRole('button', { name: /agora não/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('switch', { name: /resumo mensal/i })) // liga → optIn derivado
    expect(JSON.parse(localStorage.getItem('mb-alerts')!).optIn).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: /voltar/i }))
    expect(navigateMock).toHaveBeenCalledWith('/perfil')
  })
  it('edição: desligar todos os toggles deriva optIn=false', () => {
    // defaults: novos on, prazo on, resumo off → desligar novos e prazo
    renderWithProviders(<Alertas />, { route: '/alertas' })
    fireEvent.click(screen.getByRole('switch', { name: /novos benefícios/i }))
    fireEvent.click(screen.getByRole('switch', { name: /prazo de expiração/i }))
    expect(JSON.parse(localStorage.getItem('mb-alerts')!).optIn).toBe(false)
  })
})
