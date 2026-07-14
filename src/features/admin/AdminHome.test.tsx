import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
vi.mock('./sources/useAdminSources', () => ({ useAdminSources: () => ({ data: [{}, {}], isLoading: false, error: null }) }))
vi.mock('./discovery/useSourceCandidates', () => ({ useSourceCandidates: () => ({ data: [{}], isLoading: false, error: null }) }))
const recent = new Date('2026-07-10T00:00:00Z').toISOString()
const old = new Date('2026-06-01T00:00:00Z').toISOString()
vi.mock('./benefits/useAdminBenefits', () => ({ useAdminBenefits: () => ({ data: [{ created_at: recent }, { created_at: old }, { created_at: recent }], isLoading: false, error: null }) }))
import { AdminHome } from './AdminHome'
beforeEach(() => vi.setSystemTime(new Date('2026-07-14T00:00:00Z')))
afterEach(() => vi.useRealTimers())
describe('AdminHome', () => {
  it('mostra contagens reais e novos = created_at < 14 dias', () => {
    render(<MemoryRouter><AdminHome /></MemoryRouter>)
    expect(screen.getByText('Programas').previousSibling).toHaveTextContent('2')
    expect(screen.getByText('Benefícios').previousSibling).toHaveTextContent('3')
    expect(screen.getByText('Pendentes').previousSibling).toHaveTextContent('1')
    expect(screen.getByText('Novos').previousSibling).toHaveTextContent('2') // 2 recentes
  })
})
