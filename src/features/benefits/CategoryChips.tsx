import { CATEGORIES, type BenefitCategory } from './types'
import { Chip } from '../../ui/Chip'
import { categoryToDsCat } from './toPassProps'

export function CategoryChips({
  selected,
  onChange,
}: {
  selected: BenefitCategory | null
  onChange: (c: BenefitCategory | null) => void
}) {
  return (
    <div className="chips" style={{ overflowX: 'auto', flexWrap: 'nowrap', paddingBottom: 2 }}>
      <Chip active={selected === null} onClick={() => onChange(null)}>
        Todos
      </Chip>
      {CATEGORIES.map((c) => (
        <Chip
          key={c.key}
          category={categoryToDsCat(c.key)}
          active={selected === c.key}
          onClick={() => onChange(selected === c.key ? null : c.key)}
        >
          {c.label}
        </Chip>
      ))}
    </div>
  )
}
