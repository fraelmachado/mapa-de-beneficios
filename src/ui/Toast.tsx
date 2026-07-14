import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'

interface ToastItem {
  id: number
  message: string
}

interface ToastContextValue {
  show: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const AUTO_DISMISS_MS = 3200

/** Provider + renderizador da fila de toasts. Envolver a árvore uma vez (ex: no root do admin). */
export function ToastHost({ children }: { children?: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const nextId = useRef(0)

  const show = useCallback((message: string) => {
    const id = nextId.current++
    setItems((prev) => [...prev, { id, message }])
  }, [])

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {items.map((item) => (
        <ToastItemView key={item.id} item={item} onDismiss={dismiss} />
      ))}
    </ToastContext.Provider>
  )
}

function ToastItemView({ item, onDismiss }: { item: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(item.id), AUTO_DISMISS_MS)
    return () => clearTimeout(t)
  }, [item.id, onDismiss])

  return (
    <div role="status" aria-live="polite" className="aa-toast">
      {item.message}
    </div>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast deve ser usado dentro de <ToastHost>')
  return ctx
}
