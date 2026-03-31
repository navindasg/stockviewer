import { useState, useEffect } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { useAppStore } from '../../stores/appStore'
import { useMarketData } from '../../hooks/useMarketData'
import { PriceChart } from '../Charts/PriceChart'
import { TransactionHistory } from './TransactionHistory'
import {
  formatCurrency,
  formatSignedCurrency,
  formatPercent,
  formatShares
} from '../../utils/formatters'
import type { Transaction, Quote, Position } from '../../types/index'

function BackIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function StaleWarningIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  )
}

function getValueColorClass(value: number): string {
  if (value > 0) return 'text-sv-positive'
  if (value < 0) return 'text-sv-negative'
  return 'text-sv-text'
}

function computeHoldingPeriod(transactions: ReadonlyArray<Transaction>): string {
  if (transactions.length === 0) return '—'
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  )
  return formatDistanceToNow(parseISO(sorted[0].date), { addSuffix: false })
}

export function PositionDetail() {
  const selectedTicker = useAppStore((state) => state.selectedTicker)
  const positions = useAppStore((state) => state.positions)
  const setActiveView = useAppStore((state) => state.setActiveView)
  const setSelectedTicker = useAppStore((state) => state.setSelectedTicker)

  const [transactions, setTransactions] = useState<ReadonlyArray<Transaction>>([])
  const [txLoading, setTxLoading] = useState(false)

  if (selectedTicker === null) {
    return (
      <div className="flex items-center justify-center h-full text-sv-text-muted">
        Select a position from the dashboard to view details.
      </div>
    )
  }

  const position = positions.find((p) => p.ticker === selectedTicker) ?? null

  if (position === null) {
    return (
      <div className="flex items-center justify-center h-full text-sv-text-muted">
        Position not found for {selectedTicker}.
      </div>
    )
  }

  return (
    <PositionDetailInner
      ticker={selectedTicker}
      position={position}
      transactions={transactions}
      setTransactions={setTransactions}
      txLoading={txLoading}
      setTxLoading={setTxLoading}
      onBack={() => {
        setActiveView('dashboard')
        setSelectedTicker(null)
      }}
    />
  )
}

interface PositionDetailInnerProps {
  readonly ticker: string
  readonly position: Position
  readonly transactions: ReadonlyArray<Transaction>
  readonly setTransactions: (txs: ReadonlyArray<Transaction>) => void
  readonly txLoading: boolean
  readonly setTxLoading: (loading: boolean) => void
  readonly onBack: () => void
}

function PositionDetailInner({
  ticker,
  position,
  transactions,
  setTransactions,
  txLoading,
  setTxLoading,
  onBack
}: PositionDetailInnerProps) {
  const { quote, isStale } = useMarketData(ticker)

  useEffect(() => {
    let cancelled = false
    setTxLoading(true)
    window.electronAPI
      .getTransactions({ ticker })
      .then((txs) => {
        if (!cancelled) setTransactions(txs)
      })
      .catch((error) => {
        throw new Error(
          `Failed to load transactions: ${error instanceof Error ? error.message : String(error)}`
        )
      })
      .finally(() => {
        if (!cancelled) setTxLoading(false)
      })
    return () => { cancelled = true }
  }, [ticker, setTransactions, setTxLoading])

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      <DetailHeader
        ticker={ticker}
        companyName={position.companyName}
        color={position.color}
        isStale={isStale || (quote?.isStale ?? false)}
        onBack={onBack}
      />

      <div className="flex flex-1 gap-4 min-h-0">
        <div className="w-[60%] min-h-0">
          <PriceChart
            ticker={ticker}
            transactions={[...transactions]}
            costBasis={position.costBasis}
            color={position.color}
          />
        </div>

        <div className="w-[40%] flex flex-col gap-4 min-h-0 overflow-auto">
          <StatsPanel position={position} quote={quote} transactions={transactions} />
          {txLoading ? (
            <div className="text-sv-text-muted text-sm text-center py-4">Loading transactions...</div>
          ) : (
            <TransactionHistory transactions={transactions} ticker={ticker} />
          )}
        </div>
      </div>
    </div>
  )
}

interface DetailHeaderProps {
  readonly ticker: string
  readonly companyName: string
  readonly color: string
  readonly isStale: boolean
  readonly onBack: () => void
}

