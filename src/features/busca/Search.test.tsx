import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { MyBenefit } from '../benefits/types'

vi.mock('../auth/AuthProvider', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}))

let result: { data: MyBenefit[] | undefined; isLoading: boolean; error: unknown }
vi.mock('../benefits/useMyBenefits', () => ({ useMyBenefits: () => result }))

const mk = (over: Partial<MyBenefit>): MyBenefit => ({
  id: 'x', title: 'T', summary: 'S', category: 'shopping', scope: 'nacional', uf: null,
  steps: null, partner_name: null, valid_until: null, image_url: null, action_url: null,
  action_label: null, created_at: '', via: [], ...over,
})

import { Search } from './Search'

beforeEach(() => {
  result = {
    data: [mk({ id: '1', title: 'Sala VIP', partner_name: 'Mastercard' }), mk({ id: '2', title: 'Cinema', partner_name: 'Cinemark' })],
    isLoading: false, error: null,
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
})
