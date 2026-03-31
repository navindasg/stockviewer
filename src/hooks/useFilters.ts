import { useAppStore } from '../stores/appStore'

export function useFilters() {
  const filters = useAppStore((state) => state.filters)
  const setFilter = useAppStore((state) => state.setFilter)
  const clearFilters = useAppStore((state) => state.clearFilters)

  const activeFilterCount = [
    filters.searchText !== '',
    filters.positionStatus !== 'all',
    filters.gainStatus !== 'all',
    filters.sectors.length > 0,
    filters.dateFrom !== null || filters.dateTo !== null
  ].filter(Boolean).length

  const hasActiveFilters = activeFilterCount > 0

  return {
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters,
    activeFilterCount
  } as const
}
