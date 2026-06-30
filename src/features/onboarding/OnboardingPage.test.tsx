import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { CategoryGroup } from './groupSourcesByCategory'

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

const requestMutate = vi.fn()
vi.mock('./useSaveSourceRequest', () => ({
  useSaveSourceRequest: () => ({ mutateAsync: requestMutate, isPending: false }),
}))

let existing: { data: string[] | undefined; isLoading: boolean; error?: unknown }
vi.mock('./useUserSources', () => ({ useUserSources: () => existing }))

const bankGroup: CategoryGroup = {
  category: 'bank_card',
  meta: { key: 'bank_card', label: 'Bancos & cartões', icon: '🏦' },
  sources: [
    { id: 's1', kind: 'card', name: 'Itaú', logo_url: null, sort_order: 1, source_category: 'bank_card',
      source_items: [{ id: 'i1', label: 'Black', sort_order: 1 }] },
  ],
}
const loyaltyGroup: CategoryGroup = {
  category: 'loyalty',
  meta: { key: 'loyalty', label: 'Fidelidade & pontos', icon: '⭐' },
  sources: [
    { id: 's3', kind: 'loyalty', name: 'Livelo', logo_url: null, sort_order: 1, source_category: 'loyalty',
      source_items: [{ id: 'i3', label: 'Livelo', sort_order: 1 }] },
  ],
}

let groups: CategoryGroup[]
vi.mock('./useSources', () => ({
  useSources: () => ({ data: groups, isLoading: false, error: null }),
}))

beforeEach(() => {
  navigateMock.mockReset()
  saveMutate.mockReset()
  saveMutate.mockResolvedValue(undefined)
  requestMutate.mockReset()
  requestMutate.mockResolvedValue(undefined)
  existing = { data: [], isLoading: false, error: null }
  groups = [bankGroup, loyaltyGroup]
})

import { OnboardingPage } from './OnboardingPage'

describe('OnboardingPage (wizard híbrido)', () => {
  it('mostra a 1ª categoria; gate "Tenho" revela provedores; seleciona e conclui', async () => {
    renderWithProviders(<OnboardingPage />)
    expect(screen.getByText(/Bancos & cartões/)).toBeInTheDocument()
    // provedores escondidos até "Tenho"
    expect(screen.queryByText('Itaú')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^tenho$/i }))
    fireEvent.click(screen.getByText('Itaú'))
    fireEvent.click(screen.getByRole('button', { name: /black/i }))
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))
    // passo 2: fidelidade — diz "Não tenho" e conclui
    expect(screen.getByText(/Fidelidade & pontos/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /não tenho/i }))
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith(expect.arrayContaining(['i1'])))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/painel'), { timeout: 2500 })
  })

  it('mostra só categorias com provedores; Concluir exige responder o gate', () => {
    groups = [bankGroup]
    renderWithProviders(<OnboardingPage />)
    expect(screen.queryByText(/Fidelidade & pontos/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /avançar/i })).not.toBeInTheDocument()
    const concluir = screen.getByRole('button', { name: /concluir/i })
    expect(concluir).toBeDisabled() // gate ainda não respondido
    fireEvent.click(screen.getByRole('button', { name: /^tenho$/i }))
    expect(concluir).toBeEnabled()
  })

  it('não conclui sem responder o gate (não salva nem navega)', () => {
    groups = [bankGroup]
    renderWithProviders(<OnboardingPage />)
    fireEvent.click(screen.getByRole('button', { name: /concluir/i })) // desabilitado → no-op
    expect(saveMutate).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('modo edição: categoria com item pré-selecionado já aparece como "Tenho"', () => {
    existing = { data: ['i1'], isLoading: false }
    renderWithProviders(<OnboardingPage />)
    // provedores já visíveis sem clicar em "Tenho"
    expect(screen.getByText('Itaú')).toBeInTheDocument()
  })

  it('modo edição: "Não tenho" remove os itens da categoria ao concluir', async () => {
    existing = { data: ['i1'], isLoading: false }
    groups = [bankGroup]
    renderWithProviders(<OnboardingPage />)
    expect(screen.getByText('Itaú')).toBeInTheDocument() // pré-selecionado → "Tenho"
    fireEvent.click(screen.getByRole('button', { name: /não tenho/i }))
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalled())
    expect(saveMutate.mock.calls[0][0]).not.toContain('i1')
  })

  it('erro ao carregar fontes existentes não salva', () => {
    existing = { data: undefined, isLoading: false, error: new Error('x') } as unknown as typeof existing
    renderWithProviders(<OnboardingPage />)
    expect(screen.getByText(/erro ao carregar seus dados/i)).toBeInTheDocument()
    expect(saveMutate).not.toHaveBeenCalled()
  })
})
