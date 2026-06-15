import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'

// Quando true, o sign-in anônimo rejeita. A rejeição é criada dentro da
// implementação base do vi.fn (e não via mockRejectedValue/mockImplementation)
// para evitar que o Vitest reporte a rejeição tratada como erro do teste.
let signInShouldFail = false
const ensureMock = vi.fn(() =>
  signInShouldFail
    ? Promise.reject(new Error('falhou'))
    : Promise.resolve({ user: { id: 'x' } }),
)
vi.mock('./auth', () => ({ ensureAnonymousSession: () => ensureMock() }))

let authCb: ((event: string, session: unknown) => void) | undefined
vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: (cb: (e: string, s: unknown) => void) => {
        authCb = cb
        return { data: { subscription: { unsubscribe: () => {} } } }
      },
    },
  },
}))

import { AuthProvider } from './AuthProvider'

beforeEach(() => {
  signInShouldFail = false
  ensureMock.mockClear()
  authCb = undefined
})

describe('AuthProvider', () => {
  it('mostra loading até a sessão resolver e então renderiza os filhos', async () => {
    let resolve!: (v: { user: { id: string } }) => void
    ensureMock.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    render(<AuthProvider><div>conteúdo</div></AuthProvider>)
    expect(screen.getByText(/preparando/i)).toBeInTheDocument()
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument()
    resolve({ user: { id: 'x' } })
    await waitFor(() => expect(screen.getByText('conteúdo')).toBeInTheDocument())
  })

  it('mostra erro com retry quando o sign-in anônimo falha', async () => {
    signInShouldFail = true
    render(<AuthProvider><div>conteúdo</div></AuthProvider>)
    await waitFor(() => expect(screen.getByText(/não foi possível conectar/i)).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /tentar de novo/i })).toBeInTheDocument()
    expect(screen.queryByText('conteúdo')).not.toBeInTheDocument()
  })

  it('recria sessão anônima após logout (não cai na tela de erro)', async () => {
    ensureMock.mockResolvedValue({ user: { id: 'anon1' } })
    render(<AuthProvider><div>conteúdo</div></AuthProvider>)
    await waitFor(() => expect(screen.getByText('conteúdo')).toBeInTheDocument())

    ensureMock.mockResolvedValue({ user: { id: 'anon2' } })
    await act(async () => {
      authCb?.('SIGNED_OUT', null)
    })

    expect(screen.queryByText(/não foi possível conectar/i)).not.toBeInTheDocument()
    await waitFor(() => expect(screen.getByText('conteúdo')).toBeInTheDocument())
    expect(ensureMock).toHaveBeenCalledTimes(2)
  })

  it('não cria sessão anônima extra no INITIAL_SESSION nulo do load', async () => {
    ensureMock.mockResolvedValue({ user: { id: 'anon1' } })
    render(<AuthProvider><div>conteúdo</div></AuthProvider>)
    await waitFor(() => expect(screen.getByText('conteúdo')).toBeInTheDocument())
    await act(async () => {
      authCb?.('INITIAL_SESSION', null)
    })
    expect(ensureMock).toHaveBeenCalledTimes(1) // só o do mount, sem extra
  })
})
