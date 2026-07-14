import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDelete } from './ConfirmDelete'
describe('ConfirmDelete', () => {
  it('só confirma no botão Remover', () => {
    const onConfirm = vi.fn(); const onCancel = vi.fn()
    render(<ConfirmDelete open title="Remover item?" message="Remove também 2 variantes e 3 vínculos." onConfirm={onConfirm} onCancel={onCancel} />)
    expect(screen.getByText(/2 variantes e 3 vínculos/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i })); expect(onConfirm).not.toHaveBeenCalled(); expect(onCancel).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /^remover$/i })); expect(onConfirm).toHaveBeenCalledTimes(1)
  })
})
