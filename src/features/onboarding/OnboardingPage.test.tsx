import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.mock('./ManualWizard', () => ({ ManualWizard: () => <div>Wizard manual real</div> }))

import { OnboardingPage } from './OnboardingPage'

describe('OnboardingPage flow', () => {
  it('goes from welcome to method and manual wizard', () => {
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' })

    expect(screen.getByRole('heading', { name: /benefícios que você já tem/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /começar/i }))

    expect(screen.getByRole('heading', { name: /como você quer começar/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /gmail.*em breve/i })).toBeDisabled()

    fireEvent.click(screen.getByRole('button', { name: /adicionar manualmente/i }))

    expect(screen.getByText('Wizard manual real')).toBeInTheDocument()
  })

  it('opens manual wizard directly in edit mode', () => {
    renderWithProviders(<OnboardingPage />, { route: '/onboarding?mode=edit' })

    expect(screen.getByText('Wizard manual real')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /começar/i })).not.toBeInTheDocument()
  })
})