function DetailHeader({ ticker, companyName, color, isStale, onBack }: DetailHeaderProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sv-text-secondary hover:text-sv-text transition-colors text-sm"
      >
        <BackIcon />
        <span>Back</span>
      </button>

      <div className="flex items-center gap-2">
        <span
          className="inline-block w-3 h-3 rounded-full"
          style={{ backgroundColor: color }}
        />
        <h1 className="text-sv-text text-lg font-semibold">{ticker}</h1>
        <span className="text-sv-text-secondary text-sm">{companyName}</span>
      </div>

      {isStale && (
        <span className="flex items-center gap-1 text-sv-warning text-xs" title="Market data may be stale">
          <StaleWarningIcon />
          Stale data
        </span>
      )}
    </div>
  )
}

interface StatsPanelProps {
  readonly position: Position
  readonly quote: Quote | null
  readonly transactions: ReadonlyArray<Transaction>
}

function StatsPanel({ position, quote, transactions }: StatsPanelProps) {
  const currentPrice = quote?.price ?? 0
  const marketValue = currentPrice * position.totalShares
  const unrealizedGain = marketValue - position.costBasis * position.totalShares
  const unrealizedGainPct =
    position.costBasis > 0
      ? ((currentPrice - position.costBasis) / position.costBasis) * 100
      : 0
  const dayChange = (quote?.dayChange ?? 0) * position.totalShares
  const dayChangePct = quote?.dayChangePercent ?? 0
  const totalReturn = unrealizedGain + position.totalRealized
  const holdingPeriod = computeHoldingPeriod(transactions)

  const stats: ReadonlyArray<{ readonly label: string; readonly value: string; readonly colorClass: string }> = [
    { label: 'Current Price', value: formatCurrency(currentPrice), colorClass: 'text-sv-text' },
    { label: 'Shares Held', value: formatShares(position.totalShares), colorClass: 'text-sv-text' },
    { label: 'Avg Cost Basis', value: formatCurrency(position.costBasis), colorClass: 'text-sv-text' },
    { label: 'Market Value', value: formatCurrency(marketValue), colorClass: 'text-sv-text' },
    { label: 'Unrealized G/L', value: formatSignedCurrency(unrealizedGain), colorClass: getValueColorClass(unrealizedGain) },
    { label: 'Unrealized G/L %', value: formatPercent(unrealizedGainPct), colorClass: getValueColorClass(unrealizedGainPct) },
    { label: 'Day Change', value: formatSignedCurrency(dayChange), colorClass: getValueColorClass(dayChange) },
    { label: 'Day Change %', value: formatPercent(dayChangePct), colorClass: getValueColorClass(dayChangePct) },
    { label: 'Realized G/L', value: formatSignedCurrency(position.totalRealized), colorClass: getValueColorClass(position.totalRealized) },
    { label: 'Total Return', value: formatSignedCurrency(totalReturn), colorClass: getValueColorClass(totalReturn) },
    { label: 'Holding Period', value: holdingPeriod, colorClass: 'text-sv-text' }
  ]

  return (
    <div className="bg-sv-surface rounded-lg border border-sv-border p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sv-text text-sm font-semibold">Position Stats</h3>
        <MarketStatusBadge quote={quote} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
        {stats.map((stat) => (
          <div key={stat.label} className="flex justify-between items-baseline">
            <span className="text-sv-text-muted text-xs">{stat.label}</span>
            <span className={`font-mono tabular-nums text-xs ${stat.colorClass}`}>
              {stat.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface MarketStatusBadgeProps {
  readonly quote: Quote | null
}

function isQuoteError(quote: Quote): boolean {
  return quote.price === 0 && quote.previousClose === 0 && quote.dayChange === 0
}

function MarketStatusBadge({ quote }: MarketStatusBadgeProps) {
  if (quote === null) {
    return <span className="text-sv-text-muted text-xs">No data</span>
  }

  const isStale = quote.isStale ?? false
  const isOffline = quote.offline ?? false
  const hasError = isQuoteError(quote)

  if (hasError) {
    return (
      <span className="flex items-center gap-1 text-sv-negative text-xs" title="Unable to retrieve market data. The ticker may be delisted or invalid.">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-sv-negative" />
        Unavailable
      </span>
    )
  }

  if (isOffline) {
    return (
      <span className="flex items-center gap-1 text-sv-text-muted text-xs">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-sv-text-muted" />
        Offline
      </span>
    )
  }

  if (isStale) {
    return (
      <span className="flex items-center gap-1 text-sv-warning text-xs">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-sv-warning" />
        Stale
      </span>
    )
  }

  return (
    <span className="flex items-center gap-1 text-sv-positive text-xs">
      <span className="inline-block w-1.5 h-1.5 rounded-full bg-sv-positive" />
      Live
    </span>
  )
}
