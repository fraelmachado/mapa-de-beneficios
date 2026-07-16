import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { MyBenefit } from '../benefits/types'

vi.mock('../auth/AuthProvider', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}))

const refetch = vi.fn()
let result: { data: MyBenefit[] | undefined; isLoading: boolean; error: unknown; refetch: typeof refetch }
vi.mock('../benefits/useMyBenefits', () => ({ useMyBenefits: () => result }))

const mk = (over: Partial<MyBenefit>): MyBenefit => ({
  id: 'x', title: 'T', summary: 'S', category: 'shopping', scope: 'nacional', uf: null,
  steps: null, partner_name: null, valid_until: null, image_url: null, action_url: null,
  action_label: null, created_at: '', source_url: null, source_name: null, observed_at: null, benefit_source: null, estimated_value_brl: null, origins: [], networks: [], via: [], ...over,
})

import { Search } from './Search'

beforeEach(() => {
  refetch.mockReset()
  result = {
    data: [mk({ id: '1', title: 'Sala VIP', partner_name: 'Mastercard' }), mk({ id: '2', title: 'Cinema', partner_name: 'Cinemark' })],
    isLoading: false, error: null, refetch,
  }
})

describe('Search', () => {
  it('filtra ao digitar', () => {
    renderWithProviders(<Search />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'cine' } })
    expect(screen.getByText('Cinema')).toBeInTheDocument()
    expect(screen.queryByText('Sala VIP')).not.toBeInTheDocument()
  })

  it('mostra dica quando nada corresponde', () => {
    renderWithProviders(<Search />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } })
    expect(screen.getByText(/nada encontrado/i)).toBeInTheDocument()
  })

  it('clears an active text query', () => {
    renderWithProviders(<Search />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'cine' } })
    fireEvent.click(screen.getByRole('button', { name: /limpar busca/i }))
    expect(screen.getByRole('searchbox')).toHaveValue('')
    expect(screen.getByText('Sala VIP')).toBeInTheDocument()
  })

  it('shows result count', () => {
    renderWithProviders(<Search />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'cine' } })
    expect(screen.getByText(/1 resultado/i)).toBeInTheDocument()
  })

  it('retries a failed query', () => {
    result = { data: undefined, isLoading: false, error: new Error('down'), refetch }
    renderWithProviders(<Search />)
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })
})
