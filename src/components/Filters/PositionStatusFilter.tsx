import { useFilters } from '../../hooks/useFilters'
import type { PositionStatusFilter as PositionStatusValue } from '../../stores/appStore'

const OPTIONS: ReadonlyArray<{
  readonly value: PositionStatusValue
  readonly label: string
}> = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'closed', label: 'Closed' }
]

export function PositionStatusFilter() {
  const { filters, setFilter } = useFilters()

  return (
    <div className="flex items-center gap-1">
      {OPTIONS.map((opt) => {
        const isActive = filters.positionStatus === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilter('positionStatus', opt.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              isActive
                ? 'bg-sv-accent text-white border-sv-accent'
                : 'border-sv-border text-sv-text-muted hover:text-sv-text hover:border-sv-text-muted'
            }`}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
