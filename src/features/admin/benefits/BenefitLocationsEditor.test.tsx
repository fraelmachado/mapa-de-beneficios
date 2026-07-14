import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const saveLoc = vi.fn()
const delLoc = vi.fn()
vi.mock('./useBenefitLocations', () => ({
  useSaveBenefitLocation: () => ({ mutateAsync: saveLoc, isPending: false }),
  useDeleteBenefitLocation: () => ({ mutateAsync: delLoc, isPending: false }),
}))

import { BenefitLocationsEditor } from './BenefitLocationsEditor'
import type { BenefitLocationRow } from './types'

const locations: BenefitLocationRow[] = [
  { id: 'l1', benefit_id: 'b1', name: 'GRU T2', lat: -23.4, lng: -46.4, address: null, city: 'Guarulhos', uf: 'SP', radius_m: null, active: true },
]

beforeEach(() => {
  saveLoc.mockReset(); saveLoc.mockResolvedValue(undefined)
  delLoc.mockReset(); delLoc.mockResolvedValue(undefined)
})

describe('BenefitLocationsEditor', () => {
  it('lista e adiciona um local', async () => {
    render(<BenefitLocationsEditor benefitId="b1" locations={locations} />)
    expect(screen.getByText('GRU T2')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/nome do local/i), { target: { value: 'Loja Centro' } })
    fireEvent.change(screen.getByLabelText(/^lat/i), { target: { value: '-23.5' } })
    fireEvent.change(screen.getByLabelText(/^lng/i), { target: { value: '-46.6' } })
    fireEvent.click(screen.getByRole('button', { name: /adicionar local/i }))
    await waitFor(() => expect(saveLoc).toHaveBeenCalledWith(expect.objectContaining({ benefit_id: 'b1', name: 'Loja Centro', lat: -23.5, lng: -46.6 })))
  })

  it('remove um local — confirmação inline (D11), não deleta no 1º clique', async () => {
    render(<BenefitLocationsEditor benefitId="b1" locations={locations} />)
    fireEvent.click(screen.getByRole('button', { name: /remover GRU T2/i }))
    expect(delLoc).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => expect(delLoc).toHaveBeenCalledWith('l1'))
  })

  it('Cancelar no confirm inline não deleta', () => {
    render(<BenefitLocationsEditor benefitId="b1" locations={locations} />)
    fireEvent.click(screen.getByRole('button', { name: /remover GRU T2/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(delLoc).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /remover GRU T2/i })).toBeInTheDocument()
  })
})
