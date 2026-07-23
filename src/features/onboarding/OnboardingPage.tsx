import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ManualWizard } from './ManualWizard'
import { MethodStep, WelcomeStep } from './OnboardingIntro'
import { Vasculhando } from './Vasculhando'
import { RevisarGmail } from './RevisarGmail'
import { RadarMontado, type SummaryGroup } from './RadarMontado'
import { useSources } from './useSources'
import { GmailConsent } from './gmail/GmailConsent'
import { useGmailAuth } from './gmail/useGmailAuth'
import { gmailScan } from './gmail/gmailScan'
import type { SavedSelection, ScanResult } from './gmail/types'
import { PageState } from '../../ui'

type Screen = 'welcome' | 'method' | 'manual' | 'gmail-consent' | 'gmail-scan' | 'gmail-review' | 'gmail-done' | 'gmail-none'

export function OnboardingPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const editing = params.get('mode') === 'edit'
  const rescan = params.get('method') === 'gmail'
  const gmail = useGmailAuth()
  const initialScreen = (): Screen =>
    editing ? 'manual' : rescan ? (gmail.available ? 'gmail-consent' : 'gmail-none') : 'welcome'
  const [screen, setScreen] = useState<Screen>(initialScreen)
  const [saved, setSaved] = useState<SavedSelection[]>([])
  const sourcesQuery = useSources()
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState(false)
  const [scan, setScan] = useState<ScanResult | null>(null)

  const flatSources = (sourcesQuery.data ?? []).flatMap((g) => g.sources)

  useEffect(() => { setScreen(initialScreen()) }, [editing, rescan, gmail.available])

  // startGmail: sem catálogo/domínios → cai no manual; senão vai pro consent
  function startGmail() {
    if (!gmail.available) { setScreen('manual'); return } // sem client id → manual
    setScreen('gmail-consent')
  }

  async function connectAndScan() {
    // catálogo ainda não carregou (ou falhou) → vasculhar contra 0 domínios daria
    // "nada encontrado" falso. Barra aqui em vez de tratar zero achados como sucesso.
    if (!sourcesQuery.data || flatSources.length === 0) { setConnectError(true); return }
    setConnecting(true); setConnectError(false)
    let token: string | undefined
    try {
      const connected = await gmail.connect()
      token = connected.token
      const result = await gmailScan({ gmailAccount: connected.account, sources: flatSources, fetchJson: gmail.makeFetchJson(token) })
      setScan(result)
      if (result.findings.length === 0) { setScreen(rescan ? 'gmail-none' : 'manual'); return } // nada encontrado
      setScreen('gmail-scan')
    } catch {
      setConnectError(true)
    } finally {
      if (token) gmail.revoke(token) // one-shot: revoga mesmo se o scan falhar
      setConnecting(false)
    }
  }

  if (screen === 'manual') return <ManualWizard />

  if (screen === 'gmail-none') {
    const msg = gmail.available ? 'Nada novo no seu Gmail desta vez.' : 'Conexão com o Gmail indisponível.'
    return (
      <div className="ob-state">
        <PageState title={msg} action={gmail.available ? { label: 'Procurar de novo', onClick: () => setScreen('gmail-consent') } : undefined} />
        <button className="btn ghost" type="button" onClick={() => navigate('/programas')}>Voltar aos meus programas</button>
      </div>
    )
  }

  if (screen === 'gmail-consent') {
    return (
      <GmailConsent
        onConnect={connectAndScan}
        onBack={rescan ? () => navigate('/programas') : () => setScreen('method')}
        connecting={connecting}
        error={connectError}
        preparing={sourcesQuery.isLoading}
        brands={flatSources.filter((s) => s.logo_url).slice(0, 8).map((s) => ({ id: s.id, name: s.name, logo: s.logo_url as string }))}
        brandsTotal={flatSources.length}
      />
    )
  }

  if (screen === 'gmail-scan' && scan) {
    return (
      <Vasculhando
        count={scan.findings.length}
        onDone={() => setScreen('gmail-review')}
        onBack={rescan ? () => setScreen('gmail-consent') : () => setScreen('method')}
      />
    )
  }

  if (screen === 'gmail-review' && scan) {
    return (
      <RevisarGmail
        findings={scan.findings}
        partial={scan.partial}
        onDone={(inc) => { setSaved(inc); setScreen('gmail-done') }}
        onBack={rescan ? () => setScreen('gmail-consent') : () => setScreen('method')}
      />
    )
  }

  if (screen === 'gmail-done') {
    const groupsSummary: SummaryGroup[] = saved.length
      ? [{ label: 'Seus programas', items: saved.map(({ finding, itemId }) => ({
          provider: finding.provider,
          variant: finding.items.find((it) => it.id === itemId)?.label ?? '',
        })) }]
      : []
    return <RadarMontado groups={groupsSummary} onView={() => navigate(rescan ? '/programas' : '/alertas?from=onboarding')} />
  }

  if (screen === 'method') {
    return <MethodStep onManual={() => setScreen('manual')} onBack={() => setScreen('welcome')} onGmail={startGmail} />
  }

  return <WelcomeStep onContinue={() => setScreen('method')} onLogin={() => navigate('/perfil')} />
}
