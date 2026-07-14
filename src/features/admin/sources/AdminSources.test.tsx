import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const del = vi.fn(() => Promise.resolve())
vi.mock('./useAdminSources', () => ({
  useAdminSources: () => ({
    data: [{ id: 's1', name: 'Nubank', kind: 'card', source_category: 'bank_card', active: true, source_items: [] }],
    isLoading: false,
    error: null,
  }),
  useSaveSource: () => ({ mutateAsync: vi.fn(() => Promise.resolve('s1')), isPending: false }),
  useDeleteSource: () => ({ mutateAsync: del, isPending: false }),
}))
vi.mock('../discovery/useSourceCandidates', () => ({
  useSourceCandidates: () => ({ data: [], isLoading: false, error: null }),
}))

import { AdminSources } from './AdminSources'

beforeEach(() => del.mockClear())

describe('AdminSources — Ativos', () => {
  it('lista fontes na aba Ativos com pill de categoria', () => {
    render(
      <MemoryRouter>
        <AdminSources />
      </MemoryRouter>,
    )
    expect(screen.getByText('Nubank')).toBeInTheDocument()
    expect(screen.getByText(/bancos & cartões/i)).toBeInTheDocument()
  })

  it('Remover NÃO deleta direto — abre confirmação; confirmar deleta', () => {
    render(
      <MemoryRouter>
        <AdminSources />
      </MemoryRouter>,
    )
    fireEvent.click(screen.getByRole('button', { name: /remover nubank/i }))
    expect(del).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^remover$/i }))
    expect(del).toHaveBeenCalledWith('s1')
  })
})
