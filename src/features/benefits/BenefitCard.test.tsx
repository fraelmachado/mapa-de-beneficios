import { describe, it, expect } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '../../test/renderWithProviders'
import { BenefitCard } from './BenefitCard'
import type { MyBenefit } from './types'

const b: MyBenefit = {
  id: 'b1', title: 'Sala VIP em Guarulhos', summary: 'Acesso gratuito', category: 'viagem',
  scope: 'pontual', uf: null, steps: null, partner_name: 'Mastercard', valid_until: null,
  image_url: null, action_url: null, action_label: null, created_at: '', via: ['Black/Infinite'],
}

describe('BenefitCard', () => {
  it('mostra título, parceiro e a fonte via, com link para o detalhe', () => {
    renderWithProviders(<BenefitCard benefit={b} />)
    expect(screen.getByText('Sala VIP em Guarulhos')).toBeInTheDocument()
    expect(screen.getByText(/Mastercard/)).toBeInTheDocument()
    expect(screen.getByText(/Black\/Infinite/)).toBeInTheDocument()
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/beneficio/b1')
  })
})
