import { it, expect, vi } from 'vitest'
import { screen, fireEvent, waitFor } from '@testing-library/react'
// ponytail: brief used bare `render`, but RevisarGmail's useAddGmailSources() calls
// useMutation() which needs a QueryClientProvider in the tree or it throws synchronously.
// renderWithProviders already wraps that (same fix ManualWizard.test.tsx uses for
// useSaveUserSources's useMutation) — reuse it instead of inventing a local wrapper.
import { renderWithProviders as render } from '../../test/renderWithProviders'
import { RevisarGmail } from './RevisarGmail'
import type { Finding } from './gmail/types'

const rpc = vi.fn(async (..._args: any[]) => ({ error: null }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: (...a: any[]) => rpc(...a) } }))
vi.mock('../auth/AuthProvider', () => ({ useSession: () => ({ session: { user: { id: 'u1' } } }) }))

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

it('marca de item único salva direto via add_gmail_sources', async () => {
  const onDone = vi.fn()
  render(<RevisarGmail findings={[single]} partial={false} onDone={onDone} />)
  fireEvent.click(screen.getByRole('button', { name: /adicionar ao radar/i }))
  await waitFor(() => expect(rpc).toHaveBeenCalledWith('add_gmail_sources', expect.anything()))
  const payload = rpc.mock.calls.at(-1)![1].payload
  expect(payload[0].item_id).toBe('i1')
  expect(onDone).toHaveBeenCalled()
})

it('marca multi-tier bloqueia a CTA até escolher o tier', async () => {
  render(<RevisarGmail findings={[multi]} partial={false} onDone={vi.fn()} />)
  expect(screen.getByRole('button', { name: /adicionar ao radar/i })).toBeDisabled()
  fireEvent.click(screen.getByRole('button', { name: /Nubank/i })) // abre a sheet
  fireEvent.click(screen.getByRole('button', { name: /Platinum/i }))
  await waitFor(() => expect(screen.getByRole('button', { name: /adicionar ao radar/i })).not.toBeDisabled())
})
