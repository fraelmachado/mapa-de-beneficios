import { useEffect, useId, useRef, type ReactNode } from 'react'

export function AdminSheet({ open, title, onClose, wide, closeOnBackdrop = true, children }: {
  open: boolean; title: string; onClose: () => void; wide?: boolean; closeOnBackdrop?: boolean; children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const prev = useRef<HTMLElement | null>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current; if (!d) return
    if (open && !d.open) { prev.current = document.activeElement as HTMLElement; d.showModal() }
    else if (!open && d.open) d.close()
  }, [open])
  useEffect(() => { if (!open && prev.current) { prev.current.focus?.(); prev.current = null } }, [open])
  // onClose vem SÓ de eventos do usuário (Escape via onCancel, backdrop via onClick) — nunca do close() programático.
  return (
    <dialog
      ref={ref}
      className={'aa-dialog' + (wide ? ' aa-wide' : '')}
      aria-labelledby={titleId}
      onCancel={(e) => { e.preventDefault(); onClose() }}
      onClick={closeOnBackdrop ? (e) => { if (e.target === ref.current) onClose() } : undefined}
    >
      <div className="aa-grip" aria-hidden="true" />
      <h2 id={titleId} className="aa-dialog-title">{title}</h2>
      {children}
    </dialog>
  )
}
