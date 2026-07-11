import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { PageState } from './PageState'

describe('PageState', () => {
  it('renders heading, description and recovery action', () => {
    const retry = vi.fn()

    render(
      <PageState
        title="Nao foi possivel carregar"
        description="Confira sua conexao."
        action={{ label: 'Tentar novamente', onClick: retry }}
      />,
    )

    expect(screen.getByRole('heading', { name: /nao foi possivel carregar/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})
