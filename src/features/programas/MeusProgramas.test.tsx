import { it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
import { renderWithProviders as render } from '../../test/renderWithProviders'
import { MeusProgramas } from './MeusProgramas'
import type { Program } from './buildPrograms'

const save = vi.fn(async () => {})
vi.mock('../onboarding/useSaveUserSources', () => ({ useSaveUserSources: () => ({ mutateAsync: save }) }))
vi.mock('../auth/AuthProvider', () => ({ useSession: () => ({ session: { user: { id: 'u1' } } }) }))
const nav = vi.fn()
vi.mock('react-router-dom', async (o) => ({ ...(await o() as object), useNavigate: () => nav }))
vi.mock('../onboarding/useUserSources', () => ({ useUserSources: () => ({ data: ['plat', 'prem'] }) }))
const programs: Program[] = [
  { itemId: 'plat', sourceId: 's1', brand: 'Nubank', tier: 'Platinum', items: [{ id: 'gold', label: 'Gold', sort_order: 1 }, { id: 'plat', label: 'Platinum', sort_order: 2 }], logo: null, provenance: 'gmail', when: 'há 3 dias', from: 'a@nubank.com.br' },
  { itemId: 'prem', sourceId: 's2', brand: 'Spotify', tier: 'Premium', items: [{ id: 'prem', label: 'Premium', sort_order: 1 }], logo: null, provenance: 'manual', when: '', from: '' },
]
vi.mock('./useMyPrograms', () => ({ useMyPrograms: () => ({ programs, summary: { total: 2, gmailCount: 1, manualCount: 1, lastFound: 'há 3 dias', account: 'me@gmail.com' }, isLoading: false, error: null, refetch: vi.fn() }) }))

beforeEach(() => { save.mockClear(); nav.mockClear() })

it('mostra resumo e lista', () => {
  render(<MeusProgramas />)
  expect(screen.getByText(/Você tem 2 programas/)).toBeInTheDocument()
  expect(screen.getByText(/1 via Gmail/)).toBeInTheDocument()
})
it('remover recomputa sem o item', async () => {
  render(<MeusProgramas />)
  fireEvent.click(screen.getByRole('button', { name: /Opções de Nubank/ }))
  fireEvent.click(screen.getByRole('button', { name: /Remover do radar/ }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(['prem']))
})
it('trocar tier recomputa trocando o item (dedup)', async () => {
  render(<MeusProgramas />)
  fireEvent.click(screen.getByRole('button', { name: /Opções de Nubank/ }))
  fireEvent.click(screen.getByRole('button', { name: /Gold/ }))
  await waitFor(() => expect(save).toHaveBeenCalledWith(['gold', 'prem']))
})
it('ações navegam', () => {
  render(<MeusProgramas />)
  fireEvent.click(screen.getByRole('button', { name: /Procurar no Gmail/ }))
  expect(nav).toHaveBeenCalledWith('/onboarding?method=gmail')
  fireEvent.click(screen.getByRole('button', { name: /Do catálogo/ }))
  expect(nav).toHaveBeenCalledWith('/onboarding?mode=edit')
})
it('erro na mutação mostra alerta', async () => {
  save.mockRejectedValueOnce(new Error('x'))
  render(<MeusProgramas />)
  fireEvent.click(screen.getByRole('button', { name: /Opções de Spotify/ }))
  fireEvent.click(screen.getByRole('button', { name: /Remover do radar/ }))
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
})
