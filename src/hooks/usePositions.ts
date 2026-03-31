import { useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import type { Position, Quote } from '../types/index'
import type { FilterState } from '../stores/appStore'

function matchesSearchText(position: Position, searchText: string): boolean {
  const lower = searchText.toLowerCase()
  return (
    position.ticker.toLowerCase().includes(lower) ||
    position.companyName.toLowerCase().includes(lower)
  )
}

function matchesPositionStatus(
  position: Position,
  statusFilter: FilterState['positionStatus']
): boolean {
  if (statusFilter === 'all') return true
  if (statusFilter === 'open') return position.status === 'OPEN'
  return position.status === 'CLOSED'
}

function matchesGainStatus(
  position: Position,
  gainStatus: FilterState['gainStatus'],
  quotes: Readonly<Record<string, Quote>>
): boolean {
  if (gainStatus === 'all') return true

  const quote = quotes[position.ticker]
  if (!quote || position.totalShares === 0) return false

  const unrealizedGain = (quote.price - position.costBasis) * position.totalShares
  if (gainStatus === 'winners') return unrealizedGain > 0
  return unrealizedGain < 0
}

function matchesSector(
  position: Position,
  sectors: ReadonlyArray<string>,
  quotes: Readonly<Record<string, Quote>>
): boolean {
  if (sectors.length === 0) return true

  const quote = quotes[position.ticker]
  return quote?.sector != null && sectors.includes(quote.sector)
}

function applyFilters(
  positions: ReadonlyArray<Position>,
  filters: FilterState,
  quotes: Readonly<Record<string, Quote>>
): ReadonlyArray<Position> {
  return positions.filter(
    (pos) =>
      matchesSearchText(pos, filters.searchText) &&
      matchesPositionStatus(pos, filters.positionStatus) &&
      matchesGainStatus(pos, filters.gainStatus, quotes) &&
      matchesSector(pos, filters.sectors, quotes)
  )
}

export function usePositions() {
  const positions = useAppStore((state) => state.positions)
  const positionsLoading = useAppStore((state) => state.positionsLoading)
  const selectedTicker = useAppStore((state) => state.selectedTicker)
  const filters = useAppStore((state) => state.filters)
  const quotes = useAppStore((state) => state.quotes)

  const filteredPositions = useMemo(
    () => applyFilters(positions, filters, quotes),
    [positions, filters, quotes]
  )

  return {
    positions,
    filteredPositions,
    isLoading: positionsLoading,
    selectedTicker
  } as const
}
