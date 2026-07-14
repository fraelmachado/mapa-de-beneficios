import { AdminSheet } from '../../ui/AdminSheet'
import { Button } from '../../ui/Button'

export function ConfirmDelete({
  open,
  title,
  message,
  onConfirm,
  onCancel,
}: {
  open: boolean
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <AdminSheet open={open} title={title} onClose={onCancel}>
      <p>{message}</p>
      <div className="aa-dialog-actions">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button className="danger" onClick={onConfirm}>Remover</Button>
      </div>
    </AdminSheet>
  )
}
