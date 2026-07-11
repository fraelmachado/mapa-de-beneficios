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

import { ManualWizard } from './ManualWizard'

describe('ManualWizard (wizard híbrido)', () => {
  it('mostra a 1ª categoria; gate "Tenho" revela provedores (chips inline); seleciona e conclui', async () => {
    renderWithProviders(<ManualWizard />)
    expect(screen.getByText(/Passo 1 de 2/i)).toBeInTheDocument()
    expect(screen.getByText(/Bancos & cartões/)).toBeInTheDocument()
    // provedores escondidos até "Tenho"
    expect(screen.queryByText('Itaú')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^tenho$/i }))
    // fim do accordion: o nome do provedor NÃO é mais um botão de expandir,
    // e a variante já está visível inline (sem clicar para abrir)
    expect(screen.getByText('Itaú')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Itaú' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /black/i }))
    fireEvent.click(screen.getByRole('button', { name: /avançar/i }))
    // passo 2: fidelidade — diz "Não tenho" e conclui
    expect(screen.getByText(/Passo 2 de 2/i)).toBeInTheDocument()
    expect(screen.getByText(/Fidelidade & pontos/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /não tenho/i }))
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith(expect.arrayContaining(['i1'])))
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/painel'), { timeout: 2500 })
  })

  it('mostra só categorias com provedores; Concluir exige responder o gate', () => {
    groups = [bankGroup]
    renderWithProviders(<ManualWizard />)
    expect(screen.queryByText(/Fidelidade & pontos/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /avançar/i })).not.toBeInTheDocument()
    const concluir = screen.getByRole('button', { name: /concluir/i })
    expect(concluir).toBeDisabled() // gate ainda não respondido
    fireEvent.click(screen.getByRole('button', { name: /^tenho$/i }))
    expect(concluir).toBeEnabled()
  })

  it('não conclui sem responder o gate (não salva nem navega)', () => {
    groups = [bankGroup]
    renderWithProviders(<ManualWizard />)
    fireEvent.click(screen.getByRole('button', { name: /concluir/i })) // desabilitado → no-op
    expect(saveMutate).not.toHaveBeenCalled()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('modo edição: categoria com item pré-selecionado já aparece como "Tenho"', () => {
    existing = { data: ['i1'], isLoading: false }
    renderWithProviders(<ManualWizard />)
    // provedores já visíveis sem clicar em "Tenho"
    expect(screen.getByText('Itaú')).toBeInTheDocument()
  })

  it('modo edição: "Não tenho" remove os itens da categoria ao concluir', async () => {
    existing = { data: ['i1'], isLoading: false }
    groups = [bankGroup]
    renderWithProviders(<ManualWizard />)
    expect(screen.getByText('Itaú')).toBeInTheDocument() // pré-selecionado → "Tenho"
    fireEvent.click(screen.getByRole('button', { name: /não tenho/i }))
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalled())
    expect(saveMutate.mock.calls[0][0]).not.toContain('i1')
  })

  it('erro ao carregar fontes existentes não salva', () => {
    existing = { data: undefined, isLoading: false, error: new Error('x') } as unknown as typeof existing
    renderWithProviders(<ManualWizard />)
    expect(screen.getByText(/erro ao carregar seus dados/i)).toBeInTheDocument()
    expect(saveMutate).not.toHaveBeenCalled()
  })

  it('busca filtra os provedores por nome dentro da categoria', () => {
    groups = [{
      ...bankGroup,
      sources: [
        bankGroup.sources[0],
        { id: 's2', kind: 'card', name: 'Nubank', logo_url: null, sort_order: 2, source_category: 'bank_card',
          source_items: [{ id: 'i9', label: 'Ultravioleta', sort_order: 1 }] },
      ],
    }]
    renderWithProviders(<ManualWizard />)
    fireEvent.click(screen.getByRole('button', { name: /^tenho$/i }))
    expect(screen.getByText('Itaú')).toBeInTheDocument()
    expect(screen.getByText('Nubank')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nub' } })
    expect(screen.queryByText('Itaú')).not.toBeInTheDocument()
    expect(screen.getByText('Nubank')).toBeInTheDocument()
  })

  it('"Outro" grava um pedido com a categoria atual', async () => {
    renderWithProviders(<ManualWizard />)
    fireEvent.click(screen.getByRole('button', { name: /^tenho$/i }))
    fireEvent.change(screen.getByLabelText(/outro/i), { target: { value: 'C6 Bank' } })
    fireEvent.click(screen.getByRole('button', { name: /adicionar/i }))
    await waitFor(() =>
      expect(requestMutate).toHaveBeenCalledWith({ source_category: 'bank_card', text: 'C6 Bank' }),
    )
    expect(await screen.findByText(/recebemos/i)).toBeInTheDocument()
  })
})
