import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useDiscoveryJobs } from './useDiscovery'

vi.mock('../../../lib/supabase', () => {
  const jobs = [{ id: 'j1', brief: 'Unimed', status: 'pending', created_at: '2026-07-01' }]
  return {
    supabase: {
      from: () => ({
        select: () => ({ order: () => Promise.resolve({ data: jobs, error: null }) }),
      }),
    },
  }
})

const wrapper = ({ children }: { children: ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useDiscoveryJobs', () => {
  beforeEach(() => vi.clearAllMocks())
  it('carrega a lista de jobs', async () => {
    const { result } = renderHook(() => useDiscoveryJobs(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(1)
    expect(result.current.data![0].brief).toBe('Unimed')
  })
})
