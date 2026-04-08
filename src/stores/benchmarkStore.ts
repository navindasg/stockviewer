import { create } from 'zustand'
import type { TWRDataPoint, BenchmarkStats, BenchmarkTimeRange } from '../types/index'

interface BenchmarkState {
  readonly benchmarkTicker: string
  readonly timeRange: BenchmarkTimeRange
  readonly portfolioTWR: ReadonlyArray<TWRDataPoint>
  readonly benchmarkTWR: ReadonlyArray<TWRDataPoint>
  readonly stats: BenchmarkStats | null
  readonly isLoading: boolean
  readonly error: string | null
}

interface BenchmarkActions {
  readonly setBenchmarkTicker: (ticker: string) => void
  readonly setTimeRange: (range: BenchmarkTimeRange) => void
  readonly fetchBenchmarkData: () => Promise<void>
  readonly clearError: () => void
}

type BenchmarkStore = BenchmarkState & BenchmarkActions

export const DEFAULT_BENCHMARKS: ReadonlyArray<{
  readonly ticker: string
  readonly label: string
}> = [
  { ticker: 'SPY', label: 'S&P 500 (SPY)' },
  { ticker: 'QQQ', label: 'Nasdaq 100 (QQQ)' },
  { ticker: 'DIA', label: 'Dow Jones (DIA)' },
  { ticker: 'IWM', label: 'Russell 2000 (IWM)' },
  { ticker: 'VTI', label: 'Total Market (VTI)' }
]

export const useBenchmarkStore = create<BenchmarkStore>()((set, get) => ({
  benchmarkTicker: 'SPY',
  timeRange: '1Y',
  portfolioTWR: [],
  benchmarkTWR: [],
  stats: null,
  isLoading: false,
  error: null,

  setBenchmarkTicker: (ticker: string) => {
    set({ benchmarkTicker: ticker.toUpperCase() })
  },

  setTimeRange: (range: BenchmarkTimeRange) => {
    set({ timeRange: range })
  },

  fetchBenchmarkData: async () => {
    const { benchmarkTicker, timeRange } = get()

    if (!benchmarkTicker) {
      set({ error: 'No benchmark ticker selected' })
      return
    }

    set({ isLoading: true, error: null })

    try {
      const to = new Date().toISOString().slice(0, 10)
      const from = computeFromDate(timeRange, to)

      // Ensure benchmark historical prices are cached before computing TWR
      await window.electronAPI.getHistoricalPrices(benchmarkTicker, from, to)

      // Single IPC call computes portfolio TWR, benchmark TWR, and stats together
      const data = await window.electronAPI.getBenchmarkData(benchmarkTicker, from, to)

      set({
        portfolioTWR: data.portfolioTWR,
        benchmarkTWR: data.benchmarkTWR,
        stats: data.stats,
        isLoading: false
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch benchmark data'
      set({ isLoading: false, error: message })
      throw new Error(message)
    }
  },

  clearError: () => {
    set({ error: null })
  }
}))

function computeFromDate(range: BenchmarkTimeRange, to: string): string {
  const end = new Date(to)

  switch (range) {
    case '1M': {
      const d = new Date(end)
      d.setMonth(d.getMonth() - 1)
      return d.toISOString().slice(0, 10)
    }
    case '3M': {
      const d = new Date(end)
      d.setMonth(d.getMonth() - 3)
      return d.toISOString().slice(0, 10)
    }
    case '6M': {
      const d = new Date(end)
      d.setMonth(d.getMonth() - 6)
      return d.toISOString().slice(0, 10)
    }
    case 'YTD': {
      return `${end.getFullYear()}-01-01`
    }
    case '1Y': {
      const d = new Date(end)
      d.setFullYear(d.getFullYear() - 1)
      return d.toISOString().slice(0, 10)
    }
    case 'ALL': {
      return '1970-01-01'
    }
  }
}
