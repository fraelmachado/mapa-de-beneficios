import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AdminNav } from './AdminNav'
describe('AdminNav', () => {
  it('ativo por rota + badge de pendentes no item Programas', () => {
    render(<MemoryRouter initialEntries={['/admin/sources']}><AdminNav pendingCount={3} /></MemoryRouter>)
    expect(screen.getByRole('link', { name: /programas/i })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /painel/i })).toHaveAttribute('href', '/admin')
    expect(screen.getByText('3')).toBeInTheDocument()
  })
})
