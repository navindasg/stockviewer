import { useFilters } from '../../hooks/useFilters'
import type { GainStatus } from '../../stores/appStore'

const OPTIONS: ReadonlyArray<{
  readonly value: GainStatus
  readonly label: string
  readonly activeClass: string
}> = [
  { value: 'all', label: 'All', activeClass: 'bg-sv-accent text-white' },
  { value: 'winners', label: 'Winners', activeClass: 'bg-sv-positive/20 text-sv-positive border-sv-positive/40' },
  { value: 'losers', label: 'Losers', activeClass: 'bg-sv-negative/20 text-sv-negative border-sv-negative/40' }
]

export function GainLossFilter() {
  const { filters, setFilter } = useFilters()

  return (
    <div className="flex items-center gap-1">
      {OPTIONS.map((opt) => {
        const isActive = filters.gainStatus === opt.value
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => setFilter('gainStatus', opt.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              isActive
                ? opt.activeClass
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
