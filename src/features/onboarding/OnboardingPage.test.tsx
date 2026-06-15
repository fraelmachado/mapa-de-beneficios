import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { GroupedSources } from './types'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

vi.mock('../auth/AuthProvider', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}))

const saveMutate = vi.fn()
vi.mock('./useSaveUserSources', () => ({
  useSaveUserSources: () => ({ mutateAsync: saveMutate, isPending: false }),
}))

let existing: { data: string[] | undefined; isLoading: boolean; error?: unknown }
vi.mock('./useUserSources', () => ({
  useUserSources: () => existing,
}))

const fullGrouped: GroupedSources = {
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
let grouped: GroupedSources
vi.mock('./useSources', () => ({
  useSources: () => ({ data: grouped, isLoading: false, error: null }),
}))

beforeEach(() => {
  navigateMock.mockReset()
  saveMutate.mockReset()
  saveMutate.mockResolvedValue(undefined)
  existing = { data: [], isLoading: false, error: null }
  grouped = fullGrouped
})

import { OnboardingPage } from './OnboardingPage'

describe('OnboardingPage', () => {
  it('navega pelos 3 passos, salva a seleção e vai pro painel', async () => {
    renderWithProviders(<OnboardingPage />)
    fireEvent.click(screen.getByText('Itaú'))
    fireEvent.click(screen.getByRole('button', { name: /black/i }))
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))
    fireEvent.click(screen.getByText('Claro'))
    fireEvent.click(screen.getByRole('button', { name: /pós/i }))
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith(expect.arrayContaining(['i1', 'i2'])))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/painel'), { timeout: 2500 })
  })

  it('pré-preenche a seleção existente (modo edição) e salva sem nova escolha', async () => {
    existing = { data: ['i1', 'i2'], isLoading: false }
    renderWithProviders(<OnboardingPage />)
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith(expect.arrayContaining(['i1', 'i2'])))
  })

  it('com só cartões no catálogo, mostra 1 passo e conclui direto (sem passos vazios)', async () => {
    grouped = { card: fullGrouped.card, carrier: [], loyalty: [], cpf: [] } as GroupedSources
    renderWithProviders(<OnboardingPage />)
    // não deve existir o passo de operadora nem o de fidelidade
    expect(screen.queryByText(/qual sua operadora/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/nada por aqui ainda/i)).not.toBeInTheDocument()
    // único passo é o de cartões e seu CTA é "Concluir"
    expect(screen.getByText(/quais cartões ou bancos/i)).toBeInTheDocument()
    fireEvent.click(screen.getByText('Itaú'))
    fireEvent.click(screen.getByRole('button', { name: /black/i }))
    expect(screen.queryByRole('button', { name: /avançar/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith(expect.arrayContaining(['i1'])))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/painel'), { timeout: 2500 })
  })

  it('mostra erro e não salva quando falha ao carregar as fontes existentes', () => {
    existing = { data: undefined, isLoading: false, error: new Error('x') } as unknown as typeof existing
    renderWithProviders(<OnboardingPage />)
    expect(screen.getByText(/erro ao carregar seus dados/i)).toBeInTheDocument()
    expect(saveMutate).not.toHaveBeenCalled()
  })
})
