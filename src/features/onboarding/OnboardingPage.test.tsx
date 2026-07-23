import { describe, expect, it, vi, beforeEach } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import { useNavigate, useLocation } from 'react-router-dom'
import { renderWithProviders } from '../../test/renderWithProviders'

vi.mock('./ManualWizard', () => ({ ManualWizard: () => <div>Wizard manual real</div> }))

let sourcesResult: { data: unknown; isLoading: boolean; error: unknown; refetch: () => void }
vi.mock('./useSources', () => ({ useSources: () => sourcesResult }))
vi.mock('./Vasculhando', () => ({ Vasculhando: ({ onDone }: { onDone: () => void }) => <button onClick={onDone}>ver meus benefícios</button> }))
vi.mock('./RevisarGmail', () => ({
  RevisarGmail: ({ onDone }: { onDone: (i: unknown[]) => void }) => (
    <button onClick={() => onDone([{ finding: { sourceId: 's1', provider: 'Nubank', category: 'bank_card', items: [{ id: 'i1', label: 'Ultravioleta', sort_order: 1 }] }, itemId: 'i1' }])}>
      adicionar ao radar
    </button>
  ),
}))
vi.mock('./RadarMontado', () => ({ RadarMontado: ({ onView }: { onView: () => void }) => <button onClick={onView}>ver meu radar</button> }))

// mocks Gmail real (Task 6/7/8): useGmailAuth + gmailScan, mutáveis por teste (mesmo
// padrão do sourcesResult) — cada teste ajusta o cenário antes de renderizar.
let gmailAuth: {
  available: boolean
  connect: () => Promise<{ token: string; account: string }>
  makeFetchJson: () => (path: string) => Promise<unknown>
  revoke: () => void
}
vi.mock('./gmail/useGmailAuth', () => ({ useGmailAuth: () => gmailAuth }))

let scanResult: { findings: unknown[]; partial: boolean }
vi.mock('./gmail/gmailScan', () => ({ gmailScan: async () => scanResult }))

import { OnboardingPage } from './OnboardingPage'
import { MethodStep } from './OnboardingIntro'

