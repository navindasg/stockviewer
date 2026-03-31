import { useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import { computePortfolioSummary } from '../utils/calculations'

export function usePortfolioStats() {
  const positions = useAppStore((state) => state.positions)
  const quotes = useAppStore((state) => state.quotes)
  const positionsLoading = useAppStore((state) => state.positionsLoading)

  const summary = useMemo(() => {
    const quotesArray = Object.values(quotes)
    return computePortfolioSummary(positions, quotesArray)
  }, [positions, quotes])

  return {
    summary,
    isLoading: positionsLoading
  } as const
}
