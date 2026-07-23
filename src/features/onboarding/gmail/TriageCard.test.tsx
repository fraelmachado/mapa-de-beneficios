import { it, expect, vi } from 'vitest'
import { screen, fireEvent } from '@testing-library/react'
import { renderWithProviders as render } from '../../../test/renderWithProviders'
import { TriageCard } from './TriageCard'
import type { Finding } from './types'

const single: Finding = {
  sourceId: 's1', provider: 'Spotify', logo: null, category: 'retail',
  items: [{ id: 'i1', label: 'Premium', sort_order: 1 }],
  evidence: { gmailAccount: 'me@gmail.com', gmailMessageId: 'm1', emailFrom: 'no-reply@spotify.com', emailSubject: 'x', emailDate: '2026-01-01T00:00:00Z' },
}
const multi: Finding = {
  sourceId: 's2', provider: 'Nubank', logo: null, category: 'bank_card',
  items: [
    { id: 'gold', label: 'Gold', sort_order: 1, benefitCount: 2, estValueBrl: 420 },
    { id: 'plat', label: 'Platinum', sort_order: 2, benefitCount: 5, estValueBrl: 970 },
    { id: 'soon', label: 'Ultravioleta', sort_order: 3, benefitCount: 0, estValueBrl: 0 },
  ],
  evidence: { gmailAccount: 'me@gmail.com', gmailMessageId: 'm2', emailFrom: 'billing@nubank.com.br', emailSubject: 'y', emailDate: '2026-01-01T00:00:00Z' },
}

const base = { position: 1, total: 3, hasNext: true, onBack: vi.fn() }

it('mostra categoria, procedência e foca o título ao montar', () => {
  render(<TriageCard {...base} finding={single} decision={undefined} onDecide={vi.fn()} />)
  expect(screen.getByText('Varejo & assinaturas')).toBeInTheDocument()
  expect(screen.getByText('no-reply@spotify.com')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Spotify' })).toHaveFocus()
})

it('single: "Tenho ›" decide com o item único; "Não tenho" decide null', () => {
  const onDecide = vi.fn()
  render(<TriageCard {...base} finding={single} decision={undefined} onDecide={onDecide} />)
  fireEvent.click(screen.getByRole('button', { name: /Tenho ›/ }))
  expect(onDecide).toHaveBeenCalledWith('i1')
  fireEvent.click(screen.getByRole('button', { name: /^Não tenho$/ }))
  expect(onDecide).toHaveBeenCalledWith(null)
})

it('multi: toque no tier decide com o itemId dele; sem botão "Tenho ›"', () => {
  const onDecide = vi.fn()
  render(<TriageCard {...base} finding={multi} decision={undefined} onDecide={onDecide} />)
  expect(screen.queryByRole('button', { name: /Tenho ›/ })).not.toBeInTheDocument()
  fireEvent.click(screen.getByRole('button', { name: /Platinum/ }))
  expect(onDecide).toHaveBeenCalledWith('plat')
})

it('multi: "Não tenho certeza" escolhe o tier mais completo (mais benefícios)', () => {
  const onDecide = vi.fn()
  render(<TriageCard {...base} finding={multi} decision={undefined} onDecide={onDecide} />)
  fireEvent.click(screen.getByRole('button', { name: /Não tenho certeza/ }))
  expect(onDecide).toHaveBeenCalledWith('plat') // 5 benefícios > 2
})

it('tier sem benefício mostra "em breve" e não mostra valor', () => {
  render(<TriageCard {...base} finding={multi} decision={undefined} onDecide={vi.fn()} />)
  const soon = screen.getByRole('button', { name: /Ultravioleta/ })
  expect(soon).toHaveTextContent('benefícios em breve')
  expect(soon).not.toHaveTextContent('R$')
})

it('reabrir com decisão: o tier escolhido fica aria-pressed', () => {
  render(<TriageCard {...base} finding={multi} decision={'gold'} onDecide={vi.fn()} />)
  expect(screen.getByRole('button', { name: /Gold/ })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: /Platinum/ })).toHaveAttribute('aria-pressed', 'false')
})
