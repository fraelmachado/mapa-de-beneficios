import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock }
})

let sessionValue: { session: unknown; loading: boolean }
vi.mock('../auth/AuthProvider', () => ({
  useSession: () => sessionValue,
}))

let hasOnboarded: { data: boolean | undefined; isLoading: boolean }
vi.mock('./useHasOnboarded', () => ({
  useHasOnboarded: () => hasOnboarded,
}))

import { BootstrapRoute } from './BootstrapRoute'

beforeEach(() => navigateMock.mockReset())

describe('BootstrapRoute', () => {
  it('manda pro onboarding quando não há seleção', async () => {
    sessionValue = { session: { user: { id: 'x' } }, loading: false }
    hasOnboarded = { data: false, isLoading: false }
    renderWithProviders(<BootstrapRoute />)
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/onboarding', { replace: true }))
  })

  it('manda pro painel quando já fez onboarding', async () => {
    sessionValue = { session: { user: { id: 'x' } }, loading: false }
    hasOnboarded = { data: true, isLoading: false }
    renderWithProviders(<BootstrapRoute />)
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/painel', { replace: true }))
  })

  it('mostra carregando enquanto a sessão inicializa', () => {
    sessionValue = { session: null, loading: true }
    hasOnboarded = { data: undefined, isLoading: true }
    renderWithProviders(<BootstrapRoute />)
    expect(screen.getByText(/preparando/i)).toBeInTheDocument()
  })
})
