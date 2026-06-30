import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BenefitSourcesEditor } from './BenefitSourcesEditor'
import type { SourceRow } from '../sources/types'

const sources: SourceRow[] = [
  { id: 's1', kind: 'card', source_category: 'bank_card', name: 'Itaú', logo_url: null, sort_order: 1, active: true,
    connector_type: null, pluggy_connector_id: null, institution_url: null, primary_color: null, country: 'BR',
    source_items: [
      { id: 'i1', source_id: 's1', label: 'Black', sort_order: 1, card_brand: null, card_level: null, pluggy_product: null },
      { id: 'i2', source_id: 's1', label: 'Platinum', sort_order: 2, card_brand: null, card_level: null, pluggy_product: null },
    ] },
]

describe('BenefitSourcesEditor', () => {
  it('marca/desmarca variantes e chama onChange', () => {
    const onChange = vi.fn()
    render(<BenefitSourcesEditor sources={sources} selected={['i1']} onChange={onChange} />)
    const black = screen.getByRole('checkbox', { name: /black/i })
    expect(black).toBeChecked()
    fireEvent.click(screen.getByRole('checkbox', { name: /platinum/i }))
    expect(onChange).toHaveBeenCalledWith(['i1', 'i2'])
    fireEvent.click(black)
    expect(onChange).toHaveBeenCalledWith([])
  })
})
