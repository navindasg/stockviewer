import { useCallback } from 'react'
import { useAppStore } from '../../stores/appStore'
import { usePortfolioStats } from '../../hooks/usePortfolioStats'
import {
  formatCurrency,
  formatSignedCurrency,
  formatPercent
} from '../../utils/formatters'

const STALE_THRESHOLD_MS = 15 * 60 * 1000

function RefreshIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M13.5 2.5V6H10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2.5 13.5V10H6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 6A5 5 0 0112.3 4.3L13.5 6M2.5 10l1.2 1.7A5 5 0 0012.5 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M8 3V13M3 8H13"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function StaleIndicator() {
  return (
    <span
      className="inline-block w-2 h-2 rounded-full bg-sv-warning ml-2"
      title="Market data may be stale (last updated over 15 minutes ago)"
    />
  )
}

function isDataStale(quotesLastFetched: number | null): boolean {
  if (quotesLastFetched === null) return true
  return Date.now() - quotesLastFetched > STALE_THRESHOLD_MS
}

export function TopBar() {
  const { summary, isLoading } = usePortfolioStats()
  const quotesLastFetched = useAppStore((state) => state.quotesLastFetched)
  const positions = useAppStore((state) => state.positions)
  const fetchPositions = useAppStore((state) => state.fetchPositions)
  const fetchQuotes = useAppStore((state) => state.fetchQuotes)
  const setModalOpen = useAppStore((state) => state.setModalOpen)

  const stale = isDataStale(quotesLastFetched)
  const dayChangePositive = summary.totalDayChange >= 0

  const handleRefresh = useCallback(async () => {
    try {
      await fetchPositions()
      const tickers = positions.map((p) => p.ticker)
      if (tickers.length > 0) {
        await fetchQuotes(tickers)
      }
    } catch {
      // Error is thrown by store actions; UI will reflect stale state
    }
  }, [fetchPositions, fetchQuotes, positions])

  const handleAddTransaction = useCallback(() => {
    setModalOpen(true)
  }, [setModalOpen])

  return (
    <header className="flex items-center justify-between h-14 px-4 bg-sv-surface border-b border-sv-border">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sv-text-secondary text-sm">Portfolio Value</span>
          <span className="font-mono text-lg font-semibold text-sv-text tabular-nums">
            {isLoading ? '--' : formatCurrency(summary.totalValue)}
          </span>
          {stale && <StaleIndicator />}
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-sv-text-secondary text-sm">Day</span>
          <span
            className={`font-mono text-sm font-medium tabular-nums ${
              dayChangePositive ? 'text-sv-positive' : 'text-sv-negative'
            }`}
          >
            {isLoading
              ? '--'
              : `${formatSignedCurrency(summary.totalDayChange)} (${formatPercent(summary.totalDayChangePercent)})`}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleRefresh}
          className="
            flex items-center justify-center w-8 h-8 rounded
            text-sv-text-secondary hover:text-sv-text hover:bg-sv-elevated
            transition-colors duration-150 ease-in-out cursor-pointer
          "
          title="Refresh market data"
        >
          <RefreshIcon />
        </button>

        <button
          onClick={handleAddTransaction}
          className="
            flex items-center gap-1.5 h-8 px-3 rounded
            bg-sv-accent text-white text-sm font-medium
            hover:brightness-110
            transition-all duration-150 ease-in-out cursor-pointer
          "
        >
          <PlusIcon />
          <span>Add Transaction</span>
        </button>
      </div>
    </header>
  )
}
