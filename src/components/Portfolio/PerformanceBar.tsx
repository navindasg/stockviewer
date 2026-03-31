import { useMemo } from 'react'
import type { Position, Quote } from '../../types/index'
import { formatPercent } from '../../utils/formatters'

interface PerformanceBarProps {
  readonly positions: ReadonlyArray<Position>
  readonly quotes: Readonly<Record<string, Quote>>
}

interface PerformerEntry {
  readonly ticker: string
  readonly gainPercent: number
  readonly color: string
}

function computePerformers(
  positions: ReadonlyArray<Position>,
  quotes: Readonly<Record<string, Quote>>
): { readonly gainers: ReadonlyArray<PerformerEntry>; readonly losers: ReadonlyArray<PerformerEntry> } {
  const entries: ReadonlyArray<PerformerEntry> = positions
    .filter((p) => p.status === 'OPEN' && p.totalShares > 0 && quotes[p.ticker])
    .map((p) => {
      const quote = quotes[p.ticker]
      const costTotal = p.costBasis * p.totalShares
      const marketValue = quote.price * p.totalShares
      const gainPercent = costTotal > 0 ? ((marketValue - costTotal) / costTotal) * 100 : 0
      return { ticker: p.ticker, gainPercent, color: p.color }
    })

  const sorted = [...entries].sort((a, b) => b.gainPercent - a.gainPercent)
  const gainers = sorted.filter((e) => e.gainPercent > 0).slice(0, 3)
  const losers = sorted.filter((e) => e.gainPercent < 0).slice(-3).reverse()

  return { gainers, losers }
}

function PerformerItem({ entry }: { readonly entry: PerformerEntry }) {
  const colorClass = entry.gainPercent >= 0 ? 'text-sv-positive' : 'text-sv-negative'

  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <span
          className="w-2 h-2 rounded-full inline-block"
          style={{ backgroundColor: entry.color }}
        />
        <span className="text-sm font-semibold text-sv-text">{entry.ticker}</span>
      </div>
      <span className={`text-sm font-mono tabular-nums ${colorClass}`}>
        {formatPercent(entry.gainPercent)}
      </span>
    </div>
  )
}

export function PerformanceBar({ positions, quotes }: PerformanceBarProps) {
  const { gainers, losers } = useMemo(
    () => computePerformers(positions, quotes),
    [positions, quotes]
  )

  if (gainers.length === 0 && losers.length === 0) {
    return (
      <div className="rounded-lg bg-sv-surface border border-sv-border p-4 flex items-center justify-center h-full text-sv-text-muted text-sm">
        No performance data available
      </div>
    )
  }

  return (
    <div className="rounded-lg bg-sv-surface border border-sv-border p-4">
      <h3 className="text-sm font-semibold text-sv-text mb-3">Performance</h3>
      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="text-xs text-sv-positive uppercase tracking-wider mb-2">
            Top Gainers
          </p>
          {gainers.length > 0 ? (
            gainers.map((e) => <PerformerItem key={e.ticker} entry={e} />)
          ) : (
            <p className="text-xs text-sv-text-muted">No gainers</p>
          )}
        </div>
        <div>
          <p className="text-xs text-sv-negative uppercase tracking-wider mb-2">
            Top Losers
          </p>
          {losers.length > 0 ? (
            losers.map((e) => <PerformerItem key={e.ticker} entry={e} />)
          ) : (
            <p className="text-xs text-sv-text-muted">No losers</p>
          )}
        </div>
      </div>
    </div>
  )
}
