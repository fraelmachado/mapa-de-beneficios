import { describe, it, expect, vi } from 'vitest'
const del = vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) }))
vi.mock('../../lib/supabase', () => ({ supabase: { from: () => ({ delete: del }) } }))
vi.mock('../../lib/queryClient', () => ({ queryClient: { invalidateQueries: vi.fn() } }))

import { deleteEvidence } from './useDisconnectGmail'

describe('deleteEvidence', () => {
  it('apaga evidência do próprio usuário', async () => {
    await deleteEvidence('u1')
    expect(del).toHaveBeenCalled()
  })
})
