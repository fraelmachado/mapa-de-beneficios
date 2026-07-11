import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ManualWizard } from './ManualWizard'
import { MethodStep, WelcomeStep } from './OnboardingIntro'

type Screen = 'welcome' | 'method' | 'manual'

export function OnboardingPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const editing = params.get('mode') === 'edit'
  const [screen, setScreen] = useState<Screen>(editing ? 'manual' : 'welcome')

  useEffect(() => {
    setScreen(editing ? 'manual' : 'welcome')
  }, [editing])

  if (screen === 'manual') return <ManualWizard />
  if (screen === 'method') {
    return <MethodStep onManual={() => setScreen('manual')} onBack={() => setScreen('welcome')} />
  }

  return (
    <WelcomeStep
      onContinue={() => setScreen('method')}
      onSkip={() => navigate('/painel')}
      onLogin={() => navigate('/perfil')}
    />
  )
}
