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
import type { Finding, ScanResult } from './gmail/types'

type Screen = 'welcome' | 'method' | 'manual' | 'gmail-consent' | 'gmail-scan' | 'gmail-review' | 'gmail-done'

export function OnboardingPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const editing = params.get('mode') === 'edit'
  const [screen, setScreen] = useState<Screen>(editing ? 'manual' : 'welcome')
  const [saved, setSaved] = useState<Finding[]>([])
  const sourcesQuery = useSources()
  const gmail = useGmailAuth()
  const [connecting, setConnecting] = useState(false)
  const [connectError, setConnectError] = useState(false)
  const [scan, setScan] = useState<ScanResult | null>(null)

  const flatSources = (sourcesQuery.data ?? []).flatMap((g) => g.sources)

  useEffect(() => { setScreen(editing ? 'manual' : 'welcome') }, [editing])

  // startGmail: sem catálogo/domínios → cai no manual; senão vai pro consent
  function startGmail() {
    if (!gmail.available) { setScreen('manual'); return } // sem client id → manual
    setScreen('gmail-consent')
  }

  async function connectAndScan() {
    setConnecting(true); setConnectError(false)
    try {
      const { token, account } = await gmail.connect()
      const result = await gmailScan({ gmailAccount: account, sources: flatSources, fetchJson: gmail.makeFetchJson(token) })
      gmail.revoke(token) // one-shot: não precisamos mais do token
      setScan(result)
      if (result.findings.length === 0) { setScreen('manual'); return } // nada encontrado → manual
      setScreen('gmail-scan')
    } catch {
      setConnectError(true)
    } finally {
      setConnecting(false)
    }
  }

  if (screen === 'manual') return <ManualWizard />

  if (screen === 'gmail-consent') {
    return <GmailConsent onConnect={connectAndScan} onBack={() => setScreen('method')} connecting={connecting} error={connectError} />
  }

  if (screen === 'gmail-scan' && scan) {
    return <Vasculhando count={scan.findings.length} onDone={() => setScreen('gmail-review')} onBack={() => setScreen('method')} />
  }

  if (screen === 'gmail-review' && scan) {
    return <RevisarGmail findings={scan.findings} partial={scan.partial} onDone={(inc) => { setSaved(inc); setScreen('gmail-done') }} onBack={() => setScreen('method')} />
  }

  if (screen === 'gmail-done') {
    const groupsSummary: SummaryGroup[] = saved.length
      ? [{ label: 'Seus programas', items: saved.map((f) => ({ provider: f.provider, variant: f.items.length === 1 ? f.items[0].label : '' })) }]
      : []
    return <RadarMontado groups={groupsSummary} onView={() => navigate('/alertas?from=onboarding')} />
  }

  if (screen === 'method') {
    return <MethodStep onManual={() => setScreen('manual')} onBack={() => setScreen('welcome')} onGmail={startGmail} />
  }

  return <WelcomeStep onContinue={() => setScreen('method')} onSkip={() => navigate('/painel')} onLogin={() => navigate('/perfil')} />
}
