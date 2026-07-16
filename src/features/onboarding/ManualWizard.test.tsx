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

const refetchSources = vi.fn()
const refetchExisting = vi.fn()
let sourceResult: {
  data: CategoryGroup[] | undefined
  isLoading: boolean
  error: unknown
  refetch: typeof refetchSources
}
let existingResult: {
  data: string[] | undefined
  isLoading: boolean
  error: unknown
  refetch: typeof refetchExisting
}

vi.mock('./useSources', () => ({ useSources: () => sourceResult }))
vi.mock('./useUserSources', () => ({ useUserSources: () => existingResult }))

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
// marca com múltiplos tiers → abre a bottom sheet
const multiTierGroup: CategoryGroup = {
  category: 'bank_card',
  meta: { key: 'bank_card', label: 'Bancos & cartões', icon: '🏦' },
  sources: [
    { id: 'sN', kind: 'card', name: 'Nubank', logo_url: null, sort_order: 1, source_category: 'bank_card',
      source_items: [
        { id: 'nu1', label: 'Roxinho', sort_order: 1, benefitCount: 4, estValueBrl: 280 },
        { id: 'nu2', label: 'Ultravioleta', sort_order: 2, benefitCount: 12, estValueBrl: 900 },
      ] },
  ],
}

beforeEach(() => {
  navigateMock.mockReset()
  saveMutate.mockReset()
  saveMutate.mockResolvedValue(undefined)
  requestMutate.mockReset()
  requestMutate.mockResolvedValue(undefined)
  refetchSources.mockReset()
  refetchExisting.mockReset()
  sourceResult = { data: [bankGroup, loyaltyGroup], isLoading: false, error: null, refetch: refetchSources }
  existingResult = { data: [], isLoading: false, error: null, refetch: refetchExisting }
})

import { ManualWizard } from './ManualWizard'

