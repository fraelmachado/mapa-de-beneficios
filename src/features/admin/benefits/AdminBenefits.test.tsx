import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderWithProviders'
import type { BenefitRow } from './types'
import type { SourceRow } from '../sources/types'

const del = vi.fn(() => Promise.resolve())
vi.mock('./useAdminBenefits', () => ({
  useAdminBenefits: () => ({ data: benefits, isLoading: false, error: null }),
  useSaveBenefit: () => ({ mutateAsync: vi.fn(() => Promise.resolve('b1')), isPending: false, error: null }),
  useDeleteBenefit: () => ({ mutateAsync: del, isPending: false }),
}))
vi.mock('./useBenefitSources', () => ({
  useSaveBenefitSources: () => ({ mutateAsync: vi.fn(() => Promise.resolve(undefined)), isPending: false }),
}))
vi.mock('./useBenefitLocations', () => ({
  useSaveBenefitLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteBenefitLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../sources/useAdminSources', () => ({
  useAdminSources: () => ({ data: [] as SourceRow[], isLoading: false, error: null }),
}))
vi.mock('../upload/ImageUpload', () => ({ ImageUpload: () => <div>upload</div> }))

let benefits: BenefitRow[]
import { AdminBenefits } from './AdminBenefits'

beforeEach(() => {
  del.mockClear()
  vi.setSystemTime(new Date('2026-07-14T12:00:00Z'))
  benefits = [
    {
      id: 'b1',
      title: 'Sala VIP',
      summary: 'Acesso à sala vip em aeroportos',
      category: 'airport',
      scope: 'nacional',
      uf: null,
      steps: null,
      partner_name: null,
      valid_until: null,
      image_url: null,
      action_url: null,
      action_label: null,
      active: true,
      benefit_source: 'issuer',
      created_at: new Date('2026-07-10T12:00:00Z').toISOString(), // 4 dias atrás — "novo"
      benefit_sources: [{ source_item_id: 'i1', source_items: { sources: { name: 'Nubank' } } }],
      benefit_locations: [],
    },
  ]
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AdminBenefits', () => {
  it('lista o benefício com título, badge "novo", origem e fonte', () => {
    renderWithProviders(<AdminBenefits />)
    expect(screen.getByText('Sala VIP')).toBeInTheDocument()
    expect(screen.getByText('novo')).toBeInTheDocument()
    expect(screen.getByText('Emissor')).toBeInTheDocument()
    expect(screen.getByText('Nubank')).toBeInTheDocument()
  })

  it('benefício com mais de 14 dias não mostra badge "novo"', () => {
    benefits[0].created_at = new Date('2026-01-01T00:00:00Z').toISOString()
    renderWithProviders(<AdminBenefits />)
    expect(screen.getByText('Sala VIP')).toBeInTheDocument()
    expect(screen.queryByText('novo')).not.toBeInTheDocument()
  })

  it('busca por título filtra a lista', () => {
    benefits.push({ ...benefits[0], id: 'b2', title: 'Cinema 50% off', benefit_sources: [] })
    renderWithProviders(<AdminBenefits />)
    expect(screen.getByText('Cinema 50% off')).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Buscar benefício'), { target: { value: 'cinema' } })
    expect(screen.queryByText('Sala VIP')).not.toBeInTheDocument()
    expect(screen.getByText('Cinema 50% off')).toBeInTheDocument()
  })

  it('Remover não deleta direto — abre ConfirmDelete; confirmar deleta', () => {
    renderWithProviders(<AdminBenefits />)
    fireEvent.click(screen.getByRole('button', { name: /remover sala vip/i }))
    expect(del).not.toHaveBeenCalled()
    expect(screen.getByText('Remover item?')).toBeInTheDocument()
    expect(screen.getByText('Remove também os locais e vínculos deste benefício.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^remover$/i }))
    expect(del).toHaveBeenCalledWith('b1')
  })
})
