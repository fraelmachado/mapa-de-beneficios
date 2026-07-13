import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.mock('./ManualWizard', () => ({ ManualWizard: () => <div>Wizard manual real</div> }))

let sourcesResult: { data: unknown; isLoading: boolean; error: unknown; refetch: () => void }
vi.mock('./useSources', () => ({ useSources: () => sourcesResult }))
vi.mock('./Vasculhando', () => ({ Vasculhando: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>ver meus benefícios</button> }))
vi.mock('./RevisarGmail', () => ({ RevisarGmail: ({ onDone }: { onDone: (i: unknown[]) => void }) => <button onClick={() => onDone([{ itemId: 'i1', provider: 'Nubank', variant: 'Ultravioleta' }])}>adicionar ao radar</button> }))
vi.mock('./RadarMontado', () => ({ RadarMontado: ({ onView }: { onView: () => void }) => <button onClick={onView}>ver meu radar</button> }))

import { OnboardingPage } from './OnboardingPage'
import { MethodStep } from './OnboardingIntro'

beforeEach(() => {
  sourcesResult = {
    data: [{ category: 'bank_card', meta: { key: 'bank_card', label: 'Bancos & cartões', icon: '🏦' },
      sources: [{ id: 's1', kind: 'card', name: 'Nubank', logo_url: null, sort_order: 1, source_category: 'bank_card', source_items: [{ id: 'i1', label: 'Ultravioleta', sort_order: 1 }] }] }],
    isLoading: false, error: null, refetch: vi.fn(),
  }
})

// Sonda de rota: navegação real (MemoryRouter) — evita mockar useNavigate, que
// quebraria o teste de sincronização de URL (RouteControls) abaixo.
function LocationProbe() {
  const loc = useLocation()
  return <div data-testid="loc">{loc.pathname + loc.search}</div>
}

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

  it('caminho Gmail: método → scan → revisar → radar montado → alertas', () => {
    renderWithProviders(<><LocationProbe /><OnboardingPage /></>, { route: '/onboarding' })
    fireEvent.click(screen.getByRole('button', { name: /mapear meus benefícios/i }))
    fireEvent.click(screen.getByRole('button', { name: /conectar gmail.*prévia/i }))
    fireEvent.click(screen.getByRole('button', { name: /ver meus benefícios/i }))
    fireEvent.click(screen.getByRole('button', { name: /adicionar ao radar/i }))
    fireEvent.click(screen.getByRole('button', { name: /ver meu radar/i }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/alertas?from=onboarding')
  })

  it('catálogo vazio no Gmail cai no wizard manual (D4)', () => {
    sourcesResult = { ...sourcesResult, data: [] }
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' })
    fireEvent.click(screen.getByRole('button', { name: /mapear meus benefícios/i }))
    fireEvent.click(screen.getByRole('button', { name: /conectar gmail.*prévia/i }))
    expect(screen.getByText('Wizard manual real')).toBeInTheDocument() // mock do ManualWizard
  })

  it('erro no catálogo não bloqueia o caminho manual', () => {
    sourcesResult = { ...sourcesResult, data: undefined, error: new Error('down') }
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' })
    fireEvent.click(screen.getByRole('button', { name: /mapear meus benefícios/i }))
    fireEvent.click(screen.getByRole('button', { name: /adicionar manualmente/i }))
    expect(screen.getByText('Wizard manual real')).toBeInTheDocument()
  })

  it('erro no catálogo ao entrar no Gmail: mostra retry e chama refetch', () => {
    const refetch = vi.fn()
    sourcesResult = { ...sourcesResult, data: undefined, error: new Error('down'), refetch }
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' })
    fireEvent.click(screen.getByRole('button', { name: /mapear meus benefícios/i }))
    fireEvent.click(screen.getByRole('button', { name: /conectar gmail.*prévia/i }))
    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }))
    expect(refetch).toHaveBeenCalledTimes(1)
  })
})
