import { it, expect, vi, beforeEach } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
// renderWithProviders envolve o QueryClientProvider que useAddGmailSources (useMutation) exige.
import { renderWithProviders as render } from '../../test/renderWithProviders'
import { RevisarGmail } from './RevisarGmail'
import type { Finding } from './gmail/types'

const rpc = vi.fn(async (..._args: any[]) => ({ error: null }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: any[]) => rpc(...a) } }))

beforeEach(() => rpc.mockClear())

const single: Finding = {
  sourceId: 's1', provider: 'Spotify', logo: null,
  items: [{ id: 'i1', label: 'Premium', sort_order: 1 }],
  evidence: { gmailAccount: 'me@gmail.com', gmailMessageId: 'm1', emailFrom: 'a@spotify.com', emailSubject: 'x', emailDate: '2026-01-01T00:00:00Z' },
}
const multi: Finding = {
  sourceId: 's2', provider: 'Nubank', logo: null,
  items: [{ id: 'a', label: 'Gold', sort_order: 1 }, { id: 'b', label: 'Platinum', sort_order: 2 }],
  evidence: { gmailAccount: 'me@gmail.com', gmailMessageId: 'm2', emailFrom: 'a@nubank.com.br', emailSubject: 'y', emailDate: '2026-01-01T00:00:00Z' },
}

const cta = () => screen.getByRole('button', { name: /Falta|Adicionar \d|Concluir|Salvando/ })

it('toda entrada começa pendente: CTA bloqueada e progresso 0 de N', () => {
  render(<RevisarGmail findings={[single, multi]} partial={false} onDone={vi.fn()} />)
  expect(cta()).toBeDisabled()
  expect(cta()).toHaveTextContent(/Falta 2/)
  expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')
})

it('single "Tenho" confirma → CTA libera e salva o item único', async () => {
  const onDone = vi.fn()
  render(<RevisarGmail findings={[single]} partial={false} onDone={onDone} />)
  fireEvent.click(screen.getByRole('button', { name: /^Tenho$/ }))
  const btn = screen.getByRole('button', { name: /Adicionar 1 ao radar/ })
  expect(btn).not.toBeDisabled()
  fireEvent.click(btn)
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('add_gmail_sources', expect.anything()))
  expect(rpc.mock.calls.at(-1)![1].payload[0].item_id).toBe('i1')
  await waitFor(() => expect(onDone).toHaveBeenCalled())
})

it('single "Não" descarta → CTA "Concluir" sem chamar a RPC', async () => {
  const onDone = vi.fn()
  render(<RevisarGmail findings={[single]} partial={false} onDone={onDone} />)
  fireEvent.click(screen.getByRole('button', { name: /^Não$/ }))
  const btn = screen.getByRole('button', { name: /Concluir/ })
  expect(btn).not.toBeDisabled()
  fireEvent.click(btn)
  await waitFor(() => expect(onDone).toHaveBeenCalledWith([]))
  expect(rpc).not.toHaveBeenCalled()
})

it('multi "Tenho ›" abre o sheet, escolher tier confirma e salva o tier certo', async () => {
  render(<RevisarGmail findings={[multi]} partial={false} onDone={vi.fn()} />)
  expect(cta()).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /Tenho ›/ }))
  fireEvent.click(screen.getByRole('button', { name: /Platinum/ }))
  const btn = screen.getByRole('button', { name: /Adicionar 1 ao radar/ })
  expect(btn).not.toBeDisabled()
  fireEvent.click(btn)
  await waitFor(() => expect(rpc).toHaveBeenCalled())
  expect(rpc.mock.calls.at(-1)![1].payload[0].item_id).toBe('b')
})

it('multi "Não tenho" no sheet descarta a marca', async () => {
  render(<RevisarGmail findings={[multi]} partial={false} onDone={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /Tenho ›/ }))
  fireEvent.click(screen.getByRole('button', { name: /Não tenho o Nubank/i }))
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  // decidido (não tenho) → CTA "Concluir" liberada
  expect(screen.getByRole('button', { name: /Concluir/ })).not.toBeDisabled()
})

it('payload leva só os "tenho": single tenho + multi não → 1 item', async () => {
  render(<RevisarGmail findings={[single, multi]} partial={false} onDone={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /^Tenho$/ }))          // single → have
  fireEvent.click(screen.getAllByRole('button', { name: /^Não$/ })[0])       // multi → no
  const btn = screen.getByRole('button', { name: /Adicionar 1 ao radar/ })
  fireEvent.click(btn)
  await waitFor(() => expect(rpc).toHaveBeenCalled())
  const payload = rpc.mock.calls.at(-1)![1].payload
  expect(payload).toHaveLength(1)
  expect(payload[0].source_id).toBe('s1')
})
