import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CategoryChips } from './CategoryChips'

describe('CategoryChips', () => {
  it('renderiza "Todos" + categorias e dispara onChange', () => {
    const onChange = vi.fn()
    render(<CategoryChips selected={null} onChange={onChange} />)
    expect(screen.getByRole('button', { name: /todos/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /viagem/i }))
    expect(onChange).toHaveBeenCalledWith('travel')
  })

  it('clicar na categoria já selecionada limpa (volta a null)', () => {
    const onChange = vi.fn()
    render(<CategoryChips selected={'travel'} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: /viagem/i }))
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('renderiza o chip de aeroporto e o "Todos"', () => {
    render(<CategoryChips selected={null} onChange={() => {}} />)
    expect(screen.getByText('Todos')).toBeInTheDocument()
    expect(screen.getByText(/Aeroporto/)).toBeInTheDocument()
  })
})
