import { useState } from 'react'
import { AdminSheet } from '../../../ui/AdminSheet'
import { Button } from '../../../ui/Button'

export function RejectDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean
  onClose: () => void
  onConfirm: (reason: string) => void
}) {
  const [reason, setReason] = useState('')

  function close() {
    setReason('')
    onClose()
  }

  return (
    <AdminSheet open={open} title="Rejeitar candidato" closeOnBackdrop onClose={close}>
      <label>
        Motivo
        <textarea aria-label="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
      </label>
      <div className="aa-dialog-actions">
        <Button variant="ghost" onClick={close}>Cancelar</Button>
        <Button
          className="danger"
          onClick={() => {
            onConfirm(reason)
            setReason('')
          }}
        >
          Confirmar rejeição
        </Button>
      </div>
    </AdminSheet>
  )
}
