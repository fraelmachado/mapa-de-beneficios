// src/features/programas/useSourceEvidence.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

const rows = [{ source_id: 's1', email_from: 'a@nubank.com.br', email_date: '2026-07-01T00:00:00Z', created_at: '2026-07-16T00:00:00Z', gmail_account: 'me@gmail.com' }]
const select = vi.fn(async () => ({ data: rows, error: null }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ select }) } }))

import { useSourceEvidence } from './useSourceEvidence'

const wrap = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('useSourceEvidence', () => {
  it('lê as evidências e seleciona os campos certos', async () => {
    const { result } = renderHook(() => useSourceEvidence('u1'), { wrapper: wrap() })
    await waitFor(() => expect(result.current.data).toBeDefined())
    expect(result.current.data![0].source_id).toBe('s1')
    expect(select).toHaveBeenCalledWith('source_id, email_from, email_date, created_at, gmail_account')
  })
})
