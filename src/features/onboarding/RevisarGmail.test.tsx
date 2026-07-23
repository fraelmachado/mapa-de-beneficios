import { it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
// renderWithProviders envolve o QueryClientProvider que useAddGmailSources (useMutation) exige.
import { renderWithProviders as render } from '../../test/renderWithProviders'
import { RevisarGmail } from './RevisarGmail'
import type { Finding } from './gmail/types'

const rpc = vi.fn(async (..._args: any[]): Promise<{ error: unknown }> => ({ error: null }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: any[]) => rpc(...a) } }))

beforeEach(() => rpc.mockReset().mockResolvedValue({ error: null }))

const single: Finding = {
  sourceId: 's1', provider: 'Spotify', logo: null, category: 'retail',
  items: [{ id: 'i1', label: 'Premium', sort_order: 1 }],
  evidence: { gmailAccount: 'me@gmail.com', gmailMessageId: 'm1', emailFrom: 'a@spotify.com', emailSubject: 'x', emailDate: '2026-01-01T00:00:00Z' },
}
const multi: Finding = {
  sourceId: 's2', provider: 'Nubank', logo: null, category: 'bank_card',
  items: [{ id: 'a', label: 'Gold', sort_order: 1 }, { id: 'b', label: 'Platinum', sort_order: 2 }],
  evidence: { gmailAccount: 'me@gmail.com', gmailMessageId: 'm2', emailFrom: 'a@nubank.com.br', emailSubject: 'y', emailDate: '2026-01-01T00:00:00Z' },
}

const cta = () => screen.getByRole('button', { name: /Adicionar \d|Concluir|Salvando/ })
const lastPayload = () => rpc.mock.calls.at(-1)![1].payload

it('single "Tenho ›" decide, avança pro resumo e salva o item único', async () => {
  const onDone = vi.fn()
  render(<RevisarGmail findings={[single]} partial={false} onDone={onDone} />)
  fireEvent.click(screen.getByRole('button', { name: /Tenho ›/ }))
  expect(cta()).toHaveTextContent('Adicionar 1 ao radar')
  fireEvent.click(cta())
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('add_gmail_sources', expect.anything()))
  expect(lastPayload()[0].item_id).toBe('i1')
  await waitFor(() => expect(onDone).toHaveBeenCalled())
})

it('single "Não tenho" descarta → resumo "Concluir" sem chamar a RPC', async () => {
  const onDone = vi.fn()
  render(<RevisarGmail findings={[single]} partial={false} onDone={onDone} />)
  fireEvent.click(screen.getByRole('button', { name: /^Não tenho$/ }))
  expect(cta()).toHaveTextContent('Concluir')
  fireEvent.click(cta())
  await waitFor(() => expect(onDone).toHaveBeenCalledWith([]))
  expect(rpc).not.toHaveBeenCalled()
})

it('multi: toque no tier decide, avança e salva o tier certo', async () => {
  render(<RevisarGmail findings={[multi]} partial={false} onDone={vi.fn()} />)
  expect(screen.queryByRole('button', { name: /Tenho ›/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Platinum/ }))
  expect(cta()).toHaveTextContent('Adicionar 1 ao radar')
  fireEvent.click(cta())
  await waitFor(() => expect(rpc).toHaveBeenCalled())
  expect(lastPayload()[0].item_id).toBe('b')
})

it('cada decisão avança exatamente um card', () => {
  render(<RevisarGmail findings={[single, multi]} partial={false} onDone={vi.fn()} />)
  expect(screen.getByText('1 de 2')).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Tenho ›/ })) // decide Spotify
  expect(screen.getByRole('heading', { name: 'Nubank' })).toBeInTheDocument()
  expect(screen.getByText('2 de 2')).toBeInTheDocument() // avançou 1, não pulou pro resumo
})

it('"‹" volta ao card anterior', () => {
  render(<RevisarGmail findings={[single, multi]} partial={false} onDone={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /Tenho ›/ }))       // Spotify → Nubank
  expect(screen.getByRole('heading', { name: 'Nubank' })).toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))         // Nubank → Spotify
  expect(screen.getByRole('heading', { name: 'Spotify' })).toBeInTheDocument()
  expect(screen.getByText('1 de 2')).toBeInTheDocument()
})

it('"‹" no primeiro card sai da tela (onBack)', () => {
  const onBack = vi.fn()
  render(<RevisarGmail findings={[single]} partial={false} onDone={vi.fn()} onBack={onBack} />)
  fireEvent.click(screen.getByRole('button', { name: 'Voltar' }))
  expect(onBack).toHaveBeenCalled()
})

it('resumo lista confirmados E descartados', () => {
  render(<RevisarGmail findings={[single, multi]} partial={false} onDone={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /Tenho ›/ }))   // Spotify → tenho
  fireEvent.click(screen.getByRole('button', { name: /^Não tenho$/ })) // Nubank → não tenho
  expect(screen.getByText('Spotify')).toBeInTheDocument()
  expect(screen.getByText('Nubank')).toBeInTheDocument()
  expect(screen.getAllByText('tenho')).toHaveLength(1)
  expect(screen.getByText('não tenho')).toBeInTheDocument()
  expect(cta()).toHaveTextContent('Adicionar 1 ao radar')
})

it('"Editar" no resumo reabre o card e devolve ao resumo ao decidir', () => {
  render(<RevisarGmail findings={[single]} partial={false} onDone={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /Tenho ›/ }))   // → resumo (tenho)
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  expect(screen.getByRole('heading', { name: 'Spotify' })).toBeInTheDocument() // card de novo
  fireEvent.click(screen.getByRole('button', { name: /^Não tenho$/ }))
  expect(cta()).toHaveTextContent('Concluir')                        // voltou ao resumo, agora descartado
  expect(screen.getByText('não tenho')).toBeInTheDocument()
})

it('payload leva só os "tenho": single tenho + multi não → 1 item', async () => {
  render(<RevisarGmail findings={[single, multi]} partial={false} onDone={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /Tenho ›/ }))
  fireEvent.click(screen.getByRole('button', { name: /^Não tenho$/ }))
  fireEvent.click(cta())
  await waitFor(() => expect(rpc).toHaveBeenCalled())
  const payload = lastPayload()
  expect(payload).toHaveLength(1)
  expect(payload[0].source_id).toBe('s1')
})

it('erro de save mantém no resumo e o alerta some ao editar', async () => {
  rpc.mockResolvedValue({ error: { message: 'boom' } })
  render(<RevisarGmail findings={[single]} partial={false} onDone={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /Tenho ›/ }))
  fireEvent.click(cta())
  await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument())
  fireEvent.click(screen.getByRole('button', { name: 'Editar' }))
  fireEvent.click(screen.getByRole('button', { name: /Tenho ›/ }))
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
