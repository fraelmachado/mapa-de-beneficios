import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import type { MyBenefit } from '../benefits/types'

vi.mock('../auth/AuthProvider', () => ({
  useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }),
}))
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>()
  return { ...actual, useParams: () => ({ id: 'b1' }) }
})

const refetch = vi.fn()
let result: { data: MyBenefit[] | undefined; isLoading: boolean; error: unknown; refetch: typeof refetch }
vi.mock('../benefits/useMyBenefits', () => ({ useMyBenefits: () => result }))

const b: MyBenefit = {
  id: 'b1', title: 'Seguro Viagem', summary: 'Cobertura internacional', category: 'travel',
  scope: 'nacional', uf: null, steps: '1. Emita a apólice\n2. Apresente o bilhete',
  partner_name: 'C6', valid_until: null, image_url: null, action_url: 'https://x.test',
  action_label: 'Emitir', created_at: '', source_url: null, source_name: null, observed_at: null, benefit_source: null, origins: [], networks: [], via: ['Carbon'],
}

import { BenefitDetail } from './BenefitDetail'

beforeEach(() => {
  refetch.mockReset()
  result = { data: [b], isLoading: false, error: null, refetch }
})

describe('BenefitDetail', () => {
  it('renders stable detail loading', () => {
    result = { data: undefined, isLoading: true, error: null, refetch }
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    expect(screen.getByLabelText(/carregando benefício/i)).toBeInTheDocument()
  })

  it('retries detail error', () => {
    result = { data: undefined, isLoading: false, error: new Error('down'), refetch }
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('mostra título, via, passos e o botão de ação', () => {
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    expect(screen.getByText('Seguro Viagem')).toBeInTheDocument()
    expect(screen.getByText(/Carbon/)).toBeInTheDocument()
    expect(screen.getByText(/Emita a apólice/)).toBeInTheDocument()
    const action = screen.getByRole('link', { name: /emitir/i })
    expect(action).toHaveAttribute('href', 'https://x.test')
  })

  it('mostra "não encontrado" quando o id não está na lista', () => {
    result = { data: [], isLoading: false, error: null, refetch }
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    expect(screen.getByText(/não encontrado/i)).toBeInTheDocument()
  })

  it('não renderiza ação com esquema perigoso (javascript:)', () => {
    const evil = { ...b, action_url: 'javascript:alert(1)', action_label: 'Clique' }
    result = { data: [evil], isLoading: false, error: null, refetch }
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    expect(screen.queryByRole('link', { name: /clique/i })).not.toBeInTheDocument()
  })

  it('mostra a fonte oficial (nome) e a data de coleta', () => {
    const withSource: MyBenefit = {
      ...b, source_url: 'https://www.visa.com.br/beneficios', source_name: 'Visa Brasil',
      observed_at: '2026-06-15',
    }
    result = { data: [withSource], isLoading: false, error: null, refetch }
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    const src = screen.getByRole('link', { name: /visa brasil/i })
    expect(src).toHaveAttribute('href', 'https://www.visa.com.br/beneficios')
    expect(screen.getByText(/coletadas em/i)).toBeInTheDocument()
    expect(screen.getByText(/15\/06\/2026/)).toBeInTheDocument()
  })

  it('oculta o bloco de fonte quando não há source_url', () => {
    result = { data: [{ ...b, source_url: null, source_name: null, observed_at: null }], isLoading: false, error: null, refetch }
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    expect(screen.queryByText(/coletadas em/i)).not.toBeInTheDocument()
  })

  it('lista "Da mesma fonte" com correlatos e linka para o detalhe', () => {
    const cur: MyBenefit = { ...b, id: 'b1', source_url: 'https://visa.com/x' }
    const sib: MyBenefit = { ...b, id: 'b2', title: 'Outro Visa', source_url: 'https://visa.com/x' }
    const other: MyBenefit = { ...b, id: 'b3', title: 'Mastercard X', source_url: 'https://mc.com/y' }
    result = { data: [cur, sib, other], isLoading: false, error: null, refetch }
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    const link = screen.getByRole('link', { name: /outro visa/i })
    expect(link).toHaveAttribute('href', '/beneficio/b2')
    expect(screen.queryByRole('link', { name: /mastercard x/i })).not.toBeInTheDocument()
  })

  it('não renderiza fonte com esquema perigoso (javascript:) em source_url', () => {
    result = {
      data: [{ ...b, source_url: 'javascript:alert(1)', source_name: 'Mau', observed_at: '2026-06-15' }],
      isLoading: false, error: null, refetch,
    }
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    expect(screen.queryByRole('link', { name: /mau/i })).not.toBeInTheDocument()
    expect(screen.queryByText(/coletadas em/i)).not.toBeInTheDocument()
  })

  it('não mostra "Da mesma fonte" quando não há outros benefícios da mesma fonte', () => {
    result = {
      data: [{ ...b, id: 'b1', source_url: 'https://only.test/x', source_name: 'Única' }],
      isLoading: false, error: null, refetch,
    }
    renderWithProviders(<BenefitDetail />, { route: '/beneficio/b1' })
    expect(screen.queryByText(/da mesma fonte/i)).not.toBeInTheDocument()
  })
})
