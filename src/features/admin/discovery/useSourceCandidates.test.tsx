import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const order = vi.fn()
const eqStatus = vi.fn(() => ({ order }))
const eqEntity = vi.fn(() => ({ eq: eqStatus }))
const select = vi.fn(() => ({ eq: eqEntity }))
vi.mock('../../../lib/supabase', () => ({ supabase: { from: () => ({ select }) } }))
import { useSourceCandidates } from './useSourceCandidates'

const wrap = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}
beforeEach(() => { order.mockReset(); eqStatus.mockClear(); eqEntity.mockClear(); select.mockClear() })

describe('useSourceCandidates', () => {
  it('filtra entity_type=source + review_status, ordenado por created_at', async () => {
    order.mockResolvedValue({ data: [{ id: 'c1' }], error: null })
    const { result } = renderHook(() => useSourceCandidates('pending'), { wrapper: wrap() })
    await waitFor(() => expect(result.current.data).toHaveLength(1))
    expect(select).toHaveBeenCalledWith('*')
    expect(eqEntity).toHaveBeenCalledWith('entity_type', 'source')
    expect(eqStatus).toHaveBeenCalledWith('review_status', 'pending')
  })
})
