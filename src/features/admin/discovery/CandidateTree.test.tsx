import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CandidateTree } from './CandidateTree'
import type { DiscoveryCandidate } from './types'

const base = (over: Partial<DiscoveryCandidate>): DiscoveryCandidate => ({
  id: 'x', job_id: 'j', entity_type: 'source', fingerprint: 'fp', parent_fingerprint: null,
  payload: {}, provenance: {}, match_status: 'new', matched_id: null, review_status: 'pending',
  promoted_id: null, created_at: '', ...over,
})

const tree: DiscoveryCandidate[] = [
  base({
    id: 's1',
    entity_type: 'source',
    fingerprint: 'source|wellhub',
    payload: { name: 'Wellhub', source_category: 'corporate_benefits' },
    provenance: { source_url: 'https://wellhub.com', verification_status: 'official_confirmed' },
  }),
  base({
    id: 'i1',
    entity_type: 'source_item',
    fingerprint: 'si|wellhub|empresas',
    parent_fingerprint: 'source|wellhub',
    payload: { label: 'Wellhub para empresas' },
  }),
  base({
    id: 'b1',
    entity_type: 'benefit',
    fingerprint: 'b|empresas|academia',
    parent_fingerprint: 'si|wellhub|empresas',
    payload: { title: 'Acesso a academias', category: 'other', summary: 'Rede de locais parceiros.' },
    provenance: { source_url: 'https://wellhub.com/academias' },
  }),
]

describe('CandidateTree', () => {
  it('renderiza a árvore Programa -> Variante -> Benefício com labels certos', () => {
    render(<CandidateTree candidates={tree} onPromote={vi.fn()} onReject={vi.fn()} />)
    expect(screen.getByText('Wellhub')).toBeInTheDocument()
    expect(screen.getByText('Wellhub para empresas')).toBeInTheDocument()
    expect(screen.getByText('Acesso a academias')).toBeInTheDocument()
    expect(screen.getByText('Multibenefícios')).toBeInTheDocument()
    expect(screen.getByText('Outros')).toBeInTheDocument()
    expect(screen.getByText(/oficial confirmado/i)).toBeInTheDocument()
  })

  it('Aprovar o Programa chama onPromote com o id da source', () => {
    const onPromote = vi.fn()
    render(<CandidateTree candidates={tree} onPromote={onPromote} onReject={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /aprovar programa/i }))
    expect(onPromote).toHaveBeenCalledWith('s1')
  })

  it('trava top-down: Aprovar da variante fica desabilitado enquanto a source está pendente', () => {
    render(<CandidateTree candidates={tree} onPromote={vi.fn()} onReject={vi.fn()} />)
    const variantApprove = screen.getAllByRole('button', { name: /^aprovar$/i })
    expect(variantApprove.length).toBeGreaterThan(0)
    expect(variantApprove.every((b) => (b as HTMLButtonElement).disabled)).toBe(true)
    expect(screen.getAllByText(/aprove o programa primeiro/i).length).toBeGreaterThan(0)
  })

  it('destrava a variante quando a source está aprovada; e esconde ações da source aprovada', () => {
    const approved = tree.map((c) => (c.id === 's1' ? { ...c, review_status: 'approved' as const } : c))
    render(<CandidateTree candidates={approved} onPromote={vi.fn()} onReject={vi.fn()} />)
    expect(screen.queryByRole('button', { name: /aprovar programa/i })).not.toBeInTheDocument()
    expect(screen.getByText('aprovado')).toBeInTheDocument()
    const variantApprove = screen.getByRole('button', { name: /^aprovar$/i })
    expect((variantApprove as HTMLButtonElement).disabled).toBe(false)
  })
})
