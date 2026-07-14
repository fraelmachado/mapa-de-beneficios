import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminList } from './AdminList'

describe('AdminList', () => {
  it('renderiza role="table", uma role="row" por item e chama renderRow', () => {
    const rows = [{ id: '1', name: 'Alfa' }, { id: '2', name: 'Beta' }]
    const renderRow = vi.fn((r: (typeof rows)[number]) => <span>{r.name}</span>)
    render(
      <AdminList
        ariaLabel="Fontes"
        rows={rows}
        keyOf={(r) => r.id}
        renderRow={renderRow}
      />,
    )
    expect(screen.getByRole('table', { name: 'Fontes' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(2)
    expect(renderRow).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Alfa')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })
})
