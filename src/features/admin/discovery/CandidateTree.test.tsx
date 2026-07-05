import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CandidateTree } from './CandidateTree'
import type { DiscoveryCandidate } from './types'

const base = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate => ({
  id: 'x', job_id: 'j', entity_type: 'source', fingerprint: 'source|s', parent_fingerprint: null,
  payload: {}, provenance: {}, match_status: 'new', matched_id: null, review_status: 'pending',
  promoted_id: null, created_at: '', ...over,
})

const candidates: DiscoveryCandidate[] = [
  base({ id: 's1', entity_type: 'source', fingerprint: 'source|unimed', payload: { name: 'Unimed', slug: 'unimed' } }),
  base({ id: 'i1', entity_type: 'source_item', fingerprint: 'source_item|unimed|nacional',
         parent_fingerprint: 'source|unimed', payload: { label: 'Nacional' } }),
  base({ id: 'b1', entity_type: 'benefit', fingerprint: 'benefit|unimed-nacional|farmacia',
         parent_fingerprint: 'source_item|unimed|nacional', payload: { title: 'Farmácia' } }),
]

describe('CandidateTree', () => {
  it('renderiza a árvore source -> item -> benefit', () => {
    render(<CandidateTree candidates={candidates} onPromote={vi.fn()} onReject={vi.fn()} />)
    expect(screen.getByText('Unimed')).toBeInTheDocument()
    expect(screen.getByText('Nacional')).toBeInTheDocument()
    expect(screen.getByText('Farmácia')).toBeInTheDocument()
  })

  it('Aprovar chama onPromote com o id do candidato', () => {
    const onPromote = vi.fn()
    render(<CandidateTree candidates={candidates} onPromote={onPromote} onReject={vi.fn()} />)
    fireEvent.click(screen.getAllByRole('button', { name: /aprovar/i })[0])
    expect(onPromote).toHaveBeenCalledWith('s1')
  })

  it('esconde ações de um candidato já aprovado', () => {
    const approved = [base({ id: 's1', payload: { name: 'Unimed' }, review_status: 'approved' })]
    render(<CandidateTree candidates={approved} onPromote={vi.fn()} onReject={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /aprovar/i })).not.toBeInTheDocument()
  })
})
