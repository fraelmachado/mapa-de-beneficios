import type * as React from 'react'

export interface InputProps {
  type?: string
  placeholder?: string
  value?: string
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void
  /** Ícone à esquerda. */
  icon?: React.ReactNode
  ariaLabel?: string
  id?: string
  required?: boolean
  disabled?: boolean
  className?: string
}

export function Input({
  type = 'text',
  placeholder,
  value,
  onChange,
  icon,
  ariaLabel,
  id,
  required,
  disabled,
  className,
}: InputProps) {
  return (
    <label className={['input', className].filter(Boolean).join(' ')}>
      {icon ? (
        <span className="muted" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        aria-label={ariaLabel ?? placeholder}
      />
    </label>
  )
}
