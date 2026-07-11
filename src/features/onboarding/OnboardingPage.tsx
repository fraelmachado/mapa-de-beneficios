import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ManualWizard } from './ManualWizard'
import { MethodStep, WelcomeStep } from './OnboardingIntro'

type Screen = 'welcome' | 'method' | 'manual'

export function OnboardingPage() {
  const [params] = useSearchParams()
  const editing = params.get('mode') === 'edit'
  const [screen, setScreen] = useState<Screen>(editing ? 'manual' : 'welcome')

  if (screen === 'manual') return <ManualWizard />
  if (screen === 'method') return <MethodStep onManual={() => setScreen('manual')} />

  return <WelcomeStep onContinue={() => setScreen('method')} />
}
