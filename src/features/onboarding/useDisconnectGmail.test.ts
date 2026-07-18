import { describe, it, expect, vi } from 'vitest'

const { eq, deleteObj, from } = vi.hoisted(() => {
  const eq = vi.fn(async () => ({ error: null }))
  const deleteObj = { delete: vi.fn(() => ({ eq })) }
  const from = vi.fn(() => deleteObj)
  return { eq, deleteObj, from }
})

vi.mock('../../lib/supabase', () => ({ supabase: { from } }))
vi.mock('../../lib/queryClient', () => ({ queryClient: { invalidateQueries: vi.fn() } }))

import { deleteEvidence } from './useDisconnectGmail'

describe('deleteEvidence', () => {
  it('apaga evidência do próprio usuário', async () => {
    await deleteEvidence('u1')
    expect(from).toHaveBeenCalledWith('source_evidence')
    expect(deleteObj.delete).toHaveBeenCalled()
    expect(eq).toHaveBeenCalledWith('user_id', 'u1')
  })
})
