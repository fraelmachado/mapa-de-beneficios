import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import { BottomNav } from './BottomNav'

describe('BottomNav', () => {
  it('tem links para Painel, Buscar, Programas e Perfil', () => {
    renderWithProviders(<BottomNav />, { route: '/painel' })
    expect(screen.getByRole('link', { name: /painel/i })).toHaveAttribute('href', '/painel')
    expect(screen.getByRole('link', { name: /buscar/i })).toHaveAttribute('href', '/buscar')
    expect(screen.getByRole('link', { name: /programas/i })).toHaveAttribute('href', '/onboarding?mode=edit')
    expect(screen.getByRole('link', { name: /perfil/i })).toHaveAttribute('href', '/perfil')
  })
})
