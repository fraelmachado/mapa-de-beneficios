import type * as React from 'react'

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'className'> {
  /** Ícone à esquerda. */
  icon?: React.ReactNode
  ariaLabel?: string
  className?: string
}

export function Input({
  icon,
  ariaLabel,
  className,
  type = 'text',
  ...inputProps
}: InputProps) {
  return (
    <label className={['input', className].filter(Boolean).join(' ')}>
      {icon ? (
        <span className="muted" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <input
        {...inputProps}
        type={type}
        aria-label={ariaLabel ?? inputProps['aria-label'] ?? inputProps.placeholder}
      />
    </label>
  )
}
