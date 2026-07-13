import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ManualWizard } from './ManualWizard'
import { MethodStep, WelcomeStep } from './OnboardingIntro'
import { Vasculhando } from './Vasculhando'
import { RevisarGmail } from './RevisarGmail'
import { RadarMontado, type SummaryGroup } from './RadarMontado'
import { useSources } from './useSources'
import { demoFindings, type Finding } from './demoFindings'
import { PageState, Skeleton } from '../../ui'

type Screen = 'welcome' | 'method' | 'manual' | 'gmail-scan' | 'gmail-review' | 'gmail-done'

export function OnboardingPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const editing = params.get('mode') === 'edit'
  const [screen, setScreen] = useState<Screen>(editing ? 'manual' : 'welcome')
  const [gmailFindings, setGmailFindings] = useState<Finding[]>([]) // snapshot congelado do fluxo Gmail
  const [saved, setSaved] = useState<Finding[]>([])
  const sourcesQuery = useSources()
  const groups = sourcesQuery.data ?? []
  const findings = demoFindings(groups)

  useEffect(() => { setScreen(editing ? 'manual' : 'welcome') }, [editing])

  // Catálogo vazio no caminho Gmail → wizard manual (D4). Via efeito, nunca setState no render.
  useEffect(() => {
    if (screen === 'gmail-scan' && !sourcesQuery.isLoading && !sourcesQuery.error && findings.length === 0) {
      setScreen('manual')
    }
  }, [screen, sourcesQuery.isLoading, sourcesQuery.error, findings.length])

  function startGmail() {
    // sempre entra no scan; loading/erro/vazio são tratados no próprio estado 'gmail-scan'
    if (!sourcesQuery.isLoading && !sourcesQuery.error && findings.length === 0) { setScreen('manual'); return } // D4 (atalho no clique)
    setScreen('gmail-scan')
  }

  if (screen === 'manual') return <ManualWizard />

  if (screen === 'gmail-scan') {
    if (sourcesQuery.isLoading) {
      return <div className="ob-state" role="status" aria-label="Preparando sua prévia" aria-busy="true"><Skeleton height="200px" radius="18px" /><Skeleton height="52px" radius="13px" /></div>
    }
    if (sourcesQuery.error) {
      return (
        <div className="ob-state">
          <PageState title="Não foi possível preparar sua prévia" action={{ label: 'Tentar novamente', onClick: () => void sourcesQuery.refetch() }} />
          <button className="btn ghost" type="button" onClick={() => setScreen('method')}>Voltar</button>
        </div>
      )
    }
    if (findings.length === 0) return null // efeito acima redireciona para 'manual'
    return (
      <Vasculhando
        count={findings.length}
        onDone={() => { setGmailFindings(findings); setScreen('gmail-review') }} // congela o snapshot
        onBack={() => setScreen('method')}
      />
    )
  }

  if (screen === 'gmail-review') {
    return <RevisarGmail findings={gmailFindings} onDone={(inc) => { setSaved(inc); setScreen('gmail-done') }} onBack={() => setScreen('method')} />
  }

  if (screen === 'gmail-done') {
    const groupsSummary: SummaryGroup[] = saved.length
      ? [{ label: groups[0]?.meta.label ?? 'Seus programas', items: saved.map((f) => ({ provider: f.provider, variant: f.variant })) }]
      : []
    return <RadarMontado groups={groupsSummary} onView={() => navigate('/alertas?from=onboarding')} />
  }

  if (screen === 'method') {
    return <MethodStep onManual={() => setScreen('manual')} onBack={() => setScreen('welcome')} onGmail={startGmail} />
  }

  return <WelcomeStep onContinue={() => setScreen('method')} onSkip={() => navigate('/painel')} onLogin={() => navigate('/perfil')} />
}