describe('ManualWizard (grade de provedores)', () => {
  it('mostra a 1ª categoria, seleciona um provedor e conclui', async () => {
    renderWithProviders(<ManualWizard />)
    expect(screen.getByRole('group', { name: /passo 1 de 2/i })).toBeInTheDocument()
    expect(screen.getByText(/quais cartões você tem/i)).toBeInTheDocument()
    // provedores visíveis direto, sem gate
    expect(screen.getByText('Itaú')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /itaú/i }))
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    // passo 2: pula sem selecionar e conclui
    expect(screen.getByRole('group', { name: /passo 2 de 2/i })).toBeInTheDocument()
    expect(screen.getByText(/programas de fidelidade/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith(expect.arrayContaining(['i1'])))
    // tela de conclusão (Radar montado) antes de ir pro painel
    const ver = await screen.findByRole('button', { name: /ver meu radar/i }, { timeout: 2500 })
    fireEvent.click(ver)
    expect(navigateMock).toHaveBeenCalledWith('/alertas?from=onboarding')
  })

  it('modo edição: "Ver meu radar" vai direto ao painel', async () => {
    sourceResult.data = [bankGroup]
    renderWithProviders(<ManualWizard />, { route: '/onboarding?mode=edit' })
    fireEvent.click(screen.getByRole('button', { name: /itaú/i }))
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    const ver = await screen.findByRole('button', { name: /ver meu radar/i }, { timeout: 2500 })
    fireEvent.click(ver)
    expect(navigateMock).toHaveBeenCalledWith('/painel')
  })

  it('mostra só categorias com provedores; Concluir fica disponível', () => {
    sourceResult.data = [bankGroup]
    renderWithProviders(<ManualWizard />)
    expect(screen.queryByText(/programas de fidelidade/i)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /continuar/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /concluir/i })).toBeEnabled()
  })

  it('conclui sem seleção salva uma lista vazia', async () => {
    sourceResult.data = [bankGroup]
    renderWithProviders(<ManualWizard />)
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith([]))
  })

  it('modo edição: item já salvo aparece marcado', () => {
    existingResult = { ...existingResult, data: ['i1'] }
    sourceResult.data = [bankGroup]
    renderWithProviders(<ManualWizard />)
    expect(screen.getByText('Itaú')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /itaú/i })).toHaveAttribute('aria-pressed', 'true')
  })

  it('modo edição: desmarcar o item o remove ao concluir', async () => {
    existingResult = { ...existingResult, data: ['i1'] }
    sourceResult.data = [bankGroup]
    renderWithProviders(<ManualWizard />)
    const item = screen.getByRole('button', { name: /itaú/i })
    expect(item).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(item) // desmarca
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalled())
    expect(saveMutate.mock.calls[0][0]).not.toContain('i1')
  })

  it('erro ao carregar fontes existentes não salva', () => {
    existingResult = { ...existingResult, data: undefined, error: new Error('x') }
    renderWithProviders(<ManualWizard />)
    expect(screen.getByText(/não foi possível carregar seus programas/i)).toBeInTheDocument()
    expect(saveMutate).not.toHaveBeenCalled()
  })

  it('busca filtra os provedores por nome dentro da categoria', () => {
    sourceResult.data = [{
      ...bankGroup,
      sources: [
        bankGroup.sources[0],
        { id: 's2', kind: 'card', name: 'Nubank', logo_url: null, sort_order: 2, source_category: 'bank_card',
          source_items: [{ id: 'i9', label: 'Ultravioleta', sort_order: 1 }] },
      ],
    }]
    renderWithProviders(<ManualWizard />)
    expect(screen.getByText('Itaú')).toBeInTheDocument()
    expect(screen.getByText('Nubank')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'nub' } })
    expect(screen.queryByText('Itaú')).not.toBeInTheDocument()
    expect(screen.getByText('Nubank')).toBeInTheDocument()
  })

  it('"Outro" grava um pedido com a categoria atual', async () => {
    renderWithProviders(<ManualWizard />)
    fireEvent.click(screen.getByRole('button', { name: /não vejo o meu/i }))
    fireEvent.change(screen.getByLabelText(/outro provedor/i), { target: { value: 'C6 Bank' } })
    fireEvent.click(screen.getByRole('button', { name: /adicionar/i }))
    await waitFor(() =>
      expect(requestMutate).toHaveBeenCalledWith({ source_category: 'bank_card', text: 'C6 Bank' }),
    )
    expect(await screen.findByText(/recebemos/i)).toBeInTheDocument()
  })

  it('shows stable loading and retries both read queries', () => {
    sourceResult.isLoading = true
    const view = renderWithProviders(<ManualWizard />)
    const loading = screen.getByRole('status', { name: /carregando seus programas/i })
    expect(loading).toHaveAttribute('aria-busy', 'true')
    view.unmount()
    sourceResult = { ...sourceResult, isLoading: false, error: new Error('down') }
    renderWithProviders(<ManualWizard />)
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(refetchSources).toHaveBeenCalledTimes(1)
    expect(refetchExisting).toHaveBeenCalledTimes(1)
  })

  it('marca com múltiplos tiers abre a sheet e escolher o tier salva o item certo', async () => {
    sourceResult.data = [multiTierGroup]
    renderWithProviders(<ManualWizard />)
    // o card é da MARCA, não do tier
    expect(screen.getByRole('button', { name: /nubank/i })).toBeInTheDocument()
    expect(screen.queryByText('Ultravioleta')).not.toBeInTheDocument()
    // abre a sheet
    fireEvent.click(screen.getByRole('button', { name: /nubank/i }))
    const sheet = screen.getByRole('dialog', { name: /qual o seu nubank/i })
    expect(sheet).toBeInTheDocument()
    // "Mais completo" no tier com mais benefícios
    expect(screen.getByText(/mais completo/i)).toBeInTheDocument()
    // escolhe o tier
    fireEvent.click(screen.getByRole('button', { name: /ultravioleta/i }))
    // sheet fecha, sub aparece no card
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText('Ultravioleta')).toBeInTheDocument()
    // conclui salvando exatamente o item do tier escolhido
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith(['nu2']))
  })

  it('"Não tenho certeza" marca o tier mais completo como "A confirmar"', async () => {
    sourceResult.data = [multiTierGroup]
    renderWithProviders(<ManualWizard />)
    fireEvent.click(screen.getByRole('button', { name: /nubank/i }))
    fireEvent.click(screen.getByRole('button', { name: /não tenho certeza/i }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText(/a confirmar/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalledWith(['nu2']))
  })

  it('shows an unavailable-catalog state', () => {
    sourceResult.data = []
    renderWithProviders(<ManualWizard />)
    expect(screen.getByText(/nenhum programa disponível/i)).toBeInTheDocument()
  })

  it('mantém a seleção após falha ao salvar', async () => {
    sourceResult.data = [bankGroup]
    saveMutate.mockRejectedValueOnce(new Error('write failed'))
    renderWithProviders(<ManualWizard />)
    const item = screen.getByRole('button', { name: /itaú/i })
    fireEvent.click(item)
    fireEvent.click(screen.getByRole('button', { name: /concluir/i }))
    const error = await screen.findByRole('alert')
    expect(error).toHaveTextContent(/não foi possível salvar/i)
    expect(error).toHaveAttribute('aria-live', 'assertive')
    expect(item).toHaveAttribute('aria-pressed', 'true')
  })

  it('recovers a later step when retry returns a smaller catalog', () => {
    const view = renderWithProviders(<ManualWizard />)
    fireEvent.click(screen.getByRole('button', { name: /continuar/i }))
    expect(screen.getByRole('group', { name: /passo 2 de 2/i })).toBeInTheDocument()

    sourceResult = { ...sourceResult, data: undefined, error: new Error('down') }
    view.rerender(<ManualWizard />)
    expect(screen.getByText(/não foi possível carregar seus programas/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(refetchSources).toHaveBeenCalledTimes(1)

    sourceResult = { ...sourceResult, data: [bankGroup], error: null }
    view.rerender(<ManualWizard />)
    expect(screen.getByRole('group', { name: /passo 1 de 1/i })).toBeInTheDocument()
    expect(screen.getByText(/quais cartões você tem/i)).toBeInTheDocument()
  })
})
