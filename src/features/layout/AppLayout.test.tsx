import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { Route, Routes } from 'react-router-dom'
import { renderWithProviders } from '../../test/renderWithProviders'
import { AppLayout } from './AppLayout'

describe('AppLayout', () => {
  it('exposes the same destinations in sidebar and bottom navigation', () => {
    renderWithProviders(
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/painel" element={<h1>Painel teste</h1>} />
        </Route>
      </Routes>,
      { route: '/painel' },
    )

    expect(screen.getByRole('main')).toHaveTextContent('Painel teste')
    expect(screen.getAllByRole('link', { name: /painel/i })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: /buscar/i })).toHaveLength(2)
    expect(screen.getAllByRole('link', { name: /perfil/i })).toHaveLength(2)
    expect(screen.getAllByRole('navigation', { name: /principal/i })).toHaveLength(2)
  })
})
