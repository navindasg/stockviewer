import { useCallback, useMemo } from 'react'
import { useAppStore } from '../../stores/appStore'
import { usePortfolioStats } from '../../hooks/usePortfolioStats'
import { PortfolioSwitcher } from '../Portfolios/PortfolioSwitcher'
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

function isUSMarketOpen(now: Date): boolean {
  const day = now.getDay()
  if (day === 0 || day === 6) return false

  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const hours = et.getHours()
  const minutes = et.getMinutes()
  const totalMinutes = hours * 60 + minutes

  const marketOpen = 9 * 60 + 30
  const marketClose = 16 * 60

  return totalMinutes >= marketOpen && totalMinutes < marketClose
}

function formatLastClosedDate(): string {
  const now = new Date()
  const et = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  const day = et.getDay()
  const hours = et.getHours()
  const minutes = et.getMinutes()
  const totalMinutes = hours * 60 + minutes

  const date = new Date(et)
  if (day === 0) {
    date.setDate(date.getDate() - 2)
  } else if (day === 6) {
    date.setDate(date.getDate() - 1)
  } else if (totalMinutes < 9 * 60 + 30) {
    if (day === 1) {
      date.setDate(date.getDate() - 3)
    } else {
      date.setDate(date.getDate() - 1)
    }
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function MarketHoursIndicator() {
  const marketOpen = useMemo(() => isUSMarketOpen(new Date()), [])
  const closedDate = useMemo(() => (marketOpen ? '' : formatLastClosedDate()), [marketOpen])

  if (marketOpen) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-sv-positive">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-sv-positive animate-pulse" />
        Market Open
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-sv-text-muted">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-sv-text-muted" />
      Market Closed
      {closedDate && <span className="text-sv-text-muted">&middot; As of {closedDate}</span>}
    </span>
  )
}

function formatTimeSince(timestamp: number): string {
  const diffMs = Date.now() - timestamp
  const diffMinutes = Math.floor(diffMs / 60_000)

  if (diffMinutes < 1) return 'Updated just now'
  if (diffMinutes < 60) return `Updated ${diffMinutes}m ago`
  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `Updated ${diffHours}h ago`
  return `Updated ${Math.floor(diffHours / 24)}d ago`
}

function isDataStale(quotesLastFetched: number | null): boolean {
  if (quotesLastFetched === null) return true
  return Date.now() - quotesLastFetched > STALE_THRESHOLD_MS
}

interface StaleIndicatorProps {
  readonly quotesLastFetched: number | null
  readonly onRefresh: () => void
}

function StaleIndicator({ quotesLastFetched, onRefresh }: StaleIndicatorProps) {
  const timeSince = quotesLastFetched !== null
    ? formatTimeSince(quotesLastFetched)
    : 'No data loaded'

  return (
    <button
      type="button"
      onClick={onRefresh}
      className="
        flex items-center gap-1.5 px-2 py-0.5 rounded
        text-xs text-sv-warning hover:bg-sv-elevated
        transition-colors duration-150 cursor-pointer
      "
      title="Click to refresh market data"
    >
      <span className="inline-block w-2 h-2 rounded-full bg-sv-warning" />
      {timeSince}
    </button>
  )
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
        <PortfolioSwitcher />
        <div className="flex items-center gap-2">
          <span className="text-sv-text-secondary text-sm">Portfolio Value</span>
          <span className="font-mono text-lg font-semibold text-sv-text tabular-nums">
            {isLoading ? '--' : formatCurrency(summary.totalValue)}
          </span>
          {stale && <StaleIndicator quotesLastFetched={quotesLastFetched} onRefresh={handleRefresh} />}
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

        <MarketHoursIndicator />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleRefresh}
          className="
            flex items-center justify-center w-8 h-8 rounded
            text-sv-text-secondary hover:text-sv-text hover:bg-sv-elevated
            transition-colors duration-150 ease-in-out cursor-pointer
          "
          title="Refresh market data (Ctrl+R)"
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
          title="Add Transaction (Ctrl+N)"
        >
          <PlusIcon />
          <span>Add Transaction</span>
        </button>
      </div>
    </header>
  )
}
