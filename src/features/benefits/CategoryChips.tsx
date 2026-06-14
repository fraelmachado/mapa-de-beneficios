import { CATEGORIES, type BenefitCategory } from './types'

export function CategoryChips({
  selected,
  onChange,
}: {
  selected: BenefitCategory | null
  onChange: (c: BenefitCategory | null) => void
}) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <button
        type="button"
        onClick={() => onChange(null)}
        className={
          'shrink-0 rounded-full border px-3 py-1 text-sm ' +
          (selected === null ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 text-slate-700')
        }
      >
        Todos
      </button>
      {CATEGORIES.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => onChange(selected === c.key ? null : c.key)}
          className={
            'shrink-0 rounded-full border px-3 py-1 text-sm ' +
            (selected === c.key ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 text-slate-700')
          }
        >
          {c.emoji} {c.label}
        </button>
      ))}
    </div>
  )
}
