import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { GroupedSources } from './types'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

const saveMutate = vi.fn()
vi.mock('./useSaveUserSources', () => ({
  useSaveUserSources: () => ({ mutateAsync: saveMutate, isPending: false }),
}))

const grouped: GroupedSources = {
  card: [
    { id: 's1', kind: 'card', name: 'Itaú', logo_url: null, sort_order: 1, source_items: [
      { id: 'i1', label: 'Black', sort_order: 1 },
    ] },
  ],
  carrier: [
    { id: 's2', kind: 'carrier', name: 'Claro', logo_url: null, sort_order: 1, source_items: [
      { id: 'i2', label: 'Pós', sort_order: 1 },
    ] },
  ],
  loyalty: [
    { id: 's3', kind: 'loyalty', name: 'Livelo', logo_url: null, sort_order: 1, source_items: [
      { id: 'i3', label: '—', sort_order: 1 },
    ] },
  ],
  cpf: [],
} as GroupedSources
vi.mock('./useSources', () => ({
  useSources: () => ({ data: grouped, isLoading: false, error: null }),
}))

beforeEach(() => {
  navigateMock.mockReset()
  saveMutate.mockReset()
  saveMutate.mockResolvedValue(undefined)
})

import { OnboardingPage } from './OnboardingPage'

describe('OnboardingPage', () => {
  it('navega pelos 3 passos, salva a seleção e vai pro painel', async () => {
    renderWithProviders(<OnboardingPage />)

    // Passo 1: cartões
    fireEvent.click(screen.getByText('Itaú'))
    fireEvent.click(screen.getByRole('button', { name: /black/i }))
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))

    // Passo 2: operadora
    fireEvent.click(screen.getByText('Claro'))
    fireEvent.click(screen.getByRole('button', { name: /pós/i }))
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))

    // Passo 3: fidelidade -> concluir
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))

    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith(expect.arrayContaining(['i1', 'i2'])))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/painel'), { timeout: 2500 })
  })
})
