import { useFilters } from '../../hooks/useFilters'
import { SearchFilter } from './SearchFilter'
import { GainLossFilter } from './GainLossFilter'
import { SectorFilter } from './SectorFilter'
import { DateRangeFilter } from './DateRangeFilter'

export function FilterBar() {
  const { hasActiveFilters, activeFilterCount, clearFilters } = useFilters()

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg bg-sv-surface border border-sv-border px-4 py-3">
      <SearchFilter />

      <div className="h-5 w-px bg-sv-border" />

      <GainLossFilter />

      <div className="h-5 w-px bg-sv-border" />

      <SectorFilter />

      <div className="h-5 w-px bg-sv-border" />

      <DateRangeFilter />

      {hasActiveFilters && (
        <>
          <div className="h-5 w-px bg-sv-border" />
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-sv-negative border border-sv-negative/30 hover:bg-sv-negative/10 transition-colors"
          >
            <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
            Clear All
            <span className="inline-flex items-center justify-center h-4 w-4 rounded-full bg-sv-negative/20 text-sv-negative text-[10px] font-bold">
              {activeFilterCount}
            </span>
          </button>
        </>
      )}
    </div>
  )
}
