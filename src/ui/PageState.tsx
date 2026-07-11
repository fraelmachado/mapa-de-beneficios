import type { ReactNode } from 'react'
import { Button } from './Button'

export interface PageStateProps {
  title: string
  description?: string
  action?: { label: string; onClick: () => void }
  children?: ReactNode
}

export function PageState({ title, description, action, children }: PageStateProps) {
  return (
    <section className="page-state">
      {children ? <div className="page-state-visual" aria-hidden="true">{children}</div> : null}
      <h2>{title}</h2>
      {description ? <p>{description}</p> : null}
      {action ? <div className="page-state-actions"><Button onClick={action.onClick}>{action.label}</Button></div> : null}
    </section>
  )
}
