import { useMemo } from 'react'
import { useAppStore } from '../stores/appStore'
import { useDividendStore } from '../stores/dividendStore'
import { computePortfolioSummary } from '../utils/calculations'

export function usePortfolioStats() {
  const positions = useAppStore((state) => state.positions)
  const quotes = useAppStore((state) => state.quotes)
  const positionsLoading = useAppStore((state) => state.positionsLoading)
  const dividendSummary = useDividendStore((state) => state.summary)

  const summary = useMemo(() => {
    const quotesArray = Object.values(quotes)
    const totalDividendIncome = dividendSummary?.totalIncomeAllTime ?? 0
    return computePortfolioSummary(positions, quotesArray, totalDividendIncome)
  }, [positions, quotes, dividendSummary])

  return {
    summary,
    isLoading: positionsLoading
  } as const
}
