import { sub, format } from 'date-fns'
import type { PricePoint } from '../../types/index'

export type CompareTimeRange = '1M' | '3M' | '6M' | '1Y' | 'ALL'

export const COMPARE_RANGES: ReadonlyArray<{
  readonly value: CompareTimeRange
  readonly label: string
}> = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'ALL' }
]

export function getCompareStartDate(range: CompareTimeRange): string {
  const now = new Date()

  switch (range) {
    case '1M':
      return format(sub(now, { months: 1 }), 'yyyy-MM-dd')
    case '3M':
      return format(sub(now, { months: 3 }), 'yyyy-MM-dd')
    case '6M':
      return format(sub(now, { months: 6 }), 'yyyy-MM-dd')
    case '1Y':
      return format(sub(now, { years: 1 }), 'yyyy-MM-dd')
    case 'ALL':
      return '1970-01-01'
  }
}

export function getTodayStr(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export interface NormalizedPoint {
  readonly date: string
  readonly [ticker: string]: number | string
}

export function normalizePriceSeries(
  allPrices: Readonly<Record<string, ReadonlyArray<PricePoint>>>,
  tickers: ReadonlyArray<string>
): ReadonlyArray<NormalizedPoint> {
  const dateSet = new Set<string>()
  const tickerMaps: Record<string, Map<string, number>> = {}
  const startPrices: Record<string, number> = {}

  for (const ticker of tickers) {
    const prices = allPrices[ticker]
    if (!prices || prices.length === 0) continue

    const map = new Map<string, number>()
    for (const p of prices) {
      const dateKey = p.date.slice(0, 10)
      dateSet.add(dateKey)
      map.set(dateKey, p.close)
    }
    tickerMaps[ticker] = map
    startPrices[ticker] = prices[0].close
  }

  const sortedDates = [...dateSet].sort()

  return sortedDates.map((date) => {
    const point: Record<string, number | string> = { date }
    for (const ticker of tickers) {
      const map = tickerMaps[ticker]
      const start = startPrices[ticker]
      if (!map || !start) continue

      const price = map.get(date)
      if (price != null) {
        point[ticker] = ((price - start) / start) * 100
      }
    }
    return point as NormalizedPoint
  })
}

export function formatXAxis(range: CompareTimeRange): (dateStr: string) => string {
  return (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      if (range === '1M') {
        return format(d, 'MMM dd')
      }
      return format(d, "MMM ''yy")
    } catch {
      return dateStr
    }
  }
}

export function formatYAxis(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export const MAX_SELECTIONS = 4
export const MIN_SELECTIONS = 2
