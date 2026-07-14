import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
const reject = vi.fn(); const reconsider = vi.fn(); const navigate = vi.fn()
vi.mock('react-router-dom', async (o) => ({ ...(await o<any>()), useNavigate: () => navigate }))
vi.mock('./useAdminSources', () => ({ useAdminSources: () => ({ data: [], isLoading: false, error: null }), useSaveSource: () => ({ mutateAsync: vi.fn(), isPending: false }), useDeleteSource: () => ({ mutateAsync: vi.fn(), isPending: false }) }))
const pendRow = { id: 'c1', fingerprint: 'fp1', entity_type: 'source', review_status: 'pending', rejection_reason: null, provenance: { source_url: 'https://nubank.com.br' }, payload: { name: 'Nubank' }, created_at: new Date().toISOString() }
vi.mock('../discovery/useSourceCandidates', () => ({
  useSourceCandidates: (s: string) => ({ data: s === 'pending' ? [pendRow] : [{ ...pendRow, review_status: 'rejected', rejection_reason: 'fora de escopo' }], isLoading: false, error: null }),
  useCandidateSubtree: () => ({ data: [], isLoading: false }),
}))
vi.mock('../discovery/useDiscovery', () => ({ useRejectCandidate: () => ({ mutate: reject }), useReconsiderCandidate: () => ({ mutate: reconsider }) }))
import { AdminSources } from './AdminSources'
beforeEach(() => { reject.mockClear(); reconsider.mockClear(); navigate.mockClear() })
describe('AdminSources — discovery', () => {
  it('Pendentes: Revisar navega ao cascade por fingerprint', () => {
    render(<MemoryRouter><AdminSources /></MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: /pendentes/i }))
    expect(screen.getByText('Nubank')).toBeInTheDocument()
    expect(screen.getByText(/nubank\.com\.br/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /revisar/i }))
    expect(navigate).toHaveBeenCalledWith('/admin/discovery?fp=fp1')
  })
  it('Rejeitar grava motivo; Reconsiderar na aba Rejeitados', () => {
    render(<MemoryRouter><AdminSources /></MemoryRouter>)
    fireEvent.click(screen.getByRole('tab', { name: /pendentes/i }))
    fireEvent.click(screen.getByRole('button', { name: /rejeitar/i }))
    fireEvent.change(screen.getByRole('textbox', { name: /motivo/i }), { target: { value: 'spam' } })
    fireEvent.click(screen.getByRole('button', { name: /confirmar rejei/i }))
    expect(reject).toHaveBeenCalledWith({ candidateId: 'c1', reason: 'spam' })

    fireEvent.click(screen.getByRole('tab', { name: /rejeitados/i }))
    expect(screen.getByText('fora de escopo')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /reconsiderar/i }))
    expect(reconsider).toHaveBeenCalledWith({ candidateId: 'c1' })
  })
})
