import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { routes } from './router'

describe('infra', () => {
  it('expõe um QueryClient configurado', () => {
    expect(queryClient).toBeDefined()
    expect(queryClient.getDefaultOptions().queries?.retry).toBe(false)
  })
})

// Mocks dos hooks de dados usados por MeusProgramas (mesmo padrão de MeusProgramas.test.tsx),
// só que com paths relativos a este arquivo — necessários pra montar a rota sem bater na rede.
vi.mock('./features/auth/AuthProvider', () => ({ useSession: () => ({ session: { user: { id: 'u1' } } }) }))
vi.mock('./features/programas/useMyPrograms', () => ({
  useMyPrograms: () => ({
    programs: [],
    summary: { total: 0, gmailCount: 0, manualCount: 0, lastFound: '', account: '' },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}))
vi.mock('./features/onboarding/useUserSources', () => ({ useUserSources: () => ({ data: [] }) }))
vi.mock('./features/onboarding/useSaveUserSources', () => ({ useSaveUserSources: () => ({ mutateAsync: vi.fn() }) }))

describe('router', () => {
  it('registra /programas sob o AppLayout', () => {
    const memoryRouter = createMemoryRouter(routes, { initialEntries: ['/programas'] })
    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={memoryRouter} />
      </QueryClientProvider>,
    )

    expect(screen.getByRole('heading', { name: /programas/i })).toBeInTheDocument()
    expect(screen.getAllByRole('navigation', { name: /principal/i }).length).toBeGreaterThan(0)
  })
})