beforeEach(() => {
  sourcesResult = {
    data: [{ category: 'bank_card', meta: { key: 'bank_card', label: 'Bancos & cartões', icon: '🏦' },
      sources: [{ id: 's1', kind: 'card', name: 'Nubank', logo_url: null, sort_order: 1, source_category: 'bank_card', source_items: [{ id: 'i1', label: 'Ultravioleta', sort_order: 1 }] }] }],
    isLoading: false, error: null, refetch: vi.fn(),
  }
  gmailAuth = {
    available: true,
    connect: async () => ({ token: 't', account: 'me@gmail.com' }),
    makeFetchJson: () => async () => ({}),
    revoke: vi.fn(),
  }
  scanResult = {
    findings: [{
      sourceId: 's1', provider: 'Spotify', logo: null,
      items: [{ id: 'i1', label: 'Premium', sort_order: 1 }],
      evidence: { gmailAccount: 'me@gmail.com', gmailMessageId: 'm1', emailFrom: 'a@spotify.com', emailSubject: 'x', emailDate: '2026-01-01T00:00:00Z' },
    }],
    partial: false,
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
    expect(screen.getByRole('button', { name: /conectar gmail.*beta/i })).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: /adicionar manualmente/i }))

    expect(screen.getByText('Wizard manual real')).toBeInTheDocument()
  })

  it('boas-vindas: não oferece mais "Pular" e troca o tema no lugar dele', () => {
    document.documentElement.setAttribute('data-theme', 'light')
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' })

    expect(screen.queryByRole('button', { name: /^pular$/i })).not.toBeInTheDocument()

    const btn = screen.getByRole('button', { name: /trocar para escuro/i })
    expect(btn).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(btn)
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark')
    expect(screen.getByRole('button', { name: /trocar para claro/i })).toHaveAttribute('aria-pressed', 'true')
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

  it('MethodStep: card Gmail Beta dispara onGmail', () => {
    const onGmail = vi.fn()
    renderWithProviders(<MethodStep onManual={() => {}} onGmail={onGmail} />, { route: '/onboarding' })
    const gmail = screen.getByRole('button', { name: /conectar gmail.*beta/i })
    expect(gmail).toBeEnabled()
    fireEvent.click(gmail)
    expect(onGmail).toHaveBeenCalledTimes(1)
  })

  it('caminho Gmail: método → consent → scan real → revisar → radar montado → alertas', async () => {
    renderWithProviders(<><LocationProbe /><OnboardingPage /></>, { route: '/onboarding' })
    fireEvent.click(screen.getByRole('button', { name: /mapear meus benefícios/i }))
    fireEvent.click(screen.getByRole('button', { name: /conectar gmail.*beta/i }))

    expect(screen.getByRole('heading', { name: /vamos achar seus benefícios/i })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^conectar gmail$/i }))

    fireEvent.click(await screen.findByRole('button', { name: /ver meus benefícios/i }))
    fireEvent.click(screen.getByRole('button', { name: /adicionar ao radar/i }))
    fireEvent.click(screen.getByRole('button', { name: /ver meu radar/i }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/alertas?from=onboarding')
  })

  it('revoga o token do Gmail após um scan bem-sucedido', async () => {
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' })
    fireEvent.click(screen.getByRole('button', { name: /mapear meus benefícios/i }))
    fireEvent.click(screen.getByRole('button', { name: /conectar gmail.*beta/i }))
    fireEvent.click(screen.getByRole('button', { name: /^conectar gmail$/i }))
    await screen.findByRole('button', { name: /ver meus benefícios/i })
    expect(gmailAuth.revoke).toHaveBeenCalledWith('t')
  })

  it('scan sem programas encontrados cai no wizard manual', async () => {
    scanResult = { findings: [], partial: false }
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' })
    fireEvent.click(screen.getByRole('button', { name: /mapear meus benefícios/i }))
    fireEvent.click(screen.getByRole('button', { name: /conectar gmail.*beta/i }))
    fireEvent.click(screen.getByRole('button', { name: /^conectar gmail$/i }))
    expect(await screen.findByText('Wizard manual real')).toBeInTheDocument()
  })

  it('sem VITE_GOOGLE_CLIENT_ID (gmail indisponível) pula direto pro wizard manual', () => {
    gmailAuth = { ...gmailAuth, available: false }
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' })
    fireEvent.click(screen.getByRole('button', { name: /mapear meus benefícios/i }))
    fireEvent.click(screen.getByRole('button', { name: /conectar gmail.*beta/i }))
    expect(screen.getByText('Wizard manual real')).toBeInTheDocument()
  })

  it('erro ao conectar ao Gmail mostra alerta na tela de consentimento', async () => {
    gmailAuth = { ...gmailAuth, connect: async () => { throw new Error('popup_closed') } }
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' })
    fireEvent.click(screen.getByRole('button', { name: /mapear meus benefícios/i }))
    fireEvent.click(screen.getByRole('button', { name: /conectar gmail.*beta/i }))
    fireEvent.click(screen.getByRole('button', { name: /^conectar gmail$/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/não foi possível conectar ao google/i)
  })

  it('erro no catálogo não bloqueia o caminho manual', () => {
    sourcesResult = { ...sourcesResult, data: undefined, error: new Error('down') }
    renderWithProviders(<OnboardingPage />, { route: '/onboarding' })
    fireEvent.click(screen.getByRole('button', { name: /mapear meus benefícios/i }))
    fireEvent.click(screen.getByRole('button', { name: /adicionar manualmente/i }))
    expect(screen.getByText('Wizard manual real')).toBeInTheDocument()
  })
})

describe('OnboardingPage re-scan (?method=gmail)', () => {
  it('começa direto no consent quando o Gmail está disponível', () => {
    renderWithProviders(<OnboardingPage />, { route: '/onboarding?method=gmail' })
    expect(screen.getByRole('heading', { name: /vamos achar seus benefícios/i })).toBeInTheDocument()
  })

  it('zero achados no re-scan cai em gmail-none com botão de volta pra /programas', async () => {
    scanResult = { findings: [], partial: false }
    renderWithProviders(<><LocationProbe /><OnboardingPage /></>, { route: '/onboarding?method=gmail' })
    fireEvent.click(screen.getByRole('button', { name: /^conectar gmail$/i }))

    expect(await screen.findByText(/nada novo no seu gmail/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /voltar aos meus programas/i }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/programas')
  })

  it('catálogo ainda carregando: botão fica "Preparando…" e não vasculha (evita "nada encontrado" falso)', () => {
    sourcesResult = { data: undefined, isLoading: true, error: null, refetch: vi.fn() }
    renderWithProviders(<><LocationProbe /><OnboardingPage /></>, { route: '/onboarding?method=gmail' })
    const cta = screen.getByRole('button', { name: /preparando/i })
    expect(cta).toBeDisabled()
    fireEvent.click(cta)
    // não caiu em gmail-none nem navegou: continua no consentimento
    expect(screen.getByRole('heading', { name: /vamos achar seus benefícios/i })).toBeInTheDocument()
    expect(screen.queryByText(/nada novo no seu gmail/i)).not.toBeInTheDocument()
  })

  it('gmail indisponível + re-scan cai em gmail-none (indisponível) com botão de volta pra /programas', () => {
    gmailAuth = { ...gmailAuth, available: false }
    renderWithProviders(<><LocationProbe /><OnboardingPage /></>, { route: '/onboarding?method=gmail' })

    expect(screen.getByText(/conexão com o gmail indisponível/i)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /voltar aos meus programas/i }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/programas')
  })

  it('re-scan: gmail-done navega pra /programas (não /alertas)', async () => {
    renderWithProviders(<><LocationProbe /><OnboardingPage /></>, { route: '/onboarding?method=gmail' })
    fireEvent.click(screen.getByRole('button', { name: /^conectar gmail$/i }))

    fireEvent.click(await screen.findByRole('button', { name: /ver meus benefícios/i }))
    fireEvent.click(screen.getByRole('button', { name: /adicionar ao radar/i }))
    fireEvent.click(screen.getByRole('button', { name: /ver meu radar/i }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/programas')
  })

  it('re-scan: onBack do consent volta pra /programas', () => {
    renderWithProviders(<><LocationProbe /><OnboardingPage /></>, { route: '/onboarding?method=gmail' })
    fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(screen.getByTestId('loc')).toHaveTextContent('/programas')
  })
})
