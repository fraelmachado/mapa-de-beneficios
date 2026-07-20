// src/features/programas/ProgramSheet.test.tsx
import { it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ProgramSheet } from './ProgramSheet'
import type { Program } from './buildPrograms'

const multi: Program = { itemId: 'plat', sourceId: 's1', brand: 'Nubank', tier: 'Platinum',
  items: [{ id: 'gold', label: 'Gold', sort_order: 1 }, { id: 'plat', label: 'Platinum', sort_order: 2 }],
  logo: null, provenance: 'gmail', when: 'há 3 dias', from: 'a@nubank.com.br' }
const single: Program = { itemId: 'prem', sourceId: 's2', brand: 'Spotify', tier: 'Premium',
  items: [{ id: 'prem', label: 'Premium', sort_order: 1 }], logo: null, provenance: 'manual', when: '', from: '' }

it('multi-tier troca ao tocar na versão', () => {
  const onPickTier = vi.fn()
  render(<ProgramSheet program={multi} onPickTier={onPickTier} onRemove={vi.fn()} onClose={vi.fn()} />)
  fireEvent.click(screen.getByRole('button', { name: /Gold/ }))
  expect(onPickTier).toHaveBeenCalledWith('gold')
})
it('single-tier só tem Remover; Escape fecha', () => {
  const onRemove = vi.fn(), onClose = vi.fn()
  render(<ProgramSheet program={single} onPickTier={vi.fn()} onRemove={onRemove} onClose={onClose} />)
  expect(screen.queryByRole('button', { name: /Premium/ })).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: /Remover do radar/ }))
  expect(onRemove).toHaveBeenCalled()
  fireEvent.keyDown(document, { key: 'Escape' })
  expect(onClose).toHaveBeenCalled()
})
