import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, act } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { MyBenefit } from '../benefits/types'

vi.mock('../auth/AuthProvider', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}))

let result: { data: MyBenefit[] | undefined; isLoading: boolean; error: unknown }
vi.mock('../benefits/useMyBenefits', () => ({
  useMyBenefits: () => result,
}))

const mk = (over: Partial<MyBenefit>): MyBenefit => ({
  id: 'x', title: 'T', summary: 'S', category: 'shopping', scope: 'nacional', uf: null,
  steps: null, partner_name: null, valid_until: null, image_url: null, action_url: null,
  action_label: null, created_at: '', via: [], ...over,
})

import { Painel } from './Painel'

beforeEach(() => {
  result = { data: undefined, isLoading: false, error: null }
})

describe('Painel', () => {
  it('mostra a contagem e o feed', () => {
    result = {
      data: [mk({ id: '1', title: 'Sala VIP', category: 'travel' }), mk({ id: '2', title: 'Cinema', category: 'experience' })],
      isLoading: false, error: null,
    }
    renderWithProviders(<Painel />)
    expect(screen.getByText(/2 benefícios ativos/i)).toBeInTheDocument()
    expect(screen.getByText('Sala VIP')).toBeInTheDocument()
    expect(screen.getByText('Cinema')).toBeInTheDocument()
  })

  it('filtra o feed ao escolher uma categoria', () => {
    result = {
      data: [mk({ id: '1', title: 'Sala VIP', category: 'travel' }), mk({ id: '2', title: 'Cinema', category: 'experience' })],
      isLoading: false, error: null,
    }
    renderWithProviders(<Painel />)
    act(() => { screen.getByRole('button', { name: /viagem/i }).click() })
    expect(screen.getByText('Sala VIP')).toBeInTheDocument()
    expect(screen.queryByText('Cinema')).not.toBeInTheDocument()
  })

  it('estado vazio quando não há benefícios', () => {
    result = { data: [], isLoading: false, error: null }
    renderWithProviders(<Painel />)
    expect(screen.getByText(/nenhum benefício/i)).toBeInTheDocument()
  })
})
