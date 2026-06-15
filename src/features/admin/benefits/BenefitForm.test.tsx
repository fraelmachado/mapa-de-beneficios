import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
vi.mock('../upload/ImageUpload', () => ({
  ImageUpload: ({ onChange }: { onChange: (u: string) => void }) => (
    <button type="button" onClick={() => onChange('https://cdn.test/banner.png')}>mock-upload</button>
  ),
}))
import { BenefitForm } from './BenefitForm'
import type { SourceRow } from '../sources/types'

const sources: SourceRow[] = [
  { id: 's1', kind: 'card', name: 'Itaú', logo_url: null, sort_order: 1, active: true,
    connector_type: null, pluggy_connector_id: null, institution_url: null, primary_color: null, country: 'BR',
    source_items: [{ id: 'i1', source_id: 's1', label: 'Black', sort_order: 1, card_brand: null, card_level: null, pluggy_product: null }] },
]

describe('BenefitForm', () => {
  it('preenche, seleciona variante e submete', () => {
    const onSubmit = vi.fn()
    render(<BenefitForm initial={null} sources={sources} onSubmit={onSubmit} onCancel={() => {}} />)
    fireEvent.change(screen.getByLabelText(/título/i), { target: { value: 'Sala VIP' } })
    fireEvent.change(screen.getByLabelText(/resumo/i), { target: { value: 'Acesso grátis' } })
    fireEvent.change(screen.getByLabelText(/categoria/i), { target: { value: 'viagem' } })
    fireEvent.click(screen.getByRole('button', { name: /mock-upload/i }))
    fireEvent.click(screen.getByRole('checkbox', { name: /black/i }))
    fireEvent.click(screen.getByRole('button', { name: /salvar/i }))
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        input: expect.objectContaining({ title: 'Sala VIP', summary: 'Acesso grátis', category: 'viagem', image_url: 'https://cdn.test/banner.png', active: true }),
        sourceItemIds: ['i1'],
      }),
    )
  })
})
