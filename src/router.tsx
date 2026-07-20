import { createBrowserRouter, type RouteObject } from 'react-router-dom'
import { BootstrapRoute } from './features/bootstrap/BootstrapRoute'
import { OnboardingPage } from './features/onboarding/OnboardingPage'
import { AppLayout } from './features/layout/AppLayout'
import { Painel } from './features/painel/Painel'
import { Search } from './features/busca/Search'
import { MeusProgramas } from './features/programas/MeusProgramas'
import { BenefitDetail } from './features/detalhe/BenefitDetail'
import { Perfil } from './features/perfil/Perfil'
import { Alertas } from './features/alertas/Alertas'
import { AdminLogin } from './features/admin/AdminLogin'
import { AdminGuard } from './features/admin/AdminGuard'
import { AdminAppShell } from './features/admin/AdminAppShell'
import { AdminHome } from './features/admin/AdminHome'
import { AdminSources } from './features/admin/sources/AdminSources'
import { AdminBenefits } from './features/admin/benefits/AdminBenefits'
import { AdminDiscovery } from './features/admin/discovery/AdminDiscovery'

export const routes: RouteObject[] = [
  { path: '/', element: <BootstrapRoute /> },
  { path: '/onboarding', element: <OnboardingPage /> },
  {
    element: <AppLayout />,
    children: [
      { path: '/painel', element: <Painel /> },
      { path: '/buscar', element: <Search /> },
      { path: '/programas', element: <MeusProgramas /> },
      { path: '/perfil', element: <Perfil /> },
    ],
  },
  { path: '/beneficio/:id', element: <BenefitDetail /> },
  { path: '/alertas', element: <Alertas /> },
  { path: '/admin/login', element: <AdminLogin /> },
  {
    element: <AdminGuard />,
    children: [
      {
        element: <AdminAppShell />,
        children: [
          { path: '/admin', element: <AdminHome /> },
          { path: '/admin/sources', element: <AdminSources /> },
          { path: '/admin/benefits', element: <AdminBenefits /> },
          { path: '/admin/discovery', element: <AdminDiscovery /> },
        ],
      },
    ],
  },
]

export const router = createBrowserRouter(routes)
