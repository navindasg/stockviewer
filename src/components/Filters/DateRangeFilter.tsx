import { useFilters } from '../../hooks/useFilters'

export function DateRangeFilter() {
  const { filters, setFilter } = useFilters()

  return (
    <div className="flex items-center gap-2">
      <input
        type="date"
        value={filters.dateFrom ?? ''}
        onChange={(e) => setFilter('dateFrom', e.target.value || null)}
        className="px-2 py-1.5 rounded text-xs bg-sv-bg border border-sv-border text-sv-text focus:outline-none focus:border-sv-accent transition-colors [color-scheme:dark]"
        aria-label="From date"
      />
      <span className="text-xs text-sv-text-muted">to</span>
      <input
        type="date"
        value={filters.dateTo ?? ''}
        onChange={(e) => setFilter('dateTo', e.target.value || null)}
        className="px-2 py-1.5 rounded text-xs bg-sv-bg border border-sv-border text-sv-text focus:outline-none focus:border-sv-accent transition-colors [color-scheme:dark]"
        aria-label="To date"
      />
    </div>
  )
}
