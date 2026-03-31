import { useState, useCallback } from 'react'
import { useAppStore } from '../stores/appStore'
import type { PricePoint } from '../types/index'

const STALE_THRESHOLD_MS = 15 * 60 * 1000

export function useMarketData(ticker: string) {
  const quote = useAppStore((state) => state.quotes[ticker] ?? null)
  const quotesLastFetched = useAppStore((state) => state.quotesLastFetched)

  const [historicalPrices, setHistoricalPrices] = useState<ReadonlyArray<PricePoint>>([])
  const [isLoading, setIsLoading] = useState(false)

  const isStale =
    quotesLastFetched === null || Date.now() - quotesLastFetched > STALE_THRESHOLD_MS

  const fetchHistorical = useCallback(
    async (from: string, to: string) => {
      setIsLoading(true)
      try {
        const prices = await window.electronAPI.getHistoricalPrices(ticker, from, to)
        setHistoricalPrices(prices)
      } catch (error) {
        throw new Error(
          `Failed to fetch historical prices for ${ticker}: ${error instanceof Error ? error.message : String(error)}`
        )
      } finally {
        setIsLoading(false)
      }
    },
    [ticker]
  )

  return {
    quote,
    historicalPrices,
    isLoading,
    isStale,
    fetchHistorical
  } as const
}
