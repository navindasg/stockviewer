import { format } from 'date-fns'
import type { TWRDataPoint, BenchmarkTimeRange } from '../../types/index'

export const BENCHMARK_RANGES: ReadonlyArray<{
  readonly value: BenchmarkTimeRange
  readonly label: string
}> = [
  { value: '1M', label: '1M' },
  { value: '3M', label: '3M' },
  { value: '6M', label: '6M' },
  { value: 'YTD', label: 'YTD' },
  { value: '1Y', label: '1Y' },
  { value: 'ALL', label: 'ALL' }
]

export interface ChartDataPoint {
  readonly date: string
  readonly portfolio?: number
  readonly benchmark?: number
}

/**
 * Merge portfolio and benchmark TWR series into a unified chart dataset.
 * Aligns by date so both lines share the same x-axis.
 */
export function mergeChartData(
  portfolioTWR: ReadonlyArray<TWRDataPoint>,
  benchmarkTWR: ReadonlyArray<TWRDataPoint>
): ReadonlyArray<ChartDataPoint> {
  const dateMap = new Map<string, ChartDataPoint>()

  for (const point of portfolioTWR) {
    dateMap.set(point.date, {
      date: point.date,
      portfolio: point.cumulativeReturn
    })
  }

  for (const point of benchmarkTWR) {
    const existing = dateMap.get(point.date)
    if (existing) {
      dateMap.set(point.date, { ...existing, benchmark: point.cumulativeReturn })
    } else {
      dateMap.set(point.date, { date: point.date, benchmark: point.cumulativeReturn })
    }
  }

  return [...dateMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, point]) => point)
}

/**
 * Format x-axis tick label based on the selected time range.
 */
export function formatXAxisTick(range: BenchmarkTimeRange): (dateStr: string) => string {
  return (dateStr: string) => {
    try {
      const d = new Date(dateStr)
      if (range === '1M' || range === '3M' || range === '6M') {
        return format(d, 'MMM dd')
      }
      return format(d, "MMM ''yy")
    } catch {
      return dateStr
    }
  }
}

/**
 * Format y-axis value as percentage with sign.
 */
export function formatYAxisTick(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

/**
 * Format a return value for display in stat cards.
 */
export function formatReturnValue(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

/**
 * Format a drawdown value for display (always negative or zero).
 */
export function formatDrawdownValue(value: number): string {
  if (value === 0) return '0.00%'
  return `-${value.toFixed(2)}%`
}
