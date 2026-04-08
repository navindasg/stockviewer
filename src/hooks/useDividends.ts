import { useEffect, useMemo } from 'react'
import { useDividendStore } from '../stores/dividendStore'

export function useDividends(ticker?: string) {
  const dividends = useDividendStore((s) => s.dividends)
  const dividendsLoading = useDividendStore((s) => s.dividendsLoading)
  const fetchDividends = useDividendStore((s) => s.fetchDividends)

  useEffect(() => {
    const filters = ticker ? { ticker } : undefined
    fetchDividends(filters).catch(() => {})
  }, [ticker, fetchDividends])

  const filtered = useMemo(() => {
    if (!ticker) return dividends
    return dividends.filter((d) => d.ticker === ticker.toUpperCase())
  }, [dividends, ticker])

  return {
    dividends: filtered,
    isLoading: dividendsLoading
  } as const
}

export function useDividendSummary() {
  const summary = useDividendStore((s) => s.summary)
  const summaryLoading = useDividendStore((s) => s.summaryLoading)
  const fetchDividendSummary = useDividendStore((s) => s.fetchDividendSummary)

  useEffect(() => {
    fetchDividendSummary().catch(() => {})
  }, [fetchDividendSummary])

  return {
    summary,
    isLoading: summaryLoading
  } as const
}

export function useDividendInfo(ticker: string) {
  const info = useDividendStore((s) => s.dividendInfo[ticker] ?? null)
  const fetchDividendInfo = useDividendStore((s) => s.fetchDividendInfo)

  useEffect(() => {
    if (ticker) {
      fetchDividendInfo(ticker).catch(() => {})
    }
  }, [ticker, fetchDividendInfo])

  return info
}
