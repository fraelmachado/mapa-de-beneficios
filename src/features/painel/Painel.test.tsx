import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, act, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { MyBenefit } from '../benefits/types'

vi.mock('../auth/AuthProvider', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}))

const refetch = vi.fn()
let result: { data: MyBenefit[] | undefined; isLoading: boolean; error: unknown; refetch: typeof refetch }
vi.mock('../benefits/useMyBenefits', () => ({
  useMyBenefits: () => result,
}))

const mk = (over: Partial<MyBenefit>): MyBenefit => ({
  id: 'x', title: 'T', summary: 'S', category: 'shopping', scope: 'nacional', uf: null,
  steps: null, partner_name: null, valid_until: null, image_url: null, action_url: null,
  action_label: null, created_at: '', source_url: null, source_name: null, observed_at: null, benefit_source: null, origins: [], networks: [], via: [], ...over,
})

import { Painel } from './Painel'

beforeEach(() => {
  refetch.mockReset()
  result = { data: undefined, isLoading: false, error: null, refetch }
})

describe('Painel', () => {
  it('mostra a contagem e o feed', () => {
    result = {
      data: [mk({ id: '1', title: 'Sala VIP', category: 'travel' }), mk({ id: '2', title: 'Cinema', category: 'experience' })],
      isLoading: false, error: null, refetch,
    }
    renderWithProviders(<Painel />)
    expect(screen.getByText(/2 benefícios ativos/i)).toBeInTheDocument()
    expect(screen.getByText('Sala VIP')).toBeInTheDocument()
    expect(screen.getByText('Cinema')).toBeInTheDocument()
  })

  it('filtra o feed ao escolher uma categoria', () => {
    result = {
      data: [mk({ id: '1', title: 'Sala VIP', category: 'travel' }), mk({ id: '2', title: 'Cinema', category: 'experience' })],
      isLoading: false, error: null, refetch,
    }
    renderWithProviders(<Painel />)
    act(() => { screen.getByRole('button', { name: /viagem/i }).click() })
    expect(screen.getByText('Sala VIP')).toBeInTheDocument()
    expect(screen.queryByText('Cinema')).not.toBeInTheDocument()
  })

  it('estado vazio quando não há benefícios', () => {
    result = { data: [], isLoading: false, error: null, refetch }
    renderWithProviders(<Painel />)
    expect(screen.getByText(/nenhum benefício/i)).toBeInTheDocument()
  })

  it('shows stable loading', () => {
    result = { data: undefined, isLoading: true, error: null, refetch }
    renderWithProviders(<Painel />)
    expect(screen.getByLabelText(/carregando seu radar/i)).toBeInTheDocument()
  })

  it('retries query error', () => {
    result = { data: undefined, isLoading: false, error: new Error('down'), refetch }
    renderWithProviders(<Painel />)
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('empty radar exposes manual setup and disabled Gmail', () => {
    result = { data: [], isLoading: false, error: null, refetch }
    renderWithProviders(<Painel />)
    expect(screen.getByRole('link', { name: /adicionar programas/i })).toHaveAttribute('href', '/onboarding?mode=edit')
    expect(screen.getByRole('button', { name: /gmail.*em breve/i })).toBeDisabled()
  })

  it('can clear a category with no results', () => {
    result = { data: [mk({ id: '1', title: 'Cinema', category: 'experience' })], isLoading: false, error: null, refetch }
    renderWithProviders(<Painel />)
    fireEvent.click(screen.getByRole('button', { name: /viagem/i }))
    fireEvent.click(screen.getByRole('button', { name: /limpar filtro/i }))
    expect(screen.getByText('Cinema')).toBeInTheDocument()
  })
})
