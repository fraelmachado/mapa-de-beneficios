import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { useEffect } from 'react'
import { ToastHost, useToast } from './Toast'

function ShowOnMount({ message }: { message: string }) {
  const { show } = useToast()
  useEffect(() => {
    show(message)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return null
}

describe('Toast', () => {
  it('exibe a mensagem via role=status', async () => {
    render(
      <ToastHost>
        <ShowOnMount message="Salvo" />
      </ToastHost>,
    )
    expect(await screen.findByRole('status')).toHaveTextContent('Salvo')
  })
})
