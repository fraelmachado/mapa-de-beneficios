import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderWithProviders'
import type { BenefitRow } from './types'
import type { SourceRow } from '../sources/types'

const saveBenefit = vi.fn()
const saveBenefitSources = vi.fn()
vi.mock('./useAdminBenefits', () => ({
  useAdminBenefits: () => ({ data: benefits, isLoading: false, error: null }),
  useSaveBenefit: () => ({ mutateAsync: saveBenefit, isPending: false }),
  useDeleteBenefit: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('./useBenefitSources', () => ({
  useSaveBenefitSources: () => ({ mutateAsync: saveBenefitSources, isPending: false }),
}))
vi.mock('./useBenefitLocations', () => ({
  useSaveBenefitLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteBenefitLocation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../sources/useAdminSources', () => ({
  useAdminSources: () => ({ data: srcs, isLoading: false, error: null }),
}))
vi.mock('../upload/ImageUpload', () => ({ ImageUpload: () => <div>upload</div> }))

let benefits: BenefitRow[]
let srcs: SourceRow[]
import { AdminBenefits } from './AdminBenefits'

beforeEach(() => {
  saveBenefit.mockReset(); saveBenefit.mockResolvedValue('new-id')
  saveBenefitSources.mockReset(); saveBenefitSources.mockResolvedValue(undefined)
  srcs = []
  benefits = [
    { id: 'b1', title: 'Sala VIP', summary: 's', category: 'travel', scope: 'pontual', uf: null, steps: null,
      partner_name: null, valid_until: null, image_url: null, action_url: null, action_label: null, active: true,
      benefit_source: null, created_at: new Date().toISOString(),
      benefit_sources: [], benefit_locations: [] },
  ]
})

describe('AdminBenefits', () => {
  it('lista os benefícios', () => {
    renderWithProviders(<AdminBenefits />)
    expect(screen.getByText('Sala VIP')).toBeInTheDocument()
  })

  it('cria novo benefício: salva e grava o vínculo', async () => {
    renderWithProviders(<AdminBenefits />)
    fireEvent.click(screen.getByRole('button', { name: /novo benefício/i }))
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Cinema' } })
    fireEvent.change(screen.getByLabelText(/resumo/i), { target: { value: '50%' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => expect(saveBenefit).toHaveBeenCalledWith(expect.objectContaining({ title: 'Cinema' })))
    await waitFor(() => expect(saveBenefitSources).toHaveBeenCalledWith({ benefitId: 'new-id', sourceItemIds: [] }))
  })
})
