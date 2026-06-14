import { createBrowserRouter } from 'react-router-dom'
import { BootstrapRoute } from './features/bootstrap/BootstrapRoute'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { PainelPlaceholder } from './features/painel/PainelPlaceholder'

export const router = createBrowserRouter([
  { path: '/', element: <BootstrapRoute /> },
  { path: '/onboarding', element: <OnboardingPage /> },
  { path: '/painel', element: <PainelPlaceholder /> },
])
