import { describe, it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.mock('../auth/AuthProvider', () => ({ useSession: () => ({ session: { user: { id: 'u1' } }, loading: false }) }))
const saveMutate = vi.fn()
vi.mock('./useSaveUserSources', () => ({ useSaveUserSources: () => ({ mutateAsync: saveMutate, isPending: false }) }))
let existing: { data: string[] | undefined; isLoading: boolean; error: unknown; refetch: () => void }
vi.mock('./useUserSources', () => ({ useUserSources: () => existing }))

import { RevisarGmail } from './RevisarGmail'
const findings = [
  { itemId: 'i1', provider: 'Nubank', variant: 'Ultravioleta' },
  { itemId: 'i2', provider: 'Itaú', variant: 'Black' },
]
beforeEach(() => {
  saveMutate.mockReset(); saveMutate.mockResolvedValue(undefined)
  existing = { data: [], isLoading: false, error: null, refetch: vi.fn() }
})

describe('RevisarGmail', () => {
  it('salva a união de existentes + incluídos e chama onDone com os incluídos', async () => {
    existing = { ...existing, data: ['x9'] }
    const onDone = vi.fn()
    renderWithProviders(<RevisarGmail findings={findings} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /adicionar ao radar/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalledTimes(1))
    expect([...saveMutate.mock.calls[0][0]].sort()).toEqual(['i1', 'i2', 'x9'])
    await waitFor(() => expect(onDone).toHaveBeenCalledWith(findings))
  })
  it('descartar um achado o remove do save e do onDone', async () => {
    const onDone = vi.fn()
    renderWithProviders(<RevisarGmail findings={findings} onDone={onDone} />)
    fireEvent.click(screen.getByRole('button', { name: /itaú black/i }))
    fireEvent.click(screen.getByRole('button', { name: /adicionar ao radar/i }))
    await waitFor(() => expect(saveMutate).toHaveBeenCalled())
    expect(saveMutate.mock.calls[0][0]).not.toContain('i2')
    expect(onDone).toHaveBeenCalledWith([findings[0]])
  })
  it('CTA desabilitada com 0 incluídos', () => {
    renderWithProviders(<RevisarGmail findings={findings} onDone={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /nubank ultravioleta/i }))
    fireEvent.click(screen.getByRole('button', { name: /itaú black/i }))
    expect(screen.getByRole('button', { name: /adicionar ao radar/i })).toBeDisabled()
  })
  it('CTA desabilitada enquanto existentes carregam', () => {
    existing = { ...existing, data: undefined, isLoading: true }
    renderWithProviders(<RevisarGmail findings={findings} onDone={vi.fn()} />)
    expect(screen.getByRole('button', { name: /adicionar ao radar/i })).toBeDisabled()
  })
  it('erro ao carregar existentes: alerta inline + retry, mantém as escolhas e não salva', () => {
    const refetch = vi.fn()
    existing = { data: undefined, isLoading: false, error: new Error('down'), refetch }
    renderWithProviders(<RevisarGmail findings={findings} onDone={vi.fn()} />)
    expect(screen.getByRole('button', { name: /nubank ultravioleta/i })).toBeInTheDocument() // lista preservada
    expect(screen.getByRole('alert')).toHaveTextContent(/não foi possível preparar/i)
    expect(screen.getByRole('button', { name: /adicionar ao radar/i })).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
    expect(saveMutate).not.toHaveBeenCalled()
  })
  it('mantém a seleção após falha no save', async () => {
    saveMutate.mockRejectedValueOnce(new Error('write'))
    renderWithProviders(<RevisarGmail findings={findings} onDone={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /adicionar ao radar/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível salvar/i)
    expect(screen.getByRole('button', { name: /nubank ultravioleta/i })).toHaveAttribute('aria-pressed', 'true')
  })
})
