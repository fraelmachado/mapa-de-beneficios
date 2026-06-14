import { describe, it, expect } from 'vitest'
import { queryClient } from './lib/queryClient'

describe('infra', () => {
  it('expõe um QueryClient configurado', () => {
    expect(queryClient).toBeDefined()
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(false)
  })
})
