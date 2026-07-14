import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

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
vi.mock('./useSourceCandidates', () => ({
  useCandidateSubtree: () => ({ data: [], isLoading: false }),
}))

import { AdminDiscovery } from './AdminDiscovery'

function renderDiscovery(initialEntries = ['/admin/discovery']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <AdminDiscovery />
    </MemoryRouter>,
  )
}

describe('AdminDiscovery', () => {
  beforeEach(() => vi.clearAllMocks())

  it('mostra header, jobs e status traduzido', () => {
    renderDiscovery()
    expect(screen.getByRole('heading', { name: 'Discovery' })).toBeInTheDocument()
    expect(screen.getByText('Wellhub')).toBeInTheDocument()
    expect(screen.getByText('concluído')).toBeInTheDocument()
    expect(screen.getByText('processando')).toBeInTheDocument()
  })

  it('enfileira novo job com o texto digitado', () => {
    renderDiscovery()
    fireEvent.change(screen.getByPlaceholderText('Novo job — ex.: Priority Pass, Wellhub…'), {
      target: { value: 'Alelo' },
    })
    fireEvent.click(screen.getByRole('button', { name: /enfileirar/i }))
    expect(createMutate).toHaveBeenCalledWith('Alelo', expect.anything())
  })

  it('com ?fp= mostra a subárvore do candidato em vez da fila de jobs', () => {
    renderDiscovery(['/admin/discovery?fp=fp1'])
    expect(screen.getByRole('heading', { name: 'Discovery' })).toBeInTheDocument()
    expect(screen.queryByText('Fila de jobs')).not.toBeInTheDocument()
  })
})
