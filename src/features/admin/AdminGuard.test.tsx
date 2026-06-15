import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'

let sessionValue: { session: unknown; loading: boolean }
vi.mock('../auth/AuthProvider', () => ({ useSession: () => sessionValue }))

let adminResult: { data: boolean | undefined; isLoading: boolean; error: unknown }
vi.mock('./useIsAdmin', () => ({ useIsAdmin: () => adminResult }))

const navigateMock = vi.fn()
vi.mock('react-router-dom', async (orig) => {
  const actual = await orig<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => navigateMock, Outlet: () => <div>conteúdo-admin</div> }
})

import { AdminGuard } from './AdminGuard'

beforeEach(() => navigateMock.mockReset())

describe('AdminGuard', () => {
  it('admin vê o conteúdo', () => {
    sessionValue = { session: { user: { id: 'a' } }, loading: false }
    adminResult = { data: true, isLoading: false, error: null }
    renderWithProviders(<AdminGuard />)
    expect(screen.getByText('conteúdo-admin')).toBeInTheDocument()
  })

  it('não-admin é redirecionado pro login', async () => {
    sessionValue = { session: { user: { id: 'a' } }, loading: false }
    adminResult = { data: false, isLoading: false, error: null }
    renderWithProviders(<AdminGuard />)
    expect(navigateMock).toHaveBeenCalledWith('/admin/login', { replace: true })
  })

  it('mostra carregando enquanto verifica', () => {
    sessionValue = { session: { user: { id: 'a' } }, loading: false }
    adminResult = { data: undefined, isLoading: true, error: null }
    renderWithProviders(<AdminGuard />)
    expect(screen.getByText(/verificando acesso/i)).toBeInTheDocument()
  })
})
