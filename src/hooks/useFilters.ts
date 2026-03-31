import { useAppStore } from '../stores/appStore'

export function useFilters() {
  const filters = useAppStore((state) => state.filters)
  const setFilter = useAppStore((state) => state.setFilter)
  const clearFilters = useAppStore((state) => state.clearFilters)

  const hasActiveFilters =
    filters.searchText !== '' ||
    filters.positionStatus !== 'all' ||
    filters.gainStatus !== 'all' ||
    filters.sector !== null ||
    filters.dateFrom !== null ||
    filters.dateTo !== null

  return {
    filters,
    setFilter,
    clearFilters,
    hasActiveFilters
  } as const
}
