export interface SegmentedOption {
  label: string
  value: string
  count?: number
}

export interface SegmentedControlProps {
  options: SegmentedOption[]
  /** Valor selecionado. */
  value?: string
  onChange?: (value: string) => void
  ariaLabel?: string
}

export function SegmentedControl({ options = [], value, onChange, ariaLabel }: SegmentedControlProps) {
  return (
    <div className="seg" role="tablist" aria-label={ariaLabel}>
      {options.map((opt) => (
        <button
          key={opt.value}
          className={opt.value === value ? 'on' : ''}
          type="button"
          role="tab"
          aria-selected={opt.value === value}
          onClick={onChange ? () => onChange(opt.value) : undefined}
        >
          {opt.label}
          {typeof opt.count === 'number' ? <span className="n">{opt.count}</span> : null}
        </button>
      ))}
    </div>
  )
}
