import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const saveItem = vi.fn()
const deleteItem = vi.fn()
vi.mock('./useSourceItems', () => ({
  useSaveSourceItem: () => ({ mutateAsync: saveItem, isPending: false }),
  useDeleteSourceItem: () => ({ mutateAsync: deleteItem, isPending: false }),
}))

import { SourceItemsEditor } from './SourceItemsEditor'
import type { SourceItemRow } from './types'

const items: SourceItemRow[] = [
  { id: 'i1', source_id: 's1', label: 'Black', sort_order: 1, card_brand: 'VISA', card_level: 'BLACK', pluggy_product: 'CREDIT_CARDS' },
]

beforeEach(() => {
  saveItem.mockReset(); saveItem.mockResolvedValue(undefined)
  deleteItem.mockReset(); deleteItem.mockResolvedValue(undefined)
})

describe('SourceItemsEditor', () => {
  it('lista variantes e adiciona uma nova', async () => {
    render(<SourceItemsEditor sourceId="s1" items={items} />)
    expect(screen.getByText('Black')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText(/nova variante/i), { target: { value: 'Platinum' } })
    fireEvent.click(screen.getByRole('button', { name: /adicionar/i }))
    await waitFor(() => expect(saveItem).toHaveBeenCalledWith(expect.objectContaining({ source_id: 's1', label: 'Platinum' })))
  })

  it('remove uma variante — confirmação inline (D11), não deleta no 1º clique', async () => {
    render(<SourceItemsEditor sourceId="s1" items={items} />)
    fireEvent.click(screen.getByRole('button', { name: /remover Black/i }))
    expect(deleteItem).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: /confirmar/i }))
    await waitFor(() => expect(deleteItem).toHaveBeenCalledWith('i1'))
  })

  it('Cancelar no confirm inline não deleta', () => {
    render(<SourceItemsEditor sourceId="s1" items={items} />)
    fireEvent.click(screen.getByRole('button', { name: /remover Black/i }))
    fireEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(deleteItem).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /remover Black/i })).toBeInTheDocument()
  })
})
