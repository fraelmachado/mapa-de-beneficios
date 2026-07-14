import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { AdminSheet } from './AdminSheet'

describe('AdminSheet', () => {
  it('renderiza título (aria-labelledby) e conteúdo quando open', () => {
    render(<AdminSheet open title="Remover item?" onClose={() => {}}><p>corpo</p></AdminSheet>)
    const dialog = screen.getByRole('dialog', { hidden: true })
    expect(dialog).toHaveAttribute('aria-labelledby')
    expect(screen.getByText('corpo')).toBeInTheDocument()
  })
  it('clique no backdrop chama onClose uma vez (closeOnBackdrop)', () => {
    const onClose = vi.fn()
    const { container } = render(<AdminSheet open title="X" onClose={onClose}><p>c</p></AdminSheet>)
    fireEvent.click(container.querySelector('dialog')!) // target === dialog = backdrop
    expect(onClose).toHaveBeenCalledTimes(1)
  })
  it('não fecha no backdrop quando closeOnBackdrop=false', () => {
    const onClose = vi.fn()
    const { container } = render(<AdminSheet open title="X" onClose={onClose} closeOnBackdrop={false}><p>c</p></AdminSheet>)
    fireEvent.click(container.querySelector('dialog')!)
    expect(onClose).not.toHaveBeenCalled()
  })
})
