import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

const createMutate = vi.fn()
const jobs = [
  { id: 'j1', brief: 'Wellhub', status: 'done', error: null, created_at: '' },
  { id: 'j2', brief: 'Priority Pass', status: 'processing', error: null, created_at: '' },
]

vi.mock('./useDiscovery', () => ({
  useDiscoveryJobs: () => ({ data: jobs, isLoading: false }),
  useCreateJob: () => ({ mutate: createMutate, isPending: false }),
  useJobCandidates: () => ({ data: [], isLoading: false }),
  usePromoteCandidate: () => ({ mutate: vi.fn() }),
  useRejectCandidate: () => ({ mutate: vi.fn() }),
}))

import { AdminDiscovery } from './AdminDiscovery'

describe('AdminDiscovery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mostra header, jobs e status traduzido', () => {
    render(<AdminDiscovery />)
    expect(screen.getByRole('heading', { name: 'Discovery' })).toBeInTheDocument()
    expect(screen.getByText('Wellhub')).toBeInTheDocument()
    expect(screen.getByText('concluído')).toBeInTheDocument()
    expect(screen.getByText('processando')).toBeInTheDocument()
  })

  it('enfileira novo job com o texto digitado', () => {
    render(<AdminDiscovery />)
    fireEvent.change(screen.getByPlaceholderText('Novo job — ex.: Priority Pass, Wellhub…'), {
      target: { value: 'Alelo' },
    })
    fireEvent.click(screen.getByRole('button', { name: /enfileirar/i }))
    expect(createMutate).toHaveBeenCalledWith('Alelo', expect.anything())
  })
})
