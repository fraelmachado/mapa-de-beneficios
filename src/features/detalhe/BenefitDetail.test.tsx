import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { MyBenefit } from '../benefits/types'

vi.mock('../auth/AuthProvider', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}))
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>()
  return { ...actual, useParams: () => ({ id: 'b1' }) }
})

let result: { data: MyBenefit[] | undefined; isLoading: boolean; error: unknown }
vi.mock('../benefits/useMyBenefits', () => ({ useMyBenefits: () => result }))

const b: MyBenefit = {
  id: 'b1', title: 'Seguro Viagem', summary: 'Cobertura internacional', category: 'travel',
  scope: 'nacional', uf: null, steps: '1. Emita a apólice\n2. Apresente o bilhete',
  partner_name: 'C6', valid_until: null, image_url: null, action_url: 'https://x.test',
  action_label: 'Emitir', created_at: '', via: ['Carbon'],
}

import { BenefitDetail } from './BenefitDetail'

beforeEach(() => {
  result = { data: [b], isLoading: false, error: null }
})

describe('BenefitDetail', () => {
  it('mostra título, via, passos e o botão de ação', () => {
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    expect(screen.getByText('Seguro Viagem')).toBeInTheDocument()
    expect(screen.getByText(/Carbon/)).toBeInTheDocument()
    expect(screen.getByText(/Emita a apólice/)).toBeInTheDocument()
    const action = screen.getByRole('link', { name: /emitir/i })
    expect(action).toHaveAttribute('href', 'https://x.test')
  })

  it('mostra "não encontrado" quando o id não está na lista', () => {
    result = { data: [], isLoading: false, error: null }
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    expect(screen.getByText(/não encontrado/i)).toBeInTheDocument()
  })

  it('não renderiza ação com esquema perigoso (javascript:)', () => {
    const evil = { ...b, action_url: 'javascript:alert(1)', action_label: 'Clique' }
    result = { data: [evil], isLoading: false, error: null }
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    expect(screen.queryByRole('link', { name: /clique/i })).not.toBeInTheDocument()
  })
})
