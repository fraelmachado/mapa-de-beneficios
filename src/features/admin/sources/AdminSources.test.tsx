import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../../test/renderWithProviders'
import type { SourceRow } from './types'

const saveSource = vi.fn()
vi.mock('./useAdminSources', () => ({
  useAdminSources: () => ({ data: sources, isLoading: false, error: null }),
  useSaveSource: () => ({ mutateAsync: saveSource, isPending: false }),
  useDeleteSource: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('./useSourceItems', () => ({
  useSaveSourceItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useDeleteSourceItem: () => ({ mutateAsync: vi.fn(), isPending: false }),
}))
vi.mock('../upload/ImageUpload', () => ({ ImageUpload: () => <div>upload</div> }))

let sources: SourceRow[]
import { AdminSources } from './AdminSources'

beforeEach(() => {
  saveSource.mockReset(); saveSource.mockResolvedValue('new-id')
  sources = [
    { id: 's1', kind: 'card', name: 'Itaú', logo_url: null, sort_order: 1, active: true,
      connector_type: null, pluggy_connector_id: null, institution_url: null, primary_color: null, country: 'BR',
      source_items: [] },
  ]
})

describe('AdminSources', () => {
  it('lista as fontes', () => {
    renderWithProviders(<AdminSources />)
    expect(screen.getByText('Itaú')).toBeInTheDocument()
  })

  it('abre o form de nova fonte e salva', async () => {
    renderWithProviders(<AdminSources />)
    fireEvent.click(screen.getByRole('button', { name: /nova fonte/i }))
    fireEvent.change(screen.getByLabelText(/nome/i), { target: { value: 'Nubank' } })
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))
    await waitFor(() => expect(saveSource).toHaveBeenCalledWith(expect.objectContaining({ name: 'Nubank' })))
  })
})
