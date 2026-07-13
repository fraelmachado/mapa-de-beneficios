import { describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { useNavigate } from 'react-router-dom'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.mock('./ManualWizard', () => ({ ManualWizard: () => <div>Wizard manual real</div> }))

import { OnboardingPage } from './OnboardingPage'
import { MethodStep } from './OnboardingIntro'

function RouteControls() {
  const navigate = useNavigate()

  return (
    <>
      <button type="button" onClick={() => navigate('/onboarding?mode=edit')}>
        Abrir edição
      </button>
      <button type="button" onClick={() => navigate('/onboarding')}>
        Sair da edição
      </button>
    </>
  )
}

describe('OnboardingPage flow', () => {
  it('goes from welcome to method and manual wizard', () => {
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' })

    expect(screen.getByRole('heading', { name: /benefícios esperando por você/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /mapear meus benefícios/i }))

    expect(screen.getByRole('heading', { name: /como quer encontrar seus benefícios/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /conectar gmail.*prévia/i })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: /adicionar manualmente/i }))

    expect(screen.getByText('Wizard manual real')).toBeInTheDocument()
  })

  it('opens manual wizard directly in edit mode', () => {
    renderWithProviders(<OnboardingPage />, { route: '/onboarding?mode=edit' })

    expect(screen.getByText('Wizard manual real')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mapear meus benefícios/i })).not.toBeInTheDocument()
  })

  it('synchronizes the screen when navigating between standard and edit URLs', () => {
    renderWithProviders(
      <>
        <RouteControls />
        <OnboardingPage />
      </>,
      { route: '/onboarding' },
    )

    expect(screen.getByRole('heading', { name: /benefícios esperando por você/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Abrir edição' }))

    expect(screen.getByText('Wizard manual real')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Sair da edição' }))

    expect(screen.getByRole('heading', { name: /benefícios esperando por você/i })).toBeInTheDocument()
  })

  it('MethodStep: card Gmail Prévia dispara onGmail', () => {
    const onGmail = vi.fn()
    renderWithProviders(<MethodStep onManual={() => {}} onGmail={onGmail} />, { route: '/onboarding' })
    const gmail = screen.getByRole('button', { name: /conectar gmail.*prévia/i })
    expect(gmail).toBeEnabled()
    fireEvent.click(gmail)
    expect(onGmail).toHaveBeenCalledTimes(1)
  })
})
