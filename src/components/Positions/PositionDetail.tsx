import { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { useAppStore } from '../../stores/appStore'
import { useMarketData } from '../../hooks/useMarketData'
import { useDividends, useDividendInfo } from '../../hooks/useDividends'
import { PriceChart } from '../Charts/PriceChart'
import { TransactionHistory } from './TransactionHistory'
import { TaxLotTable } from '../TaxLots/TaxLotTable'
import { CostBasisMethodSelector } from '../TaxLots/CostBasisMethodSelector'
import { DividendHistoryTable } from '../Dividends/DividendHistoryTable'
import { AddDividendModal } from '../Dividends/AddDividendModal'
import {
  formatCurrency,
  formatSignedCurrency,
  formatPercent,
  formatShares
} from '../../utils/formatters'
import type { Transaction, Quote, Position, CostBasisMethod } from '../../types/index'

interface PositionPickerProps {
  readonly positions: ReadonlyArray<Position>
  readonly setSelectedTicker: (ticker: string) => void
}

function PositionPicker({ positions, setSelectedTicker }: PositionPickerProps) {
  const quotes = useAppStore((state) => state.quotes)
  const openPositions = positions.filter((p) => p.status === 'OPEN')

  if (openPositions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-sv-text-muted text-sm">
        No open positions. Add a transaction to get started.
      </div>
    )
  }

  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-sv-text mb-4">Select a Position</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {openPositions.map((p) => {
          const quote = quotes[p.ticker]
          const price = quote?.price ?? 0
          const gainPct = p.costBasis > 0 ? ((price - p.costBasis) / p.costBasis) * 100 : 0
          const isPositive = gainPct >= 0

          return (
            <button
              key={p.ticker}
              type="button"
              onClick={() => setSelectedTicker(p.ticker)}
              className="flex items-center gap-3 p-3 rounded-lg bg-sv-surface border border-sv-border hover:bg-sv-elevated transition-colors cursor-pointer text-left"
            >
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: p.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className="font-semibold text-sv-text text-sm">{p.ticker}</span>
                  <span className="text-xs text-sv-text-muted truncate">{p.companyName}</span>
                </div>
                <div className="flex items-baseline gap-2 mt-0.5">
                  {quote && (
                    <span className="font-mono tabular-nums text-xs text-sv-text">
                      {formatCurrency(price)}
                    </span>
                  )}
                  <span className={`font-mono tabular-nums text-xs ${isPositive ? 'text-sv-positive' : 'text-sv-negative'}`}>
                    {isPositive ? '+' : ''}{formatPercent(gainPct)}
                  </span>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

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
    return <PositionPicker positions={positions} setSelectedTicker={setSelectedTicker} />
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
  const taxLots = useAppStore((s) => s.taxLots)
  const taxLotsLoading = useAppStore((s) => s.taxLotsLoading)
  const fetchTaxLots = useAppStore((s) => s.fetchTaxLots)
  const setCostBasisMethod = useAppStore((s) => s.setCostBasisMethod)
  const { dividends, isLoading: dividendsLoading } = useDividends(ticker)
  const dividendInfo = useDividendInfo(ticker)
  const [dividendModalOpen, setDividendModalOpen] = useState(false)

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

  useEffect(() => {
    fetchTaxLots(ticker).catch(() => {})
  }, [ticker, fetchTaxLots])

  const handleMethodChange = useCallback(async (_ticker: string, method: CostBasisMethod) => {
    await setCostBasisMethod(_ticker, method)
  }, [setCostBasisMethod])

  const totalDividendIncome = dividends.reduce((sum, d) => sum + d.totalAmount, 0)

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
        <div className="w-[60%] min-h-0 flex flex-col gap-4 overflow-auto">
          <PriceChart
            ticker={ticker}
            transactions={[...transactions]}
            costBasis={position.costBasis}
            color={position.color}
          />
          <TaxLotTable lots={taxLots} quote={quote} loading={taxLotsLoading} />

          {(dividends.length > 0 || dividendsLoading) && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-sv-text">Dividend History</h3>
                <button
                  type="button"
                  onClick={() => setDividendModalOpen(true)}
                  className="text-xs text-sv-accent hover:text-sv-accent/80 transition-colors cursor-pointer"
                >
                  + Record Dividend
                </button>
              </div>
              <DividendHistoryTable
                dividends={dividends}
                isLoading={dividendsLoading}
                showTicker={false}
              />
            </div>
          )}
        </div>

        <div className="w-[40%] flex flex-col gap-4 min-h-0 overflow-auto">
          <CostBasisMethodSelector
            ticker={ticker}
            currentMethod={position.costBasisMethod}
            onMethodChange={handleMethodChange}
          />
          <StatsPanel
            position={position}
            quote={quote}
            transactions={transactions}
            totalDividendIncome={totalDividendIncome}
            dividendInfo={dividendInfo}
          />
          {dividends.length === 0 && !dividendsLoading && (
            <button
              type="button"
              onClick={() => setDividendModalOpen(true)}
              className="w-full py-2 text-sm font-medium text-sv-accent border border-sv-border border-dashed rounded-md hover:bg-sv-elevated/50 transition-colors cursor-pointer"
            >
              + Record Dividend Payment
            </button>
          )}
          {txLoading ? (
            <div className="text-sv-text-muted text-sm text-center py-4">Loading transactions...</div>
          ) : (
            <TransactionHistory transactions={transactions} ticker={ticker} />
          )}
        </div>
      </div>

      <AddDividendModal
        isOpen={dividendModalOpen}
        onClose={() => setDividendModalOpen(false)}
        prefillTicker={ticker}
      />
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
  readonly totalDividendIncome?: number
  readonly dividendInfo?: import('../../types/index').DividendInfo | null
}

function StatsPanel({ position, quote, transactions, totalDividendIncome = 0, dividendInfo }: StatsPanelProps) {
  const currentPrice = quote?.price ?? 0
  const marketValue = currentPrice * position.totalShares
  const unrealizedGain = marketValue - position.costBasis * position.totalShares
  const unrealizedGainPct =
    position.costBasis > 0
      ? ((currentPrice - position.costBasis) / position.costBasis) * 100
      : 0
  const dayChange = (quote?.dayChange ?? 0) * position.totalShares
  const dayChangePct = quote?.dayChangePercent ?? 0
  const totalReturn = unrealizedGain + position.totalRealized + totalDividendIncome
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
    { label: 'Dividend Income', value: formatSignedCurrency(totalDividendIncome), colorClass: getValueColorClass(totalDividendIncome) },
    ...(dividendInfo?.dividendYield != null ? [
      { label: 'Dividend Yield', value: `${dividendInfo.dividendYield.toFixed(2)}%`, colorClass: 'text-sv-accent' as const }
    ] : []),
    ...(dividendInfo?.trailingAnnualDividendRate != null ? [
      { label: 'Annual Div Rate', value: formatCurrency(dividendInfo.trailingAnnualDividendRate), colorClass: 'text-sv-text' as const }
    ] : []),
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
